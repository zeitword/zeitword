<script setup lang="ts">
import { NuxtLink } from "#components"

type Props = {
  to?: string
  padding?: boolean
}

const { to = undefined, padding = true } = defineProps<Props>()

const component = computed(() => {
  return to ? NuxtLink : "div"
})
</script>
<template>
  <component
    :is="component"
    class="hover:bg-neutral-hover group border-neutral flex min-h-14 border-b bg-white last:border-transparent"
    :class="padding ? 'px-4 py-3' : ''"
    :to="to"
  >
    <slot />
  </component>
</template>
