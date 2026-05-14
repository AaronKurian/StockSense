export const demoUser = {
  id: "usr_demo_01",
  name: "Aarav Mehta",
  email: "aarav@stocksense.app",
  avatarUrl: null,
  initials: "AM",
  riskScore: 62,
  riskLabel: "Moderate-Aggressive",
  joinedAt: "2025-11-02T10:00:00.000Z",
};

export const demoPortfolio = {
  totalCapital: 2_450_000,
  invested: 1_882_400,
  cash: 567_600,
  dayPnl: 12430,
  dayPnlPct: 0.66,
  totalPnl: 186_200,
  totalPnlPct: 10.97,
  currency: "INR",
};

export const demoSectorAllocations = [
  { sector: "IT Services", value: 28, color: "hsl(199 89% 48%)" },
  { sector: "Pharma", value: 18, color: "hsl(160 84% 39%)" },
  { sector: "Banking", value: 22, color: "hsl(217 91% 60%)" },
  { sector: "Auto", value: 12, color: "hsl(280 65% 60%)" },
  { sector: "Energy", value: 10, color: "hsl(38 92% 50%)" },
  { sector: "Cash & equivalents", value: 10, color: "hsl(215 16% 40%)" },
];

export const demoStocks = {
  INFY: {
    ticker: "INFY",
    name: "Infosys Ltd",
    exchange: "NSE",
    sector: "IT Services",
    price: 1524.35,
    change: 18.2,
    changePct: 1.21,
    volume: "4.2M",
    sentiment: "bullish",
    high52: 1994.5,
    low52: 1310.0,
    pe: 22.4,
    mcapCr: 630214,
  },
  SUNPHARMA: {
    ticker: "SUNPHARMA",
    name: "Sun Pharmaceutical",
    exchange: "NSE",
    sector: "Pharma",
    price: 1782.1,
    change: -9.45,
    changePct: -0.53,
    volume: "1.1M",
    sentiment: "neutral",
    high52: 1910.0,
    low52: 1420.0,
    pe: 28.1,
    mcapCr: 427800,
  },
  HDFCBANK: {
    ticker: "HDFCBANK",
    name: "HDFC Bank",
    exchange: "NSE",
    sector: "Banking",
    price: 1689.55,
    change: 12.05,
    changePct: 0.72,
    volume: "6.8M",
    sentiment: "bullish",
    high52: 1880.0,
    low52: 1422.0,
    pe: 17.2,
    mcapCr: 1280000,
  },
  RELIANCE: {
    ticker: "RELIANCE",
    name: "Reliance Industries",
    exchange: "NSE",
    sector: "Energy",
    price: 1288.4,
    change: -6.1,
    changePct: -0.47,
    volume: "5.3M",
    sentiment: "cautious",
    high52: 1600.0,
    low52: 1110.0,
    pe: 24.9,
    mcapCr: 1740000,
  },
  TATAMOTORS: {
    ticker: "TATAMOTORS",
    name: "Tata Motors",
    exchange: "NSE",
    sector: "Auto",
    price: 782.3,
    change: 22.15,
    changePct: 2.91,
    volume: "8.9M",
    sentiment: "bullish",
    high52: 810.0,
    low52: 520.0,
    pe: 14.8,
    mcapCr: 260000,
  },
};

export const demoWatchlistRows = [
  {
    ticker: "INFY",
    ...demoStocks.INFY,
    signal: "BUY",
    confidence: 81,
    sparkline: [1488, 1495, 1490, 1502, 1510, 1505, 1518, 1524],
  },
  {
    ticker: "SUNPHARMA",
    ...demoStocks.SUNPHARMA,
    signal: "HOLD",
    confidence: 64,
    sparkline: [1802, 1795, 1790, 1788, 1784, 1786, 1781, 1782],
  },
  {
    ticker: "HDFCBANK",
    ...demoStocks.HDFCBANK,
    signal: "BUY",
    confidence: 73,
    sparkline: [1665, 1670, 1678, 1680, 1675, 1682, 1688, 1690],
  },
  {
    ticker: "RELIANCE",
    ...demoStocks.RELIANCE,
    signal: "EXIT",
    confidence: 77,
    sparkline: [1310, 1305, 1298, 1295, 1292, 1290, 1289, 1288],
  },
  {
    ticker: "TATAMOTORS",
    ...demoStocks.TATAMOTORS,
    signal: "HOLD",
    confidence: 58,
    sparkline: [755, 760, 765, 770, 772, 775, 780, 782],
  },
];

