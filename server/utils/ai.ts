// Org AI credits must be seeded manually, e.g.:
// INSERT INTO language_model_usage_credits (id, amount, organisation_id)
// VALUES (gen_random_uuid(), 10000, '<org-uuid>');

import { eq, sum } from "drizzle-orm"
import { languageModelUsageCredits, languageModelUsages } from "~~/server/database/schema"

export const TRANSLATION_MODEL = "gpt-5.4-mini"
export const TRANSLATION_MARKUP = 1.3

export const modelCards = {
  [TRANSLATION_MODEL]: {
    input: 0.75 / 1_000_000,
    output: 4.5 / 1_000_000
  }
} as const

function getTranslationUsageCost(inputTokens: number, outputTokens: number) {
  const pricing = modelCards[TRANSLATION_MODEL]
  const baseCost = inputTokens * pricing.input + outputTokens * pricing.output
  return baseCost * TRANSLATION_MARKUP
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

  const inputTokens = parseInt(usage.inputTokens ?? "0")
  const outputTokens = parseInt(usage.outputTokens ?? "0")
  const totalCost = getTranslationUsageCost(inputTokens, outputTokens)
  const funds = parseInt(credits.amount ?? "0")

  return totalCost < funds
}

export async function trackUsage({
  usage,
  userId,
  modelId,
  organisationId
}: {
  usage: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
  userId: string
  modelId: string
  organisationId: string
}) {
  await useDrizzle()
    .insert(languageModelUsages)
    .values({
      userId,
      modelId,
      organisationId,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens ?? 0
    })
}
