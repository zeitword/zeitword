<script setup lang="ts">
const route = useRoute()
const id = route.params.id

const { data: site, refresh } = await useFetch(`/api/sites/${id}`)
</script>

<template>
  <div class="p-4">
    <pre class="text-sm">{{ site }}</pre>
  </div>
</template>
