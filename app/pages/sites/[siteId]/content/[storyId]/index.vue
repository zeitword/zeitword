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

watch(
  story,
  (newStory) => {
    if (newStory) {
      content.value = newStory.content || {}
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

function deleteBlock(originalPath: string[], index: number) {
  console.log("deleteBlock called with originalPath:", originalPath, "and index:", index)

  if (!story.value) {
    console.log("story.value is null or undefined. Returning.")
    return
  }

  const path = [...originalPath]
  console.log("Copied path:", path)

  const arrayKey = path.pop()
  console.log("arrayKey (after pop):", arrayKey)
  console.log("path (after pop):", path)

  if (!arrayKey) {
    console.log("arrayKey is null. returning")
    return
  }

  let current: any = content.value
  console.log("Initial current:", JSON.stringify(current, null, 2))

  for (const key of path) {
    console.log("Traversing path segment:", key)
    if (!current[key]) {
      console.error("Path segment not found:", key, "in", JSON.stringify(current, null, 2))
      return
    }
    current = current[key]
    console.log("Current after traversing segment:", JSON.stringify(current, null, 2))
  }

  console.log("Final current:", JSON.stringify(current, null, 2))
  console.log(
    "current[arrayKey]:",
    current ? JSON.stringify(current[arrayKey], null, 2) : "current is null"
  )

  if (current && current[arrayKey] && Array.isArray(current[arrayKey])) {
    console.log("Splicing array at index:", index)
    current[arrayKey].splice(index, 1)
    console.log("content.value after splice:", JSON.stringify(content.value, null, 2))
  } else {
    console.error(
      "deleteBlock target is not an array:",
      JSON.stringify(current, null, 2),
      arrayKey,
      path,
      index
    )
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
          @delete-block="(path, index) => deleteBlock(path, index)"
        />
      </template>
    </div>
  </div>
</template>
