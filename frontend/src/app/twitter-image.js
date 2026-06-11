import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px",
          backgroundColor: "#020617",
          backgroundImage:
            "radial-gradient(circle at 15% 15%, rgba(16,185,129,0.22), transparent 45%), radial-gradient(circle at 85% 0%, rgba(59,130,246,0.2), transparent 45%)",
          color: "#E2E8F0",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "58px",
              height: "58px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #10B981, #3B82F6)",
            }}
          />
          <div style={{ fontSize: 36, fontWeight: 700 }}>StockSense</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "900px" }}>
          <div style={{ fontSize: 64, lineHeight: 1.08, fontWeight: 800 }}>
            AI investment intelligence
            <br />
            with explainable signals
          </div>
          <div style={{ fontSize: 28, color: "#94A3B8", lineHeight: 1.35 }}>
            Portfolio-aware recommendations, transparent reasoning and human-controlled decisions.
          </div>
        </div>

        <div style={{ fontSize: 22, color: "#94A3B8" }}>
          Informational signals only · Not financial advice
        </div>
      </div>
    ),
    { ...size }
  )
}
