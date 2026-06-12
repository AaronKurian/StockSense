"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getToken, getUserId } from "@/lib/api"
import { LandingView } from "@/components/landing/LandingView"

export function HomePageClient({ structuredData }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = getToken()
    const userId = getUserId()

    if (token && userId) {
      router.replace("/dashboard")
    } else {
      setChecking(false)
    }
  }, [router])

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingView />
    </>
  )
}