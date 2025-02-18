<script setup lang="ts">
type Props = {
  title?: string
}
const { title } = defineProps<Props>()
</script>
<template>
  <div>
    <p
      v-if="title"
      class="text-copy test-neutral mb-2 font-medium"
    >
      {{ title }}
    </p>
    <div class="border-neutral bg-neutral flex flex-col rounded-lg border">
      <slot></slot>
    </div>
  </div>
</template>
