import { z } from "zod"

/**
 * Zod schema definitions for Postmark types
 */
const EmailMessageSchema = z.object({
  from: z.string(),
  to: z.string().email(),
  subject: z.string().min(1),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  messageStream: z.string().optional(),
})

const PostmarkConfigSchema = z.object({
  serverToken: z.string().min(1),
  //   apiUrl: z.string().url().optional().default("https://api.postmarkapp.com/email"),
})

const PostmarkResponseSchema = z.object({
  MessageID: z.string(),
  Message: z.string(),
  To: z.string(),
  SubmittedAt: z.string(),
  ErrorCode: z.number().optional(),
})

/**
 * Type definitions inferred from Zod schemas
 */
type EmailMessage = z.infer<typeof EmailMessageSchema>
type PostmarkConfig = z.infer<typeof PostmarkConfigSchema>
type PostmarkResponse = z.infer<typeof PostmarkResponseSchema>

/**
 * Custom error class for Postmark-related errors
 */
class PostmarkError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown,
  ) {
    super(message)
    this.name = "PostmarkError"
  }
}

const API_URL = "https://api.postmarkapp.com"

/**
 * Creates a Postmark email client utility with validation
 * @param config - Configuration options for Postmark
 * @returns Object containing email sending methods
 * @throws {z.ZodError} If config validation fails
 */
export function usePostmark(config: PostmarkConfig) {
  const validatedConfig = PostmarkConfigSchema.parse(config)

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Postmark-Server-Token": validatedConfig.serverToken,
  }

  /**
   * Sends an email using Postmark API
   * @param message - Email message configuration
   * @returns Promise resolving to validated Postmark API response
   * @throws {z.ZodError} If message validation fails
   * @throws {PostmarkError} If API request fails
   */
  function sendEmail(message: EmailMessage): Promise<PostmarkResponse> {
    const validatedMessage = EmailMessageSchema.parse(message)

    const payload = {
      From: validatedMessage.from,
      To: validatedMessage.to,
      Subject: validatedMessage.subject,
      HtmlBody: validatedMessage.htmlBody,
      TextBody: validatedMessage.textBody,
      MessageStream: validatedMessage.messageStream || "outbound",
    }

    return fetch(`${API_URL}/email`, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    })
      .then(async function (response) {
        if (!response.ok) {
          console.log(response)
          const res = await response.json()
          console.log(res)
          throw new PostmarkError("Postmark API request failed", response.status)
        }
        return response.json()
      })
      .then(function (data) {
        // Validate API response
        return PostmarkResponseSchema.parse(data)
      })
      .catch(function (error) {
        if (error instanceof z.ZodError) {
          throw new PostmarkError("Invalid API response format", undefined, error.errors)
        }
        throw error
      })
  }

  return {
    sendEmail,
  }
}
