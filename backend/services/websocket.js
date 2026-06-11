
import WebSocket from 'ws'
import { getCollection } from '../config/db.js'
import { upsertLatestPrice, refreshQuotesBatch } from './prices.js'
import { broadcastPrice } from './sse.js'
import { info } from '../lib/logger.js'

const WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price'
const HEARTBEAT_INTERVAL_MS = 10_000
const RECONNECT_BASE_MS     = 2_000
const RECONNECT_MAX_MS      = 60_000
const SUBSCRIBE_DELAY_MS    = 500

let ws = null
let heartbeatTimer = null
let reconnectTimer = null
let reconnectDelay = RECONNECT_BASE_MS

let subscribedTickers = new Set()
let isShuttingDown = false
let intentionalClose = false

async function resolveTrackedTickers() {
  const watchlistItemsCol   = getCollection('watchlist_items')
  const portfolioCol        = getCollection('portfolio_positions')

  if (!watchlistItemsCol && !portfolioCol) {
    throw new Error('MongoDB not connected: cannot resolve tracked tickers')
  }

  const tickers = new Set()

  if (watchlistItemsCol) {
    const items = await watchlistItemsCol.find({}, { projection: { ticker: 1 } }).toArray()
    for (const item of items) {
      if (item.ticker) tickers.add(String(item.ticker).trim().toUpperCase())
    }
  }

  if (portfolioCol) {
    const positions = await portfolioCol.find({}, { projection: { ticker: 1 } }).toArray()
    for (const pos of positions) {
      if (pos.ticker) tickers.add(String(pos.ticker).trim().toUpperCase())
    }
  }

  return [...tickers].sort()
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'heartbeat' }))
    }
  }, HEARTBEAT_INTERVAL_MS)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function sendSubscribe(tickers) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  if (!tickers.length) return

  const fresh = tickers.filter(t => !subscribedTickers.has(t))
  if (!fresh.length) return

  ws.send(JSON.stringify({
    action: 'subscribe',
    params: { symbols: fresh.join(',') }
  }))

  for (const t of fresh) subscribedTickers.add(t)
  console.log(`[ws] subscribed to ${fresh.length} ticker(s): ${fresh.slice(0, 10).join(', ')}${fresh.length > 10 ? ' …' : ''}`)
}

async function handleMessage(raw) {
  let msg
  try {
    msg = JSON.parse(raw)
  } catch {
    console.warn('[ws] non-JSON message received:', raw)
    return
  }

  if (msg.event === 'price') {
    const ticker = msg.symbol ? String(msg.symbol).trim().toUpperCase() : null
    if (!ticker) return

    const price         = msg.price        != null ? Number(msg.price)        : null
    const day_volume    = msg.day_volume   != null ? Number(msg.day_volume)   : null

    const updated_at    = msg.timestamp    != null
      ? new Date(Number(msg.timestamp) * 1000).toISOString()
      : new Date().toISOString()

    try {
      const doc = await upsertLatestPrice(ticker, {
        price,
        volume: day_volume,
        change_percent: null,
        updated_at
      })

      broadcastPrice(ticker, doc)
    } catch (err) {
      console.error(`[ws] upsertLatestPrice failed for ${ticker}:`, err.message)
    }
    return
  }

  if (msg.event === 'subscribe-status') {
    const okSymbols = (msg.success || []).map(s => s.symbol).filter(Boolean)
    const failSymbols = (msg.fails || []).map(s => s.symbol).filter(Boolean)
    if (msg.status === 'ok') {
      console.log(`[ws] subscribe-status ok - success: [${okSymbols.join(', ') || '(none)'}]  fails: [${failSymbols.join(', ') || '(none)'}]`)
    } else {
      console.warn('[ws] subscribe-status non-ok:', JSON.stringify(msg))
    }
    if (failSymbols.length) {
      info('prices', 'WebSocket subscribe failed - REST backfill scheduled', {
        tickers: failSymbols,
        source: 'websocket',
        reason: msg.status === 'ok' ? 'partial_subscribe_failure' : 'subscribe_rejected',
      })
      refreshQuotesBatch(failSymbols, { source: 'websocket' }).catch(err => {
        console.warn('[ws] REST backfill after subscribe failure:', err.message)
      })
    }
    return
  }

  if (msg.event === 'heartbeat') {

    return
  }

  console.log('[ws] event:', msg.event || '(unknown)', JSON.stringify(msg).slice(0, 200))
}

function scheduleReconnect() {
  if (isShuttingDown) return
  if (reconnectTimer) return

  console.log(`[ws] reconnecting in ${reconnectDelay / 1000}s …`)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, reconnectDelay)

  reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS)
}

async function connect() {
  if (isShuttingDown) return
  intentionalClose = false

  const apiKey = process.env.TWELVEDATA_API_KEY
  if (!apiKey) {
    throw new Error('TWELVEDATA_API_KEY not configured - WebSocket cannot connect')
  }

  const url = `${WS_URL}?apikey=${encodeURIComponent(apiKey)}`

  ws = new WebSocket(url)

  ws.on('open', async () => {
    console.log('[ws] connected to Twelve Data')
    reconnectDelay = RECONNECT_BASE_MS

    startHeartbeat()

    await new Promise(resolve => setTimeout(resolve, SUBSCRIBE_DELAY_MS))

    let tickers
    try {
      tickers = await resolveTrackedTickers()
    } catch (err) {
      console.error('[ws] could not resolve tickers:', err.message)
      return
    }

    if (!tickers.length) {
      console.log('[ws] no tickers to subscribe to - closing connection, will retry when tickers are added')
      stopHeartbeat()
      intentionalClose = true
      ws.close(1000, 'no-tickers')
      ws = null
      return
    }

    subscribedTickers = new Set()
    sendSubscribe(tickers)
  })

  ws.on('message', (data) => {
    handleMessage(data.toString())
  })

  ws.on('close', (code, reason) => {
    stopHeartbeat()
    ws = null
    if (intentionalClose) {
      intentionalClose = false
      return
    }
    console.warn(`[ws] connection closed - code: ${code}, reason: ${reason || '(none)'}`)
    scheduleReconnect()
  })

  ws.on('error', (err) => {
    console.error('[ws] error:', err.message)

  })
}

export function startWebSocket() {
  if (ws || reconnectTimer) {
    console.log('[ws] already running - ignoring startWebSocket() call')
    return
  }
  isShuttingDown = false
  connect().catch(err => {
    console.error('[ws] initial connect failed:', err.message)
    scheduleReconnect()
  })
}

export function stopWebSocket() {
  isShuttingDown = true
  stopHeartbeat()
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (ws) {
    ws.close(1000, 'shutdown')
    ws = null
  }
  subscribedTickers = new Set()
  console.log('[ws] stopped')
}

export function subscribeToTickers(tickers) {
  if (!Array.isArray(tickers) || !tickers.length) return
  const normalized = tickers.map(t => String(t).trim().toUpperCase()).filter(Boolean)
  if (!normalized.length) return

  if (ws && ws.readyState === WebSocket.OPEN) {
    sendSubscribe(normalized)
    return
  }

  if (!ws && !reconnectTimer && !isShuttingDown) {
    console.log('[ws] (re)starting connection for newly added ticker(s):', normalized.join(', '))
    startWebSocket()
    return
  }

  console.log('[ws] not connected yet; tickers will be subscribed on next connect:', normalized.join(', '))
}

export function getSubscribedTickers() {
  return [...subscribedTickers]
}
