"use client"

import { useState } from "react"
import { AgentChatPage } from "@/components/chat/AgentChatPage"
import { AgentStatusPage } from "@/components/chat/AgentStatusPage"
import { MessageSquare, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

export default function Page() {
  const [tab, setTab] = useState("status")

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-md border border-white/10 bg-black/30 p-1 w-fit">
        <button
          onClick={() => setTab("status")}
          className={cn("flex items-center gap-1.5 rounded-sm cursor-pointer px-3 py-1.5 text-xs transition-all", tab === "status" ? "bg-emerald-500/20 text-emerald-200" : "text-muted-foreground hover:text-foreground")}
        >
          <Activity className="size-3.5" /> Agent Status
        </button>
        <button
          onClick={() => setTab("chat")}
          className={cn("flex items-center gap-1.5 rounded-sm cursor-pointer px-3 py-1.5 text-xs transition-all", tab === "chat" ? "bg-emerald-500/20 text-emerald-200" : "text-muted-foreground hover:text-foreground")}
        >
          <MessageSquare className="size-3.5" /> Chat
        </button>
      </div>
      {tab === "status" ? <AgentStatusPage /> : <AgentChatPage />}
    </div>
  )
}
