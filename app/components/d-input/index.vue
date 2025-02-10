<script setup lang="ts">
interface Props {
  type?: string
  placeholder?: string | undefined
}

const { type = "text", placeholder = undefined } = defineProps<Props>()

const model = defineModel()
</script>

<template>
  <input
    v-model="model"
    :type
    :placeholder
    class="rounded-md bg-neutral-100 px-2 py-2 text-sm leading-0 ring-blue-600 outline-none placeholder:text-neutral-400 focus:border-transparent focus:ring-2"
  />
</template>
