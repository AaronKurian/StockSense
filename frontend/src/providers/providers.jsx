"use client"

import { useEffect } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function Providers({ children }) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/sw.js').then(async (reg) => {

      if (Notification.permission !== 'granted') return
      const token = localStorage.getItem('stocksense_token')
      if (!token) return

      const existingSub = await reg.pushManager.getSubscription()
      if (existingSub) return

      try {
        const keyRes = await fetch(`${BASE}/api/push/public-key`)
        const { publicKey } = await keyRes.json()
        if (!publicKey) return

        const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
        await fetch(`${BASE}/api/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ subscription: subscription.toJSON() })
        })
        console.log('[PWA] Auto-subscribed to push notifications')
      } catch (err) {
        console.warn('[PWA] Auto-subscribe failed:', err.message)
      }
    }).catch(() => {})
  }, [])

  return (
    <TooltipProvider delay={200}>
      {children}
      <Toaster richColors position="top-center" />
    </TooltipProvider>
  )
}
