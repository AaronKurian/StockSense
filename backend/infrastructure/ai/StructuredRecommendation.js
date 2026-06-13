export const VALID_SIGNALS = new Set(['BUY', 'HOLD', 'EXIT', 'WATCH', 'REBALANCE'])

export const STRUCTURED_RECOMMENDATION_SCHEMA = {
  type: 'object',
  required: ['signal', 'confidence', 'rationale', 'supporting_factors', 'risks'],
  properties: {
    signal: { type: 'string', enum: ['BUY', 'HOLD', 'EXIT', 'WATCH', 'REBALANCE'] },
    confidence: { type: 'number' },
    rationale: { type: 'string' },
    supporting_factors: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
}

export const STRUCTURED_RECOMMENDATION_SYSTEM_PROMPT = 'You are StockSense, an investment operations agent. Return only strict JSON matching the schema. Do not include markdown, code fences, extra keys or commentary. Use portfolio_context plus market data. Mention portfolio impact only when it materially affects the decision.'

export function buildStructuredRecommendationContext({ user_profile, portfolio, watchlist, latest_price, price_context, market_news, portfolio_context } = {}) {
  return JSON.stringify(
    { user_profile, portfolio, portfolio_context, watchlist, latest_price, price_context, market_news } ?? null,
    (_, v) => typeof v === 'bigint' ? v.toString() : v,
    2
  )
}

export function validateRecommendationDecision(output, providerName = 'AI provider') {
  if (!output || typeof output !== 'object' || Array.isArray(output)) throw new Error(`${providerName} returned invalid JSON`)
  if (!VALID_SIGNALS.has(output.signal)) throw new Error(`${providerName} returned invalid signal`)
  const confidence = Number(output.confidence)
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error(`${providerName} returned invalid confidence`)
  const rationale = typeof output.rationale === 'string' ? output.rationale.trim() : ''
  if (!rationale) throw new Error(`${providerName} returned empty rationale`)
  return {
    signal: output.signal,
    confidence,
    rationale,
    supporting_factors: Array.isArray(output.supporting_factors) ? output.supporting_factors.filter(f => typeof f === 'string' && f.trim()) : [],
    risks: Array.isArray(output.risks) ? output.risks.filter(r => typeof r === 'string' && r.trim()) : [],
  }
}

export function parseStrictJson(text, providerName = 'AI provider') {
  const raw = String(text || '').trim()
  if (!raw) throw new Error(`${providerName} returned empty response`)
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  try {
    return JSON.parse(stripped)
  } catch {
    const start = stripped.indexOf('{')
    const end = stripped.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1))
      } catch {}
    }
    throw new Error(`${providerName} returned non-JSON output`)
  }
}
