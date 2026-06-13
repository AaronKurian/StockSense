const PROVIDER_NAMES = ['gemini', 'openai', 'openrouter', 'fireworks']

const manualProviderLoaders = {
  gemini: async () => (await import('./GeminiProvider.js')).geminiProvider,
  openai: async () => (await import('./OpenAIProvider.js')).openAIProvider,
  openrouter: async () => (await import('./OpenRouterProvider.js')).openRouterProvider,
  fireworks: async () => (await import('./FireworksProvider.js')).fireworksProvider,
}

const structuredProviderLoaders = {
  gemini: async () => (await import('./GeminiStructuredProvider.js')).geminiStructuredProvider,
  openai: async () => (await import('./OpenAIProvider.js')).openAIProvider,
  openrouter: async () => (await import('./OpenRouterProvider.js')).openRouterProvider,
  fireworks: async () => (await import('./FireworksProvider.js')).fireworksProvider,
}

const providerCache = new Map()

function normalizeProviderName(name, fallback = 'gemini') {
  return String(name || fallback).trim().toLowerCase()
}

function providerRuntimeConfig(name) {
  const provider = normalizeProviderName(name)
  if (provider === 'gemini') {
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'global'
    return {
      provider,
      model: process.env.VERTEX_MODEL || 'gemini-3.5-flash',
      base_url: location === 'global'
        ? 'https://aiplatform.googleapis.com'
        : `https://${location}-aiplatform.googleapis.com`,
      project_configured: !!process.env.GOOGLE_CLOUD_PROJECT,
      key_configured: true,
    }
  }
  if (provider === 'openai') {
    return {
      provider,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      base_url: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      key_configured: !!process.env.OPENAI_API_KEY,
    }
  }
  if (provider === 'openrouter') {
    return {
      provider,
      model: process.env.OPENROUTER_MODEL || 'nex-agi/nex-n2-pro:free',
      base_url: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      key_configured: !!process.env.OPENROUTER_API_KEY,
    }
  }
  if (provider === 'fireworks') {
    return {
      provider,
      model: process.env.FIREWORKS_MODEL || 'accounts/fireworks/models/deepseek-v4-pro',
      base_url: process.env.FIREWORKS_BASE_URL || 'https://api.fireworks.ai/inference/v1',
      key_configured: !!process.env.FIREWORKS_API_KEY,
    }
  }
  return { provider, key_configured: false }
}

async function pickProvider(registry, envName, fallback = 'gemini') {
  const requested = normalizeProviderName(process.env[envName] || process.env.AI_PROVIDER, fallback)
  const loader = registry[requested]
  if (!loader) {
    const valid = Object.keys(registry).join(', ')
    throw new Error(`Unsupported ${envName || 'AI provider'} '${requested}'. Valid providers: ${valid}`)
  }
  const cacheKey = `${envName}:${requested}`
  if (!providerCache.has(cacheKey)) providerCache.set(cacheKey, await loader())
  return providerCache.get(cacheKey)
}

export function getManualAnalysisProvider() {
  return pickProvider(manualProviderLoaders, 'MANUAL_AI_PROVIDER')
}

export function getStructuredRecommendationProvider() {
  return pickProvider(structuredProviderLoaders, 'STRUCTURED_AI_PROVIDER')
}

export async function getProviderByName(name, { structured = true } = {}) {
  const registry = structured ? structuredProviderLoaders : manualProviderLoaders
  const requested = normalizeProviderName(name)
  const loader = registry[requested]
  if (!loader) {
    const valid = Object.keys(registry).join(', ')
    throw new Error(`Unsupported AI provider '${name}'. Valid providers: ${valid}`)
  }
  const cacheKey = `${structured ? 'structured' : 'manual'}:${requested}`
  if (!providerCache.has(cacheKey)) providerCache.set(cacheKey, await loader())
  return providerCache.get(cacheKey)
}

export function getAvailableProviderNames() {
  return [...PROVIDER_NAMES]
}

export function getAIProviderRuntimeSummary() {
  const fallback = normalizeProviderName(process.env.AI_PROVIDER)
  const manual = normalizeProviderName(process.env.MANUAL_AI_PROVIDER || fallback)
  const structured = normalizeProviderName(process.env.STRUCTURED_AI_PROVIDER || fallback)
  return {
    fallback,
    manual: providerRuntimeConfig(manual),
    structured: providerRuntimeConfig(structured),
  }
}