const signalBase = (overrides) => ({
  id: overrides.id ?? `sig_${overrides.ticker ?? "GEN"}_${overrides.type ?? "SIG"}`,
  createdAt: new Date().toISOString(),
  urgency: "medium",
  supportingFactors: [],
  risks: [],
  ...overrides,
});

export const demoSignals = [
  signalBase({
    id: "sig_infy_buy_01",
    ticker: "INFY",
    name: "Infosys Ltd",
    type: "BUY",
    confidence: 81,
    urgency: "high",
    headline: "Entered target buy zone after overreaction to guidance.",
    rationale:
      "Price retraced into our accumulation band while institutional flow remained net positive. Relative strength vs Nifty IT improved over 5 sessions.",
    supportingFactors: [
      "Entered buy zone after sentiment washout",
      "Positive institutional sentiment (FII + DII)",
      "Sector allocation still within policy band",
    ],
    risks: [
      "Upcoming earnings in 11 days",
      "Weak global IT demand narrative",
      "USD/INR volatility could compress margins outlook",
    ],
    indicators: ["RSI 42", "MACD histogram improving", "Volume dry-up then expansion"],
    targetZone: { low: 1490, high: 1535 },
    stopLoss: 1455,
    sector: "IT Services",
    createdAt: "2026-05-15T07:42:00.000Z",
  }),
  signalBase({
    id: "sig_sun_hold_02",
    ticker: "SUNPHARMA",
    name: "Sun Pharmaceutical",
    type: "HOLD",
    confidence: 64,
    urgency: "low",
    headline: "Defensive pharma bid intact — wait for better add point.",
    rationale:
      "Valuation fair vs peers; US generics pricing stable. Prefer staggered adds only on dips below 1750.",
    supportingFactors: [
      "Defensive sector momentum",
      "Stable US base business",
      "India formulations growth tracking plan",
    ],
    risks: ["FDA inspection cycle", "Currency headwinds on exports"],
    indicators: ["ADX trend moderate", "Beta vs Nifty 0.62"],
    targetZone: { low: 1760, high: 1840 },
    stopLoss: 1710,
    sector: "Pharma",
    createdAt: "2026-05-15T06:18:00.000Z",
  }),
  signalBase({
    id: "sig_rel_exit_03",
    ticker: "RELIANCE",
    name: "Reliance Industries",
    type: "EXIT",
    confidence: 77,
    urgency: "high",
    headline: "Risk/reward skewed — trim ahead of O2C volatility window.",
    rationale:
      "Crack spreads noisy; retail growth strong but priced. Model suggests reducing overweight into event cluster.",
    supportingFactors: ["Valuation stretched vs 5Y median", "Event risk clustering"],
    risks: ["Commodity shock", "Regulatory headlines"],
    indicators: ["Price below 50DMA", "Bearish OBV divergence"],
    targetZone: { low: 1260, high: 1310 },
    stopLoss: null,
    sector: "Energy",
    createdAt: "2026-05-15T05:05:00.000Z",
  }),
  signalBase({
    id: "sig_hdfc_buy_04",
    ticker: "HDFCBANK",
    name: "HDFC Bank",
    type: "BUY",
    confidence: 73,
    urgency: "medium",
    headline: "Liability franchise strength — accumulate on consolidation.",
    rationale:
      "NIM trajectory stabilizing; credit costs benign. Large-cap quality bias aligns with your stated preference.",
    supportingFactors: ["Deposit growth ahead of system", "Asset quality stable"],
    risks: ["Rate cycle inflection", "Competition on unsecured"],
    indicators: ["P/B vs history attractive", "RS vs Bank Nifty positive"],
    targetZone: { low: 1660, high: 1720 },
    stopLoss: 1620,
    sector: "Banking",
    createdAt: "2026-05-14T22:30:00.000Z",
  }),
];

