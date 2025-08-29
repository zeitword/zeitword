import { languageModelUsageCredits, languageModelUsages } from "~~/server/database/schema"
import { convertToModelMessages, streamText, tool, stepCountIs } from "ai"
import { hasSufficientFunds, modelCards } from "~~/server/utils/ai"
import { createOpenAI } from "@ai-sdk/openai"
import { sum } from "drizzle-orm"
import { z } from "zod"

const openai = createOpenAI({
  apiKey: useRuntimeConfig().openaiApiKey
})

export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event: any) => {
    const { secure } = await requireUserSession(event)
    if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

    // Extract the `messages` from the body of the request
    const { messages } = await readBody(event)

    const enoughFunds = await hasSufficientFunds({ organisationId: secure.organisationId })
    if (!enoughFunds) throw createError({ statusCode: 402, statusMessage: "Insufficient funds" })

    // Call the language model
    const result = streamText({
      model: openai.responses("gpt-4o"),
      messages: convertToModelMessages(messages),
      tools,
      onFinish: async ({ text, toolCalls, toolResults, usage, finishReason }) => {
        event.waitUntil(
          trackUsage({
            usage,
            userId: secure.userId,
            modelId: "gpt-4o",
            organisationId: secure.organisationId
          })
        )
      },
      stopWhen: stepCountIs(5)
    })

    // Respond with the stream
    return result.toUIMessageStreamResponse()
  })
})

async function trackUsage({
  usage,
  userId,
  modelId,
  organisationId
}: {
  usage: any
  userId: string
  modelId: string
  organisationId: string
}) {
  await useDrizzle().insert(languageModelUsages).values({
    userId,
    modelId,
    organisationId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens
  })
}

const tools = {
  listBlocks: tool({
    name: "list_blocks",
    description: "List all blocks for a site",
    inputSchema: z.object({
      blockId: z
        .string()
        .optional()
        .describe("The block ID for which to get the blocks as blocks can be nested")
    })
  }),
  getBlock: tool({
    name: "get_block",
    description: "Get a block for a site",
    inputSchema: z.object({
      blockId: z.string().describe("The block to fetch")
    })
  }),
  listAvailableBlockTypes: tool({
    name: "list_available_block_types",
    description: "List all available block types",
    inputSchema: z.object({
      siteId: z.string().describe("The site ID")
    })
  }),
  addBlock: tool({
    name: "add_block",
    description:
      "Appends a block to the end of the blocks array. Be sure to call list_available_block_types first to get the block type ID",
    inputSchema: z.object({
      componentId: z.string().describe("The component ID to use for the new block")
    })
  }),
  updateBlockField: tool({
    name: "update_block_field",
    description: "Update a field for a block",
    inputSchema: z.object({
      blockId: z.string().describe("The block to update the field for"),
      fieldKey: z.string().describe("The key of the field to update"),
      value: z.any().describe("The value to update the field with")
    })
  }),
  webSearch: openai.tools.webSearchPreview({
    searchContextSize: "high",
    userLocation: {
      type: "approximate",
      city: "Frankfurt",
      country: "DE"
    }
  })
}
