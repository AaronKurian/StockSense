"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PwaInstallBanner() {
  const [show, setShow] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    console.log('[PWA] Init check')
    console.log('[PWA] standalone:', window.matchMedia('(display-mode: standalone)').matches)
    console.log('[PWA] navigator.standalone:', window.navigator.standalone)

    const checkInstalled = () => {
      const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
      console.log('[PWA] isInstalled:', installed)
      setIsInstalled(installed)
    }
    checkInstalled()

    if (localStorage.getItem('pwa-install-dismissed')) {
      console.log('[PWA] Previously dismissed')
      return
    }

    const beforeInstall = (e) => {
      e.preventDefault()
      console.log('[PWA] beforeinstallprompt fired!')
      setDeferredPrompt(e)
      setShow(true)
    }

    const appInstalled = () => {
      console.log('[PWA] appinstalled event fired!')
      localStorage.setItem('pwa-install-dismissed', '1')
      setShow(false)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', beforeInstall)
    window.addEventListener('appinstalled', appInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall)
      window.removeEventListener('appinstalled', appInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    console.log('[PWA] Install clicked, deferredPrompt:', !!deferredPrompt)
    if (!deferredPrompt) {
      console.log('[PWA] No deferred prompt available — browser may not support install or beforeinstallprompt never fired')
      return
    }
    try {
      setInstalling(true)
      console.log('[PWA] Calling prompt()...')
      deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      console.log('[PWA] User choice:', result.outcome)
      if (result.outcome === 'accepted') {
        setShow(false)
        localStorage.setItem('pwa-install-dismissed', '1')
      }
    } catch (err) {
      console.error('[PWA] Install error:', err)
    } finally {
      setInstalling(false)
      setDeferredPrompt(null)
    }
  }, [deferredPrompt])

  const dismiss = () => {
    localStorage.setItem('pwa-install-dismissed', '1')
    setShow(false)
  }

  if (false && (isInstalled || !show)) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 48, opacity: 0 }}
        className="fixed bottom-20 left-3 right-3 z-40 md:bottom-6 md:left-auto md:right-6 md:w-96"
      >
        <div className="flex items-start gap-3 rounded-2xl border border-white/15 bg-background/95 p-4 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/30 to-blue-500/30">
            <Download className="size-5 text-emerald-200" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Install StockSense</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Get push notifications and instant access from your home screen.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={installing} className="rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500 text-white" onClick={install}>
                {installing ? (
                  <><Loader2 className="size-3.5 mr-1.5 animate-spin" /> Installing...</>
                ) : (
                  <><Download className="size-3.5 mr-1.5" /> Install App</>
                )}
              </Button>
              <Button size="sm" className="rounded-xl" variant="secondary" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </div>
          <Button size="icon" variant="ghost" className="shrink-0 rounded-xl" onClick={dismiss}>
            <X className="size-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
