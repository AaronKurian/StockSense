"use client"

import { useEffect, useState, useCallback } from "react"

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState('default')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setIsSupported(supported)
    if (supported) {
      setPermission(Notification.permission)
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => setIsSubscribed(!!sub))
      }).catch(() => {})
    }
  }, [])

  const subscribe = useCallback(async () => {
    if (!isSupported) return false
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') return false

      const reg = await navigator.serviceWorker.ready

      const res = await fetch(`${BASE}/api/push/public-key`)
      const { publicKey } = await res.json()
      if (!publicKey) return false

      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
      const token = localStorage.getItem('stocksense_token')
      await fetch(`${BASE}/api/push/subscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ subscription: subscription.toJSON() }) })
      setIsSubscribed(true)
      return true
    } catch { return false }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        const token = localStorage.getItem('stocksense_token')
        await fetch(`${BASE}/api/push/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ endpoint: subscription.endpoint }) })
        await subscription.unsubscribe()
      }
      setIsSubscribed(false)
    } catch {}
  }, [])

  return { isSupported, isSubscribed, permission, subscribe, unsubscribe }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
