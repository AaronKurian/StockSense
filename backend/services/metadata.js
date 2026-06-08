import { getCollection } from '../config/db.js'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const BASE = 'https://api.twelvedata.com'

export async function getTickerMetadata(ticker) {
  const t = String(ticker).toUpperCase()
  const col = getCollection('ticker_metadata')
  if (!col) return { ticker: t, sector: 'Unknown', industry: 'Unknown', name: t, market_cap: null, exchange: 'US' }

  const cached = await col.findOne({ ticker: t })
  if (cached && (Date.now() - new Date(cached.updated_at).getTime()) < CACHE_TTL_MS) return cached

  const doc = await fetchFromTwelveData(t)
  await col.updateOne({ ticker: t }, { $set: doc }, { upsert: true })
  return doc
}

export async function getMetadataBatch(tickers) {
  if (!tickers.length) return new Map()
  const col = getCollection('ticker_metadata')
  const result = new Map()

  if (col) {
    const cached = await col.find({ ticker: { $in: tickers } }).toArray()
    for (const doc of cached) {
      if ((Date.now() - new Date(doc.updated_at).getTime()) < CACHE_TTL_MS) result.set(doc.ticker, doc)
    }
  }

  for (const t of tickers) {
    if (!result.has(t)) {
      const meta = await getTickerMetadata(t)
      result.set(t, meta)
    }
  }
  return result
}

async function fetchFromTwelveData(ticker) {
  const fallback = { ticker, sector: 'Unknown', industry: 'Unknown', name: ticker, market_cap: null, exchange: 'US', updated_at: new Date() }
  const key = process.env.TWELVEDATA_API_KEY
  if (!key) return fallback

  try {
    const resp = await fetch(`${BASE}/profile?symbol=${encodeURIComponent(ticker)}&apikey=${key}`, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return fallback
    const json = await resp.json()
    if (!json || json.status === 'error') return fallback
    return {
      ticker,
      name: json.name || ticker,
      sector: json.sector || 'Unknown',
      industry: json.industry || 'Unknown',
      market_cap: json.market_capitalization ? Number(json.market_capitalization) : null,
      exchange: json.exchange || 'US',
      updated_at: new Date()
    }
  } catch {
    return fallback
  }
}
