import { getManualAnalysisProvider } from '../infrastructure/ai/providers/index.js'

export async function runAgent(userId, message) {
  const provider = await getManualAnalysisProvider()
  return provider.generate({ userId, message })
}

export async function* runAgentStream(userId, message) {
  const provider = await getManualAnalysisProvider()
  yield* provider.stream({ userId, message })
}
