<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue"
import { useRouter } from "vue-router"

import { FileJsonIcon } from "lucide-vue-next"
import { vShow } from "vue"

definePageMeta({ layout: "story" })

const storyId = useRouteParams("storyId")
const siteId = useRouteParams("siteId")

const { toast } = useToast()
const router = useRouter()

const { data: site } = await useFetch(`/api/sites/${siteId.value}`)

const showJson = ref(false)

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
    return
  }

  const path = [...originalPath]
  const lastKey = path.pop()

  if (!lastKey) {
    return
  }

  let current = content.value

  for (const key of path) {
    if (typeof current[key] !== "object" || current[key] === null) {
      current[key] = {}
    }
    current = current[key]
  }

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    current[lastKey] = { ...value }
  } else {
    current[lastKey] = value
  }
}

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
    if (data.id === idToDelete) {
      return false
    }
    for (const key in data) {
      if (findAndDeleteById(data[key], idToDelete)) return true
    }
  }
  return false
}

function deleteBlock(idToDelete: string) {
  if (!story.value) return
  const deleted = findAndDeleteById(content.value, idToDelete)
  if (!deleted) {
    console.warn(`Block with id ${idToDelete} not found.`)
  }
}

const sortedFields = computed(() => {
  if (story.value && story.value.component && story.value.component.fields) {
    return [...story.value.component.fields].sort((a, b) => a.order.localeCompare(b.order))
  }
  return []
})

const goDeep = () => {
  if (story.value) {
    router.push(`/sites/${siteId.value}/content/${story.value.id}`)
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
    <div class="flex items-center gap-2">
      <DButton
        :icon-left="FileJsonIcon"
        @click="showJson = !showJson"
        :variant="showJson ? 'primary' : 'secondary'"
      />
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
    class="flex h-full flex-1"
  >
    <div class="flex-1 overflow-auto bg-white">
      <iframe
        class="h-full w-full"
        v-if="!showJson"
        :src="`${site?.domain}/${story.slug}`"
      />
      <pre
        class="p-4"
        v-else
        >{{ content }}</pre
      >
    </div>
    <div
      class="border-neutral bg-neutral flex w-[720px] flex-col gap-2 overflow-scroll border-l p-5"
    >
      <template
        v-for="field in sortedFields"
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
