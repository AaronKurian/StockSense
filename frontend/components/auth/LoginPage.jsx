"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Brain } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { signin, setSession } from "@/lib/api"

export function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { token, user } = await signin(email, password)
      setSession(token, user._id)
      router.push("/dashboard")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm rounded-2xl border-white/10 bg-white/[0.03]">
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-blue-500/30 ring-1 ring-white/10">
              <Brain className="size-6 text-emerald-300" />
            </div>
            <h1 className="text-xl font-semibold">Sign in to StockSense</h1>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl border-white/10 bg-black/30" required />
            </div>
            <div>
              <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="rounded-xl border-white/10 bg-black/30" required />
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <Button type="submit" className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-blue-500" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            No account? <Link href="/signup" className="text-emerald-300 hover:underline">Sign up</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
