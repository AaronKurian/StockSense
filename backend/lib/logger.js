function timestamp() {
  return new Date().toISOString()
}

function format(level, module, message, data) {
  const entry = { ts: timestamp(), level, module, msg: message }
  if (data !== undefined) entry.data = data
  return JSON.stringify(entry)
}

export function info(module, message, data) {
  console.log(format('INFO', module, message, data))
}

export function warn(module, message, data) {
  console.warn(format('WARN', module, message, data))
}

export function error(module, message, data) {
  console.error(format('ERROR', module, message, data))
}

export function debug(module, message, data) {
  if (process.env.LOG_LEVEL === 'debug') {
    console.log(format('DEBUG', module, message, data))
  }
}

export function requestLogger(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO'
    const entry = {
      ts: timestamp(),
      level,
      module: 'http',
      msg: `${req.method} ${req.originalUrl}`,
      data: {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        duration_ms: duration,
        userId: req.userId || req.query?.userId || undefined,
      }
    }
    console.log(JSON.stringify(entry))
  })
  next()
}
