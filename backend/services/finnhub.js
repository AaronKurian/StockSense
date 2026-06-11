import { logApiUsage } from '../lib/apiUsage.js'

const BASE = 'https://finnhub.io/api/v1'

function getApiKey() {
  return process.env.FINNHUB_API_KEY || null
}

export function isFinnhubConfigured() {
  return !!getApiKey()
}

export async function fetchQuote(ticker, { source = 'unknown' } = {}) {
  const t = String(ticker).trim().toUpperCase()
  const key = getApiKey()
  if (!key) {
    return { ok: false, ticker: t, price: null, reason: 'finnhub_not_configured', source: 'finnhub' }
  }

  logApiUsage({ provider: 'finnhub', endpoint: 'quote', ticker: t, source })
  const url = `${BASE}/quote?symbol=${encodeURIComponent(t)}&token=${encodeURIComponent(key)}`
  let resp
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
  } catch (err) {
    return { ok: false, ticker: t, price: null, reason: 'network_error', source: 'finnhub', error: err.message }
  }

  const httpStatus = resp.status
  const json = await resp.json().catch(() => ({}))

  if (httpStatus === 429) {
    return { ok: false, ticker: t, price: null, reason: 'api_rate_limited', source: 'finnhub', httpStatus }
  }
  if (!resp.ok) {
    return { ok: false, ticker: t, price: null, reason: 'http_error', source: 'finnhub', httpStatus, message: json.error }
  }

  const price = Number(json.c)
  if (!Number.isFinite(price) || price <= 0) {
    const fallback = Number(json.pc)
    if (Number.isFinite(fallback) && fallback > 0) {
      const changePct = json.dp != null && Number.isFinite(Number(json.dp)) ? Number(json.dp) : null
      return {
        ok: true,
        ticker: t,
        source: 'finnhub',
        price: fallback,
        volume: null,
        change_percent: changePct,
        stale: true,
      }
    }
    return { ok: false, ticker: t, price: null, reason: 'no_price', source: 'finnhub', httpStatus }
  }

  return {
    ok: true,
    ticker: t,
    source: 'finnhub',
    price,
    volume: null,
    change_percent: json.dp != null && Number.isFinite(Number(json.dp)) ? Number(json.dp) : null,
    stale: false,
  }
}
