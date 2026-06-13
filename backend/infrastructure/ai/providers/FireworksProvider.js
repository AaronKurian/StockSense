import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js'

export class FireworksProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      providerName: 'Fireworks',
      apiKey: process.env.FIREWORKS_API_KEY,
      baseUrl: process.env.FIREWORKS_BASE_URL || 'https://api.fireworks.ai/inference/v1',
      model: process.env.FIREWORKS_MODEL || 'accounts/fireworks/models/deepseek-v4-pro',
    })
  }
}

export const fireworksProvider = new FireworksProvider()
