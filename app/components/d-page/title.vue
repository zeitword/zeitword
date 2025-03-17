<script setup lang="ts">
type Props = {
  title: string
  wide?: boolean
}

const { title, wide = false } = defineProps<Props>()
</script>
<template>
  <div class="border-neutral border-b">
    <DPageWrapper :wide>
      <div class="flex h-30 items-center justify-between gap-10">
        <div class="">
          <div class="text-neutral-strong text-title line-clamp-1">
            {{ title }}
          </div>
          <slot name="subtitle" />
        </div>
        <slot />
      </div>
    </DPageWrapper>
  </div>
</template>
