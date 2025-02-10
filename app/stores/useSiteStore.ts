// stores/site.ts
import { defineStore } from "pinia"
import { computed, ref } from "vue"
import type { sites } from "~~/server/database/schema"

type Site = typeof sites.$inferSelect

export const useSiteStore = defineStore("site", () => {
  // state
  const currentSite = ref<Site | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // getters
  const siteName = computed(() => currentSite.value?.name)
  const siteId = computed(() => currentSite.value?.id)

  // actions
  async function fetchSite(siteId: string) {
    // Don't fetch if we already have this site
    if (currentSite.value?.id === siteId) {
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const { data: response } = await useFetch<Site>(`/api/sites/${siteId}`)
      if (response.value) {
        currentSite.value = {
          ...response.value
        }
      }
    } catch (err) {
      error.value = "Failed to fetch site"
      console.error("Error fetching site:", err)
    } finally {
      isLoading.value = false
    }
  }

  return {
    // state
    currentSite,
    isLoading,
    error,

    // getters
    siteName,
    siteId,

    // actions
    fetchSite
  }
})
