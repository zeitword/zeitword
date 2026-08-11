<script setup lang="ts">
type Props = {
  error?: string
}

defineProps<Props>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <slot></slot>
    <p
      v-if="error"
      class="text-copy-sm text-danger flex items-start gap-1.5"
    >
      {{ error }}
    </p>
  </div>
</template>
