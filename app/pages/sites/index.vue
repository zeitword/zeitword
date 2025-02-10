<script setup lang="ts">
const { data, refresh } = await useFetch("/api/sites")

const isCreateModalOpen = ref(false)
const name = ref("")

async function createSite() {
  isCreateModalOpen.value = false
  await useRequestFetch()("/api/sites", {
    method: "POST",
    body: { name: name.value },
  })
  await refresh()
}
</script>

<template>
  <DPageTitle title="Sites">
    <DButton @click="isCreateModalOpen = true">Add new Site</DButton>
  </DPageTitle>
  <DPageWrapper>
    <div class="py-5">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          :to="`/sites/${site.id}/components`"
          v-for="site in data"
          :key="site.id"
          class="cursor-pointer overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xs transition-all duration-100 hover:shadow-sm"
        >
          <div class="p-5">
            {{ site.name }}
          </div>
        </NuxtLink>
      </div>
    </div>
  </DPageWrapper>

  <DModal
    v-if="isCreateModalOpen"
    title="Add new Site"
    confirm-text="Add Site"
    @close="isCreateModalOpen = false"
    @confirm="createSite"
  >
    <form class="flex flex-col p-5" @submit.prevent="createSite">
      <DInput type="text" v-model="name" placeholder="Name of the site" />
    </form>
  </DModal>
</template>
