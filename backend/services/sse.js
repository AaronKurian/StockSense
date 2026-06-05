const clients = new Set()

export function addClient(res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
  res.write(': connected\n\n')
  clients.add(res)
}

export function removeClient(res) {
  clients.delete(res)
}

export function broadcastPrice(ticker, doc) {
  if (!clients.size) return
  const payload = JSON.stringify({
    ticker,
    price:          doc.price          ?? null,
    volume:         doc.volume         ?? null,
    change_percent: doc.change_percent ?? null,
    updated_at:     doc.updated_at instanceof Date ? doc.updated_at.toISOString() : (doc.updated_at ?? new Date().toISOString())
  })
  const frame = `event: price\ndata: ${payload}\n\n`
  const dead = []
  for (const res of clients) {
    try { res.write(frame) } catch { dead.push(res) }
  }
  for (const res of dead) clients.delete(res)
}

export function getClientCount() {
  return clients.size
}
