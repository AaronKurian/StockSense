"use client"

import { motion } from "framer-motion"
import { Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionHref,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center"
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
        <Icon className="size-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {actionHref && actionLabel ? (
        <Button asChild className="mt-6 rounded-xl">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </motion.div>
  )
}
