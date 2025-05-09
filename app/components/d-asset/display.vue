<script setup lang="ts">
import { ref, computed } from "vue"
import {
  ReplaceIcon,
  Trash2Icon,
  FileIcon,
  FilmIcon,
  MusicIcon,
  UploadCloudIcon,
  ChevronDownIcon
} from "lucide-vue-next"
import type { AssetObject } from "~/types"
import { useDropZone } from "@vueuse/core"

type Props = {
  asset: AssetObject
  borderless?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "clearAsset"): void
  (e: "changeAsset", asset: AssetObject): void
  (e: "assetDropped", file: File): void
  (e: "updateAlt", newAlt: string): void
}>()

const dropZoneRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const altText = ref(props.asset.alt)
const isDetailsOpen = ref(false)

watch(
  () => props.asset.alt,
  (newAlt) => {
    altText.value = newAlt
  }
)

useDropZone(dropZoneRef, {
  onDrop: (files) => {
    isDragging.value = false
    if (files && files[0]) {
      emit("assetDropped", files[0])
    }
  },
  onEnter: () => {
    isDragging.value = true
  },
  onLeave: () => {
    isDragging.value = false
  }
})

const fileIcon = computed(() => {
  if (!props.asset) return FileIcon

  if (props.asset.type === "image") {
    return null
  }

  if (props.asset.type === "video") {
    return FilmIcon
  }

  if (props.asset.type === "audio") {
    return MusicIcon
  }

  return FileIcon
})
</script>

<template>
  <div
    class="bg-neutral flex w-full flex-col"
    ref="dropZoneRef"
  >
    <div class="flex w-full items-center gap-2 px-2 py-2">
      <slot name="controls" />
      <button
        class="group flex flex-1 items-center gap-2 text-left"
        @click="isDetailsOpen = !isDetailsOpen"
      >
        <div class="grid size-7 place-items-center rounded-md transition">
          <ChevronDownIcon
            class="size-4 transition"
            :class="[isDetailsOpen ? 'rotate-180' : '']"
          />
        </div>
        <div
          class="bg-neutral-subtle border-neutral grid size-10 place-items-center overflow-hidden rounded-md border p-0.5 transition"
        >
          <img
            v-if="props.asset.type === 'image'"
            :src="props.asset.src"
            :alt="props.asset.alt || 'Image'"
            class="bg-neutral-subtle block rounded-sm"
          />
          <component
            v-else
            class="text-neutral-subtle size-5"
            :is="fileIcon"
          />
        </div>
        <div
          class="text-copy text-neutral flex flex-1 items-baseline gap-2 transition-all duration-75 select-none active:scale-98"
        >
          <div class="text-nowrap">Asset</div>
          <div class="text-neutral-subtle line-clamp-1">
            {{ props.asset.alt || "No alt text" }}
          </div>
        </div>
      </button>
      <div class="flex gap-1">
        <DButton
          variant="secondary"
          size="sm"
          @click="$emit('changeAsset', asset)"
          :icon-left="ReplaceIcon"
        />
        <DButton
          variant="secondary"
          size="sm"
          @click="$emit('clearAsset')"
          :icon-left="Trash2Icon"
        />
      </div>
    </div>

    <div
      class="grid overflow-hidden transition-[grid-template-rows]"
      :class="isDetailsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
    >
      <div class="min-h-0">
        <div class="bg-neutral border-neutral flex flex-col gap-2 border-t p-2">
          <div
            class="group border-neutral relative w-full flex-1 overflow-hidden rounded-lg"
            :class="[borderless ? '' : 'border']"
          >
            <img
              v-if="props.asset.type === 'image'"
              :src="props.asset.src"
              :alt="props.asset.alt || 'Image'"
              class="bg-neutral-subtle block h-full max-h-40 w-full object-contain"
            />
            <div
              v-else
              class="bg-neutral-subtle flex h-full items-center p-5"
            >
              <div class="bg-neutral-strong grid size-8 place-items-center rounded-lg">
                <component
                  :is="fileIcon"
                  class="text-neutral-subtle size-4"
                />
              </div>
              <span class="text-neutral-subtle ml-2 text-sm">{{ props.asset.alt }}</span>
            </div>
            <div
              v-if="isDragging"
              class="bg-neutral/80 pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl"
            >
              <div class="text-center">
                <UploadCloudIcon class="text-neutral-subtle mx-auto mb-2 size-5" />
                <p class="text-copy-sm">Drop to replace</p>
              </div>
            </div>
          </div>
          <DInput
            v-model="altText"
            label="Alt Text"
            @update:modelValue="emit('updateAlt', altText)"
            leading="alt"
          />
        </div>
      </div>
    </div>
  </div>
</template>
