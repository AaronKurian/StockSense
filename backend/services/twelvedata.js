import fetch from 'node-fetch'
import { logApiUsage } from '../lib/apiUsage.js'

const BASE = 'https://api.twelvedata.com'

let rateLimitedUntil = 0

export function isTwelveDataRateLimited() {
  return Date.now() < rateLimitedUntil
}

export function clearTwelveDataRateLimit() {
  rateLimitedUntil = 0
}

function markRateLimited() {
  const tomorrow = new Date()
  tomorrow.setUTCHours(24, 0, 0, 0)
  rateLimitedUntil = tomorrow.getTime()
}

function getApiKey() {
  const key = process.env.TWELVEDATA_API_KEY
  if (!key) {
    const e = new Error('TWELVEDATA_API_KEY not configured')
    e.code = 'TWELVEDATA_CONFIG'
    throw e
  }
  return key
}

export async function fetchTimeSeries(ticker, interval = '1day', outputsize = 30, { source = 'unknown' } = {}) {
  const t = String(ticker).trim().toUpperCase()
  if (isTwelveDataRateLimited()) {
    const e = new Error('Twelve Data daily API credits exhausted')
    e.code = 'TWELVEDATA_RATE_LIMIT'
    throw e
  }
  logApiUsage({ provider: 'twelvedata', endpoint: 'time_series', ticker: t, source })
  const url = `${BASE}/time_series?symbol=${encodeURIComponent(t)}&interval=${interval}&outputsize=${outputsize}&apikey=${getApiKey()}`
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!resp.ok) {
    if (resp.status === 429) markRateLimited()
    throw new Error(`Twelve Data HTTP ${resp.status}: ${await resp.text().catch(() => '')}`)
  }
  const json = await resp.json()
  if (json.status === 'error') {
    if (json.code === 429) markRateLimited()
    throw new Error(`Twelve Data: ${json.message || JSON.stringify(json)}`)
  }
  return json
}

export async function fetchQuote(ticker, { source = 'unknown' } = {}) {
  const t = String(ticker).trim().toUpperCase()
  if (isTwelveDataRateLimited()) {
    return { ok: false, ticker: t, price: null, reason: 'api_rate_limited', source: 'twelvedata', httpStatus: 429 }
  }

  logApiUsage({ provider: 'twelvedata', endpoint: 'quote', ticker: t, source })
  const url = `${BASE}/quote?symbol=${encodeURIComponent(t)}&apikey=${getApiKey()}`
  let resp
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
  } catch (err) {
    return { ok: false, ticker: t, price: null, reason: 'network_error', source: 'twelvedata', error: err.message }
  }

  const httpStatus = resp.status
  const json = await resp.json().catch(() => ({}))

  if (httpStatus === 429 || json.code === 429) {
    markRateLimited()
    return { ok: false, ticker: t, price: null, reason: 'api_rate_limited', source: 'twelvedata', httpStatus: 429, message: json.message }
  }
  if (!resp.ok) {
    return { ok: false, ticker: t, price: null, reason: 'http_error', source: 'twelvedata', httpStatus, message: json.message }
  }
  if (json.status === 'error' || json.close == null) {
    return { ok: false, ticker: t, price: null, reason: json.status === 'error' ? 'api_error' : 'no_close', source: 'twelvedata', httpStatus, message: json.message }
  }

  return {
    ok: true,
    ticker: t,
    source: 'twelvedata',
    price: Number(json.close),
    volume: json.volume ? Number(json.volume) : null,
    change_percent: json.percent_change ? Number(json.percent_change) : null,
  }
}

export async function fetchQuotesBulk(tickers, { source = 'unknown' } = {}) {
  const symbols = [...new Set(tickers.map(t => String(t).trim().toUpperCase()).filter(Boolean))]
  if (!symbols.length) return new Map()
  if (symbols.length === 1) {
    const q = await fetchQuote(symbols[0], { source })
    return new Map([[symbols[0], q]])
  }
  if (isTwelveDataRateLimited()) {
    return new Map(symbols.map(t => [t, { ok: false, ticker: t, price: null, reason: 'api_rate_limited', source: 'twelvedata' }]))
  }

  logApiUsage({ provider: 'twelvedata', endpoint: 'quote', symbols, source })
  const url = `${BASE}/quote?symbol=${encodeURIComponent(symbols.join(','))}&apikey=${getApiKey()}`
  let resp
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(12000) })
  } catch (err) {
    return new Map(symbols.map(t => [t, { ok: false, ticker: t, price: null, reason: 'network_error', source: 'twelvedata', error: err.message }]))
  }

  const httpStatus = resp.status
  const json = await resp.json().catch(() => ({}))
  const result = new Map()

  if (httpStatus === 429 || json.code === 429) {
    markRateLimited()
    for (const t of symbols) result.set(t, { ok: false, ticker: t, price: null, reason: 'api_rate_limited', source: 'twelvedata', httpStatus: 429 })
    return result
  }

  if (json.status === 'error' && json.code !== undefined) {
    for (const t of symbols) result.set(t, { ok: false, ticker: t, price: null, reason: 'api_error', source: 'twelvedata', message: json.message })
    return result
  }

  for (const t of symbols) {
    const entry = json[t] || (json.symbol === t ? json : null)
    if (entry?.close != null) {
      result.set(t, {
        ok: true,
        ticker: t,
        source: 'twelvedata',
        price: Number(entry.close),
        volume: entry.volume ? Number(entry.volume) : null,
        change_percent: entry.percent_change ? Number(entry.percent_change) : null,
      })
    } else {
      result.set(t, { ok: false, ticker: t, price: null, reason: 'no_close', source: 'twelvedata' })
    }
  }
  return result
}
