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
  danger?: boolean
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
      <!-- Conditionally render the overlay and content -->
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
      >
        <DialogOverlay
          class="data-[state=open]:animate-overlayShow bg-neutral-inverse/5 fixed inset-0 z-10 backdrop-blur-xs"
        />
        <DialogContent
          class="data-[state=open]:animate-contentShow relative z-20 flex w-full flex-col rounded-lg bg-white shadow-lg outline-none"
          :class="[sizeClasses[size], 'max-h-[80vh]']"
        >
          <!-- Header -->
          <div class="border-neutral flex items-center justify-between border-b p-5">
            <div>
              <DialogTitle class="text-lg font-semibold text-neutral-900">
                {{ title }}
              </DialogTitle>
              <DialogDescription
                v-if="description"
                class="text-neutral"
              >
                {{ description }}
              </DialogDescription>
            </div>
            <DialogClose as-child>
              <DButton
                variant="transparent"
                size="sm"
                :icon-left="X"
              />
            </DialogClose>
          </div>

          <!-- Scrollable Content Area -->
          <div
            v-if="$slots.default"
            class="flex-1 overflow-y-auto p-5"
          >
            <slot />
          </div>

          <!-- Footer -->
          <div class="border-neutral border-t p-4">
            <div class="flex justify-end space-x-2">
              <DButton
                variant="secondary"
                @click="close"
              >
                Cancel
              </DButton>
              <DButton
                v-if="confirmText"
                :variant="danger ? 'danger' : 'primary'"
                @click="confirm"
              >
                {{ confirmText }}
              </DButton>
            </div>
          </div>
        </DialogContent>
      </div>
    </DialogPortal>
  </DialogRoot>
</template>
