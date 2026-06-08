"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts"

/**
 * WatchlistPerformanceChart - accepts data prop.
 * data: [{ name: 'AAPL', perf: 4.2 }, ...]
 * If no data, shows empty state.
 */
export function WatchlistPerformanceChart({ data }) {
  if (!data || !data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Not enough data for performance attribution yet.
      </div>
    )
  }

  return (
    <div className="h-64 w-full min-h-64 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis
            type="number"
            stroke="#64748b"
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#64748b"
            tick={{ fontSize: 11 }}
            width={72}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(2,6,23,0.92)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
            }}
            formatter={(v) => [`${v}%`, "Return"]}
          />
          <Bar dataKey="perf" radius={[0, 6, 6, 0]}>
            {data.map((e) => (
              <Cell
                key={e.name}
                fill={e.perf >= 0 ? "rgba(52,211,153,0.85)" : "rgba(251,113,133,0.85)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
