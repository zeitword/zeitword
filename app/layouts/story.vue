<script setup lang="ts">
const route = useRoute()

const navigation = computed(() => {
  const siteId = route.params.siteId as string
  const storyId = route.params.storyId as string

  return [
    { name: "Children", to: `/sites/${siteId}/content/${storyId}` },
    { name: "Content", to: `/sites/${siteId}/content/${storyId}/content` },
    { name: "Settings", to: `/sites/${siteId}/content/${storyId}/settings` }
  ]
})
</script>

<template>
  <div class="flex h-screen flex-col">
    <DPageHeader :navigation="navigation" />
    <main class="flex flex-1 overflow-auto">
      <slot />
    </main>
  </div>
</template>
