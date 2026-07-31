<script setup lang="ts">
import { ChevronDownIcon, Trash2Icon } from "lucide-vue-next"

import type { DComponent } from "~/types/models"

const siteId = useRouteParams("siteId")

type Props = {
  block: DComponent | undefined
  blockContent: { id: string; content: { [key: string]: any }; order: string }
  path?: string[]
  isTargeted: boolean
  currentLanguage: string
  defaultLanguage: string
  defaultLanguageValue?: { id: string; content: { [key: string]: any }; order: string }
  // validation errors keyed "language:blockId1:blockId2:...:fieldKey"
  errors?: Record<string, string>
  // ids of the blocks this block is nested in
  blockIds?: string[]
  // chain of block ids that should expand to reveal the targeted field
  expandPath?: string[]
  // number of issues inside this block (badge on the header)
  errorCount?: number
  activeErrorKey?: string
}

const {
  block,
  path = [],
  blockContent,
  isTargeted = false,
  currentLanguage,
  defaultLanguage,
  defaultLanguageValue,
  errors = {},
  blockIds = [],
  expandPath = [],
  errorCount = 0,
  activeErrorKey
} = defineProps<Props>()

const isBlockOpen = ref(false)
const emit = defineEmits<{
  (e: "update:value", value: any): void
  (e: "delete-block", path: string): void
}>()

const hasErrors = computed(() => errorCount > 0)

// the chain of block ids this block sits inside, including itself
const ownBlockIds = computed(() => [...blockIds, blockContent.id])

function updateNestedBlockField(fieldKey: string, value: any) {
  if (!blockContent) return
  emit("update:value", {
    ...blockContent,
    content: {
      ...blockContent.content,
      [fieldKey]: value
    }
  })
}

function deleteBlock() {
  emit("delete-block", blockContent.id)
}

const sortedNestedFields = computed(() => {
  if (block && block.fields) {
    return [...block.fields].sort((a, b) => a.order.localeCompare(b.order))
  }
  return []
})

defineSlots<{
  default(props: {}): any
  controls(props: {}): any
}>()

const blockRef = ref<HTMLElement | null>(null)

watch(
  () => isTargeted,
  (newValue) => {
    if (newValue && blockRef.value) {
      isBlockOpen.value = true
      nextTick(() => {
        blockRef.value?.scrollIntoView({ behavior: "smooth", block: "center" })
      })
    }
  }
)

// expand blocks along the chain that leads to the targeted field; the
// last block in the chain scrolls itself into view via isTargeted above
watch(
  () => expandPath,
  (chain) => {
    if (chain.includes(blockContent.id)) {
      isBlockOpen.value = true
    }
  },
  { immediate: true }
)
</script>

<template>
  <div>
    <div
      class="bg-neutral flex w-full flex-col"
      v-if="block"
      ref="blockRef"
      :class="{ 'ring-primary ring-2': isTargeted }"
    >
      <div class="group flex w-full items-center gap-2 px-2 py-2 perspective-normal">
        <slot name="controls" />
        <button
          class="flex flex-1 items-center gap-2 text-left"
          @click="isBlockOpen = !isBlockOpen"
        >
          <div class="grid size-7 place-items-center rounded-md transition">
            <ChevronDownIcon
              class="size-4 transition"
              :class="[isBlockOpen ? 'rotate-180' : '']"
            />
          </div>
          <div
            class="text-copy text-neutral flex flex-1 items-center gap-2 transition-all duration-75 select-none group-active:scale-98"
          >
            <div class="text-nowrap">{{ block.displayName }}</div>
            <div class="text-neutral-subtle line-clamp-1">
              {{ blockContent.content[block.previewField] }}
            </div>
            <span
              v-if="hasErrors"
              class="bg-danger-subtle text-danger-strong grid size-5 shrink-0 place-items-center rounded-full text-xs font-medium"
              :title="`${errorCount} validation issue${errorCount === 1 ? '' : 's'}`"
            >
              {{ errorCount }}
            </span>
          </div>
        </button>
        <div
          class="scale-50 opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100"
        >
          <DButton
            variant="secondary"
            size="sm"
            :icon-left="Trash2Icon"
            @click="deleteBlock"
          ></DButton>
        </div>
      </div>
      <div
        class="grid overflow-hidden transition-[grid-template-rows]"
        :class="isBlockOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
      >
        <div class="min-h-0 min-w-0">
          <div class="bg-neutral border-neutral flex flex-col gap-2 border-t p-2">
            <template
              v-if="block.fields.length > 0"
              v-for="field in sortedNestedFields"
              :key="field.id"
            >
              <DField
                :field="field"
                :path="[...path, 'content', field.fieldKey]"
                :value="blockContent.content ? blockContent.content[field.fieldKey] : undefined"
                :current-language="currentLanguage"
                :default-language="defaultLanguage"
                :default-language-value="
                  defaultLanguageValue?.content
                    ? defaultLanguageValue.content[field.fieldKey]
                    : undefined
                "
                :errors="errors"
                :block-ids="ownBlockIds"
                :expand-path="expandPath"
                :active-error-key="activeErrorKey"
                @update:value="updateNestedBlockField(field.fieldKey, $event)"
                @delete-block="(nestedPath) => $emit('delete-block', nestedPath)"
              />
            </template>
            <DEmpty
              v-else
              title="No fields available"
              description="Add fields to the component"
            >
              <DButton
                variant="secondary"
                size="sm"
                :to="`/sites/${siteId}/components/${block.id}`"
              >
                Edit component
              </DButton>
            </DEmpty>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
