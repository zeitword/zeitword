<script setup lang="ts">
type Props = {
  name: string
  to: string
}
const props = defineProps<Props>()
</script>
<template>
  <NuxtLink :to="to" class="text-neutral-subtle hover:text-neutral hover:bg-neutral-subtle text-copy rounded-lg px-2 py-1">
    {{ name }}
  </NuxtLink>
</template>
