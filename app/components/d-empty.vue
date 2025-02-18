<script setup lang="ts">
type Props = {
  title: string
  description?: string
  icon?: Component
  size?: "sm" | "md" | "lg"
}

const paddings = {
  sm: "py-5",
  md: "py-10",
  lg: "py-15"
}

const { icon, title, description, size = "sm" } = defineProps<Props>()
</script>
<template>
  <div
    class="border-neutral flex flex-col items-center justify-center gap-2 rounded-lg border bg-white px-5"
    :class="paddings[size]"
  >
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
      <div
        v-if="$slots.default"
        class="mt-4 flex flex-col items-center justify-center gap-1"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
