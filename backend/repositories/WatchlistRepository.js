import { requireCollection, resolveObjectId } from './mongo.js'

export class WatchlistRepository {
  watchlists() {
    return requireCollection('watchlists')
  }

  items() {
    return requireCollection('watchlist_items')
  }

  findByUserId(userId) {
    return this.watchlists().find({ userId }).sort({ created_at: -1 }).toArray()
  }

  insertWatchlist(doc) {
    return this.watchlists().insertOne(doc)
  }

  async findItemsByWatchlistId(watchlistId) {
    return this.items().find({ watchlistId: await resolveObjectId(watchlistId) }).sort({ ticker: 1 }).toArray()
  }

  async findItemsByWatchlistIds(watchlistIds) {
    const ids = []
    for (const id of watchlistIds) ids.push(await resolveObjectId(id))
    return this.items().find({ watchlistId: { $in: ids } }).sort({ ticker: 1 }).toArray()
  }

  async upsertItem(watchlistId, ticker, doc) {
    const resolvedId = await resolveObjectId(watchlistId)
    const t = String(ticker).toUpperCase()
    return this.items().updateOne({ watchlistId: resolvedId, ticker: t }, { $set: doc }, { upsert: true })
  }

  async deleteItem(watchlistId, ticker) {
    return this.items().deleteOne({ watchlistId: await resolveObjectId(watchlistId), ticker: String(ticker).toUpperCase() })
  }

  async deleteByUserId(userId) {
    const lists = await this.findByUserId(userId)
    const ids = lists.map(w => w._id)
    if (ids.length) await this.items().deleteMany({ watchlistId: { $in: ids } })
    await this.watchlists().deleteMany({ userId })
    return { watchlists: lists.length }
  }
}

export const watchlistRepository = new WatchlistRepository()
