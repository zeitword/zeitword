<script setup lang="ts">
const route = useRoute()

const navigation = computed(() => {
  const siteId = route.params.siteId as string
  const storyId = route.params.storyId as string

  return [
    { name: "Story", to: `/sites/${siteId}/stories/story/${storyId}/content` },
    { name: "Settings", to: `/sites/${siteId}/stories/story/${storyId}/settings` }
  ]
})
</script>

<template>
  <div class="flex h-screen flex-col">
    <DPageHeader :navigation="navigation" />
    <main class="flex w-full flex-1 overflow-y-auto">
      <div class="flex flex-1 flex-col">
        <slot />
      </div>
    </main>
  </div>
</template>
