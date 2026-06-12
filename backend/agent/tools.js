import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import {
  get_latest_price, get_price_context, get_market_news,
  get_portfolio, get_watchlist, saveRecommendation, recordFeedback,
  getRecommendationsForUser
} from '../services/agent.js';
import { getMetadataBatch } from '../services/metadata.js';
import { resolveSector } from '../lib/sectors.js';
import { info as logInfo, warn as logWarn } from '../lib/logger.js';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:8080/mcp';
const MCP_DB_NAME = process.env.MONGODB_DB_NAME || 'stocksense';
const MCP_PROTOCOL_VERSION = '2025-03-26';
const MCP_TIMEOUT_MS = Number(process.env.MCP_TIMEOUT_MS ?? 15000);
const MCP_WRITE_ENABLED = process.env.MCP_WRITE_ENABLED !== 'false';
const MCP_RECOMMENDATION_COLLECTION = process.env.MCP_RECOMMENDATION_COLLECTION || 'recommendation_log';
const MCP_FEEDBACK_COLLECTION = process.env.MCP_FEEDBACK_COLLECTION || 'recommendation_feedback';

const MCP_INSERT_TOOL = 'insert-many';
const MCP_UPDATE_TOOL = 'update-many';
const MCP_ALLOWED_WRITE_TOOLS = new Set([MCP_INSERT_TOOL, MCP_UPDATE_TOOL]);
const MCP_ALLOWED_WRITE_COLLECTIONS = new Set([
  MCP_RECOMMENDATION_COLLECTION,
  MCP_FEEDBACK_COLLECTION,
]);

const VALID_SIGNALS = new Set(['BUY', 'HOLD', 'EXIT', 'WATCH', 'REBALANCE']);
const VALID_USER_ACTIONS = new Set(['confirmed', 'ignored', 'snoozed']);

let mcpSessionId = null;
let mcpToolNames = null;
let mcpInFlight = 0;

function logMcpSuccess(tool, data = {}) {
  logInfo('agent-tools', `[MCP] ${tool} success`, { tool, route: 'mcp', ...data });
}

function logMcpFailure(tool, err, data = {}) {
  logWarn('agent-tools', `[MCP] ${tool} failed`, { tool, route: 'mcp', error: err?.message || String(err), ...data });
}

function logFallbackUsage(tool, fallback, data = {}) {
  logInfo('agent-tools', `[MCP] ${tool} using fallback`, { tool, route: 'fallback', fallback, ...data });
}

function logMcpWrite(message, data = {}) {
  logInfo('agent-tools', `[MCP-WRITE] ${message}`, data);
}

function logMcpWriteWarn(message, err, data = {}) {
  logWarn('agent-tools', `[MCP-WRITE] ${message}`, {
    error: err?.message || String(err),
    ...data,
  });
}

const recommendationWriteSchema = z.object({
  userId: z.string().min(1),
  ticker: z.string().min(1),
  signal: z.enum(['BUY', 'HOLD', 'EXIT', 'WATCH', 'REBALANCE']),
  confidence: z.number().nullable().optional(),
  rationale: z.string().optional(),
  supporting_factors: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  user_action: z.enum(['confirmed', 'ignored', 'snoozed']).nullable().optional(),
}).strict();

const feedbackWriteSchema = z.object({
  recId: z.string().min(1),
  user_action: z.enum(['confirmed', 'ignored', 'snoozed']),
}).strict();

function normalizeExtendedJson(value) {
  if (Array.isArray(value)) return value.map(normalizeExtendedJson);
  if (!value || typeof value !== 'object') return value;

  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === '$oid') return value.$oid;
  if (keys.length === 1 && keys[0] === '$date') {
    const dateValue = value.$date;
    if (typeof dateValue === 'string') return dateValue;
    if (dateValue && typeof dateValue === 'object' && '$numberLong' in dateValue) {
      return new Date(Number(dateValue.$numberLong)).toISOString();
    }
    return dateValue;
  }
  if (keys.length === 1 && keys[0] === '$numberInt') return Number(value.$numberInt);
  if (keys.length === 1 && keys[0] === '$numberLong') return Number(value.$numberLong);
  if (keys.length === 1 && keys[0] === '$numberDouble') return Number(value.$numberDouble);

  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = normalizeExtendedJson(v);
  return out;
}

