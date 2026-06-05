"use client"

import { motion } from "framer-motion"
import ReactMarkdown from "react-markdown"
import { cn } from "@/lib/utils"

export function ChatMessage({ message }) {
  const isUser = message.role === "user"

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[min(720px,92%)] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
        message.isError
          ? "border-rose-500/25 bg-rose-500/10 text-rose-100"
          : isUser
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-50"
            : "border-white/10 bg-white/[0.04] text-foreground",
      )}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown components={{
            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-emerald-100">{children}</strong>,
            ul: ({ children }) => <ul className="my-2 list-disc pl-4">{children}</ul>,
            ol: ({ children }) => <ol className="my-2 list-decimal pl-4">{children}</ol>,
            li: ({ children }) => <li className="my-0.5">{children}</li>,
            h2: ({ children }) => <h2 className="text-base font-semibold mt-3 mb-1">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
          }}>
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </motion.div>
  )
}
