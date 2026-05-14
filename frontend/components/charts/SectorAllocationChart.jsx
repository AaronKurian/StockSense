"use client"

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"
import { demoSectorAllocations } from "@/data/demo-data"

export function SectorAllocationChart() {
  return (
    <div className="h-64 w-full min-h-64 min-w-0 md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={demoSectorAllocations}
            dataKey="value"
            nameKey="sector"
            innerRadius={56}
            outerRadius={88}
            paddingAngle={2}
          >
            {demoSectorAllocations.map((entry) => (
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