export const demoMarketPulse = [
  {
    id: "mp_1",
    title: "IT sector under pressure",
    summary:
      "Global software spend commentary turned cautious. Domestic large-caps showing relative resilience — agent favors quality over beta.",
    sentiment: "cautious",
    tags: ["IT", "Global macro"],
    updatedAt: "2026-05-15T08:10:00.000Z",
  },
  {
    id: "mp_2",
    title: "Pharma defensive momentum rising",
    summary:
      "Flows rotating into defensives. Generics stability + India growth narrative supporting mid-cap pharma pairs trade.",
    sentiment: "constructive",
    tags: ["Pharma", "Flows"],
    updatedAt: "2026-05-15T07:55:00.000Z",
  },
  {
    id: "mp_3",
    title: "Bank Nifty: credit cycle benign",
    summary:
      "Slippages controlled; unsecured growth monitored. Agent maintaining overweight banks with liability moat.",
    sentiment: "constructive",
    tags: ["Banks", "Credit"],
    updatedAt: "2026-05-15T07:20:00.000Z",
  },
];

export const demoActivityFeed = [
  { id: "a1", type: "signal", text: "New BUY signal generated for INFY", time: "2m ago", ticker: "INFY" },
  { id: "a2", type: "news", text: "IT guidance cuts: agent re-scored watchlist", time: "6m ago" },
  { id: "a3", type: "memory", text: "MongoDB recommendation_log updated — feedback loop", time: "12m ago" },
  { id: "a4", type: "alert", text: "Price trigger: TATAMOTORS > 780", time: "18m ago", ticker: "TATAMOTORS" },
  { id: "a5", type: "agent", text: "Agent Builder orchestration completed (latency 840ms)", time: "24m ago" },
  { id: "a6", type: "mcp", text: "MongoDB MCP: queried watchlist_positions", time: "31m ago" },
  { id: "a7", type: "signal", text: "EXIT signal confidence raised for RELIANCE", time: "44m ago", ticker: "RELIANCE" },
  { id: "a8", type: "news", text: "Pharma US pricing: sentiment stabilizing", time: "1h ago" },
];

export const demoNotifications = [
  {
    id: "n1",
    kind: "BUY",
    title: "BUY INFY",
    body: "Confidence 81% — entered buy zone after guidance washout.",
    ticker: "INFY",
    time: "2026-05-15T07:42:00.000Z",
    read: false,
    actions: ["confirm", "dismiss", "details"],
  },
  {
    id: "n2",
    kind: "EXIT",
    title: "Trim RELIANCE",
    body: "Risk skew elevated — consider reducing overweight into volatility window.",
    ticker: "RELIANCE",
    time: "2026-05-15T05:05:00.000Z",
    read: false,
    actions: ["confirm", "dismiss", "details"],
  },
  {
    id: "n3",
    kind: "rebalance",
    title: "Sector rebalance suggestion",
    body: "IT exposure 4% above your target band after rally.",
    ticker: null,
    time: "2026-05-14T21:10:00.000Z",
    read: true,
    actions: ["confirm", "dismiss", "details"],
  },
  {
    id: "n4",
    kind: "news",
    title: "News: HDFC Bank",
    body: "Analyst day takeaways: NIM path clearer; agent updated model weight.",
    ticker: "HDFCBANK",
    time: "2026-05-14T18:40:00.000Z",
    read: true,
    actions: ["dismiss", "details"],
  },
  {
    id: "n5",
    kind: "trigger",
    title: "Price trigger hit",
    body: "TATAMOTORS crossed 780 — momentum monitor activated.",
    ticker: "TATAMOTORS",
    time: "2026-05-14T15:22:00.000Z",
    read: true,
    actions: ["details", "dismiss"],
  },
];

export const demoRecommendationHistory = [
  {
    id: "h1",
    ticker: "INFY",
    signal: "BUY",
    userAction: "confirmed",
    outcome: "win",
    pnlPct: 4.2,
    confidence: 79,
    accuracyNote: "Model underestimated earnings volatility but direction correct.",
    date: "2026-04-28",
  },
  {
    id: "h2",
    ticker: "SUNPHARMA",
    signal: "HOLD",
    userAction: "ignored",
    outcome: "neutral",
    pnlPct: -0.6,
    confidence: 61,
    accuracyNote: "User skipped — drift contained.",
    date: "2026-04-19",
  },
  {
    id: "h3",
    ticker: "HDFCBANK",
    signal: "BUY",
    userAction: "confirmed",
    outcome: "win",
    pnlPct: 2.1,
    confidence: 74,
    accuracyNote: "High precision on large-cap quality tilt.",
    date: "2026-04-10",
  },
  {
    id: "h4",
    ticker: "RELIANCE",
    signal: "EXIT",
    userAction: "snoozed",
    outcome: "loss",
    pnlPct: -3.4,
    confidence: 72,
    accuracyNote: "Snooze reduced edge — agent learning: tighten urgency on EXIT.",
    date: "2026-03-30",
  },
  {
    id: "h5",
    ticker: "TATAMOTORS",
    signal: "BUY",
    userAction: "confirmed",
    outcome: "win",
    pnlPct: 8.9,
    confidence: 68,
    accuracyNote: "User responds strongly to momentum + dip hybrid signals.",
    date: "2026-03-12",
  },
];

