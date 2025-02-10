<script lang="ts" setup>
interface Props {
  color?: string
}

const { color = "blue" } = defineProps<Props>()

// bg-neutral-100 bg-red-100 bg-orange-100 bg-amber-100 bg-yellow-100 bg-lime-100 bg-green-100 bg-emerald-100 bg-teal-100 bg-cyan-100 bg-sky-100 bg-blue-100 bg-indigo-100 bg-violet-100 bg-purple-100 bg-fuchsia-100 bg-pink-100 bg-rose-100
// text-neutral-800 text-red-800 text-orange-800 text-amber-800 text-yellow-800 text-lime-800 text-green-800 text-emerald-800 text-teal-800 text-cyan-800 text-sky-800 text-blue-800 text-indigo-800 text-violet-800 text-purple-800 text-fuchsia-800 text-pink-800 text-rose-800
</script>

<template>
  <div class="flex items-center justify-between rounded-md px-2 py-0.5 text-sm" :class="`bg-${color}-100 text-${color}-800`">
    <slot></slot>
  </div>
</template>
