import { getCollection } from '../config/db.js'
import { migrateSectorFields, parseAndValidateSectors } from '../lib/sectors.js'

const VALID_RISK = new Set(['conservative', 'moderate', 'aggressive'])
const VALID_HORIZON = new Set(['short', 'medium', 'long'])
const VALID_FREQUENCY = new Set(['5min', '15min', '30min', 'hourly', 'daily'])
const VALID_MODE = new Set(['manual', 'agentic'])

const DEFAULT_PREFERENCES = {
  mode: 'agentic',
  enabled: true,
  risk_tolerance: 'moderate',
  investment_horizon: 'medium',
  max_position_size_pct: 20,
  cash_reserve_pct: 10,
  stop_loss_pct: 12,
  take_profit_pct: 25,
  trailing_stop_pct: 10,
  max_stocks: 15,
  max_sector_exposure_pct: 40,
  rebalance_threshold_pct: 5,
  signal_frequency: 'hourly',
  min_confidence: 0.7,
  preferred_sectors: [],
  excluded_sectors: [],
  push_enabled: true,
  notify_recommendations: true,
  notify_executions: true,
  notify_rebalancing: true,
  notify_scans: false,
}

async function persistSectorMigration(col, userId, sectors, hadLegacy) {
  const update = { $set: { preferred_sectors: sectors, updated_at: new Date() } }
  if (hadLegacy) update.$unset = { preferred_sector: '' }
  await col.updateOne({ userId }, update)
}

export async function getPreferences(userId) {
  const col = getCollection('agent_preferences')
  if (!col) throw new Error('MongoDB not connected')
  if (!userId) throw new Error('userId is required')
  const stored = await col.findOne({ userId })
  if (!stored) return null

  const { sectors, migrated, hadLegacy } = migrateSectorFields(stored)
  if (migrated || hadLegacy) {
    await persistSectorMigration(col, userId, sectors, hadLegacy)
  }

  return { ...DEFAULT_PREFERENCES, ...stored, preferred_sectors: sectors }
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
  if (updates.preferred_sector != null && updates.preferred_sectors == null) {
    updates.preferred_sectors = [updates.preferred_sector]
  }
  let unsetLegacySector = false
  if (updates.preferred_sectors != null) {
    set.preferred_sectors = parseAndValidateSectors(updates.preferred_sectors, { allowEmpty: true })
    unsetLegacySector = true
  }
  if (updates.excluded_sectors != null) {
    set.excluded_sectors = parseAndValidateSectors(updates.excluded_sectors, { allowEmpty: true })
  }
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
  if (updates.cash_reserve_pct != null) {
    const v = Number(updates.cash_reserve_pct)
    if (!Number.isFinite(v) || v < 0 || v > 90) throw new Error('invalid cash_reserve_pct')
    set.cash_reserve_pct = v
  }
  if (updates.trailing_stop_pct != null) {
    const v = Number(updates.trailing_stop_pct)
    if (!Number.isFinite(v) || v < 1 || v > 50) throw new Error('invalid trailing_stop_pct')
    set.trailing_stop_pct = v
  }
  if (updates.max_stocks != null) {
    const v = Number(updates.max_stocks)
    if (!Number.isFinite(v) || v < 1 || v > 100) throw new Error('invalid max_stocks')
    set.max_stocks = Math.floor(v)
  }
  if (updates.max_sector_exposure_pct != null) {
    const v = Number(updates.max_sector_exposure_pct)
    if (!Number.isFinite(v) || v < 1 || v > 100) throw new Error('invalid max_sector_exposure_pct')
    set.max_sector_exposure_pct = v
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
  if (updates.push_enabled != null) set.push_enabled = Boolean(updates.push_enabled)
  if (updates.notify_recommendations != null) set.notify_recommendations = Boolean(updates.notify_recommendations)
  if (updates.notify_executions != null) set.notify_executions = Boolean(updates.notify_executions)
  if (updates.notify_rebalancing != null) set.notify_rebalancing = Boolean(updates.notify_rebalancing)
  if (updates.notify_scans != null) set.notify_scans = Boolean(updates.notify_scans)

  if (Object.keys(set).length === 1) throw new Error('no valid fields to update')
  const update = { $set: set }
  if (unsetLegacySector) update.$unset = { preferred_sector: '' }
  const res = await col.findOneAndUpdate({ userId }, update, { returnDocument: 'after', upsert: true, includeResultMetadata: false })
  const doc = res || (await col.findOne({ userId }))
  const { sectors } = migrateSectorFields(doc)
  return { ...DEFAULT_PREFERENCES, ...doc, preferred_sectors: sectors }
}
