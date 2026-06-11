export const sectorStocks = {
  Technology: [
    { ticker: "AAPL", name: "Apple" },
    { ticker: "MSFT", name: "Microsoft" },
    { ticker: "NVDA", name: "NVIDIA" },
    { ticker: "AMD", name: "AMD" },
  ],
  Healthcare: [
    { ticker: "JNJ", name: "Johnson & Johnson" },
    { ticker: "UNH", name: "UnitedHealth" },
    { ticker: "PFE", name: "Pfizer" },
    { ticker: "ABBV", name: "AbbVie" },
    { ticker: "MRK", name: "Merck" },
  ],
  Financials: [
    { ticker: "JPM", name: "JPMorgan" },
    { ticker: "BAC", name: "Bank of America" },
    { ticker: "GS", name: "Goldman Sachs" },
    { ticker: "V", name: "Visa" },
    { ticker: "MA", name: "Mastercard" },
  ],
  Energy: [
    { ticker: "XOM", name: "Exxon Mobil" },
    { ticker: "CVX", name: "Chevron" },
    { ticker: "SHEL", name: "Shell" },
    { ticker: "BP", name: "BP" },
    { ticker: "COP", name: "ConocoPhillips" },
  ],
  Industrials: [
    { ticker: "CAT", name: "Caterpillar" },
    { ticker: "GE", name: "GE Aerospace" },
    { ticker: "HON", name: "Honeywell" },
    { ticker: "UPS", name: "UPS" },
    { ticker: "BA", name: "Boeing" },
  ],
  Utilities: [
    { ticker: "NEE", name: "NextEra Energy" },
    { ticker: "DUK", name: "Duke Energy" },
    { ticker: "SO", name: "Southern Co" },
    { ticker: "AEP", name: "American Electric" },
  ],
  "Consumer Defensive": [
    { ticker: "PG", name: "Procter & Gamble" },
    { ticker: "KO", name: "Coca-Cola" },
    { ticker: "PEP", name: "PepsiCo" },
    { ticker: "WMT", name: "Walmart" },
    { ticker: "COST", name: "Costco" },
  ],
  "Consumer Cyclical": [
    { ticker: "AMZN", name: "Amazon" },
    { ticker: "TSLA", name: "Tesla" },
    { ticker: "NKE", name: "Nike" },
    { ticker: "MCD", name: "McDonald's" },
    { ticker: "HD", name: "Home Depot" },
  ],
  "Communication Services": [
    { ticker: "GOOGL", name: "Alphabet" },
    { ticker: "META", name: "Meta" },
    { ticker: "NFLX", name: "Netflix" },
    { ticker: "DIS", name: "Disney" },
    { ticker: "CMCSA", name: "Comcast" },
  ],
  "Real Estate": [
    { ticker: "AMT", name: "American Tower" },
    { ticker: "PLD", name: "Prologis" },
    { ticker: "EQIX", name: "Equinix" },
    { ticker: "SPG", name: "Simon Property" },
  ],
  Materials: [
    { ticker: "LIN", name: "Linde" },
    { ticker: "APD", name: "Air Products" },
    { ticker: "SHW", name: "Sherwin-Williams" },
    { ticker: "FCX", name: "Freeport-McMoRan" },
  ],
}

export function getSectorSuggestions(sectors, limit = 12) {
  const sectorList = Array.isArray(sectors) && sectors.length ? sectors : ["Technology"]
  return sectorList
    .flatMap((s) => sectorStocks[s] || [])
    .filter((item, idx, arr) => arr.findIndex((x) => x.ticker === item.ticker) === idx)
    .slice(0, limit)
}
