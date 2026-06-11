import { getCollection } from '../config/db.js'
import { info, warn } from '../lib/logger.js'
import { fetchQuote as fetchTwelveDataQuote, fetchQuotesBulk, isTwelveDataRateLimited } from './twelvedata.js'
import { fetchQuote as fetchFinnhubQuote, isFinnhubConfigured } from './finnhub.js'
import { CACHE_TTL_MS, EXECUTION_MAX_PRICE_AGE_MS } from './marketCache.js'

const REST_BACKFILL_DELAY_MS = 350

function normalizeTicker(ticker) {
  if (!ticker) throw new Error('ticker is required')
  return String(ticker).trim().toUpperCase()
}

function isValidPrice(price) {
  return price != null && Number.isFinite(Number(price)) && Number(price) > 0
}

export function getPriceAgeMinutes(doc) {
  if (!doc?.updated_at) return Infinity
  return (Date.now() - new Date(doc.updated_at).getTime()) / 60000
}

export function isExecutionPriceStale(doc, maxMinutes = EXECUTION_MAX_PRICE_AGE_MS / 60000) {
  return getPriceAgeMinutes(doc) > maxMinutes
}

function cacheAgeMs(doc) {
  if (!doc?.updated_at) return null
  return Date.now() - new Date(doc.updated_at).getTime()
}

