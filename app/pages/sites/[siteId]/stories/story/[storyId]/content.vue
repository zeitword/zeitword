<script setup lang="ts">
import { LexoRank } from "lexorank"
import { merge, set } from "lodash-es"
import {
  FileJsonIcon,
  FileWarningIcon,
  LanguagesIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from "lucide-vue-next"
import { uuidv7 } from "uuidv7"

import type { EnrichedIssue } from "~/composables/useContentValidation"

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
  })),
  watch: false
})

if (error.value) {
  toast.error({ description: "Failed to load story" })
}

const content = ref(JSON.parse(JSON.stringify(story.value?.content || {})))
const contentOriginal = ref(JSON.parse(JSON.stringify(content.value)))

watch(story, (updated) => {
  content.value = JSON.parse(JSON.stringify(updated?.content || {}))
  contentOriginal.value = JSON.parse(JSON.stringify(content.value))
})

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

function cloneContent<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

async function ensureLanguageLoaded(language: string) {
  if (content.value[language] !== undefined) return

  const loadedStory = await $fetch(`/api/sites/${siteId.value}/stories/${storyId.value}`, {
    query: { lang: language }
  })
  const languageContent = cloneContent(loadedStory.content?.[language] || {})

  // Loading a language is not an edit. Update the baseline first so the
  // content watcher keeps the existing dirty state unchanged.
  contentOriginal.value[language] = cloneContent(languageContent)
  content.value[language] = languageContent
}

async function handleLanguageChange(newLang: string) {
  if (!newLang || newLang === selectedLanguage.value) return

  try {
    await ensureLanguageLoaded(newLang)
    selectedLanguage.value = newLang
  } catch (error) {
    console.error(error)
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

const {
  load: loadValidationSchema,
  validate: validateContent,
  enrichIssues,
  issueKey: buildIssueKey
} = useContentValidation()

watch(
  () => story.value?.component?.id,
  async (componentId) => {
    if (!componentId) return
    await loadValidationSchema(siteId.value, componentId)
    runValidation()
  },
  { immediate: true }
)

// all issues across every language, enriched with block ids and labels
const enrichedIssues = ref<EnrichedIssue[]>([])

function runValidation() {
  const issues = validateContent(content.value, story.value?.defaultLanguage)
  enrichedIssues.value = enrichIssues(issues, content.value)
}

// live validation, after edits and initially (debounced)
const debouncedValidation = useDebounceFn(runValidation, 400)

watch([content, () => story.value?.component?.id], () => debouncedValidation(), { deep: true })

// issues of the currently selected language
const languageIssues = computed(() =>
  enrichedIssues.value.filter((issue) => issue.path[0] === selectedLanguage.value)
)

// errors passed down to fields, keyed "language:blockId1:...:fieldKey"
const errorMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const issue of enrichedIssues.value) {
    const language = String(issue.path[0])
    const key = buildIssueKey(issue, language)
    if (!(key in map)) map[key] = issue.message
  }
  return map
})

function issueIdentity(issue: EnrichedIssue) {
  return `${issue.path.join(".")}:${issue.message}`
}

const activeIssueIdentity = ref<string | null>(null)
const activeIssueIndex = computed(() =>
  activeIssueIdentity.value
    ? enrichedIssues.value.findIndex((issue) => issueIdentity(issue) === activeIssueIdentity.value)
    : -1
)
const activeIssue = computed(() => enrichedIssues.value[activeIssueIndex.value])
const activeErrorKey = computed(() => {
  const issue = activeIssue.value
  return issue ? buildIssueKey(issue, String(issue.path[0])) : undefined
})

async function focusIssue(requestedIssue: EnrichedIssue) {
  const language = String(requestedIssue.path[0])

  try {
    await ensureLanguageLoaded(language)
    selectedLanguage.value = language

    // A server issue can refer to a language that was not loaded when the
    // response arrived. Re-validating now resolves its block indexes to ids.
    runValidation()
    const issue =
      enrichedIssues.value.find(
        (candidate) => issueIdentity(candidate) === issueIdentity(requestedIssue)
      ) || requestedIssue

    activeIssueIdentity.value = issueIdentity(issue)
    expandPath.value = [...issue.blockIds]
    targetBlockId.value = issue.blockId ?? null
  } catch (error) {
    console.error(error)
    toast.error({ description: `Failed to open the ${language} validation issue` })
  }
}

function focusNextIssue(direction: 1 | -1) {
  const count = enrichedIssues.value.length
  if (count === 0) return

  const current = activeIssueIndex.value
  const next =
    current < 0 ? (direction === 1 ? 0 : count - 1) : (current + direction + count) % count
  focusIssue(enrichedIssues.value[next]!)
}

function focusNextLanguageIssue() {
  const issue = enrichedIssues.value.find(
    (candidate) => candidate.path[0] !== selectedLanguage.value
  )
  if (issue) focusIssue(issue)
}

