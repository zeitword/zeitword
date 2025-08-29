import { hasSufficientFunds } from "~~/server/utils/ai"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const sufficientFunds = await hasSufficientFunds({ organisationId: secure.organisationId })

  return {
    sufficientFunds
  }
})
