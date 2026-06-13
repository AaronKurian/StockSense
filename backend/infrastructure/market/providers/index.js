const providerLoaders = {
  default: async () => (await import('./DefaultMarketDataProvider.js')).defaultMarketDataProvider,
}

const providerCache = new Map()

function normalizeProviderName(name) {
  return String(name || 'default').trim().toLowerCase()
}

export async function getMarketDataProvider() {
  const requested = normalizeProviderName(process.env.MARKET_DATA_PROVIDER)
  const loader = providerLoaders[requested]
  if (!loader) {
    const valid = Object.keys(providerLoaders).join(', ')
    throw new Error(`Unsupported MARKET_DATA_PROVIDER '${requested}'. Valid providers: ${valid}`)
  }
  if (!providerCache.has(requested)) providerCache.set(requested, await loader())
  return providerCache.get(requested)
}

export function getAvailableMarketDataProviderNames() {
  return Object.keys(providerLoaders)
}

export function getMarketProviderRuntimeSummary() {
  const selected = normalizeProviderName(process.env.MARKET_DATA_PROVIDER)
  return {
    selected,
    default_stack: selected === 'default'
      ? ['mongodb_cache', 'finnhub_quotes', 'twelvedata_quotes_time_series_profile', 'yahoo_finance_rss']
      : [],
  }
}