async function save() {
  if (!story.value || !story.value.component) return

  // re-validate before saving; the debounced watch might not have run yet
  runValidation()
  if (enrichedIssues.value.length > 0) {
    const count = enrichedIssues.value.length
    toast.warning({
      description: `Cannot save: ${count} field${count === 1 ? "" : "s"} need${
        count === 1 ? "s" : ""
      } attention. Use the validation panel to jump to ${count === 1 ? "it" : "them"}.`
    })
    focusNextIssue(1)
    return
  }

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
  } catch (saveError: any) {
    const issues = saveError?.data?.data?.issues
    if (Array.isArray(issues)) {
      enrichedIssues.value = enrichIssues(issues, content.value)
      const count = enrichedIssues.value.length
      toast.warning({
        description: `Cannot save: ${count} field${count === 1 ? "" : "s"} need${
          count === 1 ? "s" : ""
        } attention`
      })
      focusNextIssue(1)
    } else {
      toast.error({
        description: saveError?.data?.statusMessage || "Failed to save story"
      })
    }
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

// chain of block ids leading to the currently focused validation issue
const expandPath = ref<string[]>([])

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
  content.value = JSON.parse(JSON.stringify(contentOriginal.value))
  hasChanges.value = false
}

const isPreviewReady = ref(false)

const isTranslationModalOpen = ref(false)
const isTranslating = ref(false)

function toggleTranslationModal() {
  isTranslationModalOpen.value = !isTranslationModalOpen.value
}

async function autoTranslate() {
  isTranslating.value = true

  try {
    const response = await $fetch(`/api/ai/translate`, {
      method: "POST",
      body: {
        storyId: storyId.value,
        fromLanguage: site.value?.defaultLanguage,
        toLanguage: selectedLanguage.value
      }
    })

    content.value = response
  } catch (error: any) {
    console.error("Error translating story:", error)
    if (error?.statusCode === 402 || error?.response?.status === 402) {
      toast.error({ description: "Insufficient AI credits" })
    } else {
      toast.error({ description: "Error translating story" })
    }
  }

  isTranslating.value = false
  isTranslationModalOpen.value = false
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
      <DButton
        v-if="site?.defaultLanguage !== selectedLanguage"
        :icon-left="LanguagesIcon"
        @click="toggleTranslationModal"
        variant="secondary"
      />
      <button
        v-if="enrichedIssues.length > 0"
        type="button"
        class="bg-danger-subtle text-danger-strong flex h-9 items-center gap-1.5 rounded-lg px-3 transition hover:brightness-95"
        title="Go to the next validation issue"
        @click="focusNextIssue(1)"
      >
        <FileWarningIcon class="size-4" />
        <span class="text-copy-sm font-medium tabular-nums">{{ enrichedIssues.length }}</span>
      </button>
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
        <div
          v-if="languageIssues.length > 0"
          class="bg-danger-subtle border-danger mb-2 flex flex-col gap-2 rounded-lg border p-3"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="text-danger-strong flex items-center gap-2">
              <FileWarningIcon class="size-4 shrink-0" />
              <p class="text-copy-sm font-medium">
                {{ languageIssues.length }} field{{ languageIssues.length === 1 ? "" : "s" }} need{{
                  languageIssues.length === 1 ? "s" : ""
                }}
                attention
              </p>
            </div>
            <div class="flex items-center gap-1">
              <DButton
                variant="secondary"
                size="sm"
                :icon-left="ChevronLeftIcon"
                aria-label="Previous issue"
                @click="focusNextIssue(-1)"
              />
              <span class="text-copy-sm text-neutral-subtle min-w-10 text-center tabular-nums">
                {{ activeIssueIndex >= 0 ? activeIssueIndex + 1 : 0 }} /
                {{ enrichedIssues.length }}
              </span>
              <DButton
                variant="secondary"
                size="sm"
                :icon-left="ChevronRightIcon"
                aria-label="Next issue"
                @click="focusNextIssue(1)"
              />
            </div>
          </div>
          <ul class="text-copy-sm flex flex-col gap-0.5">
            <li
              v-for="issue in languageIssues"
              :key="issueIdentity(issue)"
            >
              <button
                type="button"
                class="hover:bg-neutral-strong flex w-full items-baseline gap-2 rounded-md px-1.5 py-1 text-left transition"
                :class="[activeIssueIdentity === issueIdentity(issue) ? 'bg-neutral-strong' : '']"
                @click="focusIssue(issue)"
              >
                <span class="text-neutral-subtle shrink-0">{{ issue.label }}:</span>
                <span>{{ issue.message }}</span>
              </button>
            </li>
          </ul>
          <button
            v-if="enrichedIssues.length > languageIssues.length"
            type="button"
            class="text-danger-strong text-copy-sm self-start underline underline-offset-2"
            @click="focusNextLanguageIssue"
          >
            {{ enrichedIssues.length - languageIssues.length }} more
            {{ enrichedIssues.length - languageIssues.length === 1 ? "issue" : "issues" }} in other
            languages
          </button>
        </div>
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
            :errors="errorMap"
            :expand-path="expandPath"
            :active-error-key="activeErrorKey"
            @update:value="updateNestedField([selectedLanguage, field.fieldKey], $event)"
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

  <DModal
    :open="isTranslationModalOpen"
    :loading="isTranslating"
    title="Auto Translate"
    description="Use AI to translate this story:"
    confirm-text="Translate"
    @close="isTranslationModalOpen = false"
    @confirm="autoTranslate"
  >
    <div class="flex items-center justify-center gap-4">
      <DSelect
        :model-value="site?.defaultLanguage"
        :disabled="true"
        :options="languageOptions"
      />
      <ArrowRightIcon class="size-4 text-neutral-50" />
      <DSelect
        :model-value="selectedLanguage"
        :disabled="true"
        :options="languageOptions"
      />
    </div>
  </DModal>
</template>

<style scoped>
.code-container {
  background: var(--background-color-neutral-weak) url("/stripes.svg");
  background-blend-mode: overlay;
}
</style>
