import { getCollection } from '../config/db.js'
import { manualAnalysisWorkflow, portfolioScanWorkflow } from '../application/workflows/index.js'
import { runAutonomousExecution, acquireScanLock, releaseScanLock } from '../services/autonomy.js'
import { getPreferences } from '../services/preferences.js'
import { runAgent } from '../agent/index.js'
import { info, error as logError } from '../lib/logger.js'

export function registerAgentRoutes(app) {
  app.post('/agent/chat', async (req, res) => {
    try {
      const { userId, message } = req.body
      if (!userId || !message) return res.status(400).json({ error: 'userId and message are required' })
      res.json(await manualAnalysisWorkflow.run({ userId, message }))
    } catch (err) {
      logError('agent', 'Manual analysis failed', { error: err.message })
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/agent/chat/stream', async (req, res) => {
    try {
      const { userId, message } = req.body
      if (!userId || !message) return res.status(400).json({ error: 'userId and message are required' })
      info('agent', 'Streaming manual analysis request', { userId, message: message.slice(0, 80) })

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      let toolCallCount = 0
      for await (const chunk of manualAnalysisWorkflow.stream({ userId, message })) {
        if (chunk.progress) {
          res.write(`data: ${JSON.stringify({ progress: chunk.progress, event: chunk.event || { type: 'progress', message: chunk.progress } })}\n\n`)
        }
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text, event: chunk.event || { type: 'text_delta', text: chunk.text } })}\n\n`)
        }
        if (chunk.toolCall) {
          toolCallCount++
          res.write(`data: ${JSON.stringify({ toolCall: chunk.toolCall, event: chunk.event || { type: 'tool_start', tool: chunk.toolCall.tool } })}\n\n`)
        }
        if (chunk.error) {
          res.write(`data: ${JSON.stringify({ error: chunk.error, event: chunk.event || { type: 'error', error: chunk.error } })}\n\n`)
        }
        if (chunk.done) {
          res.write(`data: ${JSON.stringify({ done: true, toolCalls: chunk.toolCalls, event: chunk.event || { type: 'done' } })}\n\n`)
        }
      }

      info('agent', 'Streaming manual analysis complete', { userId, toolCalls: toolCallCount })
      res.end()
    } catch (err) {
      logError('agent', 'Streaming manual analysis failed', { error: err.message })
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
        res.end()
      } else {
        res.status(500).json({ error: err.message })
      }
    }
  })

  app.post('/agent/scan', async (req, res) => {
    try {
      const { userId } = req.body
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      info('agent', 'Manual scan triggered', { userId })
      const result = await portfolioScanWorkflow.runManual(userId)
      info('agent', 'Manual scan complete', { userId, recommendations: result.recommendations?.length || 0 })
      res.json(result)
    } catch (err) {
      if (err.code === 'SCAN_LOCKED') return res.status(429).json({ error: err.message })
      logError('agent', 'Scan failed', { error: err.message })
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/agent/run', async (req, res) => {
    let lockedUserId = null
    try {
      const { userId } = req.body
      if (!userId) return res.status(400).json({ error: 'userId is required' })

      const lock = await acquireScanLock(userId)
      if (!lock.acquired) {
        if (lock.reason === 'not_found') return res.status(404).json({ error: 'User not found' })
        if (lock.reason === 'locked') {
          const elapsed = Date.now() - new Date(lock.started_at || Date.now()).getTime()
          return res.status(429).json({ error: 'Scan already in progress', started_at: lock.started_at, elapsed_ms: elapsed })
        }
        return res.status(500).json({ error: 'Could not acquire scan lock' })
      }
      lockedUserId = userId
      const lockStartedAt = lock.started_at

      const prefs = await getPreferences(userId)
      const mode = prefs?.mode === 'manual' ? 'manual' : 'agentic'
      info('agent', 'Full agent run started', { userId, mode })

      const prompt = `Analyze the full portfolio for user ${userId}. For every ticker in the portfolio and watchlist:
1. Get the latest price
2. Get price context (technicals)
3. Get market news
4. Generate and SAVE a recommendation for each ticker

After saving all recommendations, provide a brief portfolio summary with your key findings.`

      const result = await runAgent(userId, prompt)
      if (mode === 'agentic') {
        const exec = await runAutonomousExecution(userId, prefs)
        result.mode = 'agentic'
        result.auto_executed = exec.executed
        result.exits = exec.exits
        result.rebalance_signals = exec.rebalanceSignals
        info('agent', 'Agentic run complete', { userId, autoExecuted: exec.executed, exits: exec.exits, rebalanceSignals: exec.rebalanceSignals })
      } else {
        result.mode = 'manual'
        result.auto_executed = 0
        info('agent', 'Manual mode run complete', { userId })
      }

      const scanDuration = Date.now() - new Date(lockStartedAt || Date.now()).getTime()
      await getCollection('scan_history')?.updateOne(
        { userId, completed_at: { $gte: new Date(Date.now() - 60000) } },
        { $set: { userId, completed_at: new Date(), mode: result.mode, auto_executed: result.auto_executed || 0, duration_ms: scanDuration, recommendations_generated: result.toolCalls?.length || 0 } },
        { upsert: true }
      )
      info('agent', 'Scan duration', { userId, duration_ms: scanDuration })

      await releaseScanLock(userId)
      lockedUserId = null
      res.json(result)
    } catch (err) {
      if (lockedUserId) await releaseScanLock(lockedUserId)
      logError('agent', 'Agent run failed', { error: err.message })
      res.status(500).json({ error: err.message })
    }
  })
}
