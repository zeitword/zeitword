import { createOpenAI } from "@ai-sdk/openai"
import { convertToModelMessages, streamText, tool, generateObject, stepCountIs } from "ai"
import { z } from "zod"
import { getStoryContent } from "../sites/[siteId]/stories/[storyId]/index.get"
import { components, componentFields, stories } from "~~/server/database/schema"
import { eq, and } from "drizzle-orm"
import { uuidv7 } from "uuidv7"
import { useStoryModel } from "~~/server/model/story"
import { fieldTypeEnum } from "~~/packages/schema/drizzle/schema"

const openai = createOpenAI({
  apiKey: useRuntimeConfig().openaiApiKey
})

export default defineLazyEventHandler(async () => {
  return defineEventHandler(async (event: any) => {
    const { secure } = await requireUserSession(event)
    if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

    // Extract the `messages` from the body of the request
    const { messages } = await readBody(event)

    console.dir(messages, { depth: null })

    // Call the language model
    const result = streamText({
      model: openai.responses("gpt-4o"),
      messages: convertToModelMessages(messages),
      tools,
      onFinish: async ({ text, toolCalls, toolResults, usage, finishReason }) => {
        console.log({ text, toolCalls, toolResults, usage, finishReason })
        // implement your own logic here, e.g. for storing messages
        // or recording token usage, etc.
      },
      stopWhen: stepCountIs(5)
    })

    // Respond with the stream
    return result.toUIMessageStreamResponse()
  })
})

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
    // outputSchema: z.object({
    //   blocks: z.array(
    //     z.object({
    //       id: z.string().describe("The ID of the block"),
    //       name: z.string().describe("The name of the block")
    //     })
    //   )
    // })
  }),
  getBlock: tool({
    name: "get_block",
    description: "Get a block for a site",
    inputSchema: z.object({
      blockId: z.string().describe("The block to fetch")
    })
    // outputSchema: z.object({
    //   id: z.string().describe("The ID of the block"),
    //   fields: z.array(
    //     z.object({
    //       field: z.object({
    //         key: z.string().describe("The key of the field"),
    //         value: z.any().describe("The value of the field"),
    //         type: z.enum([
    //           "text",
    //           "textarea",
    //           "richtext",
    //           "markdown",
    //           "number",
    //           "option",
    //           "options",
    //           "asset",
    //           "assets",
    //           "link"
    //         ])
    //       })
    //     })
    //   ),
    //   blockChildren: z.any().describe("The children of the block")
    // })
  }),
  listAvailableBlockTypes: tool({
    name: "list_available_block_types",
    description: "List all available block types",
    inputSchema: z.object({
      siteId: z.string().describe("The site ID")
    })
    // outputSchema: z.object({
    //   blockTypes: z.array(
    //     z.object({
    //       id: z.string().describe("The ID of the block type"),
    //       name: z.string().describe("The name of the block type")
    //     })
    //   )
    // })
  }),
  addBlock: tool({
    name: "add_block",
    description:
      "Appends a block to the end of the blocks array. Be sure to call list_available_block_types first to get the block type ID",
    inputSchema: z.object({
      componentId: z.string().describe("The component ID to use for the new block")
    })
    // outputSchema: z.object({
    //   blockId: z.string().describe("The ID of the new block")
    // })
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

const backupTools = {
  // suggestContentEdit: suggestContentEditTool,
  updateNestedField: tool({
    name: "update_nested_field",
    description: "Update a nested field in the content",
    inputSchema: z.object({
      path: z
        .array(z.string())
        .describe(
          "The path to the field to update e.g. ['en', 'blocks', '0', 'content', 'description']"
        ),
      value: z.any().describe("The value to update the field with")
    })
  }),
  webSearchPreview: openai.tools.webSearchPreview({
    searchContextSize: "high",
    userLocation: {
      type: "approximate",
      city: "Frankfurt",
      country: "DE"
    }
  }),
  listAvailableBlocks: tool({
    name: "list_available_blocks",
    description: "List all available blocks/components that can be used to create new blocks",
    inputSchema: z.object({
      siteId: z.string().describe("The site ID")
    }),
    execute: async (input: any) => {
      const storyModel = useStoryModel()

      const blocks = await storyModel.blocks.list({ siteId: input.siteId })

      // Get all components for the site
      const componentsData = await useDrizzle()
        .select()
        .from(components)
        .where(
          and(
            eq(components.siteId, input.siteId),
            eq(components.organisationId, secure.organisationId)
          )
        )
        .leftJoin(componentFields, eq(components.id, componentFields.componentId))

      const componentMap = new Map()
      const componentIds: string[] = []

      for (const row of componentsData) {
        if (!componentMap.has(row.components.id)) {
          componentMap.set(row.components.id, {
            id: row.components.id,
            name: row.components.name,
            displayName: row.components.displayName,
            previewImage: row.components.previewImage,
            fields: []
          })
          componentIds.push(row.components.id)
        }
        if (row.component_fields) {
          componentMap.get(row.components.id).fields.push({
            fieldKey: row.component_fields.fieldKey,
            type: row.component_fields.type,
            displayName: row.component_fields.displayName,
            required: row.component_fields.required
          })
        }
      }

      const availableComponents = Array.from(componentMap.values())

      return {
        components: availableComponents,
        count: availableComponents.length
      }
    }
  }),
  addBlock: tool({
    name: "add_block",
    description: "Add a block to the content at a specific path in the story structure",
    inputSchema: z.object({
      siteId: z.string().describe("The site ID"),
      storyId: z.string().describe("The story ID"),
      componentId: z.string().describe("The component ID to use for the new block"),
      path: z
        .array(z.string())
        .describe(
          "The path to the blocks array where to add the block e.g. ['en', 'blocks'] or ['en', 'content', 'nestedBlocks']"
        ),
      insertIndex: z
        .number()
        .optional()
        .describe("Index where to insert the block (defaults to end)")
    }),
    execute: async (input: any) => {
      // Get the story content
      const storyData = await getStoryContent({
        siteId: input.siteId,
        storyId: input.storyId,
        selectedLang: input.path[0], // First path element should be language
        organisationId: secure.organisationId
      })

      // Get component info first
      const [componentInfo] = await useDrizzle()
        .select()
        .from(components)
        .where(
          and(
            eq(components.id, input.componentId),
            eq(components.siteId, input.siteId),
            eq(components.organisationId, secure.organisationId)
          )
        )

      if (!componentInfo) {
        throw createError({ statusCode: 404, statusMessage: "Component not found" })
      }

      // Get the component fields to create the block from
      const componentFieldsData = await useDrizzle()
        .select()
        .from(componentFields)
        .where(
          and(
            eq(componentFields.componentId, input.componentId),
            eq(componentFields.organisationId, secure.organisationId)
          )
        )
        .orderBy(componentFields.order)

      if (componentFieldsData.length === 0) {
        throw createError({ statusCode: 404, statusMessage: "Component fields not found" })
      }

      // Initialize block content based on component fields
      const blockContent: any = {}
      for (const field of componentFieldsData) {
        if (field.type === "blocks") {
          blockContent[field.fieldKey] = []
        } else {
          blockContent[field.fieldKey] = undefined
        }
      }

      // Create new block with LexoRank ordering
      const { LexoRank } = await import("lexorank")
      const newBlockId = uuidv7()

      // Navigate to the target blocks array
      let targetArray = storyData.content
      for (const pathSegment of input.path) {
        if (!targetArray[pathSegment]) {
          targetArray[pathSegment] = []
        }
        targetArray = targetArray[pathSegment]
      }

      if (!Array.isArray(targetArray)) {
        throw createError({
          statusCode: 400,
          statusMessage: "Target path does not point to an array"
        })
      }

      // Calculate rank for new block
      let newRank: any
      const insertIndex = input.insertIndex ?? targetArray.length

      if (targetArray.length === 0) {
        newRank = LexoRank.middle()
      } else if (insertIndex === 0) {
        newRank = LexoRank.parse(targetArray[0].order).genPrev()
      } else if (insertIndex >= targetArray.length) {
        const lastBlock = targetArray[targetArray.length - 1]
        newRank = LexoRank.parse(lastBlock.order).genNext()
      } else {
        const prevBlock = targetArray[insertIndex - 1]
        const nextBlock = targetArray[insertIndex]
        const prevRank = LexoRank.parse(prevBlock.order)
        const nextRank = LexoRank.parse(nextBlock.order)
        newRank = prevRank.between(nextRank)
      }

      const newBlock = {
        id: newBlockId,
        componentId: input.componentId,
        componentName: componentInfo.name,
        content: blockContent,
        order: newRank.toString()
      }

      // Insert block at the specified index
      targetArray.splice(insertIndex, 0, newBlock)

      // Update the story content
      await useDrizzle()
        .update(stories)
        .set({
          content: storyData.content,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(stories.id, input.storyId),
            eq(stories.siteId, input.siteId),
            eq(stories.organisationId, secure.organisationId)
          )
        )

      return {
        success: true,
        blockId: newBlockId,
        message: `Added ${componentInfo.displayName} block successfully`
      }
    }
  }),
  getContent: tool({
    name: "get_content",
    description: "Get the content of the document",
    inputSchema: z.object({
      siteId: z.string().describe("The site ID"),
      storyId: z.string().describe("The story ID"),
      lang: z.string().describe("The language of the content")
    }),
    execute: async (input: any) => {
      const res = await getStoryContent({
        siteId: input.siteId,
        storyId: input.storyId,
        selectedLang: input.lang,
        organisationId: secure.organisationId
      })
      return res.content
    }
  })
}

// const editSchema = z.object({
//   path: z
//     .array(z.string())
//     .describe("The path to the field to update e.g. ['en', 'blocks', 0, 'content', 'description']"),
//   value: z.any().describe("The value to update the field with")
// })

// const suggestContentEditTool = tool({
//   name: "suggest_content_edit",
//   description: "Suggest a content edit",
//   inputSchema: z.object({
//     content: z.any().describe("The content to edit"),
//     task: z.string().describe("The task to perform on the content")
//   }),
//   execute: async (input: any) => {
//     return await suggestContentEdit(input.content)
//   },
//   outputSchema: z.object({
//     edits: z.array(editSchema).describe("The edits to apply to the content")
//   })
// })

// async function suggestContentEdit({ content, task }: { content: any; task: string }) {
//   const result = await generateObject({
//     model: openai.responses("gpt-5"),
//     schema: z.object({
//       edits: z.array(editSchema).describe("The edits to apply to the content")
//     }),
//     system: `
//     You are a helpful assistant that suggests content edits for a given content.
//     You will be given a content and you will need to suggest the edits to apply to the content.
//     You will return an object with the edits to apply to the content.
//     `,
//     messages: [
//       { role: "user", content: `<content>${content}</content>\n\nTask: <task>${task}</task> ` }
//     ]
//   })

//   return result.object
// }
