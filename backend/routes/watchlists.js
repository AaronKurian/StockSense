import {
  getWatchlists,
  getWatchlistItems,
  getLatestRecommendationsForTickers,
  getOrCreatePrimaryWatchlist,
  addWatchlistItem,
  removeWatchlistItem,
} from '../services/agent.js'
import { getMetadataBatch, getTickerMetadata } from '../services/metadata.js'
import { getLatestPricesBatch, resolveLatestPrice } from '../services/prices.js'
import { getPreferences } from '../services/preferences.js'
import { resolveSector } from '../lib/sectors.js'

function serializeManagedWatchlist({ wl, items, maxStocks, metaMap }) {
  return {
    watchlistId: wl._id,
    max_stocks: maxStocks,
    count: items.length,
    items: items.map(i => ({
      ticker: i.ticker,
      name: i.name || metaMap.get(i.ticker)?.name || i.ticker,
      sector: i.sector || metaMap.get(i.ticker)?.sector || null,
    })),
  }
}

export function registerWatchlistRoutes(app) {
  app.get('/api/watchlists', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getWatchlists(userId))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/watchlists/managed', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      const prefs = await getPreferences(userId)
      const maxStocks = prefs?.max_stocks || 15
      const wl = await getOrCreatePrimaryWatchlist(userId)
      const items = await getWatchlistItems(wl._id)
      const metaMap = items.length ? await getMetadataBatch(items.map(i => i.ticker)) : new Map()
      res.json(serializeManagedWatchlist({ wl, items, maxStocks, metaMap }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/watchlists/managed/items', async (req, res) => {
    try {
      const { userId, ticker, name, sector } = req.body
      if (!userId || !ticker) return res.status(400).json({ error: 'userId and ticker are required' })
      const prefs = await getPreferences(userId)
      const maxStocks = prefs?.max_stocks || 15
      const wl = await getOrCreatePrimaryWatchlist(userId)
      const items = await getWatchlistItems(wl._id)
      const t = String(ticker).trim().toUpperCase()
      if (!items.find(i => i.ticker === t) && items.length >= maxStocks) {
        return res.status(400).json({ error: `Maximum ${maxStocks} stocks monitored` })
      }
      const meta = await getTickerMetadata(t)
      await addWatchlistItem({ watchlistId: wl._id, ticker: t, name: name || meta.name, sector: resolveSector(t, meta.sector, sector) })
      resolveLatestPrice(t).catch(() => {})
      const updated = await getWatchlistItems(wl._id)
      const metaMap = updated.length ? await getMetadataBatch(updated.map(i => i.ticker)) : new Map()
      res.json(serializeManagedWatchlist({ wl, items: updated, maxStocks, metaMap }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.delete('/api/watchlists/managed/items/:ticker', async (req, res) => {
    try {
      const { userId } = req.query
      const { ticker } = req.params
      if (!userId || !ticker) return res.status(400).json({ error: 'userId and ticker are required' })
      const prefs = await getPreferences(userId)
      const maxStocks = prefs?.max_stocks || 15
      const wl = await getOrCreatePrimaryWatchlist(userId)
      await removeWatchlistItem({ watchlistId: wl._id, ticker })
      const items = await getWatchlistItems(wl._id)
      const metaMap = items.length ? await getMetadataBatch(items.map(i => i.ticker)) : new Map()
      res.json(serializeManagedWatchlist({ wl, items, maxStocks, metaMap }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/watchlists/:watchlistId/items', async (req, res) => {
    try {
      const { watchlistId } = req.params
      if (!watchlistId || watchlistId === 'null' || watchlistId === 'undefined') {
        return res.status(400).json({ error: 'watchlistId is required' })
      }
      const { userId } = req.query
      const items = await getWatchlistItems(watchlistId)
      if (!items.length) return res.json([])

      const tickers = items.map(i => i.ticker)
      const [priceMap, recMap] = await Promise.all([
        getLatestPricesBatch(tickers),
        userId ? getLatestRecommendationsForTickers(userId, tickers) : Promise.resolve(new Map()),
      ])

      res.json(items.map(item => {
        const latest = priceMap.get(item.ticker)
        const rec = recMap.get(item.ticker)
        return {
          ...item,
          price: latest?.price ?? null,
          change_percent: latest?.change_percent ?? null,
          volume: latest?.volume ?? null,
          updated_at: latest?.updated_at ?? null,
          signal: rec ? { type: rec.signal, confidence: Math.round((rec.confidence ?? 0) * 100) } : null,
        }
      }))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
