<script setup lang="ts">
const route = useRoute()
const siteId = computed(() => route.params.siteId)

const navigation = computed(() => {
  return [
    { name: "Components", to: `/sites/${siteId.value}/components` },
    { name: "Content", to: `/sites/${siteId.value}/content` },
    { name: "Settings", to: `/sites/${siteId.value}/settings` }
  ]
})
</script>

<template>
  <DPageHeader :navigation="navigation" />
  <div class="flex h-full max-h-screen flex-col sm:flex-row">
    <main class="flex-1 overflow-scroll flex flex-col">
      <slot></slot>
    </main>
  </div>
</template>
