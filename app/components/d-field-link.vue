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
  ComboboxCancel
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

type LinkValue = InternalLink | ExternalLink | null

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

const model = defineModel<LinkValue>()
const inputValue = ref("")
const open = ref(false)

const isInternal = computed(() => model.value?.type === "internal")

const storyId = computed(() => 
  isInternal.value ? (model.value as InternalLink).storyId : null
)

const { data: storyDetails } = useFetch<Story>(
  () => storyId.value ? `/api/sites/${props.siteId}/stories/${storyId.value}` : null
)

const { data: searchResults } = useFetch(
  `/api/sites/${props.siteId}/stories`,
  { params: { query: inputValue } }
)

onMounted(() => {
  if (model.value?.type === "external") {
    inputValue.value = (model.value as ExternalLink).url
  } else if (model.value?.type === "internal" && storyDetails.value) {
    inputValue.value = storyDetails.value.title
  }
})

function handleInput() {
  // If we had an internal link, convert back to external
  if (isInternal.value) {
    model.value = { url: inputValue.value, type: "external" }
    open.value = true
  } else if (inputValue.value) {
    // Update external link
    model.value = { url: inputValue.value, type: "external" }
  } else {
    // Empty input, clear link
    model.value = null
    // Show all stories when input is empty
    open.value = true
  }
}

function handleClear(e: Event) {
  e.stopPropagation()
  inputValue.value = ""
  model.value = null
  open.value = true
}

function selectStory(story: Story) {
  // Need to use nextTick to ensure click completes before closing dropdown
  nextTick(() => {
    model.value = { storyId: story.id, type: "internal" }
    inputValue.value = story.title
    open.value = false
  })
}
</script>

<template>
  <ComboboxRoot
    v-model:open="open"
    :disabled="props.disabled"
    @keydown.escape="open = false"
  >
    <ComboboxAnchor
      class="bg-neutral border-neutral flex min-h-[2.25rem] w-full cursor-default items-center justify-between rounded-lg border px-2 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-300"
      :class="[
        props.disabled
          ? 'bg-neutral-subtle cursor-not-allowed opacity-50'
          : 'hover:border-neutral-strong/30'
      ]"
    >
      <div class="flex min-h-6 flex-1 flex-wrap items-center gap-1 overflow-hidden">
        <input
          v-model="inputValue"
          :placeholder="placeholder"
          class="flex-1 border-0 bg-transparent px-0 py-1.5 text-sm outline-none placeholder:text-neutral-500"
          @input="handleInput"
          @focus="!isInternal && (open = true)"
        />
      </div>
      
      <div class="flex items-center gap-1">
        <button
          v-if="model"
          @click="handleClear($event)"
          class="hover:bg-neutral-hover grid size-6 place-items-center rounded"
          :disabled="props.disabled"
        >
          <XIcon class="size-4" />
        </button>
        
        <div class="ml-1 flex items-center text-neutral-500">
          <ExternalLinkIcon v-if="!isInternal" class="size-4" />
          <LinkIcon v-else class="size-4" />
        </div>
        
        <ComboboxTrigger>
          <DButton
            :icon-left="open ? ChevronUpIcon : ChevronDownIcon"
            variant="secondary"
            size="sm"
          ></DButton>
        </ComboboxTrigger>
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
        <ComboboxViewport class="max-h-48 overflow-auto p-1">
          <div v-if="!searchResults?.length" class="px-2 py-1.5 text-sm text-neutral-500">
            No results found
          </div>
          <ComboboxItem
            v-for="story in searchResults"
            :key="story.id"
            :value="story"
            @click="selectStory(story)"
            class="hover:bg-neutral-hover focus:bg-neutral-hover text-neutral flex cursor-default items-center justify-between rounded-md px-2.5 py-1.5 text-sm select-none focus:outline-0"
          >
            <span>{{ story.title }}</span>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>