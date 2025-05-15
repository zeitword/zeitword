<script setup lang="ts">
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxPortal,
  ComboboxContent,
  ComboboxViewport,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxCancel,
  ComboboxEmpty
} from "reka-ui"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  XIcon,
  LinkIcon,
  ExternalLinkIcon
} from "lucide-vue-next"
import { nextTick } from "vue"

interface InternalLink {
  storyId: string
  type: "internal"
}

interface ExternalLink {
  url: string
  type: "external"
}

type LinkValue = InternalLink | ExternalLink

interface Story {
  id: string
  slug: string
  title: string
  [key: string]: any
}

interface Props {
  value: LinkValue
  siteId: string
  placeholder?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: "Enter a link or search for a page",
  disabled: false
})

const model = defineModel<LinkValue>({ default: () => ({ url: "", type: "external" }) })
const rawInputValue = ref("")
const open = ref(false)

const inputValue = computed({
  get: () => {
    // For internal links with story details, show the title
    if (isInternal.value && storyDetails.value) {
      return storyDetails.value.title
    }
    // For external links, ensure we show the URL from the model
    else if (model.value?.type === "external") {
      return (model.value as ExternalLink).url
    }
    // Show raw input (typed text) when editing
    return rawInputValue.value
  },
  set: (value: string) => {
    rawInputValue.value = value
  }
})

const isInternal = computed(() => model.value?.type === "internal")

const storyId = computed(() => (isInternal.value ? (model.value as InternalLink).storyId : null))

const { data: storyDetails } = useFetch<Story>(() =>
  storyId.value ? `/api/sites/${props.siteId}/stories/${storyId.value}` : null
)

const { data: searchResults } = useFetch(`/api/sites/${props.siteId}/stories`, {
  params: { query: inputValue }
})

onMounted(() => {
  if (model.value?.type === "external") {
    rawInputValue.value = (model.value as ExternalLink).url
  }
  // No need to set for internal links as the computed getter will handle it
})

// Reka UI handles keyboard navigation automatically

function handleInput() {
  // If we had an internal link, convert back to external
  if (isInternal.value) {
    model.value = { url: rawInputValue.value, type: "external" }
    open.value = true
  } else if (rawInputValue.value) {
    // Update external link - ensure URL is saved
    model.value = { url: rawInputValue.value, type: "external" }
  } else {
    // Empty input, set empty external link
    model.value = { url: "", type: "external" }
    // Show all stories when input is empty
    open.value = true
  }
}

// Handle blur to restore input based on model state
function handleBlur() {
  // Wait a moment to let any click handlers complete first
  if (model.value?.type === "external") {
    rawInputValue.value = (model.value as ExternalLink).url
  }
}

function handleClear(e: Event) {
  e.stopPropagation()
  rawInputValue.value = ""
  model.value = { url: "", type: "external" }
  open.value = true
}
function selectStory(story: Story) {
  if (!story) return

  model.value = { storyId: story.id, type: "internal" }
  // No need to set inputValue, computed getter will handle it
  nextTick(() => {
    open.value = false
  })
}
</script>

<template>
  <ComboboxRoot
    v-model:open="open"
    :disabled="props.disabled"
  >
    <ComboboxAnchor
      class="bg-neutral border-neutral flex h-9 w-full cursor-default items-center justify-between rounded-lg border px-2 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-300"
      :class="[
        props.disabled
          ? 'bg-neutral-subtle cursor-not-allowed opacity-50'
          : 'hover:border-neutral-strong/30'
      ]"
    >
      <div class="flex min-h-6 flex-1 flex-wrap items-center gap-1 overflow-hidden">
        <ComboboxInput
          v-model="inputValue"
          :placeholder="placeholder"
          class="flex-1 border-0 bg-transparent px-0 py-1.5 text-sm outline-none placeholder:text-neutral-500"
          @input="handleInput"
          @focus="!isInternal && (open = true)"
          @blur="handleBlur"
          autocomplete="off"
        />
      </div>

      <div class="flex items-center gap-1">
        <DButton
          variant="transparent"
          size="sm"
          v-if="model"
          @click="handleClear($event)"
          :icon-left="XIcon"
        />

        <div class="text-neutral-subtle grid size-6 place-items-center">
          <ExternalLinkIcon
            v-if="!isInternal"
            class="size-4"
          />
          <LinkIcon
            v-else
            class="size-4"
          />
        </div>
      </div>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        side="bottom"
        align="start"
        class="border-neutral bg-neutral z-[9999] w-[var(--reka-combobox-trigger-width)] rounded-lg border shadow-sm"
        :side-offset="5"
      >
        <ComboboxViewport
          class="max-h-48 overflow-auto p-1"
          v-if="searchResults && searchResults.length > 0"
        >
          <!-- <ComboboxEmpty class="px-2 py-1.5 text-sm text-neutral-500">
            No results found
          </ComboboxEmpty> -->

          <ComboboxItem
            v-for="story in searchResults"
            :key="story.id"
            :value="story.id"
            @click="selectStory(story)"
            class="hover:bg-neutral-hover text-neutral data-[highlighted]:bg-neutral-hover flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm select-none data-[highlighted]:outline-none"
          >
            <span>{{ story.title }}</span>
            <CheckIcon
              v-if="isInternal && storyId === story.id"
              class="size-4"
            />
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
