<script setup lang="ts">
definePageMeta({ layout: false })
const { data } = await useFetch("/api/organisations")
const { transition } = useOrganisationTransition()
if (data.value?.organisations.some((org) => org.id === data.value?.activeOrganisationId)) {
  await navigateTo("/sites", { replace: true })
}
const showCreate = ref(false)
const busy = ref(false)
const error = ref("")
async function open(id: string) {
  busy.value = true
  error.value = ""
  try {
    await transition(() => $fetch(`/api/organisations/${id}/switch`, { method: "POST" }))
  } catch {
    error.value = "Unable to open organisation"
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="bg-neutral-weak text-neutral min-h-screen px-6 py-16">
    <div class="mx-auto max-w-lg space-y-6">
      <h1 class="text-title-md">
        {{ data?.organisations.length ? "Choose an organisation" : "Welcome to Zeitword" }}
      </h1>
      <p v-if="!data?.organisations.length">
        Create an organisation or accept an invitation to get started.
      </p>
      <div class="space-y-2">
        <DButton
          v-for="org in data?.organisations"
          :key="org.id"
          variant="secondary"
          :disabled="busy"
          @click="open(org.id)"
          class="w-full"
        >
          {{ org.name }}
          <span class="text-neutral-subtle ml-2">{{ org.role }}</span>
        </DButton>
      </div>
      <DButton @click="showCreate = true">New organisation</DButton>
      <DCreateOrganisation
        :open="showCreate"
        @close="showCreate = false"
      />
      <p
        v-if="error"
        role="alert"
        class="text-danger"
      >
        {{ error }}
      </p>
      <NuxtLink
        to="/logout"
        class="text-neutral-subtle hover:underline"
      >
        Sign out
      </NuxtLink>
    </div>
  </main>
</template>
