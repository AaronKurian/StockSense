"use client"

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

/**
 * ConfidenceTrendChart — accepts data prop.
 * data: [{ day: 'Mon', avg: 72 }, ...]
 * If no data, shows empty state.
 */
export function ConfidenceTrendChart({ data }) {
  if (!data || !data.length) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Not enough data for confidence trend yet.
      </div>
    )
  }

  return (
    <div className="h-56 w-full min-h-56 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            stroke="#64748b"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(2,6,23,0.92)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
            }}
          />
          <Line type="monotone" dataKey="avg" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
