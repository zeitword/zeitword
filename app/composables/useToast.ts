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
  removing?: boolean
}

const toasts = ref<Toast[]>([])

export function useToast() {
  const ANIMATION_DURATION = 300

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
      duration: 5000,
      ...options,
      removing: false
    }

    toasts.value.push(newToast)

    // Automatically remove toast after duration
    if (newToast.duration !== Infinity) {
      setTimeout(() => {
        // Start removal process
        const toast = toasts.value.find((t) => t.id === id)
        if (toast) {
          toast.removing = true
        }

        // Actually remove after animation completes
        setTimeout(() => {
          removeToast(id)
        }, ANIMATION_DURATION)
      }, newToast.duration)
    }
  }

  function removeToast(id: string) {
    const toast = toasts.value.find((t) => t.id === id)
    if (toast && !toast.removing) {
      // If not already removing, start removal animation
      toast.removing = true
      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id)
      }, ANIMATION_DURATION)
    } else {
      // If already removing or toast not found, remove immediately
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }
  }

  return {
    toast,
    toasts,
    removeToast
  }
}