export const demoLearningInsights = [
  {
    id: "l1",
    title: "You respond positively to dip-buy signals",
    detail:
      "When RSI is 35–45 and narrative is sentiment-driven, your confirm rate is 78% vs 52% baseline.",
    strength: "high",
  },
  {
    id: "l2",
    title: "You prefer explainability over speed",
    detail: "Signals with 3+ supporting factors are confirmed 2.1× more often.",
    strength: "medium",
  },
  {
    id: "l3",
    title: "MongoDB memory is converging",
    detail: "recommendation_log outcomes updated 146 times; preference vector drift < 2%.",
    strength: "high",
  },
];

export const demoAgentMessages = [
  {
    id: "m2",
    role: "user",
    content: "Why are you bullish on INFY?",
    createdAt: "2026-05-15T07:59:30.000Z",
  },
  {
    id: "m1",
    role: "assistant",
    content:
      "INFY is attractive here because **price washed out bad news faster than fundamentals**. Want me to compare it to TCS on the same framework?",
    createdAt: "2026-05-15T08:00:00.000Z",
    attachments: [{ type: "stock", ticker: "INFY" }],
  },
];

export const demoSuggestedPrompts = [
  "Why are you bullish on INFY?",
  "Should I reduce IT exposure?",
  "Find undervalued pharma stocks.",
  "Explain my risk score.",
  "What would trigger an EXIT on HDFCBANK?",
];

export const demoOnboardingSteps = [
  {
    key: "risk",
    question: "What is your risk appetite for equities?",
    chips: ["Conservative", "Moderate", "Aggressive", "Opportunistic"],
  },
  {
    key: "capital",
    question: "How much capital are you actively managing with StockSense?",
    chips: ["₹5–10L", "₹10–25L", "₹25L–1Cr", "₹1Cr+"],
  },
  {
    key: "horizon",
    question: "What is your primary investment horizon?",
    chips: ["< 1 year", "1–3 years", "3–7 years", "7+ years"],
  },
  {
    key: "sectors",
    question: "Which sectors do you want the agent to prioritize?",
    chips: ["IT", "Pharma", "Banks", "Auto", "Energy", "Consumer"],
  },
  {
    key: "watchlist",
    question: "Add tickers to your watchlist (comma separated).",
    chips: ["INFY, HDFCBANK", "SUNPHARMA, RELIANCE", "TATAMOTORS, INFY"],
  },
  {
    key: "loss",
    question: "What is your max drawdown tolerance on a single position?",
    chips: ["5%", "8%", "12%", "15%+"],
  },
  {
    key: "notify",
    question: "How should we notify you for high-urgency signals?",
    chips: ["Push + Email", "Push only", "Email digest", "In-app only"],
  },
];

export const demoOnboardingSummary = {
  risk: "Moderate",
  capital: "₹25L–1Cr",
  horizon: "3–7 years",
  sectors: ["IT", "Pharma", "Banks"],
  watchlist: ["INFY", "HDFCBANK", "SUNPHARMA", "RELIANCE", "TATAMOTORS"],
  lossTolerance: "12%",
  notifications: "Push + Email",
};

export const demoMarketSummary = {
  indexName: "Nifty 50",
  indexValue: 24312.45,
  indexChangePct: 0.34,
  breadth: "58% advances",
  status: "open",
  updatedAt: "2026-05-15T08:12:00.000Z",
};

export const demoPortfolioAnalytics = {
  sharpe: 1.12,
  maxDrawdown: -8.4,
  winRate: 63,
  avgConfidence: 71,
  signalCount30d: 42,
};

