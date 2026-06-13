import { getCollection } from '../config/db.js'
import { getNotifications } from '../services/notifications.js'
import { getPortfolioSummary, getTradeStats } from '../services/trades.js'
import { getPreferences } from '../services/preferences.js'
import { getRecommendationsByStatus, getScanTickers } from '../services/agent.js'
import { getNextScanTime } from '../services/scheduler.js'
import { getMarketDataFreshness } from '../services/prices.js'
import { getApiUsageSummary } from '../lib/apiUsage.js'

export function registerDashboardRoutes(app) {
  app.get('/api/activity', async (req, res) => {
    try {
      const { userId, limit } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      const cap = limit ? Number(limit) * 3 : 60
      const notifications = await getNotifications(userId, { limit: cap })
      const meaningful = notifications.filter(n => {
        if (n.type === 'scan_complete') return false
        if (n.type === 'recommendation') {
          const t = (n.title || '').toUpperCase()
          return t.startsWith('BUY ') || t.startsWith('EXIT ') || t.startsWith('SELL ')
        }
        return ['trade_executed', 'auto_executed', 'rebalancing'].includes(n.type)
      })
      res.json(meaningful.slice(0, limit ? Number(limit) : 20))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/debug/api-usage', async (req, res) => {
    try {
      res.json(await getApiUsageSummary(req.query.hours ? Number(req.query.hours) : 24))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/dashboard/metrics', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      const recCol = getCollection('recommendation_log')
      const [summary, stats, pendingCount, prefs, latestRec, pendingRecs, blockedRecs] = await Promise.all([
        getPortfolioSummary(userId),
        getTradeStats(userId),
        getRecommendationsByStatus(userId, 'generated', 999).then(r => r.length),
        getPreferences(userId),
        getRecommendationsByStatus(userId, null, 1).then(r => r[0] || null),
        recCol ? recCol.find({ userId, status: 'generated' }).toArray() : [],
        recCol ? recCol.find({ userId, status: 'blocked' }).toArray() : [],
      ])
      const awaiting_execution = pendingRecs.filter(r => r.signal === 'BUY' || r.signal === 'EXIT').length
      const monitoring = pendingRecs.length - awaiting_execution

      res.json({
        virtual_cash: summary.virtual_cash,
        positions_value: summary.positions_value,
        starting_capital: stats.starting_capital,
        equity: summary.total_equity,
        portfolio_return_pct: summary.portfolio_return_pct,
        realized_pnl: stats.total_pnl,
        unrealized_pnl: summary.unrealized_pnl,
        open_positions: summary.position_count,
        open_trades: stats.open_trades,
        win_rate: stats.win_rate,
        total_trades: stats.total_trades,
        pending_actions: pendingCount,
        recommendation_queue: { awaiting_execution, monitoring, blocked: blockedRecs.length },
        mode: prefs?.mode || 'agentic',
        next_scan: getNextScanTime(prefs?.signal_frequency || 'daily').toISOString(),
        latest_recommendation: latestRec ? {
          ticker: latestRec.ticker,
          signal: latestRec.signal,
          confidence: latestRec.confidence,
          confidence_delta: latestRec.confidence_delta,
          created_at: latestRec.created_at,
        } : null,
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/agent/status', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })

      const prefs = await getPreferences(userId)
      const user = await getCollection('users')?.findOne({ _id: userId })
      const lastScan = await getCollection('scan_history')?.findOne({ userId }, { sort: { completed_at: -1 } })
      const recentRecs = await getCollection('recommendation_log')?.find({
        userId,
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).toArray() || []

      const signalBreakdown = { BUY: 0, HOLD: 0, EXIT: 0, WATCH: 0, REBALANCE: 0 }
      for (const r of recentRecs) signalBreakdown[r.signal] = (signalBreakdown[r.signal] || 0) + 1

      const recentTrades = await getCollection('virtual_trades')?.find({
        userId,
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }).toArray() || []

      const pendingRecs = await getCollection('recommendation_log')?.find({ userId, status: 'generated' }).toArray() || []
      const blockedRecs = await getCollection('recommendation_log')?.find({ userId, status: 'blocked' }).toArray() || []
      const awaiting_execution = pendingRecs.filter(r => r.signal === 'BUY' || r.signal === 'EXIT').length
      const monitoring = pendingRecs.length - awaiting_execution
      const positions = await getCollection('portfolio_positions')?.find({ userId }).toArray() || []
      const market_data = await getMarketDataFreshness(await getScanTickers(userId))

      res.json({
        mode: prefs?.mode || 'agentic',
        enabled: prefs?.enabled !== false,
        scan_in_progress: user?.scan_in_progress || false,
        market_data,
        last_scan: lastScan ? {
          completed_at: lastScan.completed_at,
          auto_executed: lastScan.auto_executed,
          mode: lastScan.mode,
          duration_ms: lastScan.duration_ms || null,
          tickers_scanned: lastScan.tickers_scanned ?? null,
          recommendations: lastScan.recommendations ?? lastScan.recommendations_generated ?? null,
          executed: lastScan.executed ?? lastScan.auto_executed ?? null,
        } : null,
        last_24h: {
          recommendations: recentRecs.length,
          signals: signalBreakdown,
          trades_executed: recentTrades.length,
          buys: recentTrades.filter(t => t.action === 'BUY').length,
          sells: recentTrades.filter(t => t.action === 'SELL').length,
          outcomes: {
            executed: recentRecs.filter(r => r.status === 'executed').length,
            blocked: recentRecs.filter(r => r.status === 'blocked').length,
            monitoring: recentRecs.filter(r => r.status === 'generated' && r.signal !== 'BUY' && r.signal !== 'EXIT').length,
            awaiting_execution: recentRecs.filter(r => r.status === 'generated' && (r.signal === 'BUY' || r.signal === 'EXIT')).length,
          },
        },
        pending_recommendations: pendingRecs.length,
        recommendation_queue: { awaiting_execution, monitoring, blocked: blockedRecs.length },
        portfolio: {
          positions: positions.length,
          max_stocks: prefs?.max_stocks || 15,
          cash_reserve_pct: prefs?.cash_reserve_pct || 10,
          stop_loss_pct: prefs?.stop_loss_pct || 12,
          take_profit_pct: prefs?.take_profit_pct || 25,
          trailing_stop_pct: prefs?.trailing_stop_pct || 10,
        },
        config: {
          risk_tolerance: prefs?.risk_tolerance || 'moderate',
          signal_frequency: prefs?.signal_frequency || 'hourly',
          min_confidence: prefs?.min_confidence || 0.7,
          max_position_size_pct: prefs?.max_position_size_pct || 20,
        },
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
