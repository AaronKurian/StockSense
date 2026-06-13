import { getPreferences, createDefaultPreferences, updatePreferences } from '../services/preferences.js'

export function registerPreferenceRoutes(app) {
  app.get('/api/preferences', async (req, res) => {
    try {
      const { userId } = req.query
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await getPreferences(userId) || {})
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/preferences', async (req, res) => {
    try {
      const { userId } = req.body
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await createDefaultPreferences(userId))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  app.patch('/api/preferences', async (req, res) => {
    try {
      const { userId, ...updates } = req.body
      if (!userId) return res.status(400).json({ error: 'userId is required' })
      res.json(await updatePreferences(userId, updates))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
}
