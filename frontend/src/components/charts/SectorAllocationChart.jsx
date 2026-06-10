"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"

const PALETTE = [
  "hsl(199 89% 48%)",
  "hsl(160 84% 39%)",
  "hsl(217 91% 60%)",
  "hsl(280 65% 60%)",
  "hsl(38 92% 50%)",
  "hsl(215 16% 40%)",
  "hsl(330 70% 55%)",
  "hsl(90 60% 40%)",
]

export function SectorAllocationChart({ data }) {

  const chartData = Array.isArray(data) && data.length > 0
    ? data.map((d, i) => ({
        sector: d.sector ?? 'Unknown',
        value:  Math.round((d.weight ?? 0) * 100),
        color:  PALETTE[i % PALETTE.length],
      }))
    : []

  if (!chartData.length) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No sector data - add portfolio positions with sectors.
      </div>
    )
  }

  return (
    <div className="h-64 w-full min-h-64 min-w-0 md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="sector"
            innerRadius={56}
            outerRadius={88}
            paddingAngle={2}
          >
            {chartData.map((entry) => (
              <Cell key={entry.sector} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "rgba(2,6,23,0.92)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
            }}
            formatter={(value) => [`${value}%`, "Weight"]}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
