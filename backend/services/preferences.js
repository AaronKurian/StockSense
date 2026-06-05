import { getCollection } from '../config/db.js'

const VALID_RISK = new Set(['conservative', 'moderate', 'aggressive'])
const VALID_HORIZON = new Set(['short', 'medium', 'long'])
const VALID_FREQUENCY = new Set(['realtime', 'hourly', 'daily', 'weekly'])
const VALID_MODE = new Set(['default', 'agentic'])

const DEFAULT_PREFERENCES = {
  mode: 'default',
  enabled: true,
  risk_tolerance: 'moderate',
  investment_horizon: 'medium',
  max_position_size_pct: 25,
  stop_loss_pct: 10,
  take_profit_pct: 20,
  rebalance_threshold_pct: 5,
  signal_frequency: 'hourly',
  min_confidence: 0.7,
  preferred_sectors: [],
  excluded_sectors: [],
}

export async function getPreferences(userId) {
  const col = getCollection('agent_preferences')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  return await col.findOne({ userId }) || null
}

export async function createDefaultPreferences(userId) {
  const col = getCollection('agent_preferences')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  const existing = await col.findOne({ userId })
  if (existing) return existing
  const doc = { userId, ...DEFAULT_PREFERENCES, created_at: new Date(), updated_at: new Date() }
  await col.insertOne(doc)
  return doc
}

export async function updatePreferences(userId, updates = {}) {
  const col = getCollection('agent_preferences')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')

  const set = { updated_at: new Date() }

  if (updates.mode != null) {
    if (!VALID_MODE.has(updates.mode)) throw new Error('invalid mode')
    set.mode = updates.mode
  }
  if (updates.enabled != null) set.enabled = Boolean(updates.enabled)
  if (updates.risk_tolerance != null) {
    if (!VALID_RISK.has(updates.risk_tolerance)) throw new Error('invalid risk_tolerance')
    set.risk_tolerance = updates.risk_tolerance
  }
  if (updates.investment_horizon != null) {
    if (!VALID_HORIZON.has(updates.investment_horizon)) throw new Error('invalid investment_horizon')
    set.investment_horizon = updates.investment_horizon
  }
  if (updates.preferred_sectors != null) set.preferred_sectors = Array.isArray(updates.preferred_sectors) ? updates.preferred_sectors : []
  if (updates.excluded_sectors != null) set.excluded_sectors = Array.isArray(updates.excluded_sectors) ? updates.excluded_sectors : []
  if (updates.max_position_size_pct != null) {
    const v = Number(updates.max_position_size_pct)
    if (!Number.isFinite(v) || v < 1 || v > 100) throw new Error('invalid max_position_size_pct')
    set.max_position_size_pct = v
  }
  if (updates.stop_loss_pct != null) {
    const v = Number(updates.stop_loss_pct)
    if (!Number.isFinite(v) || v < 1 || v > 50) throw new Error('invalid stop_loss_pct')
    set.stop_loss_pct = v
  }
  if (updates.take_profit_pct != null) {
    const v = Number(updates.take_profit_pct)
    if (!Number.isFinite(v) || v < 1 || v > 100) throw new Error('invalid take_profit_pct')
    set.take_profit_pct = v
  }
  if (updates.rebalance_threshold_pct != null) {
    const v = Number(updates.rebalance_threshold_pct)
    if (!Number.isFinite(v) || v < 1 || v > 50) throw new Error('invalid rebalance_threshold_pct')
    set.rebalance_threshold_pct = v
  }
  if (updates.signal_frequency != null) {
    if (!VALID_FREQUENCY.has(updates.signal_frequency)) throw new Error('invalid signal_frequency')
    set.signal_frequency = updates.signal_frequency
  }
  if (updates.min_confidence != null) {
    const v = Number(updates.min_confidence)
    if (!Number.isFinite(v) || v < 0 || v > 1) throw new Error('invalid min_confidence')
    set.min_confidence = v
  }

  if (Object.keys(set).length === 1) throw new Error('no valid fields to update')
  const res = await col.findOneAndUpdate({ userId }, { $set: set }, { returnDocument: 'after', upsert: true })
  return res.value || res
}
