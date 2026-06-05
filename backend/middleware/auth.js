import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || req.headers.Authorization
  if (!auth) return res.status(401).json({ error: 'Missing Authorization header' })
  const parts = auth.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization format' })
  const token = parts[1]
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.sub || payload.id || null
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || req.headers.Authorization
  if (!auth) return next()
  const parts = auth.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return next()
  try {
    const payload = jwt.verify(parts[1], JWT_SECRET)
    req.userId = payload.sub || payload.id || null
  } catch (err) {
    // ignore
  }
  next()
}
