"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { signup, setSession } from "@/lib/api"

export default function SignupPage() {
  useEffect(() => { document.title = "Sign up - StockSense" }, [])
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const { token, user } = await signup(email, password, name)
      setSession(token, user._id)
      router.push("/onboarding")
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
            <Image src="/favicon.png" alt="StockSense" width={48} height={48} className="w-12 h-12" priority />
            <h1 className="text-xl font-semibold">Create your account</h1>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="rounded-md border-white/10 bg-black/30" />
            <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="rounded-md border-white/10 bg-black/30" required />
            <div className="relative">
              <Input type={showPw ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="rounded-md border-white/10 bg-black/30 pr-10" required minLength={4} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <Button type="submit" className="w-full rounded-md bg-gradient-to-r from-emerald-500 to-blue-500" disabled={loading}>
              {loading ? "Creating account…" : "Sign up"}
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account? <Link href="/login" className="text-emerald-300 hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
