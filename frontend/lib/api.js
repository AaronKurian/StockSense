import { useEffect, useRef } from 'react'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'Content-Type': 'application/json', ...options.headers }, ...options })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error || `API error ${res.status}`)
  return json
}

export function signup(email, password, name) {
  return apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name }) })
}

export function signin(email, password) {
  return apiFetch('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function fetchMe(token) {
  return apiFetch('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
}

export function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('stocksense_token')
}

export function getUserId() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('stocksense_userId')
}

export function setSession(token, userId) {
  localStorage.setItem('stocksense_token', token)
  localStorage.setItem('stocksense_userId', userId)
}

export function clearSession() {
  localStorage.removeItem('stocksense_token')
  localStorage.removeItem('stocksense_userId')
}

export function fetchPortfolio(userId) {
  return apiFetch(`/api/portfolio?userId=${encodeURIComponent(userId)}`)
}

export function fetchSectorAllocation(userId) {
  return apiFetch(`/api/portfolio/sectors?userId=${encodeURIComponent(userId)}`)
}

export function fetchWatchlists(userId) {
  return apiFetch(`/api/watchlists?userId=${encodeURIComponent(userId)}`)
}

export function fetchWatchlistItems(watchlistId, userId) {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : ''
  return apiFetch(`/api/watchlists/${encodeURIComponent(watchlistId)}/items${q}`)
}

export function fetchSignals(userId, { limit = 50, signal = null, since = null } = {}) {
  const params = new URLSearchParams({ userId })
  if (limit) params.set('limit', String(limit))
  if (signal) params.set('signal', signal)
  if (since) params.set('since', since)
  return apiFetch(`/api/signals?${params}`)
}

export function patchSignalFeedback(id, user_action) {
  return apiFetch(`/api/signals/${encodeURIComponent(id)}/feedback`, { method: 'PATCH', body: JSON.stringify({ user_action }) })
}

export function fetchLatestPrice(ticker) {
  return apiFetch(`/api/prices/${encodeURIComponent(ticker.toUpperCase())}`)
}

export function useSSEPrices(onPrice) {
  const cbRef = useRef(onPrice)
  cbRef.current = onPrice

  useEffect(() => {
    if (typeof window === 'undefined') return
    const es = new EventSource(`${BASE}/api/prices/stream`)
    es.addEventListener('price', (e) => {
      try { cbRef.current(JSON.parse(e.data)) } catch {}
    })
    return () => es.close()
  }, [])
}
