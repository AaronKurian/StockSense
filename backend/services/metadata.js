import { getCollection } from '../config/db.js'
import { resolveSector } from '../lib/sectors.js'
import { logApiUsage } from '../lib/apiUsage.js'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const BASE = 'https://api.twelvedata.com'

function withResolvedSector(doc) {
  if (!doc) return doc
  return { ...doc, sector: resolveSector(doc.ticker, doc.sector, null) }
}

export async function getTickerMetadata(ticker) {
  const t = String(ticker).toUpperCase()
  const col = getCollection('ticker_metadata')
  if (!col) return withResolvedSector({ ticker: t, sector: 'Unknown', industry: 'Unknown', name: t, market_cap: null, exchange: 'US' })

  const cached = await col.findOne({ ticker: t })
  if (cached && (Date.now() - new Date(cached.updated_at).getTime()) < CACHE_TTL_MS) return withResolvedSector(cached)

  const doc = await fetchFromTwelveData(t)
  const resolved = withResolvedSector(doc)
  await col.updateOne({ ticker: t }, { $set: resolved }, { upsert: true })
  return resolved
}

export async function repairUserSectors(userId) {
  const posCol = getCollection('portfolio_positions')
  const itemsCol = getCollection('watchlist_items')
  const wlCol = getCollection('watchlists')
  if (!posCol || !userId) return { positions: 0, watchlist: 0 }

  const positions = await posCol.find({ userId }).toArray()
  const tickers = new Set(positions.map(p => p.ticker))
  const watchlists = wlCol ? await wlCol.find({ userId }).toArray() : []
  const items = itemsCol && watchlists.length
    ? await itemsCol.find({ watchlistId: { $in: watchlists.map(w => w._id) } }).toArray()
    : []
  for (const i of items) tickers.add(i.ticker)

  const metaMap = tickers.size ? await getMetadataBatch([...tickers]) : new Map()
  let positionsUpdated = 0
  let watchlistUpdated = 0

  for (const p of positions) {
    const sector = resolveSector(p.ticker, metaMap.get(p.ticker)?.sector, p.sector)
    if (sector !== p.sector && sector !== 'Unknown') {
      await posCol.updateOne({ _id: p._id }, { $set: { sector, updated_at: new Date() } })
      positionsUpdated++
    }
  }
  if (itemsCol) {
    for (const i of items) {
      const sector = resolveSector(i.ticker, metaMap.get(i.ticker)?.sector, i.sector)
      if (sector !== i.sector && sector !== 'Unknown') {
        await itemsCol.updateOne({ _id: i._id }, { $set: { sector } })
        watchlistUpdated++
      }
    }
  }
  return { positions: positionsUpdated, watchlist: watchlistUpdated }
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
    } else {
      result.set(t, withResolvedSector(result.get(t)))
    }
  }
  return result
}

async function fetchFromTwelveData(ticker) {
  const fallback = withResolvedSector({ ticker, sector: 'Unknown', industry: 'Unknown', name: ticker, market_cap: null, exchange: 'US', updated_at: new Date() })
  const key = process.env.TWELVEDATA_API_KEY
  if (!key) return fallback

  try {
    logApiUsage({ provider: 'twelvedata', endpoint: 'profile', ticker, source: 'metadata' })
    const resp = await fetch(`${BASE}/profile?symbol=${encodeURIComponent(ticker)}&apikey=${key}`, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return fallback
    const json = await resp.json()
    if (!json || json.status === 'error') return fallback
    const raw = {
      ticker,
      name: json.name || ticker,
      sector: json.sector || 'Unknown',
      industry: json.industry || 'Unknown',
      market_cap: json.market_capitalization ? Number(json.market_capitalization) : null,
      exchange: json.exchange || 'US',
      updated_at: new Date()
    }
    return withResolvedSector(raw)
  } catch {
    return fallback
  }
}
