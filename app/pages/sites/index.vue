<script setup lang="ts">
import { FileTextIcon } from "lucide-vue-next"
const { data: sites, refresh } = await useFetch("/api/sites")
const { data: me } = await useFetch("/api/me")

const isCreateModalOpen = ref(false)
const name = ref("")

async function createSite() {
  isCreateModalOpen.value = false
  await useRequestFetch()("/api/sites", {
    method: "POST",
    body: { name: name.value }
  })
  await refresh()
}
</script>

<template>
  <DPageTitle title="Sites">
    <DButton @click="isCreateModalOpen = true">Add</DButton>
  </DPageTitle>
  <DPageWrapper>
    <div class="py-5">
      <div
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        v-if="sites && sites?.length > 0"
      >
        <NuxtLink
          :to="`/sites/${site.id}/stories`"
          v-for="site in sites"
          :key="site.id"
          class="hover:border-neutral-strong/20 bg-neutral border-neutral group cursor-pointer items-center overflow-hidden rounded-md border shadow-sm transition-all duration-100 hover:shadow-md"
        >
          <div class="p-5">
            <p class="text-copy-lg text-neutral">
              {{ site.name }}
            </p>
            <p
              v-if="site.domain"
              class="text-neutral-subtle text-xs"
            >
              {{ site.domain }}
            </p>
            <p class="text-neutral-subtle text-xs">
              {{ formatDate(new Date(site.updatedAt)) }}
            </p>
          </div>
        </NuxtLink>
      </div>
      <DEmpty
        :icon="FileTextIcon"
        title="No Sites yet"
        description="Create a new site to get started."
        size="lg"
        v-else
      >
        <DButton
          variant="secondary"
          @click="isCreateModalOpen = true"
        >
          Create Site
        </DButton>
      </DEmpty>
    </div>
  </DPageWrapper>

  <DModal
    :open="isCreateModalOpen"
    title="Add new Site"
    confirm-text="Add Site"
    @close="isCreateModalOpen = false"
    @confirm="createSite"
  >
    <form
      class="flex flex-col"
      @submit.prevent="createSite"
    >
      <DFormGroup>
        <DFormLabel name="name">Site name</DFormLabel>
        <DInput
          v-if="me"
          type="text"
          v-model="name"
          placeholder="Name of the site"
        />
      </DFormGroup>
    </form>
  </DModal>
</template>
