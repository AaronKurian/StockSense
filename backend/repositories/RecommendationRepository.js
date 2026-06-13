import { requireCollection, resolveObjectId } from './mongo.js'

export class RecommendationRepository {
  collection() {
    return requireCollection('recommendation_log')
  }

  async findById(id) {
    return this.collection().findOne({ _id: await resolveObjectId(id) })
  }

  findForUser(userId, query = {}, { limit = 50 } = {}) {
    return this.collection().find({ userId, ...query }).sort({ created_at: -1 }).limit(Number(limit)).toArray()
  }

  insert(doc) {
    return this.collection().insertOne(doc)
  }

  async updateById(id, update, options = {}) {
    return this.collection().findOneAndUpdate(
      { _id: await resolveObjectId(id) },
      update,
      { returnDocument: 'after', ...options }
    )
  }

  async updateOwnedById(userId, id, update, options = {}) {
    return this.collection().findOneAndUpdate(
      { _id: await resolveObjectId(id), userId },
      update,
      { returnDocument: 'after', ...options }
    )
  }

  deleteByUserId(userId) {
    return this.collection().deleteMany({ userId })
  }
}

export const recommendationRepository = new RecommendationRepository()
