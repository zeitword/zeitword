// useToast.ts
import { uuidv7 } from "uuidv7"
import { ref } from "vue"

interface ToastOptions {
  title?: string
  description: string
  type?: "success" | "error" | "warning" | "info"
  duration?: number
}

interface Toast extends ToastOptions {
  id: string
}

const toasts = ref<Toast[]>([])

export function useToast() {
  const toast = {
    success(options: Omit<ToastOptions, "type">) {
      addToast({ ...options, type: "success" })
    },
    error(options: Omit<ToastOptions, "type">) {
      addToast({ ...options, type: "error" })
    },
    warning(options: Omit<ToastOptions, "type">) {
      addToast({ ...options, type: "warning" })
    },
    info(options: Omit<ToastOptions, "type">) {
      addToast({ ...options, type: "info" })
    }
  }

  function addToast(options: ToastOptions) {
    const id = uuidv7()
    const newToast: Toast = {
      id,
      duration: 5000, // default duration
      ...options
    }

    toasts.value.push(newToast)
  }

  function removeToast(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    toast,
    toasts,
    removeToast
  }
}
