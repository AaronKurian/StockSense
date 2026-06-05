import { getCollection } from '../config/db.js'

function normalizeTicker(ticker) {
  if (!ticker) throw new Error('ticker is required')
  return String(ticker).trim().toUpperCase()
}

export async function upsertLatestPrice(ticker, data = {}) {
  const col = getCollection('latest_prices')
  if (!col) throw new Error('MongoDB not connected')

  const t = normalizeTicker(ticker)
  const set = { ticker: t, updated_at: data.updated_at ? new Date(data.updated_at) : new Date() }
  if (data.price != null)          set.price          = Number(data.price)
  if (data.volume != null)         set.volume         = Number(data.volume)
  if (data.change_percent != null) set.change_percent = Number(data.change_percent)

  await col.updateOne({ ticker: t }, { $set: set }, { upsert: true })
  return { ticker: t, ...set }
}

export async function getLatestPrice(ticker) {
  const col = getCollection('latest_prices')
  if (!col) throw new Error('MongoDB not connected')
  return await col.findOne({ ticker: normalizeTicker(ticker) }) || null
}

export async function getLatestPricesBatch(tickers) {
  const col = getCollection('latest_prices')
  if (!col) throw new Error('MongoDB not connected')
  if (!tickers.length) return new Map()
  const docs = await col.find({ ticker: { $in: tickers.map(t => normalizeTicker(t)) } }).toArray()
  return new Map(docs.map(d => [d.ticker, d]))
}
