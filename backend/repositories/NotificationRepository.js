import { requireCollection, resolveObjectId } from './mongo.js'

export class NotificationRepository {
  collection() {
    return requireCollection('notifications')
  }

  findForUser(userId, query = {}, { limit = 50 } = {}) {
    return this.collection().find({ userId, ...query }).sort({ created_at: -1 }).limit(Number(limit)).toArray()
  }

  insert(doc) {
    return this.collection().insertOne(doc)
  }

  async markRead(id) {
    return this.collection().updateOne({ _id: await resolveObjectId(id) }, { $set: { read: true } })
  }

  async deleteOwnedById(userId, id) {
    return this.collection().deleteOne({ _id: await resolveObjectId(id), userId })
  }

  markAllRead(userId) {
    return this.collection().updateMany({ userId, read: false }, { $set: { read: true } })
  }

  unreadCount(userId) {
    return this.collection().countDocuments({ userId, read: false })
  }

  deleteByUserId(userId) {
    return this.collection().deleteMany({ userId })
  }
}

export const notificationRepository = new NotificationRepository()
