<script setup lang="ts">
type Props = {
  title: string
  subtitle?: string
}

const { title, subtitle } = defineProps<Props>()
</script>

<template>
  <div class="border-neutral flex items-center border-b p-4 last:border-0">
    <div class="w-[300px]">
      <p class="text-title-sm text-neutral font-medium">{{ title }}</p>
      <p
        class="text-copy-sm text-neutral-subtle"
        v-if="subtitle"
      >
        {{ subtitle }}
      </p>
    </div>
    <div class="flex flex-1 justify-end">
      <slot />
    </div>
  </div>
</template>
