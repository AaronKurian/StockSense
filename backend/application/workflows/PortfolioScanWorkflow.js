import { triggerManualScan } from '../../services/scheduler.js'
import { runAgentForUser } from '../../services/agent.js'

export class PortfolioScanWorkflow {
  runManual(userId) {
    return triggerManualScan(userId)
  }

  runForUser(userId) {
    return runAgentForUser(userId)
  }
}

export const portfolioScanWorkflow = new PortfolioScanWorkflow()
