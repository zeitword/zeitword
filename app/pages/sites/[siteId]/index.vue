<script setup lang="ts">
const siteId = useRouteParams("siteId")

const { data: site } = await useFetch(`/api/sites/${siteId.value}`)
</script>

<template>
  <div class="p-4">
    <div class="text-title-md">Site: {{ site?.name }}</div>
    <div class="flex">
      <NuxtLink
        class="bg-neutral-subtle hover:bg-neutral-strong rounded-lg p-2"
        :to="`/sites/${site?.id}/components`"
      >
        Components
      </NuxtLink>
    </div>
  </div>
</template>
