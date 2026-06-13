import { AIProvider } from '../AIProvider.js'
import { allTools } from '../../../agent/tools.js'
import {
  buildStructuredRecommendationContext,
  parseStrictJson,
  STRUCTURED_RECOMMENDATION_SCHEMA,
  STRUCTURED_RECOMMENDATION_SYSTEM_PROMPT,
  validateRecommendationDecision,
} from '../StructuredRecommendation.js'

const MANUAL_ANALYSIS_SYSTEM_PROMPT = `You are StockSense, an AI-powered investment operations agent.

You are NOT a generic chatbot. You are a signal-first investment reasoning engine.

Use the available tools for portfolio, watchlist, recommendation, feedback, price, and market operations.
Always use the userId from the user's [User: <userId>] prefix when calling tools.
Always fetch real data before making investment claims.
Save recommendations only when an actionable signal exists.
For portfolio-wide manual requests, generate at most 3 recommendations.
Use markdown formatting for readability, but never use markdown tables.`

function toSafeJson(value, maxLength = 12000) {
  try {
    const json = JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    if (!json) return String(value)
    if (json.length <= maxLength) return json
    return `${json.slice(0, maxLength)}... [truncated ${json.length - maxLength} chars]`
  } catch (error) {
    return JSON.stringify({ error: error?.message || 'unserializable tool result' })
  }
}

function unwrapZod(schema) {
  let current = schema
  let optional = false
  while (current?._def?.typeName === 'ZodOptional' || current?._def?.typeName === 'ZodNullable') {
    optional = optional || current._def.typeName === 'ZodOptional'
    current = current._def.innerType
  }
  return { schema: current, optional }
}

function zodToJsonSchema(schema) {
  const { schema: unwrapped } = unwrapZod(schema)
  const def = unwrapped?._def || {}
  const description = def.description

  if (def.typeName === 'ZodString') return { type: 'string', ...(description ? { description } : {}) }
  if (def.typeName === 'ZodNumber') return { type: 'number', ...(description ? { description } : {}) }
  if (def.typeName === 'ZodBoolean') return { type: 'boolean', ...(description ? { description } : {}) }
  if (def.typeName === 'ZodEnum') return { type: 'string', enum: def.values, ...(description ? { description } : {}) }
  if (def.typeName === 'ZodArray') return { type: 'array', items: zodToJsonSchema(def.type), ...(description ? { description } : {}) }
  if (def.typeName === 'ZodObject') {
    const shape = def.shape()
    const properties = {}
    const required = []
    for (const [key, value] of Object.entries(shape)) {
      const { optional } = unwrapZod(value)
      properties[key] = zodToJsonSchema(value)
      if (!optional) required.push(key)
    }
    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
      ...(description ? { description } : {}),
    }
  }
  return { type: 'string', ...(description ? { description } : {}) }
}

function toOpenAITool(tool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    },
  }
}

function sanitizeToolArgs(args, userId) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return {}
  return Object.prototype.hasOwnProperty.call(args, 'userId') ? { ...args, userId } : args
}

export class OpenAICompatibleProvider extends AIProvider {
  constructor({ providerName, apiKey, baseUrl, model, extraHeaders = {} }) {
    super()
    this.providerName = providerName
    this.apiKey = apiKey
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '')
    this.model = model
    this.extraHeaders = extraHeaders
    this.tools = allTools
    this.toolMap = new Map(allTools.map(tool => [tool.name, tool]))
  }

  assertConfigured() {
    if (!this.apiKey) throw new Error(`${this.providerName} API key is not configured`)
    if (!this.baseUrl) throw new Error(`${this.providerName} base URL is not configured`)
    if (!this.model) throw new Error(`${this.providerName} model is not configured`)
  }

  async chatCompletions(payload) {
    this.assertConfigured()
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.extraHeaders,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(Number(process.env.AI_PROVIDER_TIMEOUT_MS || 60000)),
    })

    const text = await response.text()
    let body
    try { body = text ? JSON.parse(text) : null } catch { body = { raw: text.slice(0, 500) } }
    if (!response.ok) {
      const errMsg = body?.error?.message || body?.error?.code || `${this.providerName} HTTP ${response.status}`
      const err = new Error(errMsg)
      err.status = response.status
      err.body = body
      throw err
    }
    return body
  }

  async executeToolCall(toolCall, userId) {
    const name = toolCall?.function?.name
    const tool = this.toolMap.get(name)
    if (!tool) return { error: `Unknown tool: ${name}` }

    let args = {}
    try {
      args = toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {}
    } catch {
      return { error: `Invalid JSON arguments for ${name}` }
    }

    const safeArgs = sanitizeToolArgs(args, userId)
    return tool.execute(safeArgs)
  }

  async generate({ userId, message }) {
    const messages = [
      { role: 'system', content: MANUAL_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: message },
    ]
    const toolDefinitions = this.tools.map(toOpenAITool)
    const toolCalls = []

    for (let iteration = 0; iteration < Number(process.env.AI_TOOL_MAX_ITERATIONS || 6); iteration += 1) {
      const response = await this.chatCompletions({
        model: this.model,
        messages,
        tools: toolDefinitions,
        tool_choice: 'auto',
        temperature: 0.2,
        max_tokens: 1800,
      })

      const assistantMessage = response?.choices?.[0]?.message
      if (!assistantMessage) throw new Error(`${this.providerName} returned empty response`)
      messages.push(assistantMessage)

      const calls = assistantMessage.tool_calls || []
      if (!calls.length) {
        return {
          response: assistantMessage.content || '',
          toolCalls,
          events: messages.length,
          provider: this.providerName,
        }
      }

      for (const call of calls) {
        const args = parseStrictJson(call.function?.arguments || '{}', `${this.providerName} tool call`)
        const safeArgs = sanitizeToolArgs(args, userId)
        toolCalls.push({ tool: call.function?.name, args: safeArgs })
        const result = await this.executeToolCall({ ...call, function: { ...call.function, arguments: JSON.stringify(safeArgs) } }, userId)
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: toSafeJson(result),
        })
      }
    }

    throw new Error(`${this.providerName} exceeded tool iteration limit`)
  }

  async *stream({ userId, message }) {
    try {
      yield { progress: `Starting investment analysis with ${this.providerName}...` }
      const result = await this.generate({ userId, message })
      for (const toolCall of result.toolCalls || []) {
        yield {
          toolCall,
          event: { type: 'tool_start', tool: toolCall.tool, args: toolCall.args },
          progress: `Ran ${toolCall.tool}`,
        }
      }
      if (result.response) yield { text: result.response, event: { type: 'text_delta', text: result.response } }
      yield { done: true, toolCalls: result.toolCalls || [], event: { type: 'done' } }
    } catch (err) {
      yield { error: err.message, event: { type: 'error', error: err.message } }
      yield { done: true, toolCalls: [], event: { type: 'done' } }
    }
  }

  async generateStructuredRecommendation(input = {}) {
    const context = buildStructuredRecommendationContext(input)
    const response = await this.chatCompletions({
      model: this.model,
      messages: [
        { role: 'system', content: STRUCTURED_RECOMMENDATION_SYSTEM_PROMPT },
        { role: 'user', content: `Analyze the following context and return only the decision JSON matching this schema: ${JSON.stringify(STRUCTURED_RECOMMENDATION_SCHEMA)}\nContext:\n${context}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 900,
    })

    const text = response?.choices?.[0]?.message?.content
    const parsed = parseStrictJson(text, this.providerName)
    return validateRecommendationDecision(parsed, this.providerName)
  }
}
