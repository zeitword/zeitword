<script setup lang="ts">
const params = useRoute()
const siteId = params.params.siteId
const { data: components, refresh } = await useFetch(`/api/sites/${siteId}/components`)

const name = ref("")
const displayName = ref("")

async function createComponent() {
  await useRequestFetch()(`/api/sites/${siteId}/components`, {
    method: "POST",
    body: { name: name.value, displayName: displayName.value },
  })
  await refresh()
}
</script>
<template>
  <div class="p-4">
    <h1 class="text-title-md">Components</h1>
    <form @submit.prevent="createComponent" class="mb-4 flex max-w-sm flex-col gap-2">
      <DInput type="text" v-model="name" placeholder="Technical name" />
      <DInput type="text" v-model="displayName" placeholder="Display name" />
      <DButton type="submit">Create Component</DButton>
    </form>
    <div>
      <NuxtLink
        v-for="component in components"
        :key="component.id"
        class="hover:bg-neutral-hover group flex rounded-lg p-2"
        :to="`/sites/${siteId}/components/${component.id}`"
      >
        <div class="flex items-center text-lg font-bold">
          <div class="w-40">
            {{ component.displayName }}
          </div>
          <span class="text-copy-sm bg-neutral-subtle group-hover:bg-neutral rounded-full px-2 py-1">{{ component.name }}</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
