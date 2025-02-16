<script setup lang="ts">
import { NuxtLink } from "#components"

type Props = {
  to?: string
}

const { to = undefined } = defineProps<Props>()

const component = computed(() => {
  return to ? NuxtLink : "div"
})
</script>
<template>
  <component
    :is="component"
    class="hover:bg-neutral-hover group border-neutral flex border-b bg-white px-4 py-3 last:border-transparent"
    :to="to"
  >
    <slot />
  </component>
</template>
