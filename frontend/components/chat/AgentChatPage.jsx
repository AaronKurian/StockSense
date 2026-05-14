"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { ChatMessage } from "@/components/chat/ChatMessage"
import { demoAgentMessages, demoSuggestedPrompts } from "@/data/demo-data"

export function AgentChatPage() {
  const [messages, setMessages] = useState(demoAgentMessages)
  const [input, setInput] = useState("")
  const [typing, setTyping] = useState(false)

  const send = (text) => {
    const trimmed = (text ?? input).trim()
    if (!trimmed) return
    const userMsg = { id: `u_${Date.now()}`, role: "user", content: trimmed, createdAt: new Date().toISOString() }
    setMessages((m) => [...m, userMsg])
    setInput("")
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages((m) => [
        ...m,
        {
          id: `a_${Date.now()}`,
          role: "assistant",
          content:
            "**Demo response.** In production this hits your Express API → Agent Builder → Gemini with tool calls (Mongo MCP, market data). For now, enjoy the UI polish.",
          createdAt: new Date().toISOString(),
        },
      ])
    }, 900)
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Agent chat</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Optional depth channel: explanations, portfolio Q&amp;A, and scenario planning — not the primary proactive
          surface.
        </p>
      </div>

      <Card className="flex min-h-[560px] flex-col rounded-2xl border-white/10 bg-white/[0.03]">
        <CardContent className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex flex-wrap gap-2">
            {demoSuggestedPrompts.map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                className="rounded-full border-white/15 bg-black/30 text-xs"
                onClick={() => send(p)}
              >
                {p}
              </Button>
            ))}
          </div>
          <ScrollArea className="flex-1 pr-3">
            <div className="space-y-3">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
              <AnimatePresence>
                {typing ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Sparkles className="size-4 animate-pulse text-emerald-300" />
                    AI typing…
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </ScrollArea>
          <div className="flex gap-2 border-t border-white/10 pt-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a recommendation, sector risk, or portfolio posture…"
              className="min-h-[52px] flex-1 resize-none rounded-xl border-white/10 bg-black/30"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <Button className="rounded-xl" onClick={() => send()}>
              <Send className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
