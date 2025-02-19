<script setup lang="ts">
const siteId = useRouteParams("siteId")
const storyId = useRouteParams("storyId")

const navigation = ref([
  { name: "Content", to: `/sites/${siteId.value}/content/${storyId.value}` },
  {
    name: "Settings",
    to: `/sites/${siteId.value}/content/${storyId.value}/settings`
  }
])
</script>

<template>
  <div class="flex h-full max-h-screen flex-col">
    <DPageHeader :navigation="navigation" />
    <main class="flex flex-1 flex-col overflow-scroll">
      <slot></slot>
    </main>
  </div>
</template>
