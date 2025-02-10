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
    <form action="" @submit.prevent="createSite" class="flex max-w-sm flex-col gap-2">
      <DInput type="text" v-model="name" placeholder="Name of the site" />
      <DButton type="submit">Create Site</DButton>
    </form>
    <div class="p-4">
      <ul class="ml-4 list-disc">
        <li v-for="site in data" :key="site.id">{{ site.name }} - {{ site.id }}</li>
      </ul>
    </div>
  </div>
</template>
