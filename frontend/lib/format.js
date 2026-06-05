export function formatInr(n) {
  if (n == null || Number.isNaN(n)) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}

export function formatPct(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—"
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`
}

export function formatNumber(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return "—"
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
