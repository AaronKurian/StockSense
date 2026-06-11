
export const EVENTS = {
  ACTIONS_CHANGED: 'stocksense:actions-changed',
  SIGNALS_CHANGED: 'stocksense:signals-changed',
  NOTIFICATIONS_CHANGED: 'stocksense:notifications-changed',
  PROFILE_CHANGED: 'stocksense:profile-changed',
}

const INITIAL_SCAN_KEY = 'stocksense:initial-scan'

export function requestInitialAgentScan() {
  if (typeof window !== 'undefined') sessionStorage.setItem(INITIAL_SCAN_KEY, '1')
}

export function consumeInitialAgentScan() {
  if (typeof window === 'undefined') return false
  if (sessionStorage.getItem(INITIAL_SCAN_KEY) !== '1') return false
  sessionStorage.removeItem(INITIAL_SCAN_KEY)
  return true
}

export function emitActionsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTS.ACTIONS_CHANGED))
  }
}

export function emitSignalsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTS.SIGNALS_CHANGED))
  }
}

export function emitNotificationsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTS.NOTIFICATIONS_CHANGED))
  }
}

export function onActionsChanged(handler) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVENTS.ACTIONS_CHANGED, handler)
  return () => window.removeEventListener(EVENTS.ACTIONS_CHANGED, handler)
}

export function onSignalsChanged(handler) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVENTS.SIGNALS_CHANGED, handler)
  return () => window.removeEventListener(EVENTS.SIGNALS_CHANGED, handler)
}

export function onNotificationsChanged(handler) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVENTS.NOTIFICATIONS_CHANGED, handler)
  return () => window.removeEventListener(EVENTS.NOTIFICATIONS_CHANGED, handler)
}

export function emitProfileChanged(user) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTS.PROFILE_CHANGED, { detail: user }))
  }
}

export function onProfileChanged(handler) {
  if (typeof window === 'undefined') return () => {}
  const wrapped = (e) => handler(e.detail)
  window.addEventListener(EVENTS.PROFILE_CHANGED, wrapped)
  return () => window.removeEventListener(EVENTS.PROFILE_CHANGED, wrapped)
}
