import {
  getConfidenceCalibration,
  getSignalPerformance,
  generateDailyBriefing,
  evaluateRecommendationOutcomes,
  runNightlyJobs,
} from '../services/learning.js'

export function registerLearningRoutes(app) {
  app.get('/api/learning/calibration', async (req, res) => {
    try {
      const { userId } = req.query
      res.json(await getConfidenceCalibration(userId || null))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/learning/performance', async (req, res) => {
    try {
      const { userId } = req.query
      res.json(await getSignalPerformance(userId || null))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/briefing/daily', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      const briefing = await generateDailyBriefing(userId)
      if (!briefing) return res.status(404).json({ error: 'No data for briefing' })
      res.json(briefing)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/learning/evaluate', async (_req, res) => {
    try {
      res.json(await evaluateRecommendationOutcomes())
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/maintenance/nightly', async (_req, res) => {
    try {
      await runNightlyJobs()
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
