"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PwaInstallBanner() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const dismissed = sessionStorage.getItem("pwa-banner-dismissed")
    if (!dismissed) setOpen(true)
  }, [])

  const dismiss = () => {
    sessionStorage.setItem("pwa-banner-dismissed", "1")
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open ? (
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
                PWA manifest is wired. Hook <span className="font-mono">next-pwa</span> when you ship the service
                worker.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="rounded-xl" variant="secondary" onClick={dismiss}>
                  Maybe later
                </Button>
                <Button size="sm" className="rounded-xl" onClick={dismiss}>
                  Got it
                </Button>
              </div>
            </div>
            <Button size="icon" variant="ghost" className="shrink-0 rounded-xl" onClick={dismiss}>
              <X className="size-4" />
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
