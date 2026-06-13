import { ruleEngine } from '../rules/RuleEngine.js'
import { executeRecommendation } from '../../services/agent.js'
import { createVirtualTrade } from '../../services/trades.js'
import { createNotification, formatTradeMessage, formatTradeTitle } from '../../services/notifications.js'

export class VirtualExecutionWorkflow {
  async executeRecommendation({ userId, recommendation, executionMode = 'manual', preferences = null, quantityOverride = null }) {
    const decision = await ruleEngine.evaluateRecommendationExecution({
      userId,
      recommendation,
      preferences,
    })

    if (!decision.allowed) return { executed: false, decision }
    if (!decision.details.tradeable) {
      const updated = await executeRecommendation(recommendation._id.toString(), { execution_mode: executionMode })
      return { executed: false, recommendation: updated, trade: null, decision }
    }

    const action = decision.details.action
    const maxQuantity = decision.details.sizing?.quantity
    const requestedQuantity = quantityOverride != null ? Math.floor(Number(quantityOverride)) : maxQuantity
    const quantity = action === 'SELL'
      ? Math.min(maxQuantity, requestedQuantity)
      : requestedQuantity
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { executed: false, decision: { allowed: false, reason: 'invalid_quantity', details: decision.details } }
    }
    const price = decision.details.price
    const updated = await executeRecommendation(recommendation._id.toString(), { execution_mode: executionMode })
    if (updated._alreadyExecuted) return { executed: true, recommendation: updated, trade: null, decision }

    const trade = await createVirtualTrade({
      userId,
      ticker: recommendation.ticker,
      action,
      quantity,
      entry_price: price,
      signal_id: recommendation._id?.toString(),
      rationale: recommendation.rationale,
    })

    await createNotification({
      userId,
      type: executionMode === 'automatic' ? 'auto_executed' : 'trade_executed',
      title: formatTradeTitle(action, recommendation.ticker),
      message: formatTradeMessage({ quantity, price, mode: executionMode }),
      ticker: recommendation.ticker,
      recId: recommendation._id?.toString(),
    })

    return { executed: true, recommendation: updated, trade, decision }
  }
}

export const virtualExecutionWorkflow = new VirtualExecutionWorkflow()
