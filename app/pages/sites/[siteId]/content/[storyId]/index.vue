<script setup lang="ts">
import { ref, watch, onMounted } from "vue"

definePageMeta({ layout: "story" })

const storyId = useRouteParams("storyId")
const siteId = useRouteParams("siteId")

const { toast } = useToast()

const {
  data: story,
  error,
  refresh
} = await useFetch(`/api/sites/${siteId.value}/stories/${storyId.value}`)

if (error.value) {
  toast.error({ description: "Failed to load story" })
}

const content = ref(story.value?.content || {})

onMounted(() => {
  console.log("Initial content.value (onMounted):", JSON.stringify(content.value, null, 2))
})

watch(
  story,
  (newStory) => {
    if (newStory) {
      content.value = newStory.content || {}
      console.log("content.value updated (story watch):", JSON.stringify(content.value, null, 2))
    }
  },
  { deep: true }
)

async function save() {
  if (!story.value) return

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
    await refresh()
    toast.success({ description: "The story has been saved." })
  } catch (saveError) {
    toast.error({ description: "Failed to save story" })
  }
}

function publish() {
  toast.info({ description: "Publishing is not yet implemented" })
}

function updateNestedField(originalPath: string[], value: any) {
  console.log(
    "updateNestedField called with originalPath:",
    originalPath,
    "value:",
    JSON.stringify(value, null, 2)
  )
  if (!story.value) {
    console.log("story.value is null. Returning.")
    return
  }

  const path = [...originalPath]
  console.log("Copied path:", path)

  const lastKey = path.pop()
  console.log("lastKey (after pop):", lastKey)
  console.log("path (after pop):", path)

  if (!lastKey) {
    console.log("lastKey is null. Returning.")
    return
  }

  let current = content.value
  console.log("Initial current:", JSON.stringify(current, null, 2))

  for (const key of path) {
    console.log("Traversing path segment:", key)
    if (typeof current[key] !== "object" || current[key] === null) {
      console.log("Creating missing path segment (object):", key)
      current[key] = {} // or [] depending on what's expected
    }

    current = current[key]
    console.log("Current after traversing segment:", JSON.stringify(current, null, 2))
  }

  console.log("Final current before update:", JSON.stringify(current, null, 2))
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    current[lastKey] = { ...value } // Use spread for objects
  } else {
    current[lastKey] = value
  }

  console.log("content.value after update:", JSON.stringify(content.value, null, 2))
}

// Corrected recursive search and delete
function findAndDeleteById(data: any, idToDelete: string): boolean {
  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      if (data[i]?.id === idToDelete) {
        data.splice(i, 1)
        return true
      }
      if (typeof data[i] === "object" && data[i] !== null) {
        if (findAndDeleteById(data[i], idToDelete)) return true
      }
    }
  } else if (typeof data === "object" && data !== null) {
    // Check the object itself for the ID *before* recursing
    if (data.id === idToDelete) {
      // We can't delete the root object here.  Caller must handle.
      return false // Indicate we *found* it, but couldn't delete.
    }
    for (const key in data) {
      if (findAndDeleteById(data[key], idToDelete)) return true
    }
  }
  return false
}

function deleteBlock(idToDelete: string) {
  console.log("deleteBlock called with idToDelete:", idToDelete)
  if (!story.value) {
    console.log("story.value is null. Returning.")
    return
  }

  // Handle the case where the root object itself needs deleting
  if (content.value.id === idToDelete) {
    console.warn("Cannot delete the root content object.") // Or handle differently
    return
  }

  const deleted = findAndDeleteById(content.value, idToDelete)
  if (!deleted) {
    console.warn(`Block with id ${idToDelete} not found.`)
  }
  console.log("content.value after delete:", JSON.stringify(content.value, null, 2))
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
      <pre>{{ content }}</pre>
    </div>
    <div class="border-neutral bg-neutral flex w-[500px] flex-col gap-2 border-l p-5">
      <template
        v-for="field in story.component.fields"
        :key="field.fieldKey"
      >
        <DField
          :field="field"
          :value="content[field.fieldKey]"
          @update:value="updateNestedField([field.fieldKey], $event)"
          @delete-block="(idToDelete) => deleteBlock(idToDelete)"
        />
      </template>
    </div>
  </div>
</template>
