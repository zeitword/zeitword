<script setup lang="ts">
const siteId = useRouteParams("siteId")

const navigation = ref([
  { name: "Content", to: `/sites/${siteId.value}/stories` },
  { name: "Components", to: `/sites/${siteId.value}/components` },
  { name: "Settings", to: `/sites/${siteId.value}/settings` }
])
</script>

<template>
  <div class="flex flex-1 flex-col">
    <DPageHeader :navigation="navigation" />
    <main class="flex flex-1 flex-col overflow-auto">
      <slot></slot>
    </main>
  </div>
</template>
