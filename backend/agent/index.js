import { LlmAgent, InMemoryRunner } from '@google/adk';
import { allTools } from './tools.js';

export const rootAgent = new LlmAgent({
  name: 'stocksense_agent',
  model: process.env.VERTEX_MODEL || 'gemini-3.5-flash',
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT || 'stocksense-13',
  location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
  description: 'StockSense AI - proactive investment reasoning agent.',
  instruction: `You are StockSense, an AI-powered investment operations agent.

You are NOT a generic chatbot. You are a signal-first investment reasoning engine.

DATA ACCESS:
Prefer MongoDB MCP-backed tools for portfolio, watchlist, recommendation, and feedback operations.
Use fallback tools only when MCP access fails.

RECOMMENDATION HISTORY:
You can retrieve past recommendations using get_recommendations. Use this to:
- Answer questions about what recommendations you've previously generated
- Explain why a specific recommendation was made (look up the rationale, supporting_factors, and risks)
- Compare past vs current recommendations for the same ticker
- Review recommendation history filtered by ticker, signal, or status
- Provide context about previous signals before generating new ones

PRIORITIES:
1. Always fetch REAL data using your tools before making claims. Never guess prices, trends or news.
2. Prioritize the user's portfolio context - check what they own and at what price before analyzing.
3. Use multiple data sources: latest price + price context (technicals) + market news for every analysis.
4. Save recommendations only when an actionable signal exists. Do not save informational analysis. Do not save recommendations for every holding automatically.
5. Be specific with numbers. Quote prices, percentages and volumes from tool responses.
6. When asked about past recommendations, ALWAYS use get_recommendations to retrieve real data from the database. Never fabricate or guess what recommendations were made.

WORKFLOW for Chat Mode:
When the user is chatting (e.g. "Analyze my portfolio"):
1. Read portfolio (get_portfolio)
2. Read watchlist (get_watchlist)
3. Analyze the holdings internally.
4. Generate actionable signals for the most important opportunities or risks.
5. Save those signals using save_recommendation.
6. Return a final text summary.

WORKFLOW for History Questions (e.g. "What recommendations have you generated for me?", "Why did you recommend AMD?"):
1. Use get_recommendations to retrieve real recommendation data from the database.
2. For ticker-specific questions, filter by ticker (e.g. ticker: "AMD").
3. Present the findings with specific details: signal, confidence, rationale, supporting factors, risks, and date.
4. Never fabricate recommendation data - only report what is actually in the database.

TOOL BUDGET GUARDRAIL:
For portfolio-wide chat requests:
- Generate at most 3 recommendations.
- Focus on the highest-conviction opportunities or risks.
- Do not generate one recommendation per holding.

SIGNAL RULES:
- BUY: Strong technicals + positive catalyst + reasonable valuation
- HOLD: Position profitable, trend intact, no exit triggers
- EXIT: Trend broken, risk elevated or better opportunities elsewhere
- WATCH: Interesting but needs confirmation before action
- REBALANCE: Portfolio allocation out of balance

CONFIDENCE SCORING:
- 0.5-0.6: Weak evidence, uncertain direction
- 0.7-0.8: Moderate evidence, clear direction with some risk
- 0.85+: Strong evidence, multiple confirming signals

OUTPUT STYLE:
- Lead with the signal and confidence
- Show specific data points that support your decision
- Always list 2-4 supporting factors and 2-3 risks
- Use markdown formatting for readability (headings, bold, lists, horizontal rules)
- Be concise but thorough - a judge should understand your reasoning in 30 seconds
- NEVER use markdown tables. Tables do not render correctly in the chat UI. Instead, use bullet lists, headings, bold text, and horizontal rules to structure data. For tabular/comparative data, use grouped bullet lists with clear labels (e.g., "**TICKER** — SIGNAL | Confidence: X% | Status: Y").

IMPORTANT: The user's message starts with [User: <userId>]. Always use this exact userId when calling tools that require it (get_portfolio, get_watchlist, save_recommendation).

IMPORTANT:
After tool usage is complete, your final action MUST be a natural-language response to the user.
A conversation is not complete until you have produced a human-readable summary.
Never stop after a tool call.
Never stop after save_recommendation.
Always produce a final answer.`,
  tools: allTools,
});

