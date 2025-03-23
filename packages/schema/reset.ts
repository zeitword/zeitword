import { and, eq } from "drizzle-orm"
import { useDrizzle } from "./drizzle/client"
import { componentFields, components, fieldOptions } from "./drizzle/schema"

const organisationId = "0195c331-1f56-7f24-9699-c4dec1bd6dfd"
const siteId = "0195c333-3ec6-7614-b24c-f9281bf3f34f"

// fieldOptions

await useDrizzle()
  .delete(fieldOptions)
  .where(and(eq(fieldOptions.siteId, siteId), eq(fieldOptions.organisationId, organisationId)))

// fields

await useDrizzle()
  .delete(componentFields)
  .where(
    and(eq(componentFields.siteId, siteId), eq(componentFields.organisationId, organisationId))
  )

// components

await useDrizzle()
  .delete(components)
  .where(and(eq(components.siteId, siteId), eq(components.organisationId, organisationId)))

process.exit(0)
