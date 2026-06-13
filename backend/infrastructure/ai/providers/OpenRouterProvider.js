import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js'

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      providerName: 'OpenRouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL || 'nex-agi/nex-n2-pro:free',
      extraHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'StockSense',
      },
    })
  }
}

export const openRouterProvider = new OpenRouterProvider()
