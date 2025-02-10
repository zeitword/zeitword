<script setup lang="ts">
const model = defineModel()
</script>

<template>
  <input
    v-model="model"
    type="text"
    placeholder="Suche..."
    class="rounded-md border-none bg-neutral-100 px-2 py-1.5 text-sm ring-blue-600 ring-offset-2 outline-none focus:ring-2"
  />
</template>
