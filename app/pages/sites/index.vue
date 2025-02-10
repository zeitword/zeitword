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
    <div>Sites</div>
    <form @submit.prevent="createSite" class="mb-4 flex max-w-sm flex-col gap-2">
      <DInput type="text" v-model="name" placeholder="Name of the site" />
      <DButton type="submit">Create Site</DButton>
    </form>
    <div class="">
      <div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, 150px)">
        <NuxtLink :to="`/sites/${site.id}`" v-for="site in data" :key="site.id" class="aspect-[3/4] w-full rounded bg-black p-4 text-white">
          {{ site.name }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
