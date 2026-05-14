"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children }) {
  return (
    <TooltipProvider delay={200}>
      {children}
      <Toaster richColors position="top-center" />
    </TooltipProvider>
  )
}
