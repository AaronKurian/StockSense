import { MarketDataProvider } from '../MarketDataProvider.js'
import { fetchTimeSeries } from '../../../services/twelvedata.js'
import { getLatestPricesBatch, refreshQuotesBatch, resolveLatestPrice } from '../../../services/prices.js'
import { getMetadataBatch, getTickerMetadata } from '../../../services/metadata.js'
import { getOrFetchCached, CACHE_TTL_MS } from '../../../services/marketCache.js'
import { logApiUsage } from '../../../lib/apiUsage.js'

function normalizeTicker(ticker) {
  if (!ticker) throw new Error('ticker is required')
  return String(ticker).trim().toUpperCase()
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export class DefaultMarketDataProvider extends MarketDataProvider {
  get providerName() {
    return 'default'
  }

  async getLatestPrice(ticker, options = {}) {
    const result = await resolveLatestPrice(ticker, options)
    return result.ok ? result.doc : null
  }

  refreshQuotes(tickers, options = {}) {
    return refreshQuotesBatch(tickers, options)
  }

  getLatestPricesBatch(tickers) {
    return getLatestPricesBatch(tickers)
  }

  async computePriceContext(ticker) {
    const t = normalizeTicker(ticker)
    let ts
    try {
      ts = await fetchTimeSeries(t, '1day', 60, { source: 'price_context' })
    } catch {
      const priceResult = await resolveLatestPrice(t, { source: 'price_context_fallback' })
      if (priceResult.ok) {
        return {
          current_price: priceResult.price,
          seven_day_change_pct: null,
          thirty_day_change_pct: null,
          trend: 'neutral',
          above_50dma: null,
          above_200dma: null,
          volume_spike: false,
          price_source: priceResult.source,
          partial: true,
        }
      }
      return null
    }
    if (!ts?.values?.length) return null

    const values = ts.values.map(v => ({ close: Number(v.close), volume: Number(v.volume || 0) }))
    const latest = values[0]
    const closeAt = (n) => values.length > n ? values[n].close : null

    const sevenClose = closeAt(7)
    const thirtyClose = closeAt(30)
    const sevenDayChangePct = sevenClose ? ((latest.close - sevenClose) / sevenClose) * 100 : null
    const thirtyDayChangePct = thirtyClose ? ((latest.close - thirtyClose) / thirtyClose) * 100 : null

    const dma = (n) => values.length >= n ? mean(values.slice(0, n).map(x => x.close)) : null
    const dma50 = dma(50)
    const dma200 = dma(200)

    let trend = 'neutral'
    if (sevenDayChangePct != null && thirtyDayChangePct != null) {
      if (sevenDayChangePct > 1 && thirtyDayChangePct > 1) trend = 'bullish'
      else if (sevenDayChangePct < -1 && thirtyDayChangePct < -1) trend = 'bearish'
    } else if (sevenDayChangePct != null) {
      trend = sevenDayChangePct > 1 ? 'bullish' : sevenDayChangePct < -1 ? 'bearish' : 'neutral'
    }

    let volumeSpike = false
    if (values.length >= 5) {
      const recent = values.slice(1, 31).map(v => v.volume).filter(v => v > 0)
      if (recent.length >= 3 && mean(recent) > 0 && latest.volume > mean(recent) * 2) volumeSpike = true
    }

    return {
      current_price: latest.close,
      seven_day_change_pct: sevenDayChangePct != null ? Number(sevenDayChangePct.toFixed(3)) : null,
      thirty_day_change_pct: thirtyDayChangePct != null ? Number(thirtyDayChangePct.toFixed(3)) : null,
      trend,
      above_50dma: dma50 != null ? latest.close > dma50 : null,
      above_200dma: dma200 != null ? latest.close > dma200 : null,
      volume_spike: volumeSpike,
    }
  }

  async getPriceContext(ticker) {
    const t = normalizeTicker(ticker)
    const { data } = await getOrFetchCached('price_context_cache', t, CACHE_TTL_MS.price_context, () => this.computePriceContext(t))
    return data
  }

  async fetchMarketNewsRaw(ticker) {
    const t = normalizeTicker(ticker)
    logApiUsage({ provider: 'yahoo', endpoint: 'rss', ticker: t, source: 'market_news' })
    const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(t)}&region=US&lang=en-US`
    let xml
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'StockSense/1.0' } })
      if (!resp.ok) return []
      xml = await resp.text()
    } catch {
      return []
    }

    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || []
    return items.slice(0, 5).map(item => {
      const title = (item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || item.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim()
      const pub = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || null
      return title ? { headline: title, published_at: pub } : null
    }).filter(Boolean)
  }

  async getMarketNews(ticker) {
    const t = normalizeTicker(ticker)
    const { data } = await getOrFetchCached('market_news_cache', t, CACHE_TTL_MS.market_news, () => this.fetchMarketNewsRaw(t))
    return data || []
  }

  getTickerMetadata(ticker) {
    return getTickerMetadata(ticker)
  }

  getMetadataBatch(tickers) {
    return getMetadataBatch(tickers)
  }

  async getMarketIntelligence(ticker) {
    const t = normalizeTicker(ticker)
    const [latestPrice, priceContext, marketNews] = await Promise.allSettled([
      this.getLatestPrice(t),
      this.getPriceContext(t),
      this.getMarketNews(t),
    ])
    return {
      ticker: t,
      latest_price: latestPrice.status === 'fulfilled' ? latestPrice.value : null,
      price_context: priceContext.status === 'fulfilled' ? priceContext.value : null,
      market_news: marketNews.status === 'fulfilled' ? marketNews.value : [],
      provider: this.providerName,
    }
  }
}

export const defaultMarketDataProvider = new DefaultMarketDataProvider()
