import { requireCollection, resolveObjectId } from './mongo.js'

export class TradeRepository {
  collection() {
    return requireCollection('virtual_trades')
  }

  findByUserId(userId, query = {}, { limit = 50 } = {}) {
    return this.collection().find({ userId, ...query }).sort({ created_at: -1 }).limit(Number(limit)).toArray()
  }

  async findById(id) {
    return this.collection().findOne({ _id: await resolveObjectId(id) })
  }

  findBySignalId(userId, signalId) {
    return this.collection().findOne({ userId, signal_id: String(signalId) })
  }

  countOpenByTicker(userId, ticker) {
    return this.collection().countDocuments({ userId, ticker: String(ticker).toUpperCase(), status: 'open' })
  }

  insert(doc) {
    return this.collection().insertOne(doc)
  }

  async updateById(id, update) {
    return this.collection().findOneAndUpdate({ _id: await resolveObjectId(id) }, update, { returnDocument: 'after' })
  }

  deleteByUserId(userId) {
    return this.collection().deleteMany({ userId })
  }
}

export const tradeRepository = new TradeRepository()
