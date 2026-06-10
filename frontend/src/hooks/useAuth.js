"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getUserId, getToken, clearSession, fetchMe } from "@/lib/api"

export function useAuth() {
  const router = useRouter()
  const [userId] = useState(() => getUserId())
  const [user, setUser] = useState(null)

  useEffect(() => {
    const token = getToken()
    if (!userId || !token) {
      router.replace('/login')
      return
    }
    fetchMe(token).then(setUser).catch(() => { clearSession(); router.replace('/login') })
  }, [userId, router])

  const logout = () => {
    clearSession()
    router.replace('/login')
  }

  return { userId, user, logout }
}
