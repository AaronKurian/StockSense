import { LlmAgent, InMemoryRunner } from '@google/adk'
import { allTools } from '../../../agent/tools.js'

function toSafeJson(value, maxLength = 6000) {
  try {
    const json = JSON.stringify(
      value,
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
      2,
    )
    if (!json) return String(value)
    if (json.length <= maxLength) return json
    return `${json.slice(0, maxLength)}... [truncated ${json.length - maxLength} chars]`
  } catch (error) {
    return `[unserializable: ${error?.message || 'unknown error'}]`
  }
}

export class GeminiProvider {
  constructor() {
    this.agent = new LlmAgent({
      name: 'stocksense_agent',
      model: process.env.VERTEX_MODEL || 'gemini-3.5-flash',
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT || 'stocksense-13',
      location: process.env.GOOGLE_CLOUD_LOCATION || 'global',
      description: 'StockSense AI - proactive investment reasoning agent.',
      instruction: `You are StockSense, an AI-powered investment operations agent.

You are NOT a generic chatbot. You are a signal-first investment reasoning engine.

DATA ACCESS:
Use tools for portfolio, watchlist, recommendation, feedback, price, and market operations.
MongoDB MCP may be available as an optional adapter, but direct business tools are authoritative.

RECOMMENDATION HISTORY:
You can retrieve past recommendations using get_recommendations. Use this to:
- Answer questions about what recommendations you've previously generated
- Explain why a specific recommendation was made
- Compare past vs current recommendations for the same ticker
- Review recommendation history filtered by ticker, signal, or status

PRIORITIES:
1. Always fetch REAL data using your tools before making claims. Never guess prices, trends or news.
2. Prioritize the user's portfolio context - check what they own and at what price before analyzing.
3. Use latest price + price context + market news for investment analysis.
4. Save recommendations only when an actionable signal exists. Do not save informational analysis.
5. Be specific with numbers. Quote prices, percentages and volumes from tool responses.
6. When asked about past recommendations, ALWAYS use get_recommendations.

WORKFLOW for Manual Analysis Mode:
1. Read portfolio and watchlist when portfolio context matters.
2. Analyze internally.
3. Generate actionable signals for the most important opportunities or risks.
4. Save those signals using save_recommendation.
5. Return a final text summary.

TOOL BUDGET GUARDRAIL:
For portfolio-wide manual requests, generate at most 3 recommendations.

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
- Use markdown formatting for readability
- NEVER use markdown tables

IMPORTANT: The user's message starts with [User: <userId>]. Always use this exact userId when calling tools.
IMPORTANT: Always produce a final natural-language answer after tool usage.`,
      tools: allTools,
    })
    this.runner = new InMemoryRunner({ agent: this.agent, appName: 'stocksense' })
  }

  async generate({ userId, message }) {
    const events = []
    const toolCalls = []

    for await (const event of this.runner.runEphemeral({
      userId,
      newMessage: { role: 'user', parts: [{ text: message }] },
    })) {
      events.push(event)
      if (process.env.LOG_LEVEL === 'debug') {
        console.log(`[agent-debug] adk_event=${toSafeJson(event, 3000)}`)
      }

      if (event.content?.parts) {
        for (const part of event.content.parts) {
          if (part.functionCall) {
            toolCalls.push({ tool: part.functionCall.name, args: part.functionCall.args })
          }
        }
      }
    }

    const textParts = events
      .filter(e => e.author === 'stocksense_agent' && e.content?.parts)
      .flatMap(e => e.content.parts)
      .filter(p => p.text)
      .map(p => p.text)

    const finalResponseText = textParts.join('\n')

    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[agent-diagnostics] ${toSafeJson({
        tool_calls_count: toolCalls.length,
        recommendations_saved_count: toolCalls.filter(t => t.tool === 'save_recommendation').length,
        response_length: finalResponseText.length,
      })}`)
    }

    return {
      response: finalResponseText,
      toolCalls,
      events: events.length,
    }
  }

  async *stream({ userId, message }) {
    const toolCalls = []

    try {
      yield { progress: 'Starting investment analysis...' }
      for await (const event of this.runner.runEphemeral({
        userId,
        newMessage: { role: 'user', parts: [{ text: message }] },
      })) {
        if (event.author === 'stocksense_agent' && event.content?.parts) {
          for (const part of event.content.parts) {
            if (part.text) yield { text: part.text, event: { type: 'text_delta', text: part.text } }
            if (part.functionCall) {
              const tc = { tool: part.functionCall.name, args: part.functionCall.args }
              toolCalls.push(tc)
              yield {
                toolCall: tc,
                event: { type: 'tool_start', tool: tc.tool, args: tc.args },
                progress: `Running ${tc.tool}...`,
              }
            }
          }
        }
      }

      yield { done: true, toolCalls, event: { type: 'done' } }
    } catch (err) {
      yield { error: err.message, event: { type: 'error', error: err.message } }
      yield { done: true, toolCalls, event: { type: 'done' } }
    }
  }
}

export const geminiProvider = new GeminiProvider()
