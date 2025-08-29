import { languageModelUsageCredits } from "../database/schema"

import { sum } from "drizzle-orm"
import { languageModelUsages } from "../database/schema"

export const modelCards = {
  "gpt-4o": {
    input: 2.5 / 1_000_000,
    output: 10 / 1_000_000
  }
}

export async function hasSufficientFunds({ organisationId }: { organisationId: string }) {
  const [usage] = await useDrizzle()
    .select({
      inputTokens: sum(languageModelUsages.inputTokens),
      outputTokens: sum(languageModelUsages.outputTokens)
    })
    .from(languageModelUsages)
    .where(eq(languageModelUsages.organisationId, organisationId))

  const [credits] = await useDrizzle()
    .select({
      amount: sum(languageModelUsageCredits.amount)
    })
    .from(languageModelUsageCredits)
    .where(eq(languageModelUsageCredits.organisationId, organisationId))

  if (!usage || !credits) return false

  const inputCost = parseInt(usage.inputTokens ?? "0") * modelCards["gpt-4o"].input
  const outputCost = parseInt(usage.outputTokens ?? "0") * modelCards["gpt-4o"].output
  const totalCost = inputCost + outputCost
  const funds = parseInt(credits.amount ?? "0")

  return totalCost < funds
}
