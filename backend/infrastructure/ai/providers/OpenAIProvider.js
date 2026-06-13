import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js'

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      providerName: 'OpenAI',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    })
  }
}

export const openAIProvider = new OpenAIProvider()
