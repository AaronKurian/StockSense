import { requireCollection } from './mongo.js'

export class PortfolioRepository {
  collection() {
    return requireCollection('portfolio_positions')
  }

  findByUserId(userId, options = {}) {
    return this.collection().find({ userId }, options).sort({ ticker: 1 }).toArray()
  }

  findPosition(userId, ticker) {
    return this.collection().findOne({ userId, ticker: String(ticker).toUpperCase() })
  }

  upsertPosition(userId, ticker, doc) {
    return this.collection().updateOne(
      { userId, ticker: String(ticker).toUpperCase() },
      { $set: doc },
      { upsert: true }
    )
  }

  updatePosition(userId, ticker, update) {
    return this.collection().updateOne({ userId, ticker: String(ticker).toUpperCase() }, update)
  }

  deletePosition(userId, ticker) {
    return this.collection().deleteOne({ userId, ticker: String(ticker).toUpperCase() })
  }

  deleteByUserId(userId) {
    return this.collection().deleteMany({ userId })
  }
}

export const portfolioRepository = new PortfolioRepository()
