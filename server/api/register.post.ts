import { z } from "zod"
import { organisations, users } from "../database/schema"

const bodySchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string().min(8),
  organisationName: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, bodySchema.parse)

    // check if the user already exists
    const existing = await useDrizzle().select().from(users).where(eq(users.email, body.email))
    if (existing.length > 0) return {}

    const db = useDrizzle()
    const hashedPassword = await hashPassword(body.password)

    return await db.transaction(async (tx) => {
      // Create organisation
      const [org] = await tx
        .insert(organisations)
        .values({
          name: body.organisationName
        })
        .returning()

      const user = await tx
        .insert(users)
        .values({
          name: body.name,
          email: body.email,
          password: hashedPassword,
          organisationId: org.id
        })
        .returning()

      // TODO: log in the user immediately

      return {}
    })
  } catch (error) {
    console.error(error)
    return {}
  }
})
