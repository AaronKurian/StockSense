import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connect, getDb } from './config/db.js'
import { requireAuth } from './middleware/auth.js'
import { startWebSocket, stopWebSocket, getSubscribedTickers } from './services/websocket.js'
import { addClient, removeClient, getClientCount } from './services/sse.js'
import { startScheduler } from './services/scheduler.js'
import { initPush } from './services/push.js'
import { info, warn, requestLogger } from './lib/logger.js'
import { getAIProviderRuntimeSummary } from './infrastructure/ai/providers/index.js'
import { getMarketProviderRuntimeSummary } from './infrastructure/market/providers/index.js'
import {
  registerAgentRoutes,
  registerAuthRoutes,
  registerDashboardRoutes,
  registerLearningRoutes,
  registerNotificationRoutes,
  registerOnboardingRoutes,
  registerPortfolioRoutes,
  registerPreferenceRoutes,
  registerPriceRoutes,
  registerPushRoutes,
  registerSignalRoutes,
  registerToolRoutes,
  registerTradeRoutes,
  registerWatchlistRoutes,
} from './routes/index.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 3001

function logProviderRuntimeConfig() {
  info('startup', 'Provider runtime configuration', {
    ai: getAIProviderRuntimeSummary(),
    market_data: getMarketProviderRuntimeSummary(),
    mcp: {
      enabled: process.env.MCP_ENABLED === 'true',
      write_enabled: process.env.MCP_WRITE_ENABLED !== 'false',
      url_configured: !!process.env.MCP_SERVER_URL,
    },
  })
}

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }))
app.use(express.json())
app.use(requestLogger)

app.get('/', (_req, res) => res.type('text/plain').send('StockSense backend'))

app.get('/health', async (_req, res) => {
  const mcpUrl = process.env.MCP_SERVER_URL || 'http://localhost:8080/mcp'
  let mcpStatus = process.env.MCP_ENABLED === 'true' ? 'disconnected' : 'disabled'

  if (process.env.MCP_ENABLED === 'true') {
    try {
      const r = await fetch(mcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 0,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'healthcheck', version: '1.0' },
          },
        }),
        signal: AbortSignal.timeout(3000),
      })
      if (r.ok) mcpStatus = 'connected'
    } catch {}
  }

  res.json({
    status: 'ok',
    mongodb: getDb() ? 'connected' : 'disconnected',
    websocket: getSubscribedTickers().length > 0 ? 'connected' : 'disconnected',
    mcp: mcpStatus,
    agent: 'ready',
  })
})

app.get('/api/ws/status', (_req, res) => {
  res.json({ subscribed_count: getSubscribedTickers().length, tickers: getSubscribedTickers() })
})

app.get('/api/prices/stream', (req, res) => {
  addClient(res)
  req.on('close', () => removeClient(res))
})

app.get('/api/prices/stream/status', (_req, res) => {
  res.json({ connected_clients: getClientCount() })
})

registerAuthRoutes(app)

function protectUserRequest(req, res, next) {
  const publicPaths = new Set([
    '/api/push/public-key',
    '/api/prices/stream',
    '/api/prices/stream/status',
    '/api/ws/status',
  ])
  const shouldProtect = req.path.startsWith('/api/') || req.path.startsWith('/agent/')
  if (!shouldProtect || publicPaths.has(req.path)) return next()

  return requireAuth(req, res, () => {
    Object.defineProperty(req, 'query', {
      value: { ...(req.query || {}), userId: req.userId },
      configurable: true,
      enumerable: true,
      writable: true,
    })
    if (req.body && typeof req.body === 'object') req.body.userId = req.userId
    req.authenticatedUserId = req.userId
    next()
  })
}

app.use(protectUserRequest)

registerToolRoutes(app)
registerPortfolioRoutes(app)
registerWatchlistRoutes(app)
registerSignalRoutes(app)
registerPriceRoutes(app)
registerPreferenceRoutes(app)
registerTradeRoutes(app)
registerPushRoutes(app)
registerNotificationRoutes(app)
registerOnboardingRoutes(app)
registerAgentRoutes(app)
registerDashboardRoutes(app)
registerLearningRoutes(app)

async function start() {
  logProviderRuntimeConfig()

  try {
    const mongo = await connect(process.env.MONGODB_URI)
    if (mongo) info('startup', 'MongoDB connected')
    else warn('startup', 'MongoDB unavailable')
  } catch (err) {
    warn('startup', 'MongoDB connect failed', { error: err.message })
  }

  app.listen(port, () => info('startup', `Server listening on port ${port}`))

  if (process.env.TWELVEDATA_API_KEY) {
    startWebSocket()
    info('startup', 'WebSocket started')
  } else {
    warn('startup', 'TWELVEDATA_API_KEY not set - WebSocket disabled')
  }

  initPush()
  startScheduler()
  info('startup', 'All services initialized')
}

process.on('SIGTERM', () => {
  info('shutdown', 'SIGTERM received')
  stopWebSocket()
  process.exit(0)
})

process.on('SIGINT', () => {
  info('shutdown', 'SIGINT received')
  stopWebSocket()
  process.exit(0)
})

start()
