import { requireCollection } from './mongo.js'

export class PriceRepository {
  collection() {
    return requireCollection('latest_prices')
  }

  findByTicker(ticker) {
    return this.collection().findOne({ ticker: String(ticker).toUpperCase() })
  }

  findByTickers(tickers) {
    return this.collection().find({ ticker: { $in: tickers.map(t => String(t).toUpperCase()) } }).toArray()
  }

  upsert(ticker, update) {
    return this.collection().updateOne({ ticker: String(ticker).toUpperCase() }, { $set: update }, { upsert: true })
  }
}

export const priceRepository = new PriceRepository()
