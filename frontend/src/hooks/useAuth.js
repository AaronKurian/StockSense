"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getUserId, getToken, clearSession, fetchMe } from "@/lib/api"
import { onProfileChanged } from "@/lib/events"

export function useAuth() {
  const router = useRouter()
  const [userId, setUserId] = useState(null)
  const [user, setUser] = useState(null)

  const refreshUser = useCallback(() => {
    const token = getToken()
    if (!token) return Promise.resolve(null)
    return fetchMe(token).then(u => { setUser(u); return u })
  }, [])

  useEffect(() => {
    const id = getUserId()
    const token = getToken()
    setUserId(id)
    if (!id || !token) {
      router.replace('/login')
      return
    }
    fetchMe(token).then(setUser).catch(() => { clearSession(); router.replace('/login') })
  }, [router])

  useEffect(() => {
    return onProfileChanged((user) => {
      if (user) setUser(user)
    })
  }, [])

  const logout = () => {
    clearSession()
    router.replace('/login')
  }

  return { userId, user, logout, refreshUser }
}
