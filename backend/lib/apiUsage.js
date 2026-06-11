import { getCollection } from '../config/db.js'
import { info } from './logger.js'

export function logApiUsage({ provider, endpoint, ticker = null, symbols = null, source = 'unknown' }) {
  const entry = {
    provider,
    endpoint,
    ticker: ticker ? String(ticker).toUpperCase() : null,
    symbols: symbols?.length ? symbols.map(s => String(s).toUpperCase()) : null,
    source,
    created_at: new Date(),
  }
  const col = getCollection('api_usage_log')
  if (col) {
    col.insertOne(entry).catch(() => {})
  }
  info('api_usage', `${provider}/${endpoint}`, { ticker: entry.ticker, symbols: entry.symbols?.length, source })
}

export async function getApiUsageSummary(hours = 24) {
  const col = getCollection('api_usage_log')
  if (!col) return { hours, total: 0, by_endpoint: [], by_source: [] }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000)
  const match = { created_at: { $gte: since } }

  const [byEndpoint, bySource, total] = await Promise.all([
    col.aggregate([
      { $match: match },
      { $group: { _id: { provider: '$provider', endpoint: '$endpoint' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, provider: '$_id.provider', endpoint: '$_id.endpoint', count: 1 } },
    ]).toArray(),
    col.aggregate([
      { $match: match },
      { $group: { _id: { provider: '$provider', endpoint: '$endpoint', source: '$source' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, provider: '$_id.provider', endpoint: '$_id.endpoint', source: '$_id.source', count: 1 } },
    ]).toArray(),
    col.countDocuments(match),
  ])

  return { hours, total, since: since.toISOString(), by_endpoint: byEndpoint, by_source: bySource }
}
