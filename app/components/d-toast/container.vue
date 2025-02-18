<script setup lang="ts">
import { min } from "drizzle-orm"
import { XIcon } from "lucide-vue-next"
import {
  ToastProvider,
  ToastRoot,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastViewport
} from "reka-ui"
import { computed } from "vue"

const { toasts, removeToast } = useToast()

const toastPositions: Record<number, string> = {
  0: "translateY(0)",
  1: "translateY(-20px) scale(0.9)",
  2: "translateY(-38px) scale(0.8)"
}

function getToastStyle(index: number) {
  // Calculate relative position (newest toast at 0)
  const totalToasts = toasts.value.length
  const position = totalToasts - 1 - index

  // Scale calculation - starts at 1, reduces by 0.1 for each position
  const scale = Math.max(1 - position * 0.1, 0.65)
  // TranslateY increases by 20px for each position
  const translateY = position * 20
  const zIndex = 100 - position

  if (position > 2) {
    return {
      transform: `translateY(-${translateY}px) scale(${scale})`,
      opacity: 0,
      visibility: "hidden",
      zIndex,
      "--hover-transform": `translateY(-${position * 100}px) scale(1)`
    }
  }

  return {
    transform: `translateY(-${translateY}px) scale(${scale})`,
    opacity: 1,
    visibility: "visible",
    zIndex,
    "--hover-transform": `translateY(-${position * 100}px) scale(1)`
  }
}

const toastClasses: Record<string, string> = {
  success: "bg-success text-success-onsurface border border-success-strong",
  error: "bg-danger text-danger-onsurface border border-danger-strong",
  warning: "bg-warn text-warn-onsurface border border-warn-strong",
  info: "bg-neutral text-neutral border border-neutral"
}

const buttonVariants: Record<string, string> = {
  success: "success",
  error: "danger",
  warning: "warning",
  info: "transparent"
}
</script>

<template>
  <ToastProvider swipeDirection="right">
    <ToastViewport
      class="group fixed right-0 bottom-0 z-[2147483647] m-0 flex min-h-[200px] w-[390px] origin-bottom-right list-none flex-col gap-[10px] p-5 outline-none before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-[400px] before:content-[''] hover:min-h-[300px] hover:scale-100"
    >
      <ToastRoot
        v-for="(toast, index) in toasts"
        :key="toast.id"
        :duration="toast.duration"
        class="data-[state=closed]:animate-toast-hide data-[state=open]:animate-toast-slide-in fixed right-5 bottom-5 w-[300px] rounded-lg p-4 shadow-md transition-all duration-300"
        :class="toastClasses[toast.type]"
        :style="getToastStyle(index)"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <ToastTitle
              v-if="toast.title"
              class="text-copy-lg font-medium"
            >
              {{ toast.title }}
            </ToastTitle>
            <ToastDescription class="text-copy">
              {{ toast.description }}
            </ToastDescription>
          </div>
          <ToastClose @click="removeToast(toast.id)">
            <DButton
              :icon-left="XIcon"
              :variant="buttonVariants[toast.type]"
            />
          </ToastClose>
        </div>
      </ToastRoot>
    </ToastViewport>
  </ToastProvider>
</template>

<style>
.group:hover .fixed {
  transform: var(--hover-transform) !important;
}
</style>
