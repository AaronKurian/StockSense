/**
 * Twelve Data WebSocket manager.
 *
 * One persistent connection to wss://ws.twelvedata.com/v1/quotes/price
 * Subscribes to all tickers found in watchlist_items + portfolio_positions.
 * On every incoming price event, upserts latest_prices.
 * Reconnects automatically on close/error and resubscribes.
 *
 * Usage:
 *   import { startWebSocket } from './services/websocket.js'
 *   startWebSocket()   // call once after DB is connected
 */

import WebSocket from 'ws'
import { getCollection } from '../config/db.js'
import { upsertLatestPrice } from './prices.js'
import { broadcastPrice } from './sse.js'

const WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price'
const HEARTBEAT_INTERVAL_MS = 10_000   // 10 s - per Twelve Data recommendation
const RECONNECT_BASE_MS     = 2_000    // initial back-off
const RECONNECT_MAX_MS      = 60_000   // cap back-off at 60 s
const SUBSCRIBE_DELAY_MS    = 500      // brief pause after open before subscribing

let ws = null
let heartbeatTimer = null
let reconnectTimer = null
let reconnectDelay = RECONNECT_BASE_MS

// Track what we're currently subscribed to so we avoid duplicate sub messages
let subscribedTickers = new Set()
let isShuttingDown = false
let intentionalClose = false

// ─── Ticker resolution ───────────────────────────────────────────────────────

/**
 * Queries watchlist_items and portfolio_positions to build the full
 * deduplicated set of tickers to track.
 *
 * @returns {Promise<string[]>} Sorted, uppercased ticker array
 */
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

// ─── Heartbeat ───────────────────────────────────────────────────────────────

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

// ─── Subscription ────────────────────────────────────────────────────────────

/**
 * Sends a subscribe message for any tickers not already subscribed.
 * Merges new tickers into subscribedTickers set.
 *
 * @param {string[]} tickers
 */
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

// ─── Message handler ─────────────────────────────────────────────────────────

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
    // Twelve Data doesn't send change_percent in the WS tick; preserve whatever
    // is already stored by passing null (upsertLatestPrice only $sets non-null
    // fields - see note below).
    const updated_at    = msg.timestamp    != null
      ? new Date(Number(msg.timestamp) * 1000).toISOString()
      : new Date().toISOString()

    try {
      const doc = await upsertLatestPrice(ticker, {
        price,
        volume: day_volume,
        change_percent: null,   // not available in WS price events
        updated_at
      })
      // Push directly to SSE clients - no polling, no extra DB read
      broadcastPrice(ticker, doc)
    } catch (err) {
      console.error(`[ws] upsertLatestPrice failed for ${ticker}:`, err.message)
    }
    return
  }

  if (msg.event === 'subscribe-status') {
    if (msg.status === 'ok') {
      const ok   = (msg.success || []).map(s => s.symbol).join(', ') || '(none)'
      const fail = (msg.fails   || []).map(s => s.symbol).join(', ') || '(none)'
      console.log(`[ws] subscribe-status ok - success: [${ok}]  fails: [${fail}]`)
    } else {
      console.warn('[ws] subscribe-status non-ok:', JSON.stringify(msg))
    }
    return
  }

  if (msg.event === 'heartbeat') {
    // server echoes heartbeat - no action needed
    return
  }

  // Log anything else at debug level
  console.log('[ws] event:', msg.event || '(unknown)', JSON.stringify(msg).slice(0, 200))
}

// ─── Connection lifecycle ─────────────────────────────────────────────────────

function scheduleReconnect() {
  if (isShuttingDown) return
  if (reconnectTimer) return  // already scheduled

  console.log(`[ws] reconnecting in ${reconnectDelay / 1000}s …`)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, reconnectDelay)

  // Exponential back-off with cap
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
    reconnectDelay = RECONNECT_BASE_MS  // reset back-off on successful connect

    startHeartbeat()

    // Give the server a brief moment before subscribing
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

    // Full resubscribe on reconnect - reset tracking set so sendSubscribe sends everything
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
    // 'close' event fires after 'error', so reconnect is handled there
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the WebSocket manager.
 * Call once after MongoDB is connected and env vars are loaded.
 *
 * Safe to call multiple times - subsequent calls are no-ops if already running.
 */
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

/**
 * Gracefully close the WebSocket connection and stop reconnection attempts.
 * Intended for clean process shutdown.
 */
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

/**
 * Subscribe to additional tickers at runtime (e.g. when user adds a new
 * watchlist item or portfolio position without restarting the server).
 *
 * Silently skips tickers already subscribed.
 *
 * @param {string[]} tickers
 */
export function subscribeToTickers(tickers) {
  if (!Array.isArray(tickers) || !tickers.length) return
  const normalized = tickers.map(t => String(t).trim().toUpperCase()).filter(Boolean)
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendSubscribe(normalized)
  } else {
    // Connection is not open yet; add them to the pending set so they're
    // included in the next resubscribe triggered by the 'open' event.
    // resolveTrackedTickers() reads from MongoDB, so new DB rows will be
    // picked up automatically - no explicit pending set needed.
    console.log('[ws] not connected yet; tickers will be subscribed on next connect:', normalized.join(', '))
  }
}

/**
 * Returns the set of tickers currently subscribed to.
 * Useful for diagnostics / health checks.
 *
 * @returns {string[]}
 */
export function getSubscribedTickers() {
  return [...subscribedTickers]
}
