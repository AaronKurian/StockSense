import fetch from 'node-fetch'

const BASE = 'https://api.twelvedata.com'

function getApiKey() {
  const key = process.env.TWELVEDATA_API_KEY
  if (!key) {
    const e = new Error('TWELVEDATA_API_KEY not configured')
    e.code = 'TWELVEDATA_CONFIG'
    throw e
  }
  return key
}

export async function fetchTimeSeries(ticker, interval = '1day', outputsize = 30) {
  const url = `${BASE}/time_series?symbol=${encodeURIComponent(ticker)}&interval=${interval}&outputsize=${outputsize}&apikey=${getApiKey()}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Twelve Data HTTP ${resp.status}: ${await resp.text().catch(() => '')}`)
  const json = await resp.json()
  if (json.status === 'error') throw new Error(`Twelve Data: ${json.message || JSON.stringify(json)}`)
  return json
}