export const demoArchitectureFlow = [
  { id: "1", label: "User", description: "Preferences, feedback, capital policy", icon: "user" },
  { id: "2", label: "Next.js PWA", description: "Proactive dashboard + SSE-ready client", icon: "layout" },
  { id: "3", label: "Express APIs", description: "Auth, portfolio, signals, webhooks", icon: "server" },
  { id: "4", label: "Agent Builder", description: "Orchestration + tool routing", icon: "bot" },
  { id: "5", label: "Gemini", description: "Reasoning, rationales, structured signals", icon: "sparkles" },
  { id: "6", label: "MongoDB Atlas", description: "Watchlists, history, memory, learning", icon: "database" },
  { id: "7", label: "BUY / HOLD / EXIT", description: "Confidence-scored recommendations", icon: "signal" },
  { id: "8", label: "Web Push", description: "Realtime alerts to devices", icon: "bell" },
  { id: "9", label: "Feedback loop", description: "recommendation_log → preference updates", icon: "refresh" },
];

export const demoMongoConcept = {
  collections: [
    { name: "users", purpose: "Profiles, risk, notification prefs" },
    { name: "watchlists", purpose: "Tickers, targets, agent watch rules" },
    { name: "signals", purpose: "Active + archived AI signals" },
    { name: "recommendation_log", purpose: "Outcomes + user actions for learning" },
    { name: "agent_memory", purpose: "Longitudinal context + summaries" },
  ],
  mcpNote:
    "MongoDB MCP lets agents query collections with governed tools — enabling live memory without brittle SQL joins.",
};

export const demoTestimonials = [
  {
    quote: "Feels like Linear met a hedge fund terminal — but the agent actually explains itself.",
    name: "Sana K.",
    role: "PM, growth fund",
  },
  {
    quote: "The signal cards are absurdly good for a hackathon. Judges asked if it was real.",
    name: "Dev P.",
    role: "Founder",
  },
];

export const demoNewsByTicker = {
  INFY: [
    { id: "news1", title: "Guidance commentary spooks near-term multiples", source: "Mint", time: "3h ago" },
    { id: "news2", title: "Large deal wins continue; margin path debated", source: "Reuters", time: "6h ago" },
  ],
  DEFAULT: [
    { id: "newsx", title: "Global cues mixed; India flows resilient", source: "ET", time: "1h ago" },
  ],
};

export const demoReasoningTimeline = [
  {
    id: "t1",
    time: "2026-05-15T07:40:00.000Z",
    title: "Sentiment shock detected",
    detail: "Headline velocity spiked negative; price dislocated from fundamentals prior.",
  },
  {
    id: "t2",
    time: "2026-05-15T07:41:10.000Z",
    title: "Gemini structured pass",
    detail: "Agent consolidated news + technicals + sector context into a scored hypothesis.",
  },
  {
    id: "t3",
    time: "2026-05-15T07:42:00.000Z",
    title: "Signal emitted",
    detail: "BUY published with confidence 81%, urgency HIGH, risks enumerated.",
  },
];

export const demoPriceSeries = {
  INFY: Array.from({ length: 60 }, (_, i) => ({
    t: i,
    o: 1500 + Math.sin(i / 4) * 8 + i * 0.35,
    h: 1504 + Math.sin(i / 4) * 8 + i * 0.35,
    l: 1496 + Math.sin(i / 4) * 8 + i * 0.35,
    c: 1502 + Math.sin(i / 4) * 8 + i * 0.35,
    v: 400_000 + (i % 7) * 20_000,
  })),
};

export const demoAccuracySeries = [
  { month: "Jan", accuracy: 58 },
  { month: "Feb", accuracy: 61 },
  { month: "Mar", accuracy: 64 },
  { month: "Apr", accuracy: 67 },
  { month: "May", accuracy: 69 },
];

export const demoConfidenceTrend = [
  { day: "Mon", avg: 68 },
  { day: "Tue", avg: 70 },
  { day: "Wed", avg: 69 },
  { day: "Thu", avg: 72 },
  { day: "Fri", avg: 74 },
];

export const demoWatchlistPerformance = [
  { name: "INFY", perf: 4.2 },
  { name: "HDFCBANK", perf: 2.1 },
  { name: "SUNPHARMA", perf: -0.6 },
  { name: "RELIANCE", perf: -3.4 },
  { name: "TATAMOTORS", perf: 8.9 },
];

export function getStockByTicker(ticker) {
  const key = ticker?.toUpperCase();
  return demoStocks[key] || demoStocks.INFY;
}

export function getSignalsForTicker(ticker) {
  return demoSignals.filter((s) => s.ticker === ticker?.toUpperCase());
}

export function getNewsForTicker(ticker) {
  return demoNewsByTicker[ticker?.toUpperCase()] || demoNewsByTicker.DEFAULT;
}
