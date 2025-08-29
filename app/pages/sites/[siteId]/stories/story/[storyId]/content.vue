<script setup lang="ts">
import { ArrowUpIcon, FileJsonIcon, FileWarningIcon, SparklesIcon } from "lucide-vue-next"
import { merge, set } from "lodash-es"
import { LexoRank } from "lexorank"
import { useMagicKeys, whenever } from "@vueuse/core"
import { uuidv7 } from "uuidv7"

definePageMeta({ layout: "story" })

const storyId = useRouteParams("storyId")
const siteId = useRouteParams("siteId")

const { toast } = useToast()
const hasChanges = ref(false)

const { data: site } = await useFetch(`/api/sites/${siteId.value}`)
const selectedLanguage = ref(site.value?.defaultLanguage || "en")

const showJson = ref(false)

const {
  data: story,
  error,
  refresh
} = await useFetch(`/api/sites/${siteId.value}/stories/${storyId.value}`, {
  query: computed(() => ({
    lang: selectedLanguage.value
  }))
})

if (error.value) {
  toast.error({ description: "Failed to load story" })
}

const content = ref(JSON.parse(JSON.stringify(story.value?.content || {})))
const contentOriginal = ref(JSON.parse(JSON.stringify(content.value)))

watch(
  content,
  (updated) => {
    if (JSON.stringify(updated) === JSON.stringify(contentOriginal.value)) {
      hasChanges.value = false
    } else {
      hasChanges.value = true
    }
  },
  { deep: true }
)

async function handleLanguageChange(newLang: string) {
  if (hasChanges.value) {
    toast.warning({ description: "Please save your changes before switching languages" })
    return
  }

  selectedLanguage.value = newLang
  try {
    await refresh()
  } catch (error) {
    toast.error({ description: "Failed to switch language" })
  }
}

const languageOptions = computed(() => {
  if (!site.value?.languages) return []
  return site.value.languages.map((lang) => ({
    value: lang.language?.code || "",
    display: `${lang.language?.name || ""} (${lang.language?.nativeName || ""})`
  }))
})

const renderPreview = computed(() => {
  if (!story) return false
  return story.value?.component?.renderPreview
})

const previewContent = computed(() => {
  const langContent = content.value[selectedLanguage.value]
  // Only return content if it exists and has data, otherwise return empty object
  return langContent && Object.keys(langContent).length > 0 ? langContent : {}
})

const shouldShowPreview = computed(() => {
  return (
    renderPreview.value &&
    site.value?.domain &&
    story.value &&
    Object.keys(previewContent.value).length > 0
  )
})

async function save() {
  if (!story.value || !story.value.component) return

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
    hasChanges.value = false
    toast.success({ description: "The story has been saved." })
  } catch (saveError) {
    toast.error({ description: "Failed to save story" })
  }
}

function updateNestedFieldRefined(path: string[], value: any) {
  let target = JSON.parse(JSON.stringify(content.value))
  let insert = set({}, path.join("."), value)

  let result = merge(target, insert)

  console.log("result", result)

  content.value = result
  hasChanges.value = true
}

const { data: availableComponents } = await useFetch(`/api/sites/${siteId.value}/components`)

function addBlock({ componentId }: { componentId: string }) {
  const component = availableComponents.value?.find((c) => c.id === componentId)
  if (!component) {
    console.error("Component not found:", componentId)
    return
  }

  const currentBlocks = Array.isArray(content.value[selectedLanguage.value].blocks)
    ? [...content.value[selectedLanguage.value].blocks]
    : []

  console.log("currentBlocks", currentBlocks)

  let newRank: LexoRank
  if (currentBlocks.length === 0) {
    newRank = LexoRank.middle()
  } else {
    const lastBlock = currentBlocks.at(-1)
    newRank = LexoRank.parse(lastBlock!.order).genNext()
  }

  const newBlockId = uuidv7()
  const newBlock = {
    id: newBlockId,
    componentId: componentId,
    componentName: component.name,
    content: initializeBlockContent(component),
    order: newRank.toString()
  }

  // Add block to current language's structure
  currentBlocks.push(newBlock)

  updateNestedField([selectedLanguage.value, "blocks"], currentBlocks)
}

