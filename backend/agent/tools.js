import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import {
  get_latest_price, get_price_context, get_market_news,
  get_portfolio, get_watchlist, saveRecommendation, recordFeedback
} from '../services/agent.js';

export const getLatestPrice = new FunctionTool({
  name: 'get_latest_price',
  description: 'Get the latest cached price, volume, and change percentage for a stock ticker. Updated in real-time via Twelve Data WebSocket.',
  parameters: z.object({
    ticker: z.string().describe('Stock ticker symbol, e.g. AAPL, MSFT, NVDA'),
  }),
  execute: async ({ ticker }) => {
    const doc = await get_latest_price(ticker.toUpperCase());
    return doc || { ticker: ticker.toUpperCase(), price: null, volume: null, change_percent: null, updated_at: null };
  },
});

export const getPriceContext = new FunctionTool({
  name: 'get_price_context',
  description: 'Get technical price context for a ticker: 7-day/30-day change, trend direction, 50DMA/200DMA position, volume spike detection. Uses Twelve Data time_series API.',
  parameters: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
  }),
  execute: async ({ ticker }) => {
    const ctx = await get_price_context(ticker.toUpperCase());
    return ctx || { current_price: null, seven_day_change_pct: null, thirty_day_change_pct: null, trend: null, above_50dma: null, above_200dma: null, volume_spike: null };
  },
});

export const getMarketNews = new FunctionTool({
  name: 'get_market_news',
  description: 'Get up to 5 recent news headlines for a stock ticker. Use this to understand current market sentiment and catalysts.',
  parameters: z.object({
    ticker: z.string().describe('Stock ticker symbol'),
  }),
  execute: ({ ticker }) => get_market_news(ticker.toUpperCase()),
});

export const getPortfolio = new FunctionTool({
  name: 'get_portfolio',
  description: 'Get all portfolio positions for a user including ticker, quantity, average price, and sector.',
  parameters: z.object({
    userId: z.string().describe('User identifier'),
  }),
  execute: async ({ userId }) => (await get_portfolio(userId)) || [],
});

export const getWatchlist = new FunctionTool({
  name: 'get_watchlist',
  description: 'Get all watchlist items for a user. Returns tickers being actively monitored across all watchlists.',
  parameters: z.object({
    userId: z.string().describe('User identifier'),
  }),
  execute: async ({ userId }) => (await get_watchlist(userId)) || [],
});

export const saveRec = new FunctionTool({
  name: 'save_recommendation',
  description: 'Save an AI-generated recommendation to the recommendation_log. Call this after completing analysis to persist the signal. Valid signals: BUY, HOLD, EXIT, WATCH, REBALANCE.',
  parameters: z.object({
    userId: z.string().describe('User identifier'),
    ticker: z.string().describe('Stock ticker symbol'),
    signal: z.enum(['BUY', 'HOLD', 'EXIT', 'WATCH', 'REBALANCE']).describe('Recommendation signal'),
    confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
    rationale: z.string().describe('Explanation of the recommendation'),
    supporting_factors: z.array(z.string()).describe('Evidence supporting the recommendation'),
    risks: z.array(z.string()).describe('Identified risks'),
  }),
  execute: (params) => saveRecommendation(params),
});

export const recordFb = new FunctionTool({
  name: 'record_feedback',
  description: 'Record user feedback on a recommendation. This feeds the learning loop. Valid actions: confirmed, ignored, snoozed.',
  parameters: z.object({
    recId: z.string().describe('MongoDB _id of the recommendation'),
    user_action: z.enum(['confirmed', 'ignored', 'snoozed']).describe('User action on the recommendation'),
  }),
  execute: ({ recId, user_action }) => recordFeedback(recId, user_action),
});

export const allTools = [getLatestPrice, getPriceContext, getMarketNews, getPortfolio, getWatchlist, saveRec, recordFb];
