"use client"

import { motion } from "framer-motion"
import ReactMarkdown from "react-markdown"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function ChatMessage({ message }) {
  const isUser = message.role === "user"

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[min(720px,92%)] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-50"
            : "border-white/10 bg-white/[0.04] text-foreground",
        )}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
              strong: ({ children }) => (
                <strong className="font-semibold text-emerald-100">{children}</strong>
              ),
              ul: ({ children }) => <ul className="my-2 list-disc pl-4">{children}</ul>,
              li: ({ children }) => <li className="my-0.5">{children}</li>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
        {message.attachments?.map((a) =>
          a.type === "stock" ? (
            <Card
              key={a.ticker}
              className="mt-3 rounded-xl border-emerald-500/25 bg-black/40 p-3 text-xs"
            >
              <p className="font-semibold text-emerald-200">{a.ticker}</p>
              <p className="text-muted-foreground">Inline stock context card (demo)</p>
            </Card>
          ) : null,
        )}
      </div>
    </motion.div>
  )
}
