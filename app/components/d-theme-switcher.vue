<script setup>
import { computed, onMounted } from "vue"
import { Monitor, Sun, Moon } from "lucide-vue-next"
import { useStorage } from "@vueuse/core"

const mode = useStorage("theme-mode", "system")

const setMode = (newMode) => {
  mode.value = newMode
  updateRootColorScheme()
}

function updateRootColorScheme() {
  const root = document.documentElement
  root.style.setProperty("--current-mode", mode.value)

  if (mode.value === "system") {
    root.style.colorScheme = "light dark"
  } else {
    root.style.colorScheme = mode.value
  }
}

const indicatorClass = computed(() => {
  if (mode.value === "system") {
    return ""
  }
  if (mode.value === "light") {
    return "translate-x-8"
  }
  if (mode.value === "dark") {
    return "translate-x-16"
  }
})

onMounted(() => {
  updateRootColorScheme()
})
</script>
<template>
  <div class="border-neutral relative flex rounded-full border">
    <div
      class="border-neutral pointer-events-none absolute -top-px -left-px box-content size-8 rounded-full border transition-transform"
      :class="indicatorClass"
    ></div>
    <button
      class="grid size-8 cursor-pointer place-items-center"
      :class="mode === 'system' ? 'text-neutral-strong' : 'text-neutral-subtle hover:text-neutral'"
      @click="setMode('system')"
    >
      <Monitor class="size-4" />
    </button>

    <button
      class="grid size-8 cursor-pointer place-items-center"
      :class="mode === 'light' ? 'text-neutral-strong' : 'text-neutral-subtle hover:text-neutral'"
      @click="setMode('light')"
    >
      <Sun class="size-4" />
    </button>

    <button
      class="grid size-8 cursor-pointer place-items-center"
      :class="mode === 'dark' ? 'text-neutral-strong' : 'text-neutral-subtle hover:text-neutral'"
      @click="setMode('dark')"
    >
      <Moon class="size-4" />
    </button>
  </div>
</template>
