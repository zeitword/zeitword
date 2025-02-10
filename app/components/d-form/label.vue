<script setup lang="ts">
type Props = {
  name: string
  required?: boolean
}

const { name, required = false } = defineProps<Props>()
</script>
<template>
  <label :for="name" class="flex justify-between gap-1 text-sm font-medium whitespace-nowrap text-gray-700">
    <slot></slot>
    <span v-if="required" class="text-xs text-orange-500">*</span>
  </label>
</template>
