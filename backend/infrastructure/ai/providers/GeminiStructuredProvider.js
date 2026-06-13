import { GoogleAuth } from 'google-auth-library'
import {
  buildStructuredRecommendationContext,
  STRUCTURED_RECOMMENDATION_SCHEMA,
  STRUCTURED_RECOMMENDATION_SYSTEM_PROMPT,
  validateRecommendationDecision,
} from '../StructuredRecommendation.js'

const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'stocksense-13'
const VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'global'
const VERTEX_MODEL = process.env.VERTEX_MODEL || 'gemini-3.5-flash'
const VERTEX_HOST = VERTEX_LOCATION === 'global'
  ? 'https://aiplatform.googleapis.com'
  : `https://${VERTEX_LOCATION}-aiplatform.googleapis.com`
const VERTEX_ENDPOINT = `${VERTEX_HOST}/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_LOCATION}/publishers/google/models/${VERTEX_MODEL}:generateContent`

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })

async function getAccessToken() {
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('Failed to obtain Vertex AI access token via ADC')
  return token
}

export class GeminiStructuredProvider {
  async generateStructuredRecommendation(input = {}) {
    const accessToken = await getAccessToken()
    const context = buildStructuredRecommendationContext(input)

    const response = await fetch(VERTEX_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: STRUCTURED_RECOMMENDATION_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: `Analyze the following context and return only the decision JSON.\nContext:\n${context}` }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: STRUCTURED_RECOMMENDATION_SCHEMA,
        },
      }),
    })

    const payload = await response.json()
    if (!response.ok) {
      const errMsg = payload?.error?.message || payload?.error?.status || `Vertex AI HTTP ${response.status}`
      const err = new Error(errMsg)
      err.status = response.status
      throw err
    }
    const text = payload?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('')?.trim()
    if (!text) throw new Error('Vertex AI returned empty response')
    let parsed
    try { parsed = JSON.parse(text) } catch { throw new Error('Vertex AI returned non-JSON output') }
    return validateRecommendationDecision(parsed, 'Gemini')
  }
}

export const geminiStructuredProvider = new GeminiStructuredProvider()