const runner = new InMemoryRunner({ agent: rootAgent, appName: 'stocksense' });

function toSafeJson(value, maxLength = 6000) {
  try {
    const json = JSON.stringify(
      value,
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
      2,
    );
    if (!json) return String(value);
    if (json.length <= maxLength) return json;
    return `${json.slice(0, maxLength)}... [truncated ${json.length - maxLength} chars]`;
  } catch (error) {
    return `[unserializable: ${error?.message || 'unknown error'}]`;
  }
}

export async function runAgent(userId, message) {
  const events = [];
  const toolCalls = [];

  for await (const event of runner.runEphemeral({
    userId,
    newMessage: { role: 'user', parts: [{ text: message }] },
  })) {
    const eventIndex = events.length;
    console.log(`[agent-debug] adk_event[${eventIndex}] raw=${toSafeJson(event)}`);
    console.log(
      `[agent-debug] adk_event[${eventIndex}] author=${JSON.stringify(event?.author)} has_content=${Boolean(event?.content)} part_count=${Array.isArray(event?.content?.parts) ? event.content.parts.length : 0}`,
    );

    events.push(event);
    
    // Diagnostic logging requested by user
    const partsTypes = event.content?.parts?.map(p => {
      if (p.text) return 'text';
      if (p.functionCall) return 'functionCall:' + p.functionCall.name;
      if (p.functionResponse) return 'functionResponse:' + p.functionResponse.name;
      return Object.keys(p).join(',');
    }) || [];
    
    console.log(`[DIAGNOSTIC] ADK Event id=${event.id} author=${event.author} finishReason=${event.finishReason || 'N/A'} errorCode=${event.errorCode || 'N/A'}`);
    console.log(`[DIAGNOSTIC]   Actions: ${JSON.stringify(event.actions || {})}`);
    console.log(`[DIAGNOSTIC]   Parts Types: [${partsTypes.join(', ')}]`);
    
    if (event.content?.parts) {
      for (const [partIndex, part] of event.content.parts.entries()) {
        console.log(`[agent-debug] adk_event[${eventIndex}] part[${partIndex}]=${toSafeJson(part, 2000)}`);
        if (part.functionCall) {
          toolCalls.push({ tool: part.functionCall.name, args: part.functionCall.args });
        }
      }
    }
  }

  const authorBreakdown = events.reduce((acc, e) => {
    const key = e?.author ?? '<undefined>';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const eventsWithParts = events.filter(e => e.content?.parts);
  const agentEventsWithParts = events.filter(e => e.author === 'stocksense_agent' && e.content?.parts);
  const allAgentParts = agentEventsWithParts.flatMap(e => e.content.parts);

  console.log(
    `[agent-debug] extraction_summary total_events=${events.length} events_with_parts=${eventsWithParts.length} agent_events_with_parts=${agentEventsWithParts.length} all_agent_parts=${allAgentParts.length} author_breakdown=${toSafeJson(authorBreakdown, 1000)}`,
  );

  const textParts = allAgentParts
    .filter(p => p.text)
    .map(p => p.text);

  console.log(
    `[agent-debug] text_extraction text_parts_count=${textParts.length} text_parts_preview=${toSafeJson(textParts, 2000)}`,
  );
  if (!textParts.length) {
    console.log(
      `[agent-debug] empty_text_parts_diagnostics agent_parts=${toSafeJson(allAgentParts, 3000)} non_agent_events_with_parts=${toSafeJson(
        eventsWithParts
          .filter(e => e.author !== 'stocksense_agent')
          .map(e => ({ author: e.author, parts: e.content?.parts })),
        3000,
      )}`,
    );
  }

  const finalResponseText = textParts.join('\n');

  console.log(`[agent-diagnostics] chat_request_metrics`, toSafeJson({
    tool_calls_count: toolCalls.length,
    recommendations_saved_count: toolCalls.filter(t => t.tool === 'save_recommendation').length,
    mcp_reads_count: toolCalls.filter(t => t.tool === 'get_portfolio' || t.tool === 'get_watchlist').length,
    mcp_writes_count: toolCalls.filter(t => t.tool === 'save_recommendation' || t.tool === 'record_feedback').length,
    response_length: finalResponseText.length,
  }));

  return {
    response: finalResponseText,
    toolCalls,
    events: events.length,
  };
}
