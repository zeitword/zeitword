import { z } from "zod"
import { organisations, users } from "../database/schema"

const bodySchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
  organisationName: z.string(),
})

export default defineEventHandler(async (event) => {
  try {
    const body = await readValidatedBody(event, bodySchema.parse)

    // check if the user already exists
    const existing = await useDrizzle().select().from(users).where(eq(users.email, body.email))
    if (existing.length > 0) return {}

    // Create organisation
    const createdOrgs = await useDrizzle()
      .insert(organisations)
      .values({
        name: body.organisationName,
      })
      .returning()

    const org = createdOrgs[0]

    const hashedPassword = await hashPassword(body.password)

    const user = await useDrizzle()
      .insert(users)
      .values({
        name: body.name,
        email: body.email,
        password: hashedPassword,
        role: "admin",
        organisationId: org.id,
      })
      .returning()

    // TODO: log in the user immediately

    return {}
  } catch (error) {
    console.error(error)
    return {}
  }
})
