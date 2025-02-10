<script setup lang="ts">
const { data, refresh } = await useFetch("/api/sites")

const name = ref("")

async function createSite() {
  await useRequestFetch()("/api/sites", {
    method: "POST",
    body: { name: name.value },
  })
  await refresh()
}
</script>

<template>
  <div class="p-4">
    <h1 class="text-title-md">Sites</h1>
    <form @submit.prevent="createSite" class="mb-4 flex max-w-sm flex-col gap-2">
      <DInput type="text" v-model="name" placeholder="Name of the site" />
      <DButton type="submit">Create Site</DButton>
    </form>
    <div>
      <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, 150px)">
        <NuxtLink :to="`/sites/${site.id}`" v-for="site in data" :key="site.id" class="bg-white">
          {{ site.name }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
