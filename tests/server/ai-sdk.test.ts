import { createOpenAI } from "@ai-sdk/openai"
import { generateText, Output } from "ai"
import { expect, test } from "bun:test"
import { z } from "zod"

test("OpenAI Responses structured translations retain field paths and usage accounting", async () => {
  const translated = { fields: [{ path: ["blocks", 0, "text"], value: "Hallo" }] }
  let request: any
  const openai = createOpenAI({
    apiKey: "local-test-placeholder",
    fetch: async (_url, options) => {
      request = JSON.parse(options?.body as string)
      return Response.json({
        id: "resp_test",
        object: "response",
        created_at: 1,
        model: "gpt-5.4-mini",
        status: "completed",
        output: [
          {
            id: "msg_test",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: JSON.stringify(translated), annotations: [] }]
          }
        ],
        usage: {
          input_tokens: 10,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 5,
          output_tokens_details: { reasoning_tokens: 0 },
          total_tokens: 15
        }
      })
    }
  })
  const result = await generateText({
    model: openai.responses("gpt-5.4-mini"),
    output: Output.object({
      schema: z.object({
        fields: z.array(
          z.object({
            path: z.array(z.union([z.string(), z.number()])),
            value: z.string()
          })
        )
      })
    }),
    prompt: "Translate Hello to German while preserving the field path."
  })
  expect(request.model).toBe("gpt-5.4-mini")
  expect(request.text.format.type).toBe("json_schema")
  expect(result.output).toEqual(translated)
  expect(result.usage.inputTokens).toBe(10)
  expect(result.usage.outputTokens).toBe(5)
  expect(result.usage.totalTokens).toBe(15)
})