function parseSsePayload(text) {
  const chunks = text.split(/\n\n+/).map(chunk => chunk.trim()).filter(Boolean);
  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    const dataLines = chunks[i]
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart());
    if (!dataLines.length) continue;
    const data = dataLines.join('\n').trim();
    if (!data || data === '[DONE]') continue;
    try {
      return JSON.parse(data);
    } catch {
      // Continue looking for a parseable event payload.
    }
  }
  throw new Error('MCP response did not include a parseable SSE payload');
}

async function parseMcpResponse(response) {
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`MCP HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/event-stream')) {
    return parseSsePayload(bodyText);
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error('MCP returned a non-JSON response');
  }
}

async function postMcpRpc({ method, params = {}, sessionId = null }) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const startTime = Date.now();
  mcpInFlight += 1;
  logInfo('agent-tools', `[MCP-REQ] ${method} starting`, {
    method,
    mcp_in_flight: mcpInFlight,
    params_summary: method === 'tools/call'
      ? { tool: params?.name, collection: params?.arguments?.collection, filter_keys: params?.arguments?.filter ? Object.keys(params.arguments.filter) : [] }
      : Object.keys(params || {}),
  });

  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: AbortSignal.timeout(MCP_TIMEOUT_MS),
    });

    const payload = await parseMcpResponse(response);
    if (payload?.error) throw new Error(payload.error.message || `MCP ${method} failed`);

    const elapsed = Date.now() - startTime;
    logInfo('agent-tools', `[MCP-RES] ${method} completed`, {
      method,
      elapsed_ms: elapsed,
      mcp_in_flight: mcpInFlight - 1,
    });

    const nextSessionId = response.headers.get('mcp-session-id') || sessionId || null;
    return { payload, sessionId: nextSessionId };
  } finally {
    mcpInFlight -= 1;
  }
}

async function ensureMcpSession() {
  if (mcpSessionId) return mcpSessionId;
  const { sessionId } = await postMcpRpc({
    method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'stocksense-agent-tools', version: '1.0' },
    },
  });

  if (!sessionId) throw new Error('MCP initialize succeeded but no mcp-session-id was returned');
  mcpSessionId = sessionId;
  return mcpSessionId;
}

async function callMcp(method, params = {}) {
  const currentSession = await ensureMcpSession();
  try {
    const { payload, sessionId } = await postMcpRpc({ method, params, sessionId: currentSession });
    if (sessionId) mcpSessionId = sessionId;
    return payload?.result;
  } catch (err) {
    if (String(err?.message || '').toLowerCase().includes('session')) {
      mcpSessionId = null;
      const freshSession = await ensureMcpSession();
      const { payload, sessionId } = await postMcpRpc({ method, params, sessionId: freshSession });
      if (sessionId) mcpSessionId = sessionId;
      return payload?.result;
    }
    throw err;
  }
}

function extractStructuredDataFromToolResult(result) {
  logInfo('mcp-parser', 'diagnostic: start', {
    typeof_result: typeof result,
    keys_result: result ? Object.keys(result) : null,
    has_structuredContent: result?.structuredContent !== undefined
  });

  if (result?.structuredContent != null) {
    return normalizeExtendedJson(result.structuredContent);
  }

  const contentLen = result?.content?.length || 0;
  const textBlocks = (result?.content || [])
    .filter(item => item?.type === 'text')
    .map(item => String(item.text || ''));
  const joined = textBlocks.join('\n');

  logInfo('mcp-parser', 'diagnostic: content', {
    content_length: contentLen,
    text_blocks_length: textBlocks.length,
    joined_preview: joined.slice(0, 1000)
  });

  const untrustedRegex = /<untrusted-user-data-[^>]+>\s*([\s\S]*?)\s*<\/untrusted-user-data-[^>]+>/gi;
  logInfo('mcp-parser', 'diagnostic: regex pattern', {
    pattern: untrustedRegex.toString()
  });

  const allMatches = [...joined.matchAll(untrustedRegex)];

  // Pre-filter: only keep matches whose capture starts with [ or { (JSON).
  // The MCP warning text mentions the tag names inline (e.g. "between the <untrusted-user-data-xxx> and </untrusted-user-data-xxx> tags"),
  // which produces false-positive matches capturing " and ".  Filtering on JSON start eliminates those.
  const matches = allMatches.filter(m => {
    const cap = m?.[1]?.trim();
    return cap && (cap.startsWith('[') || cap.startsWith('{'));
  });

  logInfo('mcp-parser', 'diagnostic: matches', {
    all_matches_length: allMatches.length,
    filtered_matches_length: matches.length,
    first_match_preview: matches.length > 0 ? String(matches[0]?.[1]).slice(0, 200) : null
  });

  if (!matches.length) {
    throw new Error(
      `No JSON untrusted-user-data blocks found in MCP response. ` +
      `Total regex matches: ${allMatches.length}, joined length: ${joined.length}, ` +
      `first 2000 chars: ${joined.slice(0, 2000)}`
    );
  }

  for (const match of matches) {
    const candidate = match?.[1]?.trim();
    try {
      return normalizeExtendedJson(JSON.parse(candidate));
    } catch {
      // Try escaped JSON payloads (e.g. [{\"a\":1}]) that some MCP responses embed.
      try {
        const unescaped = candidate
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"');
        return normalizeExtendedJson(JSON.parse(unescaped));
      } catch {
        // Try next candidate block if present.
      }
    }
  }

  throw new Error('Failed to parse MCP tool data payload from untrusted-user-data block');
}

async function callMcpTool(name, args = {}) {
  return callMcp('tools/call', { name, arguments: args });
}

async function getMcpToolNames() {
  if (mcpToolNames) return mcpToolNames;
  const list = await callMcp('tools/list', {});
  mcpToolNames = new Set((list?.tools || []).map(tool => tool.name));
  return mcpToolNames;
}

async function mcpFind(collection, { filter = {}, sort = undefined, limit = 1000 } = {}) {
  const args = { database: MCP_DB_NAME, collection, filter, limit };
  if (sort) args.sort = sort;
  const result = await callMcpTool('find', args);
  const docs = extractStructuredDataFromToolResult(result);
  return Array.isArray(docs) ? docs : [];
}

function toMcpObjectIdMaybe(id) {
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) ? { $oid: id } : id;
}

function assertAllowedWriteCollection(collection) {
  if (!MCP_ALLOWED_WRITE_COLLECTIONS.has(collection)) {
    throw new Error(`[MCP-WRITE] blocked: collection '${collection}' is not allowed`);
  }
}

function assertAllowedWriteTool(name) {
  if (!MCP_ALLOWED_WRITE_TOOLS.has(name)) {
    throw new Error(`[MCP-WRITE] blocked: tool '${name}' is not allowed`);
  }
}

function assertNoOperatorInjection(value, path = 'root') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoOperatorInjection(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith('$')) {
      throw new Error(`[MCP-WRITE] blocked: mongo operator '${key}' is not allowed at ${path}`);
    }
    assertNoOperatorInjection(nested, `${path}.${key}`);
  }
}

function assertSafeWriteFilter(filter, { allowedKeys }) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw new Error('[MCP-WRITE] blocked: filter must be a non-array object');
  }

  const keys = Object.keys(filter);
  if (!keys.length) {
    throw new Error('[MCP-WRITE] blocked: empty filter is not allowed for update');
  }

  for (const key of keys) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`[MCP-WRITE] blocked: filter key '${key}' is not allowed`);
    }
    const value = filter[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const onlyOid = Object.keys(value).length === 1 && Object.prototype.hasOwnProperty.call(value, '$oid');
      if (!onlyOid) {
        throw new Error(`[MCP-WRITE] blocked: complex filter object is not allowed for key '${key}'`);
      }
    }
  }
}

async function ensureMcpWriteEnabled(requiredTools = []) {
  if (!MCP_WRITE_ENABLED) {
    throw new Error('[MCP-WRITE] disabled by MCP_WRITE_ENABLED=false');
  }

  const toolNames = await getMcpToolNames();
  const missing = requiredTools.filter(name => !toolNames.has(name));
  if (missing.length) {
    throw new Error(`[MCP-WRITE] required tool(s) unavailable: ${missing.join(', ')}`);
  }
}

async function guardedMcpInsertMany({ collection, documents, context = {} }) {
  assertAllowedWriteCollection(collection);
  assertAllowedWriteTool(MCP_INSERT_TOOL);
  if (!Array.isArray(documents) || !documents.length) {
    throw new Error('[MCP-WRITE] blocked: insert-many requires at least one document');
  }
  documents.forEach((doc, i) => {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      throw new Error(`[MCP-WRITE] blocked: document at index ${i} is invalid`);
    }
    assertNoOperatorInjection(doc, `document[${i}]`);
  });

  await ensureMcpWriteEnabled([MCP_INSERT_TOOL]);

  logMcpWrite('insert-many requested', {
    tool: MCP_INSERT_TOOL,
    collection,
    document_count: documents.length,
    ...context,
  });

  const result = await callMcpTool(MCP_INSERT_TOOL, {
    database: MCP_DB_NAME,
    collection,
    documents,
  });

  logMcpWrite('insert-many completed', {
    tool: MCP_INSERT_TOOL,
    collection,
    document_count: documents.length,
    ...context,
  });

  return result;
}

async function guardedMcpUpdateMany({ collection, filter, set, upsert = false, allowedFilterKeys = [], context = {} }) {
  assertAllowedWriteCollection(collection);
  assertAllowedWriteTool(MCP_UPDATE_TOOL);
  assertSafeWriteFilter(filter, { allowedKeys: allowedFilterKeys });
  if (!set || typeof set !== 'object' || Array.isArray(set)) {
    throw new Error('[MCP-WRITE] blocked: update set payload must be an object');
  }
  assertNoOperatorInjection(set, 'updateSet');

  await ensureMcpWriteEnabled([MCP_UPDATE_TOOL]);

  logMcpWrite('update-many requested', {
    tool: MCP_UPDATE_TOOL,
    collection,
    upsert,
    filter_keys: Object.keys(filter),
    set_keys: Object.keys(set),
    ...context,
  });

  const result = await callMcpTool(MCP_UPDATE_TOOL, {
    database: MCP_DB_NAME,
    collection,
    filter,
    update: { $set: set },
    upsert,
  });

  logMcpWrite('update-many completed', {
    tool: MCP_UPDATE_TOOL,
    collection,
    upsert,
    filter_keys: Object.keys(filter),
    set_keys: Object.keys(set),
    ...context,
  });

  return result;
}

async function getPortfolioViaMcp(userId) {
  const positions = await mcpFind('portfolio_positions', {
    filter: { userId },
    sort: { ticker: 1 },
    limit: 1000,
  });
  if (!positions.length) return [];

  const tickers = positions.map(position => position.ticker).filter(Boolean);
  const metaMap = await getMetadataBatch(tickers);
  return positions.map(position => ({
    ...position,
    sector: resolveSector(position.ticker, metaMap.get(position.ticker)?.sector, position.sector),
  }));
}

async function getWatchlistViaMcp(userId) {
  const watchlists = await mcpFind('watchlists', {
    filter: { userId },
    sort: { created_at: -1 },
    limit: 200,
  });
  if (!watchlists.length) return null;

  const watchlistIds = watchlists.map(w => toMcpObjectIdMaybe(w._id)).filter(Boolean);
  if (!watchlistIds.length) return watchlists;

  return mcpFind('watchlist_items', {
    filter: { watchlistId: { $in: watchlistIds } },
    sort: { ticker: 1 },
    limit: 5000,
  });
}

async function saveRecommendationViaMcp(params) {
  const parsed = recommendationWriteSchema.parse(params);
  if (!VALID_SIGNALS.has(parsed.signal)) throw new Error('invalid signal');
  if (parsed.user_action != null && !VALID_USER_ACTIONS.has(parsed.user_action)) throw new Error('invalid user_action');

  const ticker = String(parsed.ticker).toUpperCase();
  let confidence = parsed.confidence == null ? null : Number(parsed.confidence);
  if (confidence != null && !Number.isFinite(confidence)) throw new Error('invalid confidence');
  if (confidence != null && confidence > 1) confidence = confidence / 100;

  const doc = {
    userId: parsed.userId,
    ticker,
    signal: parsed.signal,
    confidence,
    prev_confidence: null,
    confidence_delta: null,
    rationale: parsed.rationale || '',
    supporting_factors: Array.isArray(parsed.supporting_factors) ? parsed.supporting_factors : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    status: 'generated',
    created_at: new Date(),
    user_action: parsed.user_action || null,
    approved_at: null,
    rejected_at: null,
    executed_at: null,
    expired_at: null,
    execution_mode: null,
    blocked_at: null,
    block_reason: null,
    monitoring_anchor: parsed.signal === 'HOLD' || parsed.signal === 'WATCH',
    checked_at: new Date(),
  };

  await guardedMcpInsertMany({
    collection: MCP_RECOMMENDATION_COLLECTION,
    documents: [doc],
    context: {
      operation: 'save_recommendation',
      userId: parsed.userId,
      ticker,
      signal: parsed.signal,
    },
  });

  const saved = await mcpFind(MCP_RECOMMENDATION_COLLECTION, {
    filter: { userId: parsed.userId, ticker, signal: parsed.signal, status: 'generated' },
    sort: { created_at: -1 },
    limit: 1,
  });

  const recommendation = saved[0] || { ...doc, _mcp_unverified: true };
  logMcpWrite('recommendation saved', {
    collection: MCP_RECOMMENDATION_COLLECTION,
    userId: parsed.userId,
    ticker,
    signal: parsed.signal,
    recId: recommendation?._id || null,
  });

  return recommendation;
}

async function recordFeedbackViaMcp(recId, userAction) {
  const parsed = feedbackWriteSchema.parse({ recId, user_action: userAction });
  if (!VALID_USER_ACTIONS.has(parsed.user_action)) throw new Error('invalid user_action');

  const recFilterId = toMcpObjectIdMaybe(parsed.recId);
  const existing = await mcpFind(MCP_RECOMMENDATION_COLLECTION, {
    filter: { _id: recFilterId },
    limit: 1,
  });
  const recommendation = existing[0];
  if (!recommendation) throw new Error('Recommendation not found');

  const user_action_at = new Date();

  await guardedMcpUpdateMany({
    collection: MCP_RECOMMENDATION_COLLECTION,
    filter: { _id: recFilterId },
    set: { user_action: parsed.user_action, user_action_at },
    upsert: false,
    allowedFilterKeys: ['_id'],
    context: {
      operation: 'record_feedback:update_recommendation',
      recId: parsed.recId,
      user_action: parsed.user_action,
    },
  });

  await guardedMcpUpdateMany({
    collection: MCP_FEEDBACK_COLLECTION,
    filter: { recId: parsed.recId },
    set: {
      recId: parsed.recId,
      userId: recommendation.userId || null,
      ticker: recommendation.ticker || null,
      signal: recommendation.signal || null,
      user_action: parsed.user_action,
      user_action_at,
      updated_at: new Date(),
      source: 'mcp',
    },
    upsert: true,
    allowedFilterKeys: ['recId'],
    context: {
      operation: 'record_feedback:upsert_feedback',
      recId: parsed.recId,
      user_action: parsed.user_action,
    },
  });

  const updated = await mcpFind(MCP_RECOMMENDATION_COLLECTION, {
    filter: { _id: recFilterId },
    limit: 1,
  });
  const updatedRecommendation = updated[0] || null;

  logMcpWrite('feedback recorded', {
    recId: parsed.recId,
    user_action: parsed.user_action,
    recommendation_collection: MCP_RECOMMENDATION_COLLECTION,
    feedback_collection: MCP_FEEDBACK_COLLECTION,
  });

  return updatedRecommendation;
}

export const getLatestPrice = new FunctionTool({
  name: 'get_latest_price',
  description: 'Get the latest cached price, volume and change percentage for a stock ticker. Updated in real-time via Twelve Data WebSocket.',
  parameters: z.object({
    ticker: z.string().describe('Stock ticker symbol, e.g. AAPL, MSFT, NVDA'),
  }),
  execute: async ({ ticker }) => {
    const doc = await get_latest_price(ticker.toUpperCase());
    return doc || { ticker: ticker.toUpperCase(), price: null, volume: null, change_percent: null, updated_at: null };
  },
});

export const getPriceContext = new FunctionTool({
  name: 'get_price_context',
  description: 'Get technical price context for a ticker: 7-day/30-day change, trend direction, 50DMA/200DMA position, volume spike detection. Uses Twelve Data time_series API.',
  parameters: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
  }),
  execute: async ({ ticker }) => {
    const ctx = await get_price_context(ticker.toUpperCase());
    return ctx || { current_price: null, seven_day_change_pct: null, thirty_day_change_pct: null, trend: null, above_50dma: null, above_200dma: null, volume_spike: null };
  },
});

export const getMarketNews = new FunctionTool({
  name: 'get_market_news',
  description: 'Get up to 5 recent news headlines for a stock ticker. Use this to understand current market sentiment and catalysts.',
  parameters: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
  }),
  execute: ({ ticker }) => get_market_news(ticker.toUpperCase()),
});

export const getPortfolio = new FunctionTool({
  name: 'get_portfolio',
  description: 'Get all portfolio positions for a user including ticker, quantity, average price and sector.',
  parameters: z.object({
    userId: z.string().describe('User identifier'),
  }),
  execute: async ({ userId }) => {
    try {
      const result = await getPortfolioViaMcp(userId);
      logMcpSuccess('get_portfolio', { userId, mcp_tool: 'find', collection: 'portfolio_positions', result_count: Array.isArray(result) ? result.length : null });
      return result || [];
    } catch (err) {
      logMcpFailure('get_portfolio', err, { userId, mcp_tool: 'find', collection: 'portfolio_positions' });
      logFallbackUsage('get_portfolio', 'get_portfolio', { userId });
      return (await get_portfolio(userId)) || [];
    }
  },
});

export const getWatchlist = new FunctionTool({
  name: 'get_watchlist',
  description: 'Get all watchlist items for a user. Returns tickers being actively monitored across all watchlists.',
  parameters: z.object({
    userId: z.string().describe('User identifier'),
  }),
  execute: async ({ userId }) => {
    try {
      const result = await getWatchlistViaMcp(userId);
      logMcpSuccess('get_watchlist', { userId, mcp_tool: 'find', collections: ['watchlists', 'watchlist_items'], result_count: Array.isArray(result) ? result.length : null });
      return result || [];
    } catch (err) {
      logMcpFailure('get_watchlist', err, { userId, mcp_tool: 'find', collections: ['watchlists', 'watchlist_items'] });
      logFallbackUsage('get_watchlist', 'get_watchlist', { userId });
      return (await get_watchlist(userId)) || [];
    }
  },
});

export const saveRec = new FunctionTool({
  name: 'save_recommendation',
  description: 'Save an AI-generated recommendation to the recommendation_log. Call this after completing analysis to persist the signal. Valid signals: BUY, HOLD, EXIT, WATCH, REBALANCE.',
  parameters: z.object({
    userId: z.string().describe('User identifier'),
    ticker: z.string().describe('Stock ticker symbol'),
    signal: z.enum(['BUY', 'HOLD', 'EXIT', 'WATCH', 'REBALANCE']).describe('Recommendation signal'),
    confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
    rationale: z.string().describe('Explanation of the recommendation'),
    supporting_factors: z.array(z.string()).describe('Evidence supporting the recommendation'),
    risks: z.array(z.string()).describe('Identified risks'),
  }),
  execute: async (params) => {
    try {
      const result = await saveRecommendationViaMcp(params);
      logMcpSuccess('save_recommendation', { userId: params.userId, ticker: params.ticker, signal: params.signal, mcp_tool: 'write-adapter' });
      return result;
    } catch (err) {
      logMcpWriteWarn('fallback used', err, {
        operation: 'save_recommendation',
        fallback: 'saveRecommendation',
        userId: params.userId,
        ticker: params.ticker,
        signal: params.signal,
      });
      logMcpFailure('save_recommendation', err, { userId: params.userId, ticker: params.ticker, signal: params.signal, mcp_tool: 'write-adapter' });
      logFallbackUsage('save_recommendation', 'saveRecommendation', { userId: params.userId, ticker: params.ticker, signal: params.signal });
      return saveRecommendation(params);
    }
  },
});

async function getRecommendationsViaMcp(userId, { limit = 20, signal = null, status = null, ticker = null } = {}) {
  const filter = { userId };
  if (signal) filter.signal = signal;
  if (status) filter.status = status;
  if (ticker) filter.ticker = String(ticker).toUpperCase();

  const docs = await mcpFind(MCP_RECOMMENDATION_COLLECTION, {
    filter,
    sort: { created_at: -1 },
    limit: Math.min(Number(limit), 200),
  });

  return docs;
}

export const getRecommendations = new FunctionTool({
  name: 'get_recommendations',
  description: 'Retrieve recommendation history from the recommendation_log collection. Use this to answer questions about past recommendations, compare current vs past signals, explain why a recommendation was made, or review recommendation history for a user. Can filter by ticker, signal, or status.',
  parameters: z.object({
    userId: z.string().describe('User identifier'),
    limit: z.number().min(1).max(200).optional().describe('Maximum number of recommendations to return (default 20, max 200)'),
    signal: z.enum(['BUY', 'HOLD', 'EXIT', 'WATCH', 'REBALANCE']).optional().describe('Filter by signal type'),
    status: z.enum(['generated', 'approved', 'rejected', 'executed', 'expired', 'blocked']).optional().describe('Filter by recommendation status'),
    ticker: z.string().optional().describe('Filter by stock ticker symbol (e.g. AMD, AAPL)'),
  }),
  execute: async (params) => {
    try {
      const result = await getRecommendationsViaMcp(params.userId, {
        limit: params.limit,
        signal: params.signal,
        status: params.status,
        ticker: params.ticker,
      });
      logMcpSuccess('get_recommendations', {
        userId: params.userId,
        mcp_tool: 'find',
        collection: MCP_RECOMMENDATION_COLLECTION,
        result_count: Array.isArray(result) ? result.length : null,
        filters: { signal: params.signal, status: params.status, ticker: params.ticker },
      });
      return result || [];
    } catch (err) {
      logMcpFailure('get_recommendations', err, {
        userId: params.userId,
        mcp_tool: 'find',
        collection: MCP_RECOMMENDATION_COLLECTION,
        filters: { signal: params.signal, status: params.status, ticker: params.ticker },
      });
      logFallbackUsage('get_recommendations', 'getRecommendationsForUser', { userId: params.userId });
      return (await getRecommendationsForUser(params.userId, {
        limit: params.limit || 20,
        signal: params.signal,
        status: params.status,
        ticker: params.ticker,
      })) || [];
    }
  },
});

export const recordFb = new FunctionTool({
  name: 'record_feedback',
  description: 'Record user feedback on a recommendation. This feeds the learning loop. Valid actions: confirmed, ignored, snoozed.',
  parameters: z.object({
    recId: z.string().describe('MongoDB _id of the recommendation'),
    user_action: z.enum(['confirmed', 'ignored', 'snoozed']).describe('User action on the recommendation'),
  }),
  execute: async ({ recId, user_action }) => {
    try {
      const result = await recordFeedbackViaMcp(recId, user_action);
      logMcpSuccess('record_feedback', { recId, user_action, mcp_tool: 'write-adapter' });
      return result;
    } catch (err) {
      logMcpWriteWarn('fallback used', err, {
        operation: 'record_feedback',
        fallback: 'recordFeedback',
        recId,
        user_action,
      });
      logMcpFailure('record_feedback', err, { recId, user_action, mcp_tool: 'write-adapter' });
      logFallbackUsage('record_feedback', 'recordFeedback', { recId, user_action });
      return recordFeedback(recId, user_action);
    }
  },
});

export const allTools = [getLatestPrice, getPriceContext, getMarketNews, getPortfolio, getWatchlist, getRecommendations, saveRec, recordFb];
