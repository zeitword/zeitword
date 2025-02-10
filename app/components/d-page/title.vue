<script setup lang="ts">
type Props = {
  title: string
}

const { title } = defineProps<Props>()
</script>
<template>
  <div class="border-neutral border-b py-6">
    <DPageWrapper>
      <div class="flex items-center justify-between">
        <div class="text-neutral-strong text-title">
          {{ title }}
        </div>
        <slot />
      </div>
    </DPageWrapper>
  </div>
</template>
