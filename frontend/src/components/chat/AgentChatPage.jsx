"use client"
import { useAuth } from "@/hooks/useAuth"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Sparkles, Wrench, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChatMessage } from "@/components/chat/ChatMessage"
import { agentChat } from "@/lib/api"

const SUGGESTED_PROMPTS = [
  "Analyze my portfolio",
  "Analyze AAPL",
  "What stocks do I own?",
  "Should I buy NVDA?",
  "What are my biggest risks?",
  "Show my recommendation history",
]

export function AgentChatPage() {
  const { userId } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed || loading) return
    setError(null)

    const userMsg = { id: `u_${Date.now()}`, role: "user", content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const data = await agentChat(userId, trimmed)
      const assistantMsg = {
        id: `a_${Date.now()}`,
        role: "assistant",
        content: data.response || 'No response from agent.',
        toolCalls: data.toolCalls || [],
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, {
        id: `e_${Date.now()}`,
        role: "assistant",
        content: `Error: ${err.message}`,
        isError: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Agent chat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask StockSense to analyze stocks, review your portfolio, or generate recommendations.
        </p>
      </div>

      <Card className="flex min-h-[560px] flex-col rounded-2xl border-white/10 bg-white/[0.03]">
        <CardContent className="flex flex-1 flex-col gap-4 p-4">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map(p => (
                <Button key={p} variant="outline" size="sm" className="rounded-full border-white/15 bg-black/30 text-xs" onClick={() => send(p)}>
                  {p}
                </Button>
              ))}
            </div>
          )}

          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-3">
              {messages.map(m => (
                <div key={m.id}>
                  <ChatMessage message={m} />
                  {m.toolCalls?.length > 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ml-4 mt-1 flex flex-wrap gap-1.5">
                      {m.toolCalls.map((tc, i) => (
                        <Badge key={i} variant="outline" className="rounded-md border-blue-500/30 bg-blue-500/10 text-[10px] text-blue-200 gap-1">
                          <Wrench className="size-2.5" />
                          {tc.tool}
                        </Badge>
                      ))}
                    </motion.div>
                  )}
                </div>
              ))}

              <AnimatePresence>
                {loading && (
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <Sparkles className="size-4 animate-pulse text-emerald-300" />
                    Agent reasoning - calling tools and analyzing data…
                  </motion.div>
                )}
              </AnimatePresence>

              {error && !loading && (
                <div className="flex items-center gap-2 text-xs text-rose-300 py-1">
                  <AlertCircle className="size-3.5" />
                  {error}
                </div>
              )}

              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          <div className="flex gap-2 border-t border-white/10 pt-3">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about a stock, your portfolio, or request an analysis…"
              aria-label="Agent chat input"
              className="min-h-[52px] flex-1 resize-none rounded-md border-white/10 bg-black/30"
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
              }}
              disabled={loading}
            />
            <Button className="rounded-md" onClick={() => send()} disabled={loading}>
              <Send className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
