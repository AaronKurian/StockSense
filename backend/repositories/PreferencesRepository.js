import { requireCollection } from './mongo.js'

export class PreferencesRepository {
  collection() {
    return requireCollection('agent_preferences')
  }

  findByUserId(userId) {
    return this.collection().findOne({ userId })
  }

  findEnabled() {
    return this.collection().find({ enabled: true }).toArray()
  }

  insert(doc) {
    return this.collection().insertOne(doc)
  }

  updateByUserId(userId, update, options = {}) {
    return this.collection().findOneAndUpdate(
      { userId },
      update,
      { returnDocument: 'after', includeResultMetadata: false, ...options }
    )
  }

  deleteByUserId(userId) {
    return this.collection().deleteMany({ userId })
  }
}

export const preferencesRepository = new PreferencesRepository()
