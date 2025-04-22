<script setup lang="ts">
const isMacOS = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC")

type Props = {
  combo: string
}
const { combo } = defineProps<Props>()

const modifierMap = {
  meta: isMacOS ? "⌘" : "Ctrl",
  ctrl: isMacOS ? "⌃" : "Ctrl",
  alt: isMacOS ? "⌥" : "Alt",
  shift: "⇧",
  space: "Space",
  enter: "↵",
  backspace: "⌫",
  delete: "⌦",
  escape: "Esc",
  tab: "⇥"
} as const

const shortcut = computed(() => {
  const parts = combo.split("_")
  const key = parts.pop() || ""
  const modifiers = parts

  return {
    modifiers: modifiers.map(
      (mod) =>
        modifierMap[mod as keyof typeof modifierMap] || mod.charAt(0).toUpperCase() + mod.slice(1)
    ),
    key: modifierMap[key as keyof typeof modifierMap] || key.toUpperCase()
  }
})
</script>

<template>
  <span class="text-neutral-subtle text-copy-sm">
    <template
      v-for="(mod, i) in shortcut.modifiers"
      :key="i"
    >
      {{ mod }}{{ i < shortcut.modifiers.length ? " " : "" }}
    </template>
    {{ shortcut.modifiers.length ? " " : "" }}{{ shortcut.key }}
  </span>
</template>
