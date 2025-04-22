<script setup lang="ts">
type Props = {
  title: string
  subtitle?: string
  stacked?: boolean
  centered?: boolean
}

const { title, subtitle, stacked } = defineProps<Props>()
</script>

<template>
  <div
    class="border-neutral flex border-b p-4 last:border-0"
    :class="stacked ? 'flex-col' : 'flex-row'"
  >
    <div :class="stacked ? '' : 'w-[300px]'">
      <p class="text-title-sm text-neutral font-medium">{{ title }}</p>
      <p
        class="text-copy-sm text-neutral-subtle"
        v-if="subtitle"
      >
        {{ subtitle }}
      </p>
    </div>
    <div class="flex flex-1 items-center justify-end">
      <slot />
    </div>
  </div>
</template>
