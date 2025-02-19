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
  // Create a *copy* of the path
  const path = [...originalPath]

  let current: any = content.value

  for (const key of path) {
    if (!current[key]) return // nothing to delete
    current = current[key]
  }

  if (Array.isArray(current)) {
    const newContent = { ...content.value }
    let current2 = newContent
    for (const key of path) {
      current2[key] = { ...(current2[key] || {}) }
      current2 = current2[key]
    }
    current2.splice(index, 1)
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
