import { defineStore } from "pinia"
import { computed, ref } from "vue"
import type { stories } from "~~/server/database/schema"

type Story = typeof stories.$inferSelect

interface StoryContent {
  [key: string]: string | number | boolean | null | Object
}

interface TypedStory extends Omit<Story, "content"> {
  content: StoryContent
}

export const useStoryStore = defineStore("story", () => {
  const route = useRoute()
  const siteId = computed(() => route.params.siteId)

  // state
  const currentStory = ref()
  const currentStoryCompare = ref()
  const components = ref()
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const content = computed(() => currentStory.value?.content as StoryContent)
  const hasChanges = computed(() => {
    console.log("comparing", currentStory.value?.content, currentStoryCompare.value?.content)
    return JSON.stringify(currentStory.value?.content) !== JSON.stringify(currentStoryCompare.value?.content)
  })

  // actions
  async function fetchStory(storyId: string) {
    if (currentStory.value?.id === storyId) {
      return
    }

    console.log("fetching story", storyId)

    isLoading.value = true
    error.value = null

    try {
      const { data: response } = await useFetch<Story>(`/api/sites/${siteId.value}/stories/${storyId}`)
      if (response.value) {
        currentStory.value = {
          ...response.value
        }
      }
    } catch (err) {
      error.value = "Failed to fetch site"
      console.error("Error fetching site:", err)
    } finally {
      isLoading.value = false
    }

    // copy the current story to compare
    currentStoryCompare.value = JSON.parse(JSON.stringify(currentStory.value))
  }

  async function updateField(fieldKey: string, value: string) {
    if (!currentStory.value) return
    currentStory.value.content[fieldKey] = value
  }

  function getNestedValue(path: string[]) {
    return path.reduce((obj: any, key) => obj?.[key], currentStory.value?.content)
  }

  function updateNestedField(path: string[], value: any) {
    if (!currentStory.value) return

    let current = currentStory.value.content
    const lastKey = path[path.length - 1]
    if (!lastKey) return

    // Navigate to the parent object
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i]
      if (!key) continue
      if (!(key in current)) {
        current[key] = {}
      }
      current = current[key]
    }

    // Set the value
    current[lastKey] = value
  }

  async function updateBlock(blockId: string, value: string) {
    if (!currentStory.value) return
    currentStory.value.content[blockId] = value
  }

  async function save() {
    if (!currentStory.value) return

    console.log("saving", currentStory.value)
    await $fetch(`/api/sites/${siteId.value}/stories/${currentStory.value.id}`, {
      method: "PUT",
      body: {
        slug: currentStory.value.slug,
        title: currentStory.value.title,
        content: currentStory.value.content,
        componentId: currentStory.value.component.id
      }
    })
    console.log("saved", currentStory.value.id)
    await fetchStory(currentStory.value.id)
  }

  onMounted(async () => {
    if (!route.params.siteId) return
    if (!route.params.storyId) return
    await fetchStory(route.params.storyId as string)
  })

  watch(route, async (newRoute) => {
    if (!newRoute.params.siteId) return
    if (!newRoute.params.storyId) return
    await fetchStory(newRoute.params.storyId as string)
  })

  return {
    // state
    currentStory: currentStory,
    isLoading,
    error,

    content,
    hasChanges,

    // actions
    fetchStory,
    updateField,
    updateNestedField,
    getNestedValue,
    save
  }
})
