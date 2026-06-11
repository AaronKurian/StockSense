export function formatInr(n) {
  if (n == null || Number.isNaN(n)) return "-"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

export function formatPct(n, digits = null) {
  if (n == null || Number.isNaN(n)) return "-"
  const d = digits ?? (Math.abs(n) < 0.1 ? 3 : 2)
  return `${n > 0 ? "+" : ""}${n.toFixed(d)}%`
}

export function formatDeltaUsd(n) {
  if (n == null || Number.isNaN(n)) return "-"
  const sign = n > 0 ? "+" : n < 0 ? "-" : ""
  const abs = Math.abs(n)
  const formatted = abs < 100
    ? abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : abs.toLocaleString("en-US", { maximumFractionDigits: 0 })
  return `${sign}$${formatted}`
}

export function formatNumber(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return "-"
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatTimeAgo(iso) {
  if (!iso) return ""
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
}

export function formatDateTime(iso) {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export function formatTimeOnly(iso) {
  if (!iso) return "-"
  return new Date(iso).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}
