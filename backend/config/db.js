import { MongoClient } from "mongodb"

let client
let db
let connected = false

export async function connect(uri, dbName = "stocksense") {
  if (connected && client) return { client, db }
  if (!uri) {
    console.warn("MONGODB_URI not provided - MongoDB unavailable")
    return null
  }
  client = new MongoClient(uri)
  await client.connect()
  db = client.db(dbName)
  connected = true

  try {

    await db.collection('users').createIndex({ email: 1 }, { unique: true })

    await db.collection('watchlists').createIndex({ userId: 1, created_at: -1 })

    await db.collection('watchlist_items').createIndex({ watchlistId: 1, ticker: 1 }, { unique: true })

    await db.collection('latest_prices').createIndex({ ticker: 1 }, { unique: true })

    await db.collection('portfolio_positions').createIndex({ userId: 1, ticker: 1 }, { unique: true })

    await db.collection('recommendation_log').createIndex({ userId: 1, created_at: -1 })

    await db.collection('recommendation_log').createIndex({ userId: 1, signal: 1, created_at: -1 })

    await db.collection('recommendation_log').createIndex({ ticker: 1 })
    await db.collection('recommendation_log').createIndex({ signal: 1 })

    await db.collection('push_subscriptions').createIndex({ userId: 1 })

    await db.collection('agent_preferences').createIndex({ userId: 1 }, { unique: true })

    await db.collection('virtual_trades').createIndex({ userId: 1, created_at: -1 })
    await db.collection('virtual_trades').createIndex({ userId: 1, ticker: 1, created_at: -1 })
    await db.collection('virtual_trades').createIndex({ userId: 1, status: 1 })

    await db.collection('notifications').createIndex({ userId: 1, created_at: -1 })
    await db.collection('notifications').createIndex({ userId: 1, read: 1 })

    await db.collection('ticker_metadata').createIndex({ ticker: 1 }, { unique: true })
    await db.collection('push_subscriptions').createIndex({ userId: 1, endpoint: 1 }, { unique: true })

    await db.collection('portfolio_equity_history').createIndex({ userId: 1, bucket: 1 }, { unique: true })
    await db.collection('portfolio_snapshots').createIndex({ userId: 1, date: 1 }, { unique: true })
  } catch (err) {
    console.warn('Index creation skipped or failed:', err.message)
  }

  return { client, db }
}

export function getDb() {
  if (!connected) return null
  return db
}

export function getCollection(name) {
  if (!connected) return null
  return db.collection(name)
}

export async function close() {
  if (client) await client.close()
  client = null
  db = null
  connected = false
}
