import { runAgent, runAgentStream } from '../../agent/index.js'
import { info } from '../../lib/logger.js'

export class ManualAnalysisWorkflow {
  async run({ userId, message }) {
    if (!userId || !message) throw new Error('userId and message are required')
    info('manual-analysis', 'Request started', { userId, message: message.slice(0, 80) })
    const result = await runAgent(userId, `[User: ${userId}] ${message}`)
    info('manual-analysis', 'Request completed', { userId, toolCalls: result.toolCalls?.length || 0 })
    return result
  }

  stream({ userId, message }) {
    if (!userId || !message) throw new Error('userId and message are required')
    info('manual-analysis', 'Streaming request started', { userId, message: message.slice(0, 80) })
    return runAgentStream(userId, `[User: ${userId}] ${message}`)
  }
}

export const manualAnalysisWorkflow = new ManualAnalysisWorkflow()
