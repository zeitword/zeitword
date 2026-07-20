<script setup lang="ts">
const { shadow = true } = defineProps<{ shadow?: boolean }>()
</script>

<template>
  <div
    class="border-neutral overflow-hidden rounded-md border"
    :class="{ shadow }"
  >
    <slot></slot>
  </div>
</template>
