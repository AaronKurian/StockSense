"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

/**
 * SignalAccuracyChart — accepts data prop.
 * data: [{ month: 'Jan', accuracy: 68 }, ...]
 * If no data, shows empty state.
 */
export function SignalAccuracyChart({ data }) {
  if (!data || !data.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Not enough history for accuracy trend yet.
      </div>
    )
  }

  return (
    <div className="h-64 w-full min-h-64 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <defs>
            <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
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
            formatter={(v) => [`${v}%`, "Accuracy"]}
          />
          <Bar dataKey="accuracy" fill="url(#accGrad)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
