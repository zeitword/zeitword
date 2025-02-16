<script setup lang="ts">
const route = useRoute()
const siteId = computed(() => route.params.siteId)
const storyId = computed(() => route.params.storyId)

const navigation = computed(() => {
  return [
    { name: "Content", to: `/sites/${siteId.value}/content/${storyId.value}` },
    { name: "Settings", to: `/sites/${siteId.value}/content/${storyId.value}/settings` }
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
