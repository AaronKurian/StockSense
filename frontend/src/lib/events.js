
export const EVENTS = {
  ACTIONS_CHANGED: 'stocksense:actions-changed',
  SIGNALS_CHANGED: 'stocksense:signals-changed',
  NOTIFICATIONS_CHANGED: 'stocksense:notifications-changed',
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
