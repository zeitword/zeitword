<script setup lang="ts">
import { FileJsonIcon } from "lucide-vue-next"

definePageMeta({ layout: "story" })

const storyId = useRouteParams("storyId")
const siteId = useRouteParams("siteId")

const { toast } = useToast()

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

const renderPreview = computed(() => {
  if (!story) return false
  return story.value?.component?.renderPreview
})

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

const isDeleteModalOpen = ref(false)
const selectedBlockId = ref<string | null>(null)

function openDeleteModal(id: string) {
  isDeleteModalOpen.value = true
  selectedBlockId.value = id
}

function deleteBlock() {
  const idToDelete = selectedBlockId.value
  if (!idToDelete) return
  if (!story.value) return
  const deleted = findAndDeleteById(content.value, idToDelete)
  if (!deleted) {
    console.warn(`Block with id ${idToDelete} not found.`)
  }
  isDeleteModalOpen.value = false
  selectedBlockId.value = null
}

const sortedFields = computed(() => {
  if (story.value && story.value.component && story.value.component.fields) {
    return [...story.value.component.fields].sort((a, b) => a.order.localeCompare(b.order))
  }
  return []
})

const iframeUrl = computed(() => {
  if (!site.value?.domain || !story.value?.slug) return null
  let slug = story.value.slug.replace("index", "")
  let domain = site.value.domain
  if (domain.endsWith("/")) domain = domain.slice(0, -1)
  return `${domain}/${slug}`
})

type ComponentPayload = {
  blockId: string
  componentId: string
  componentName: string
}

const targetBlockId = ref<string | null>(null)

const openBlock = (blockId: string) => {
  const findAndOpenBlock = (blocks: any[]) => {
    for (const block of blocks) {
      if (block.id === blockId) {
        return true
      }

      if (block.content && Array.isArray(block.content.blocks)) {
        if (findAndOpenBlock(block.content.blocks)) {
          return true
        }
      }
    }
    return false
  }

  if (content.value.blocks) {
    findAndOpenBlock(content.value.blocks)
  }
}

function handleComponentClick(component: ComponentPayload) {
  targetBlockId.value = component.blockId
  openBlock(component.blockId)
}

const isPreviewReady = ref(false)
</script>

<template>
  <DPageTitle
    v-if="story"
    :title="story.title"
    wide
    size="sm"
  >
    <template #subtitle>
      <p class="text-copy-sm text-neutral-subtle">{{ story.slug }}</p>
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
    class="flex min-h-0 flex-grow basis-2/3"
  >
    <div
      class="code-container flex-1 overflow-auto bg-white"
      v-if="renderPreview || showJson"
    >
      <DPreview
        v-if="!showJson && site && story"
        :site-domain="site.domain"
        :story-slug="story.slug"
        :content="content"
        @ready="isPreviewReady = true"
        @componentClick="handleComponentClick"
      />
      <div
        v-else="showJson"
        class="p-4"
      >
        <pre
          class="bg-neutral text-neutral border-neutral overflow-x-auto rounded-lg border p-4 break-all whitespace-pre-wrap"
          >{{ content }}</pre
        >
      </div>
    </div>

    <div
      class="border-neutral bg-neutral flex flex-1 flex-col gap-2 overflow-auto border-l p-5"
      :class="!renderPreview && !showJson ? 'w-full' : 'max-w-[500px]'"
    >
      <div class="mx-auto w-full max-w-4xl">
        <template
          v-for="field in sortedFields"
          :key="field.fieldKey"
        >
          <DField
            :field="field"
            :value="content[field.fieldKey]"
            :target-block-id="targetBlockId"
            @update:value="updateNestedField([field.fieldKey], $event)"
            @delete-block="(idToDelete) => openDeleteModal(idToDelete)"
          />
        </template>
      </div>
    </div>
  </div>
  <DModal
    :open="isDeleteModalOpen"
    title="Delete Block"
    description="Do you really want to delete this block?"
    confirm-text="Delete"
    danger
    @close="isDeleteModalOpen = false"
    @confirm="deleteBlock"
  ></DModal>
</template>

<style scoped>
.code-container {
  background: var(--background-color-neutral-weak) url("/stripes.svg");
  background-blend-mode: overlay;
}
</style>
