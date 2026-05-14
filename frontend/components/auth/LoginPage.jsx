"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowRight, Lock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export function LoginPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 size-[420px] rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 size-[380px] rounded-full bg-blue-500/15 blur-3xl" />
      </div>
      <div className="relative mx-auto grid min-h-dvh max-w-6xl md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden flex-col justify-between border-r border-white/10 bg-black/30 p-10 md:flex"
        >
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-blue-500/30 ring-1 ring-white/10">
                <Sparkles className="size-5 text-emerald-200" />
              </div>
              <span className="text-sm font-semibold">StockSense</span>
            </div>
            <h2 className="mt-10 max-w-md text-4xl font-semibold leading-tight tracking-tight">
              Signals first. <span className="text-gradient">Chat second.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              Log in to your proactive command center — demo UI only, no authentication backend yet.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} StockSense demo</p>
        </motion.div>
        <div className="flex items-center justify-center p-6 md:p-12">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
            <Card className="rounded-[1.75rem] border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
                <p className="text-sm text-muted-foreground">Use any credentials — this is UI only.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full rounded-xl border-white/15 bg-black/30">
                  Continue with Google
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Separator className="bg-white/10" />
                  or email
                  <Separator className="bg-white/10" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="you@company.com" className="rounded-xl border-white/10 bg-black/30" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" placeholder="••••••••" className="rounded-xl border-white/10 bg-black/30" />
                </div>
                <Button asChild className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500 text-emerald-950">
                  <Link href="/dashboard">
                    Continue
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  No account?{" "}
                  <Link href="/signup" className="text-emerald-300 hover:underline">
                    Create one
                  </Link>
                </p>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-muted-foreground">
                  <Lock className="size-3.5 text-emerald-300" />
                  Auth will route through Express + Mongo later.
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
