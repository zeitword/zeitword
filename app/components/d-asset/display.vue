<script setup lang="ts">
import { ref, computed } from "vue"
import {
  ReplaceIcon,
  Trash2Icon,
  FileIcon,
  FilmIcon,
  MusicIcon,
  UploadCloudIcon
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

const getFileIcon = computed(() => {
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
    class="relative flex h-full flex-col"
    ref="dropZoneRef"
  >
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
            :is="getFileIcon"
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
      class="mt-2"
      label="Alt Text"
      @update:modelValue="emit('updateAlt', altText)"
      leading="alt"
    />
    <div
      class="absolute top-0 right-0 flex gap-1 p-2"
      :class="borderless ? '' : 'p-2'"
    >
      <DButton
        variant="secondary"
        size="sm"
        @click="$emit('changeAsset', asset)"
        :icon-left="ReplaceIcon"
      >
        Replace
      </DButton>
      <DButton
        variant="secondary"
        size="sm"
        @click="$emit('clearAsset')"
        :icon-left="Trash2Icon"
      />
    </div>
  </div>
</template>
