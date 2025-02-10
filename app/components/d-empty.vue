<script setup lang="ts">
type Props = {
  title: string
  description?: string
  icon?: Component
}

const { icon, title, description } = defineProps<Props>()
</script>
<template>
  <div class="border-neutral flex flex-col items-center justify-center gap-2 rounded-lg border bg-white px-5 py-14">
    <div
      v-if="icon"
      class="border-neutral bg-neutral grid size-12 place-items-center rounded-lg border"
    >
      <component
        :is="icon"
        class="text-neutral-subtle size-6"
      />
    </div>

    <div class="text-neutral flex flex-col items-center justify-center gap-1 text-center">
      <h1 class="text-neutral text-copy-lg">{{ title }}</h1>
      <p
        v-if="description"
        class="text-neutral-subtle text-copy"
      >
        {{ description }}
      </p>
      <div class="mt-4 flex flex-col items-center justify-center gap-1">
        <slot />
      </div>
    </div>
  </div>
</template>
