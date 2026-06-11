export const VALID_SECTORS = [
  'Technology', 'Healthcare', 'Financials', 'Energy', 'Industrials', 'Utilities',
  'Consumer Defensive', 'Consumer Cyclical', 'Communication Services', 'Real Estate', 'Materials',
]

export const SECTOR_ALIASES = {
  Finance: 'Financials', Financial: 'Financials', Consumer: 'Consumer Cyclical', Tech: 'Technology',
  'Health Care': 'Healthcare', Communications: 'Communication Services', Communication: 'Communication Services',
  'Consumer Staples': 'Consumer Defensive', 'Consumer Discretionary': 'Consumer Cyclical',
}

export const SECTOR_PREFERENCE_BONUS = 0.05

export function normalizeSectorName(name) {
  if (name == null) return null
  const trimmed = String(name).trim()
  if (!trimmed) return null
  const aliased = SECTOR_ALIASES[trimmed] || trimmed
  return VALID_SECTORS.find(s => s.toLowerCase() === aliased.toLowerCase()) || null
}

export function normalizeSectorList(input) {
  if (input == null) return []
  const raw = typeof input === 'string' ? (input.includes(',') ? input.split(',') : [input]) : input
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map(normalizeSectorName).filter(Boolean))]
}

export function parseAndValidateSectors(input, { allowEmpty = true } = {}) {
  if (input == null || input === '') {
    if (!allowEmpty) throw new Error('preferred_sectors is required')
    return []
  }
  const raw = typeof input === 'string' ? (input.includes(',') ? input.split(',') : [input]) : input
  if (!Array.isArray(raw)) throw new Error('preferred_sectors must be an array')
  const invalid = []
  const out = []
  for (const item of raw) {
    const trimmed = String(item ?? '').trim()
    if (!trimmed) continue
    const n = normalizeSectorName(trimmed)
    if (!n) { invalid.push(trimmed); continue }
    if (!out.includes(n)) out.push(n)
  }
  if (invalid.length) throw new Error(`invalid sector(s): ${invalid.join(', ')}`)
  if (!allowEmpty && !out.length) throw new Error('preferred_sectors cannot be empty')
  return out
}

export function migrateSectorFields(doc) {
  if (!doc || typeof doc !== 'object') return { sectors: [], migrated: false, hadLegacy: false }
  if (doc.preferred_sector != null && doc.preferred_sector !== '') {
    return { sectors: normalizeSectorList(doc.preferred_sector), migrated: true, hadLegacy: true }
  }
  const sectors = normalizeSectorList(doc.preferred_sectors)
  const migrated = Array.isArray(doc.preferred_sectors)
    ? doc.preferred_sectors.some(s => normalizeSectorName(s) === null && String(s).trim())
    : typeof doc.preferred_sectors === 'string' && !!doc.preferred_sectors.trim()
  return { sectors, migrated, hadLegacy: false }
}

export function parseOnboardingSectors(body = {}) {
  const { sectors, preferred_sectors } = body
  if (preferred_sectors != null) return parseAndValidateSectors(preferred_sectors, { allowEmpty: true })
  if (sectors == null || sectors === '') return []
  return parseAndValidateSectors(sectors, { allowEmpty: true })
}

export function applySectorPreferenceBonus(confidence, tickerSector, preferredSectors) {
  if (confidence == null || !Number.isFinite(confidence) || !preferredSectors?.length || !tickerSector) return confidence
  const ticker = normalizeSectorName(tickerSector)
  if (!ticker) return confidence
  const preferred = preferredSectors.map(normalizeSectorName).filter(Boolean)
  return preferred.includes(ticker)
    ? Math.min(1, Number((confidence + SECTOR_PREFERENCE_BONUS).toFixed(4)))
    : confidence
}

export function mergePreferredSectors(...sources) {
  const out = []
  for (const src of sources) {
    if (!Array.isArray(src)) continue
    for (const s of src) {
      const n = normalizeSectorName(s)
      if (n && !out.includes(n)) out.push(n)
    }
  }
  return out
}

export const CANONICAL_TICKER_SECTORS = {
  AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Technology', AMD: 'Technology',
  GOOGL: 'Communication Services', META: 'Communication Services', NFLX: 'Communication Services',
  DIS: 'Communication Services', CMCSA: 'Communication Services',
  JNJ: 'Healthcare', UNH: 'Healthcare', PFE: 'Healthcare', ABBV: 'Healthcare', MRK: 'Healthcare',
  JPM: 'Financials', BAC: 'Financials', GS: 'Financials', V: 'Financials', MA: 'Financials',
  XOM: 'Energy', CVX: 'Energy', SHEL: 'Energy', BP: 'Energy', COP: 'Energy',
  CAT: 'Industrials', GE: 'Industrials', HON: 'Industrials', UPS: 'Industrials', BA: 'Industrials',
  NEE: 'Utilities', DUK: 'Utilities', SO: 'Utilities', AEP: 'Utilities',
  PG: 'Consumer Defensive', KO: 'Consumer Defensive', PEP: 'Consumer Defensive', WMT: 'Consumer Defensive', COST: 'Consumer Defensive',
  AMZN: 'Consumer Cyclical', TSLA: 'Consumer Cyclical', NKE: 'Consumer Cyclical', MCD: 'Consumer Cyclical', HD: 'Consumer Cyclical',
  AMT: 'Real Estate', PLD: 'Real Estate', EQIX: 'Real Estate', SPG: 'Real Estate',
  LIN: 'Materials', APD: 'Materials', SHW: 'Materials', FCX: 'Materials',
}

export function resolveSector(ticker, metaSector = null, storedSector = null) {
  const t = String(ticker || '').toUpperCase()
  if (!t) return 'Unknown'
  const fromMeta = normalizeSectorName(metaSector)
  if (fromMeta) return fromMeta
  const fromFallback = CANONICAL_TICKER_SECTORS[t]
  if (fromFallback) return fromFallback
  const fromStored = normalizeSectorName(storedSector)
  if (fromStored) return fromStored
  return 'Unknown'
}
