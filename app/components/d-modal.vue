<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from "reka-ui"

import { X } from "lucide-vue-next"

type Props = {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
}
const { open, title, description, size = "md" } = defineProps<Props>()

const sizeClasses: { [key: string]: string } = {
  xs: "max-w-xs",
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl"
}

const emit = defineEmits<{
  close: []
  confirm: []
}>()

function close() {
  emit("close")
}

function confirm() {
  emit("confirm")
}
</script>

<template>
  <DialogRoot
    :open="open"
    @update:open="close"
  >
    <DialogPortal>
      <DialogOverlay
        class="data-[state=open]:animate-overlayShow bg-neutral-inverse/5 pointer-events-none fixed inset-0 z-50 backdrop-blur-xs"
      />
      <DialogContent
        class="data-[state=open]:animate-contentShow fixed top-1/2 left-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white shadow-lg outline-none"
        :class="sizeClasses[size]"
      >
        <div>
          <div class="border-neutral flex items-center justify-between border-b p-5">
            <DialogTitle class="text-lg font-semibold text-neutral-900">
              {{ title }}
            </DialogTitle>
            <DialogClose asChild>
              <EditorButton
                variant="transparent"
                size="sm"
                :icon-left="X"
              />
            </DialogClose>
          </div>

          <DialogDescription
            v-if="description"
            class="mb-4 text-neutral-600"
          >
            {{ description }}
          </DialogDescription>

          <div>
            <slot />
          </div>
          <div>
            <div class="flex justify-end space-x-2 rounded-b border-t border-neutral-200 p-4">
              <DButton
                id="cancel"
                variant="secondary"
                @click="close"
              >
                Cancel
              </DButton>
              <DButton
								v-if="confirmText"
                variant="primary"
                @click="confirm"
              >
                {{ confirmText }}
              </DButton>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
