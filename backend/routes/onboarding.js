import { getCollection } from '../config/db.js'
import { updatePreferences } from '../services/preferences.js'
import { createWatchlist, addWatchlistItem } from '../services/agent.js'
import { getTickerMetadata } from '../services/metadata.js'
import { parseOnboardingSectors, resolveSector } from '../lib/sectors.js'
import { info, error as logError } from '../lib/logger.js'

export function registerOnboardingRoutes(app) {
  app.post('/api/onboarding/complete', async (req, res) => {
    try {
      const userId = req.userId
      const { risk, horizon, sectors, preferred_sectors, watchlist } = req.body
      const sectorList = parseOnboardingSectors({ sectors, preferred_sectors })
      info('onboarding', 'Onboarding started', { userId, risk, horizon, sectors: sectorList })

      const riskMap = { Conservative: 'conservative', Moderate: 'moderate', Aggressive: 'aggressive' }
      const horizonMap = { 'Short (< 1 year)': 'short', 'Medium (1-5 years)': 'medium', 'Long (5+ years)': 'long' }

      const usersCol = getCollection('users')
      if (usersCol) {
        const userUpdates = {}
        if (risk && riskMap[risk]) userUpdates.risk_tolerance = riskMap[risk]
        if (horizon && horizonMap[horizon]) userUpdates.investment_horizon = horizonMap[horizon]
        if (sectorList.length) userUpdates.preferred_sectors = sectorList
        userUpdates.onboarding_completed = true
        userUpdates.updated_at = new Date()
        const userUpdate = { $set: userUpdates }
        if (sectorList.length) userUpdate.$unset = { preferred_sector: '' }
        await usersCol.updateOne({ _id: userId }, userUpdate)
      }

      const riskProfiles = {
        conservative: { cash_reserve_pct: 20, stop_loss_pct: 8, take_profit_pct: 20, max_position_size_pct: 15, max_stocks: 10, trailing_stop_pct: 8 },
        moderate: { cash_reserve_pct: 10, stop_loss_pct: 12, take_profit_pct: 25, max_position_size_pct: 20, max_stocks: 15, trailing_stop_pct: 10 },
        aggressive: { cash_reserve_pct: 5, stop_loss_pct: 15, take_profit_pct: 35, max_position_size_pct: 25, max_stocks: 20, trailing_stop_pct: 12 },
      }
      const prefUpdates = { mode: 'agentic' }
      const riskKey = risk && riskMap[risk] ? riskMap[risk] : 'moderate'
      if (risk && riskMap[risk]) prefUpdates.risk_tolerance = riskMap[risk]
      if (horizon && horizonMap[horizon]) prefUpdates.investment_horizon = horizonMap[horizon]
      if (sectorList.length) prefUpdates.preferred_sectors = sectorList
      Object.assign(prefUpdates, riskProfiles[riskKey] || riskProfiles.moderate)
      await updatePreferences(userId, prefUpdates)

      let watchlistResult = null
      if (watchlist && watchlist !== 'Skipped' && watchlist.length > 0) {
        const wl = await createWatchlist({ userId, name: 'My Watchlist' })
        const tickers = typeof watchlist === 'string' ? watchlist.split(',').map(t => t.trim()).filter(Boolean) : watchlist
        for (const ticker of tickers) {
          const meta = await getTickerMetadata(ticker)
          await addWatchlistItem({ watchlistId: wl._id, ticker, sector: resolveSector(ticker, meta.sector, null), name: meta.name })
        }
        watchlistResult = { id: wl._id, name: wl.name, tickers }
      }

      info('onboarding', 'Onboarding complete', { userId, watchlistTickers: watchlistResult?.tickers?.length || 0 })
      res.json({ ok: true, watchlist: watchlistResult })
    } catch (err) {
      logError('onboarding', 'Onboarding failed', { userId: req.userId, error: err.message })
      res.status(500).json({ error: err.message })
    }
  })
}
