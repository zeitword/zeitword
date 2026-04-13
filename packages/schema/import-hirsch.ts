import { useDrizzle } from "./drizzle/client"
import { and, eq, notInArray } from "drizzle-orm"
import { componentFields, components, fieldOptions, organisations, sites } from "./drizzle/schema"
import { schema } from "./schema-hirsch"
import { LexoRank } from "lexorank"

const organisationId = process.env.ORGANISATION_ID
const siteId = "019d447f-eec5-7635-8bf0-0614fc1f2540"

if (!organisationId) {
  throw new Error("ORGANISATION_ID must be set in .env")
}

async function importSchema() {
  const drizzle = useDrizzle()

  const [site] = await drizzle.select().from(sites).where(eq(sites.id, siteId))

  const [org] = await drizzle
    .select()
    .from(organisations)
    .where(eq(organisations.id, organisationId))

  console.log(`Organisation: ${org.name} (${org.id})`)
  console.log(`Site: ${site.name} (${site.id})`)

  try {
    for (const schemaKey in schema) {
      const component = schema[schemaKey]
      console.log(component.displayName)

      const [_component] = await drizzle
        .insert(components)
        .values({
          name: component.name,
          displayName: component.displayName,
          previewField: component.previewField ?? null,
          siteId,
          organisationId
        })
        .onConflictDoUpdate({
          target: [components.siteId, components.name],
          set: {
            displayName: component.displayName,
            previewField: component.previewField ?? null
          }
        })
        .returning({
          id: components.id
        })

      const fieldKeys = Object.keys(component.fields)
      let previousRank = LexoRank.min()

      for (const fieldKey of fieldKeys) {
        const field = component.fields[fieldKey]

        if (!field.type) {
          console.error(
            `Field type is undefined for fieldKey: ${fieldKey} in component: ${component.name}`
          )
          continue
        }

        const rank = previousRank.genNext()
        previousRank = rank

        await drizzle
          .insert(componentFields)
          .values({
            fieldKey,
            componentId: _component.id,
            type: field.type,
            required: field.required ?? false,
            description: field.description ?? null,
            displayName: field.displayName ?? null,
            componentWhitelist: field.componentWhitelist ?? [],
            siteId,
            organisationId,
            order: rank.toString()
          })
          .onConflictDoUpdate({
            target: [componentFields.fieldKey, componentFields.componentId],
            set: {
              type: field.type,
              required: field.required ?? false,
              description: field.description ?? null,
              displayName: field.displayName ?? null,
              componentWhitelist: field.componentWhitelist ?? [],
              order: rank.toString()
            }
          })

        if (field.type === "option" && field.options) {
          for (const option of field.options) {
            await drizzle
              .insert(fieldOptions)
              .values({
                componentId: _component.id,
                fieldKey,
                optionName: option.value,
                optionValue: option.key,
                siteId,
                organisationId
              })
              .onConflictDoUpdate({
                target: [fieldOptions.componentId, fieldOptions.fieldKey, fieldOptions.optionValue],
                set: {
                  optionName: option.value,
                  optionValue: option.key
                }
              })
          }
        }
      }

      // Delete fields that are no longer in the schema
      await drizzle
        .delete(componentFields)
        .where(
          and(
            eq(componentFields.componentId, _component.id),
            notInArray(componentFields.fieldKey, fieldKeys)
          )
        )
    }
    console.log("Schema import successful!")
  } catch (error) {
    console.error("Schema import failed:", error)
  } finally {
    process.exit(0)
  }
}

importSchema()
