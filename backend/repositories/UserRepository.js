import { requireCollection } from './mongo.js'

export class UserRepository {
  collection() {
    return requireCollection('users')
  }

  findById(userId) {
    return this.collection().findOne({ _id: userId })
  }

  findByEmail(email) {
    return this.collection().findOne({ email: String(email).toLowerCase().trim() })
  }

  insert(user) {
    return this.collection().insertOne(user)
  }

  updateById(userId, update) {
    return this.collection().updateOne({ _id: userId }, update)
  }

  deleteById(userId) {
    return this.collection().deleteOne({ _id: userId })
  }

  acquireScanLock(userId, staleCutoff, startedAt = new Date()) {
    return this.collection().findOneAndUpdate(
      {
        _id: userId,
        $or: [
          { scan_in_progress: { $ne: true } },
          { scan_started_at: { $lt: staleCutoff } },
          { scan_started_at: { $exists: false } },
        ],
      },
      { $set: { scan_in_progress: true, scan_started_at: startedAt } },
      { returnDocument: 'after', includeResultMetadata: false }
    )
  }

  releaseScanLock(userId) {
    return this.collection().updateOne({ _id: userId }, { $set: { scan_in_progress: false } })
  }
}

export const userRepository = new UserRepository()
