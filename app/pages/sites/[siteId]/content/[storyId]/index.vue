<script setup lang="ts">
import { stories, components, componentFields } from "~~/server/database/schema"

definePageMeta({ layout: "story" })

const route = useRoute()
const storyId = computed(() => route.params.storyId as string)
const siteId = computed(() => route.params.siteId as string)

const {
  data: story,
  pending: isLoading,
  error,
  refresh
} = await useFetch(`/api/sites/${siteId.value}/stories/${storyId.value}`)

if (error.value) {
  console.error("Failed to fetch site:", error.value)
  // Consider showing a user-friendly error message here, perhaps using useToast()
}

const { toast } = useToast()

// Use a ref for the content, initialized from the fetched story
const content = ref(story.value?.content || {}) // Initialize with empty object if content is null

// Watch for changes in the fetched story and update the content ref
watch(story, (newStory) => {
  if (newStory) {
    content.value = newStory.content || {} // Update content when story changes
  }
})

async function save() {
  if (!story.value) return

  console.log("saving", story.value)
  try {
    await $fetch(`/api/sites/${siteId.value}/stories/${story.value.id}`, {
      method: "PUT",
      body: {
        slug: story.value.slug,
        title: story.value.title,
        content: content.value,
        componentId: story.value.component.id
      }
    })
    console.log("saved", story.value.id)
    await refresh()
    toast.success({ description: "The story has been saved." })
  } catch (saveError) {
    toast.error({ description: "Failed to save story" })
  }
}

function publish() {
  console.log("publish")
}

// --- Content Update Functions ---
function updateNestedField(originalPath: string[], value: any) {
  if (!story.value) return

  // Create a *copy* of the path to avoid mutation
  const path = [...originalPath]
  const lastKey = path.pop()
  if (!lastKey) return

  // Use immer-like update for deep object modification
  const newContent = { ...content.value } // Start with a shallow copy
  let current = newContent

  for (const key of path) {
    current[key] = { ...(current[key] || {}) } // Ensure nested objects exist
    current = current[key]
  }
  current[lastKey] = value
  content.value = newContent // Assign the *new* object to the ref
}

function deleteBlock(originalPath: string[], index: number) {
  if (!story.value) return
  // Create a *copy* of the path
  const path = [...originalPath]

  let current: any = content.value

  for (const key of path) {
    if (!current[key]) return // nothing to delete
    current = current[key]
  }

  if (Array.isArray(current)) {
    const newContent = { ...content.value } // Start with a shallow copy
    let current2 = newContent
    for (const key of path) {
      current2[key] = { ...(current2[key] || {}) } // Ensure nested objects exist
      current2 = current2[key]
    }
    current2.splice(index, 1) // Remove the block at the specified index
    content.value = newContent
  }
}
</script>

<template>
  <DPageTitle
    v-if="story"
    :title="story.title"
    wide
  >
    <template #subtitle>
      <p class="text-copy-sm text-neutral-subtle">/{{ story.slug }}</p>
    </template>
    <div class="flex gap-2">
      <DButton
        variant="secondary"
        @click="save"
      >
        Save
      </DButton>
      <DButton @click="publish">Publish</DButton>
    </div>
  </DPageTitle>
  <div
    v-if="story"
    class="flex flex-1"
  >
    <div class="flex-1 overflow-auto p-5">
      <!-- Display the content from the ref -->
      <pre>{{ content }}</pre>
    </div>
    <div class="border-neutral flex w-[500px] flex-col gap-2 border-l p-5">
      <template
        v-for="field in story.component.fields"
        :key="field.fieldKey"
      >
        <DField
          :field="field"
          :value="content[field.fieldKey]"
          @update:value="updateNestedField([field.fieldKey], $event)"
        />
      </template>
    </div>
  </div>
</template>
