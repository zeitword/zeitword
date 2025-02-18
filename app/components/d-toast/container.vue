<script setup lang="ts">
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
  0: "",
  1: "-translate-y-5 scale-90",
  2: "-translate-y-10 scale-80"
}

function getToastStyle(index: number) {
  const total = toasts.value.length
  const position = total - index - 1
  if (position > 2) return "opacity-0 -translate-y-12 scale-65"
  return toastPositions[position]
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
      class="fixed right-0 bottom-0 z-[2147483647] m-0 flex w-[390px] list-none flex-col gap-[10px] p-5 outline-none"
    >
      <ToastRoot
        v-for="(toast, index) in toasts"
        :key="toast.id"
        :duration="toast.duration"
        class="data-[state=closed]:animate-toast-hide data-[state=open]:animate-toast-slide-in fixed right-5 bottom-5 w-[300px] rounded-lg p-4 shadow-md transition-all"
        :class="[toastClasses[toast.type], getToastStyle(index)]"
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
