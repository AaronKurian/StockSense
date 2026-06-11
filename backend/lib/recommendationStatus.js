export function getDisplayStatus(rec, { mode } = {}) {
  if (!rec) return 'UNKNOWN'
  const status = rec.status
  const execution_mode = rec.execution_mode
  const signal = rec.signal
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
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXECUTED_AUTOMATICALLY: 'Executed Automatically',
  EXECUTED_MANUALLY: 'Executed Manually',
  EXPIRED: 'Expired',
  BLOCKED: 'Blocked',
  FAILED: 'Failed',
  UNKNOWN: 'Unknown',
}

export const BLOCK_REASON_LABELS = {
  price_unavailable: 'Price Unavailable',
}

export function getDisplayStatusLabel(rec, opts) {
  const key = getDisplayStatus(rec, opts)
  if (key === 'BLOCKED') {
    return BLOCK_REASON_LABELS[rec.block_reason] || rec.block_reason?.replace(/_/g, ' ') || DISPLAY_STATUS_LABELS.BLOCKED
  }
  return DISPLAY_STATUS_LABELS[key] || key
}
