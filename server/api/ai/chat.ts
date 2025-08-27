import { createOpenAI } from "@ai-sdk/openai"
import { convertToModelMessages, streamText, tool, generateObject, stepCountIs } from "ai"
import { z } from "zod"
import { getStoryContent } from "../sites/[siteId]/stories/[storyId]/index.get"

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
      model: openai.responses("gpt-5"),
      messages: convertToModelMessages(messages),
      tools: {
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
      },
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
