import { stories, storyTranslatedSlugs } from "~~/server/database/schema"
import { eq, and } from "drizzle-orm"

export async function transformLinks(obj: any, language: string, siteId: string): Promise<any> {
  if (!obj) return obj

  // Handle link objects: { type: "internal" | "external", ... }
  if (obj && typeof obj === "object" && !Array.isArray(obj) && obj.type) {
    if (obj.type === "external" && obj.url) {
      return obj.url
    }
    if (obj.type === "internal" && obj.storyId) {
      try {
        // First check for translated slug
        const db = useDrizzle()
        let slug = null

        if (language) {
          const translatedSlugs = await db
            .select({ slug: storyTranslatedSlugs.slug })
            .from(storyTranslatedSlugs)
            .where(
              and(
                eq(storyTranslatedSlugs.storyId, obj.storyId),
                eq(storyTranslatedSlugs.siteId, siteId),
                eq(storyTranslatedSlugs.languageCode, language)
              )
            )
            .limit(1)

          if (translatedSlugs.length > 0) {
            slug = translatedSlugs[0].slug
          }
        }

        // Fall back to default slug if no translation found
        if (!slug) {
          const storyResults = await db
            .select({ slug: stories.slug })
            .from(stories)
            .where(eq(stories.id, obj.storyId))
            .limit(1)

          if (storyResults.length > 0) {
            slug = storyResults[0].slug
          }
        }

        return slug ? `/${slug}` : `#${obj.storyId}`
      } catch (error) {
        console.error("Error transforming internal link:", error)
        return `#${obj.storyId}`
      }
    }
  }

  // Process arrays
  if (Array.isArray(obj)) {
    const results = []
    for (const item of obj) {
      results.push(await transformLinks(item, language, siteId))
    }
    return results
  }

  // Process objects recursively
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const result: Record<string, any> = {}
    for (const key in obj) {
      result[key] = await transformLinks(obj[key], language, siteId)
    }
    return result
  }

  // Return primitive values as is
  return obj
}

export async function mergeWithFallbackAndTransformLinks(
  defaultObj: any,
  requestedObj: any,
  language: string,
  siteId: string
) {
  const merged = mergeWithFallback(defaultObj, requestedObj)
  return transformLinks(merged, language, siteId)
}

export function mergeWithFallback(defaultObj: any, requestedObj: any) {
  if (!defaultObj) return requestedObj
  if (!requestedObj) return defaultObj

  const result = { ...defaultObj }

  for (const key in requestedObj) {
    if (typeof requestedObj[key] === "object" && requestedObj[key] !== null) {
      // Check if object has only numeric keys
      const isNumericKeysObject = Object.keys(requestedObj[key]).every((k) => !isNaN(Number(k)))
      if (isNumericKeysObject) {
        result[key] = Object.values(requestedObj[key])
      } else {
        result[key] = mergeWithFallback(defaultObj[key] || {}, requestedObj[key])
      }
    } else if (requestedObj[key] !== null && requestedObj[key] !== "") {
      result[key] = requestedObj[key]
    }
  }

  return result
}
