self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()

  // Subtype-specific badge text
  const subtypeBadge = {
    buy: '📈',
    sell: '📉',
    stop_loss: '🛑',
    take_profit: '💰',
    trailing_stop: '📊',
    rebalance: '⚖️',
    recommendation: '💡',
    scan_complete: '✅',
  }

  const options = {
    body: data.body || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || 'stocksense',
    data: {
      url: data.url || '/dashboard',
      entityId: data.entityId || null,
      subtype: data.subtype || null,
    },
    requireInteraction: data.subtype === 'stop_loss' || data.subtype === 'trailing_stop',
    actions: data.subtype === 'buy' || data.subtype === 'sell'
      ? [{ action: 'view', title: 'View Trade' }]
      : [{ action: 'open', title: 'Open StockSense' }],
  }

  const title = `${subtypeBadge[data.subtype] || '🔔'} ${data.title || 'StockSense'}`
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
