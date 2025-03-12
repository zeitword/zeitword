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
      <div class="flex h-30 items-center justify-between">
        <div>
          <div class="text-neutral-strong text-title">
            <span>
              {{ title }}
            </span>
          </div>
          <slot name="subtitle" />
        </div>
        <slot />
      </div>
    </DPageWrapper>
  </div>
</template>
