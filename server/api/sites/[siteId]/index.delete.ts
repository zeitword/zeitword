import {
  sites,
  components,
  componentFields,
  fieldOptions,
  stories
} from "~~/server/database/schema"
import { and, eq } from "drizzle-orm"

export default defineEventHandler(async (event) => {
  const { secure, session } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, statusMessage: "Unauthorized" })

  const siteId = getRouterParam(event, "siteId")
  if (!siteId) throw createError({ statusCode: 400, statusMessage: "siteId is required" })

  const db = useDrizzle()

  try {
    return await db.transaction(async (tx) => {
      const [existingSite] = await tx
        .select()
        .from(sites)
        .where(and(eq(sites.id, siteId), eq(sites.organisationId, secure.organisationId)))

      if (!existingSite) {
        throw createError({
          statusCode: 403,
          statusMessage: "Site not found or you do not have permission to delete it."
        })
      }

      // Get all stories to validate content before deletion
      const siteStories = await tx
        .select()
        .from(stories)
        .where(and(eq(stories.siteId, siteId), eq(stories.organisationId, secure.organisationId)))

      // Get all components to check for references
      const siteComponents = await tx
        .select()
        .from(components)
        .where(and(eq(components.siteId, siteId), eq(components.organisationId, secure.organisationId)))

      // Get all component fields to validate content against
      const siteComponentFields = await tx
        .select()
        .from(componentFields)
        .where(and(eq(componentFields.siteId, siteId), eq(componentFields.organisationId, secure.organisationId)))

      // Check for orphaned data in stories content
      for (const story of siteStories) {
        // Validate that the story's content references valid components and fields
        const content = story.content as any
        if (content && typeof content === 'object') {
          // Validate component references
          if (content.componentId) {
            const componentExists = siteComponents.some(comp => comp.id === content.componentId);
            if (!componentExists) {
              throw createError({
                statusCode: 400,
                statusMessage: `Story '${story.title}' references a non-existent component`
              });
            }
          }
          
          // Validate fields in content
          if (content.fields && typeof content.fields === 'object') {
            for (const fieldKey in content.fields) {
              const fieldExists = siteComponentFields.some(
                field => field.componentId === story.componentId && field.fieldKey === fieldKey
              );
              
              if (!fieldExists) {
                throw createError({
                  statusCode: 400,
                  statusMessage: `Story '${story.title}' contains invalid field '${fieldKey}'`
                });
              }
            }
          }
          
          // Check for nested components
          if (Array.isArray(content.children)) {
            for (const child of content.children) {
              if (child.componentId) {
                const childComponentExists = siteComponents.some(comp => comp.id === child.componentId);
                if (!childComponentExists) {
                  throw createError({
                    statusCode: 400,
                    statusMessage: `Story '${story.title}' contains a nested component that doesn't exist`
                  });
                }
              }
            }
          }
        }
      }

      // Delete in proper order to respect foreign key constraints
      await tx
        .delete(stories)
        .where(and(eq(stories.siteId, siteId), eq(stories.organisationId, secure.organisationId)))
      await tx
        .delete(fieldOptions)
        .where(
          and(
            eq(fieldOptions.siteId, siteId),
            eq(fieldOptions.organisationId, secure.organisationId)
          )
        )
      await tx
        .delete(componentFields)
        .where(
          and(
            eq(componentFields.siteId, siteId),
            eq(componentFields.organisationId, secure.organisationId)
          )
        )
      await tx
        .delete(components)
        .where(
          and(eq(components.siteId, siteId), eq(components.organisationId, secure.organisationId))
        )
      const [deletedSite] = await tx
        .delete(sites)
        .where(and(eq(sites.id, siteId), eq(sites.organisationId, secure.organisationId)))
        .returning()

      return deletedSite
    })
  } catch (error) {
    console.error("Error deleting site:", error)
    if (error instanceof Error && error.message.includes("foreign key constraint")) {
      throw createError({
        statusCode: 409,
        statusMessage: "Cannot delete site because it has related data."
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error"
    })
  }
})
