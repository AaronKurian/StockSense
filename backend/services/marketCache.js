import { getCollection } from '../config/db.js'

export const CACHE_TTL_MS = {
  quote: 60 * 1000,
  price_context: 30 * 60 * 1000,
  market_news: 60 * 60 * 1000,
}

export const EXECUTION_MAX_PRICE_AGE_MS = 30 * 60 * 1000

export async function getCachedEntry(collection, key) {
  const col = getCollection(collection)
  if (!col) return null
  const doc = await col.findOne({ key })
  if (!doc?.expires_at || new Date(doc.expires_at) <= new Date()) return null
  return doc
}

export async function setCachedEntry(collection, key, data, ttlMs) {
  const col = getCollection(collection)
  if (!col || data == null) return null
  const now = new Date()
  const doc = {
    key,
    data,
    generated_at: now,
    expires_at: new Date(now.getTime() + ttlMs),
  }
  await col.updateOne({ key }, { $set: doc }, { upsert: true })
  return doc
}

export async function getOrFetchCached(collection, key, ttlMs, fetchFn) {
  const cached = await getCachedEntry(collection, key)
  if (cached) return { data: cached.data, fromCache: true, generated_at: cached.generated_at }

  const data = await fetchFn()
  if (data != null) {
    await setCachedEntry(collection, key, data, ttlMs)
  }
  return { data, fromCache: false, generated_at: new Date() }
}
