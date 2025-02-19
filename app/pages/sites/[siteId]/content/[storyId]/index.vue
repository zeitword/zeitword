<script setup lang="ts">
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

watch(story, (newStory) => {
  if (newStory) {
    content.value = newStory.content || {}
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
  toast.info({ description: "Publishing is not yet implemented" })
}

function updateNestedField(originalPath: string[], value: any) {
  if (!story.value) return

  const path = [...originalPath]
  const lastKey = path.pop()
  if (!lastKey) return

  const newContent = { ...content.value }
  let current = newContent

  for (const key of path) {
    current[key] = { ...(current[key] || {}) }
    current = current[key]
  }
  current[lastKey] = value
  content.value = newContent
}

function deleteBlock(originalPath: string[], index: number) {
  if (!story.value) return

  const path = [...originalPath]
  const arrayKey = path.pop()

  if (!arrayKey) return

  let current: any = content.value
  for (const key of path) {
    if (!current[key]) return
    current = current[key]
  }

  // Check and delete
  if (
    current &&
    typeof current === "object" &&
    current[arrayKey] &&
    Array.isArray(current[arrayKey])
  ) {
    current[arrayKey].splice(index, 1) // Use splice directly on the array
  } else {
    console.error(
      "Target is not an array or path is invalid",
      current,
      arrayKey,
      index,
      originalPath
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
      <!-- Display the content from the ref -->
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
