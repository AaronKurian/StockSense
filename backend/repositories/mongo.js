import { getCollection } from '../config/db.js'

export function requireCollection(name) {
  const col = getCollection(name)
  if (!col) throw new Error('MongoDB not connected')
  return col
}

export async function resolveObjectId(id) {
  const { ObjectId } = await import('mongodb')
  try { return new ObjectId(id) } catch { return id }
}