export async function upsertLatestPrice(ticker, data = {}) {
  const col = getCollection('latest_prices')
  if (!col) throw new Error('MongoDB not connected')

  const t = normalizeTicker(ticker)
  const set = { ticker: t, updated_at: data.updated_at ? new Date(data.updated_at) : new Date() }
  if (data.price != null)          set.price          = Number(data.price)
  if (data.volume != null)         set.volume         = Number(data.volume)
  if (data.change_percent != null) set.change_percent = Number(data.change_percent)
  if (data.source)                 set.source         = data.source

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

export async function getTickersMissingPrices(tickers) {
  const normalized = [...new Set(tickers.map(normalizeTicker))]
  if (!normalized.length) return []
  const priceMap = await getLatestPricesBatch(normalized)
  return normalized.filter(t => !isValidPrice(priceMap.get(t)?.price))
}

export async function getTickersNeedingQuoteRefresh(tickers, maxAgeMs = CACHE_TTL_MS.quote) {
  const normalized = [...new Set(tickers.map(normalizeTicker))]
  if (!normalized.length) return []
  const priceMap = await getLatestPricesBatch(normalized)
  return normalized.filter(t => {
    const doc = priceMap.get(t)
    if (!isValidPrice(doc?.price)) return true
    const age = cacheAgeMs(doc)
    return age == null || age >= maxAgeMs
  })
}

export async function resolveLatestPrice(ticker, { allowStale = true, forceRefresh = false, source = 'price_resolve' } = {}) {
  const t = normalizeTicker(ticker)
  const col = getCollection('latest_prices')
  const cached = col ? await col.findOne({ ticker: t }) : null

  if (!forceRefresh && isValidPrice(cached?.price)) {
    const ageMs = cacheAgeMs(cached)
    if (ageMs != null && ageMs < CACHE_TTL_MS.quote) {
      return {
        ok: true,
        ticker: t,
        price: Number(cached.price),
        doc: cached,
        source: cached.source || 'cache',
        stale: false,
        fresh: true,
        reason: null,
      }
    }
  }

  const fhQuote = await fetchFinnhubQuote(t, { source })
  if (fhQuote.ok && isValidPrice(fhQuote.price)) {
    const doc = await upsertLatestPrice(t, {
      price: fhQuote.price,
      volume: fhQuote.volume,
      change_percent: fhQuote.change_percent,
      source: 'finnhub',
    })
    info('prices', 'Price fetched', { ticker: t, source: 'finnhub', price: fhQuote.price })
    return { ok: true, ticker: t, price: fhQuote.price, doc, source: 'finnhub', stale: !!fhQuote.stale, fresh: !fhQuote.stale, reason: fhQuote.stale ? 'finnhub_previous_close' : null }
  }

  const tdQuote = await fetchTwelveDataQuote(t, { source })
  if (tdQuote.ok && isValidPrice(tdQuote.price)) {
    const doc = await upsertLatestPrice(t, {
      price: tdQuote.price,
      volume: tdQuote.volume,
      change_percent: tdQuote.change_percent,
      source: 'twelvedata',
    })
    info('prices', 'Price fetched', { ticker: t, source: 'twelvedata', price: tdQuote.price })
    return { ok: true, ticker: t, price: tdQuote.price, doc, source: 'twelvedata', stale: false, fresh: true, reason: null }
  }

  if (allowStale && isValidPrice(cached?.price)) {
    warn('prices', 'Using stale cache after provider miss', {
      ticker: t,
      source: 'cache',
      finnhubReason: fhQuote.reason,
      twelvedataReason: tdQuote.reason,
    })
    return {
      ok: true,
      ticker: t,
      price: Number(cached.price),
      doc: cached,
      source: 'cache',
      stale: true,
      fresh: false,
      reason: fhQuote.reason || tdQuote.reason || 'cache_only',
    }
  }

  info('prices', 'Price unavailable', {
    ticker: t,
    source: fhQuote.source || tdQuote.source || 'none',
    reason: fhQuote.reason || tdQuote.reason || 'cache_miss',
    finnhubReason: fhQuote.reason,
    twelvedataReason: tdQuote.reason,
    finnhubConfigured: isFinnhubConfigured(),
    rateLimited: isTwelveDataRateLimited(),
    httpStatus: tdQuote.httpStatus || fhQuote.httpStatus,
  })
  return {
    ok: false,
    ticker: t,
    price: null,
    doc: cached,
    source: fhQuote.source || tdQuote.source || 'none',
    reason: fhQuote.reason || tdQuote.reason || 'cache_miss',
    stale: false,
    fresh: false,
  }
}

export async function refreshQuotesBatch(tickers, { source = 'scan' } = {}) {
  const needRefresh = await getTickersNeedingQuoteRefresh(tickers)
  if (!needRefresh.length) return { attempted: 0, resolved: 0, skipped: tickers.length, failed: [] }

  let resolved = 0
  const failed = []
  const stillMissing = new Set(needRefresh)

  for (const ticker of needRefresh) {
    const fh = await fetchFinnhubQuote(ticker, { source })
    if (fh.ok && isValidPrice(fh.price)) {
      await upsertLatestPrice(ticker, { price: fh.price, volume: fh.volume, change_percent: fh.change_percent, source: 'finnhub' })
      resolved++
      stillMissing.delete(ticker)
    }
    if (needRefresh.length > 1) await new Promise(r => setTimeout(r, REST_BACKFILL_DELAY_MS))
  }

  const remaining = [...stillMissing]
  if (remaining.length && !isTwelveDataRateLimited()) {
    const bulk = await fetchQuotesBulk(remaining, { source })
    for (const [ticker, quote] of bulk) {
      if (quote.ok && isValidPrice(quote.price)) {
        await upsertLatestPrice(ticker, { price: quote.price, volume: quote.volume, change_percent: quote.change_percent, source: 'twelvedata' })
        resolved++
        stillMissing.delete(ticker)
      }
    }
  }

  for (const ticker of stillMissing) {
    const result = await resolveLatestPrice(ticker, { source, allowStale: true })
    if (result.ok) resolved++
    else failed.push({ ticker, reason: result.reason, source: result.source })
  }

  if (failed.length) {
    info('prices', 'Quote refresh completed with failures', { attempted: needRefresh.length, resolved, failed, source })
  } else {
    info('prices', 'Quote refresh completed', { attempted: needRefresh.length, resolved, source })
  }
  return { attempted: needRefresh.length, resolved, skipped: tickers.length - needRefresh.length, failed }
}

export async function backfillMissingPrices(tickers, { source = 'backfill' } = {}) {
  const missing = await getTickersMissingPrices(tickers)
  const stale = await getTickersNeedingQuoteRefresh(tickers)
  const targets = [...new Set([...missing, ...stale])]
  if (!targets.length) return { attempted: 0, resolved: 0, failed: [] }
  return refreshQuotesBatch(targets, { source })
}

export async function getMarketDataFreshness(tickers, { staleMinutes = EXECUTION_MAX_PRICE_AGE_MS / 60000 } = {}) {
  const normalized = [...new Set(tickers.map(normalizeTicker))]
  if (!normalized.length) {
    return { status: 'unknown', last_updated_at: null, age_minutes: null, tickers_covered: 0, tickers_total: 0, stale_tickers: [] }
  }

  const priceMap = await getLatestPricesBatch(normalized)
  const ages = []
  const stale = []
  let newest = null

  for (const t of normalized) {
    const doc = priceMap.get(t)
    if (!doc?.updated_at || !isValidPrice(doc?.price)) {
      stale.push(t)
      continue
    }
    const ageMin = getPriceAgeMinutes(doc)
    ages.push(ageMin)
    const updated = new Date(doc.updated_at)
    if (!newest || updated > newest) newest = updated
    if (ageMin > staleMinutes) stale.push(t)
  }

  const maxAge = ages.length ? Math.max(...ages) : null
  let status = 'fresh'
  if (!ages.length) status = 'unavailable'
  else if (stale.length === normalized.length) status = 'stale'
  else if (stale.length > 0) status = 'mixed'

  return {
    status,
    last_updated_at: newest?.toISOString() ?? null,
    age_minutes: maxAge != null ? Number(maxAge.toFixed(1)) : null,
    tickers_covered: ages.length,
    tickers_total: normalized.length,
    stale_tickers: stale.slice(0, 5),
    stale_threshold_minutes: staleMinutes,
  }
}