function initializeBlockContent(component: any): any {
  const content: any = {}
  for (const field of component.fields) {
    if (field.type === "blocks") {
      content[field.fieldKey] = []
    } else {
      content[field.fieldKey] = undefined
    }
  }
  return content
}

function updateNestedField(originalPath: string[], value: any) {
  console.log("updateNestedField", { originalPath, value })

  if (!story.value) {
    console.warn("No story found")
    return
  }

  const path = [...originalPath]
  const lastKey = path.pop()

  if (!lastKey) {
    console.warn("No last key found")
    return
  }

  let current = content.value

  for (const key of path) {
    if (!current[key] || typeof current[key] !== "object") {
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

type ComponentPayload = {
  blockId: string
  componentId: string
  componentName: string
}

const targetBlockId = ref<string | null>(null)

function openBlock(blockId: string) {
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

function resetChanges() {
  content.value = JSON.parse(JSON.stringify(originalContent.value))
  hasChanges.value = false
}

const isPreviewReady = ref(false)

const { meta_s, ctrl_s } = useMagicKeys()

// Prevent default browser save dialog
// useEventListener(
//   document,
//   "keydown",
//   (e) => {
//     if ((e.key === "s" || e.key === "S") && (e.ctrlKey || e.metaKey)) {
//       e.preventDefault()
//     }
//   },
//   { passive: false }
// )

// whenever(
//   () => meta_s?.value || ctrl_s?.value,
//   () => {
//     if (hasChanges.value) {
//       save()
//     }
//   }
// )

// onMounted(async () => {
//   await refresh()
// })

const agentEditor = useSessionStorage("agentEditor", false)

function toggleAgentEditor() {
  agentEditor.value = !agentEditor.value
}
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
    <template #center>
      <Transition name="slide-fade-up">
        <div
          v-if="hasChanges"
          class="text-warn bg-warn-subtle border-warn text-copy flex h-9 min-w-lg items-center justify-between gap-3 rounded-xl border pr-1 pl-3"
        >
          <div class="flex items-center gap-1">
            <FileWarningIcon class="size-4" />
            <p>Unsaved story</p>
          </div>
          <div class="flex items-center gap-1">
            <DButton
              variant="secondary"
              size="sm"
              @click="resetChanges"
            >
              Reset
            </DButton>
            <DButton
              variant="primary"
              size="sm"
              @click="save"
              kbd="meta_s"
            >
              Save
            </DButton>
          </div>
        </div>
      </Transition>
    </template>
    <div class="flex items-center gap-2">
      <DSelect
        :model-value="selectedLanguage"
        :options="languageOptions"
        @update:model-value="handleLanguageChange($event || '')"
      />
      <DButton
        :icon-left="FileJsonIcon"
        @click="showJson = !showJson"
        :variant="showJson ? 'primary' : 'secondary'"
      />
      <DButton
        :icon-left="SparklesIcon"
        @click="toggleAgentEditor"
        :variant="agentEditor ? 'primary' : 'secondary'"
      />
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
        v-if="shouldShowPreview && !showJson"
        :site-domain="site.domain"
        :story-slug="story.slug"
        :content="previewContent"
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
      <div class="mx-auto flex w-full max-w-4xl flex-col gap-2">
        <template
          v-for="field in sortedFields"
          :key="field.fieldKey"
        >
          <DField
            :field="field"
            :value="content[selectedLanguage]?.[field.fieldKey]"
            :target-block-id="targetBlockId || undefined"
            :current-language="selectedLanguage"
            :default-language="story.defaultLanguage"
            :default-language-value="content[story.defaultLanguage]?.[field.fieldKey]"
            @update:value="updateNestedField([selectedLanguage, field.fieldKey], $event)"
            @delete-block="(idToDelete) => openDeleteModal(idToDelete)"
          />
        </template>
      </div>
    </div>

    <div
      v-if="agentEditor"
      name="agent-editor"
      class="border-neutral flex max-w-[500px] flex-1 flex-col gap-2 overflow-auto border-l"
    >
      <d-agent-editor
        :language="selectedLanguage"
        :site-id="siteId as string"
        :story-id="storyId as string"
        :content="content"
        :sorted-fields="sortedFields"
        @updateNestedField="updateNestedFieldRefined"
        @addBlock="addBlock"
      />
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
