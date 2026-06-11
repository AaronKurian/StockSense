export function getDisplayStatus(rec, { mode } = {}) {
  if (!rec) return 'UNKNOWN'
  const status = rec.status ?? rec.rawStatus
  const execution_mode = rec.execution_mode
  const signal = rec.signal ?? rec.type
  if (status === 'blocked') return 'BLOCKED'
  if (status === 'generated') {
    if (mode === 'agentic') {
      if (signal === 'BUY' || signal === 'EXIT') return 'AWAITING_EXECUTION'
      return 'MONITORING'
    }
    return 'PENDING_APPROVAL'
  }
  if (status === 'rejected') return 'REJECTED'
  if (status === 'expired') return 'EXPIRED'
  if (status === 'approved') return 'APPROVED'
  if (status === 'executed') {
    return execution_mode === 'automatic' ? 'EXECUTED_AUTOMATICALLY' : 'EXECUTED_MANUALLY'
  }
  return String(status).toUpperCase()
}

export const DISPLAY_STATUS_LABELS = {
  PENDING_APPROVAL: 'Pending Approval',
  AWAITING_EXECUTION: 'Awaiting Execution',
  MONITORING: 'Monitoring',
  BLOCKED: 'Blocked',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXECUTED_AUTOMATICALLY: 'Executed Automatically',
  EXECUTED_MANUALLY: 'Executed Manually',
  EXPIRED: 'Expired',
  FAILED: 'Failed',
  UNKNOWN: 'Unknown',
}

export const COMPACT_STATUS_LABELS = {
  PENDING_APPROVAL: 'Pending',
  AWAITING_EXECUTION: 'Awaiting',
  MONITORING: 'Monitoring',
  BLOCKED: 'Blocked',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXECUTED_AUTOMATICALLY: 'Executed',
  EXECUTED_MANUALLY: 'Manual',
  EXPIRED: 'Expired',
  FAILED: 'Failed',
  UNKNOWN: 'Unknown',
}

export const STATUS_BADGE_STYLES = {
  PENDING_APPROVAL: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  AWAITING_EXECUTION: 'border-blue-500/30 bg-blue-500/10 text-blue-100',
  MONITORING: 'border-blue-500/30 bg-blue-500/10 text-blue-100',
  APPROVED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  REJECTED: 'border-white/15 bg-white/5 text-slate-100',
  EXECUTED_AUTOMATICALLY: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  EXECUTED_MANUALLY: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100',
  EXPIRED: 'border-white/15 bg-white/5 text-muted-foreground',
  BLOCKED: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  FAILED: 'border-rose-500/30 bg-rose-500/10 text-rose-100',
  UNKNOWN: 'border-white/15 bg-white/5 text-muted-foreground',
}

export const BLOCK_REASON_LABELS = {
  price_unavailable: 'Awaiting Price Data',
  stale_price: 'Stale Price Data',
}

export const BLOCK_REASON_HINTS = {
  price_unavailable: 'Waiting for market price data. The agent will retry automatically during future scans.',
  stale_price: 'Price data is older than 30 minutes. The agent will refresh and retry during future scans.',
}

const STALE_RATIONALE_PATTERNS = [
  /unknown.*sector/i,
  /null sector/i,
  /showing as ["']?unknown["']?/i,
  /unknown.*or null/i,
]

export function getRecommendationContextBadge(rec) {
  if (!rec) return null
  const text = [rec.rationale, ...(rec.supporting_factors || []), ...(rec.risks || [])].filter(Boolean).join(' ')
  if (!text || !STALE_RATIONALE_PATTERNS.some(p => p.test(text))) return null
  return { label: 'Generated before sector metadata repair', tone: 'amber' }
}

export function getDisplayStatusLabel(rec, opts) {
  const key = getDisplayStatus(rec, opts)
  if (key === 'BLOCKED') {
    return BLOCK_REASON_LABELS[rec.block_reason] || rec.block_reason?.replace(/_/g, ' ') || DISPLAY_STATUS_LABELS.BLOCKED
  }
  return DISPLAY_STATUS_LABELS[key] || key
}

export function getCompactStatusLabel(rec, opts) {
  const key = getDisplayStatus(rec, opts)
  if (key === 'BLOCKED') {
    if (rec.block_reason === 'price_unavailable') return 'No Price'
    if (rec.block_reason === 'stale_price') return 'Stale'
    return COMPACT_STATUS_LABELS.BLOCKED
  }
  return COMPACT_STATUS_LABELS[key] || key
}

export function getBlockedStatusHint(rec) {
  if (!rec || rec.status !== 'blocked') return null
  return BLOCK_REASON_HINTS[rec.block_reason] || 'The agent will re-evaluate during future scans.'
}

export function toSignalFromRec(rec, { mode } = {}) {
  const displayStatus = getDisplayStatus(rec, { mode })
  return {
    id: rec._id?.toString() ?? rec.ticker,
    ticker: rec.ticker,
    name: rec.ticker,
    type: rec.signal,
    signal: rec.signal,
    confidence: Math.round((rec.confidence ?? 0) * 100),
    urgency: 'medium',
    headline: rec.rationale?.slice(0, 120) ?? '',
    rationale: rec.rationale ?? '',
    supportingFactors: rec.supporting_factors ?? [],
    risks: rec.risks ?? [],
    indicators: [],
    createdAt: rec.created_at ?? new Date().toISOString(),
    status: rec.status,
    rawStatus: rec.status,
    execution_mode: rec.execution_mode ?? null,
    displayStatus,
    displayStatusLabel: getDisplayStatusLabel(rec, { mode }),
    displayStatusShortLabel: getCompactStatusLabel(rec, { mode }),
    block_reason: rec.block_reason ?? null,
    blockedHint: getBlockedStatusHint(rec),
    contextBadge: getRecommendationContextBadge(rec),
    user_action: rec.user_action ?? null,
  }
}
