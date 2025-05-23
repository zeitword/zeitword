<script setup lang="ts">
import { LoaderCircleIcon } from "lucide-vue-next"
import { RouterLink } from "vue-router"

const slots = useSlots()

interface Props {
  variant?: "primary" | "secondary" | "danger" | "danger-light" | "transparent" | "outline"
  iconLeft?: Component
  to?: any
  size?: "xs" | "sm" | "md" | "lg"
  type?: "submit" | "button"
  loading?: boolean
  disabled?: boolean
  noCursor?: boolean
  kbd?: string
}

const {
  variant = "primary",
  size = "lg",
  type = "button",
  loading = false,
  kbd
} = defineProps<Props>()

const variantClasses: { [key: string]: string } = {
  primary:
    "bg-neutral-inverse text-neutral-inverse hover:bg-neutral-inverse-hover hover:shadow-button hover:inset-shadow-sm hover:inset-shadow-white/20 active:inset-shadow active:inset-shadow-black/30",
  secondary:
    "text-neutra border border-neutral hover:bg-neutral-weak hover:shadow-button active:inset-shadow bg-neutral",
  danger:
    "bg-danger text-danger-onsurface hover:bg-danger-hover hover:shadow-button hover:inset-shadow-sm active:inset-shadow active:inset-shadow-black/30",
  success:
    "bg-success text-success-onsurface hover:bg-success-hover active:inset-shadow-sm active:inset-shadow-black/10 active:bg-success-strong",
  warning:
    "bg-warn text-warn-onsurface hover:bg-warn-hover active:inset-shadow-sm active:inset-shadow-black/10 active:bg-warn-strong",
  transparent: "text-neutral hover:bg-neutral-strong/10 active:inset-shadow"
}

const paddingClasses: { [key: string]: string } = {
  xs: "px-2",
  sm: "px-3",
  md: "px-3",
  lg: "px-4"
}

const heightClasses: { [key: string]: string } = {
  xs: "h-6",
  sm: "h-7",
  md: "h-8",
  lg: "h-9"
}

const widthClasses: { [key: string]: string } = {
  xs: "w-5",
  sm: "w-7",
  md: "w-8",
  lg: "w-9"
}

const sizeClass = computed(() => {
  if (slots.default) {
    return [paddingClasses[size], heightClasses[size]]
  } else {
    return [heightClasses[size], widthClasses[size]]
  }
})
</script>

<template>
  <component
    :is="to ? RouterLink : 'button'"
    :type
    :to
    class="relative inline-flex items-center justify-center gap-2 rounded-lg text-sm text-nowrap ring-blue-600 outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2"
    :class="[
      sizeClass,
      variantClasses[variant],
      disabled ? 'pointer-events-none opacity-50' : '',
      noCursor ? '' : 'cursor-pointer'
    ]"
    :disabled
  >
    <component
      v-if="iconLeft"
      :is="iconLeft"
      class="size-4"
    />
    <slot name="leading" />
    <div
      v-if="$slots.default"
      class="inline"
      :class="{ 'opacity-0': loading }"
    >
      <slot />
    </div>
    <DKbd
      v-if="kbd"
      :combo="kbd"
    />
    <slot name="trailing" />
    <div
      v-if="loading"
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform"
    >
      <LoaderCircleIcon class="size-5 animate-spin" />
    </div>
  </component>
</template>
