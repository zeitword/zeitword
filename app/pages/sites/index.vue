<script setup lang="ts">
import { FileTextIcon } from "lucide-vue-next"
const { data: sites, refresh } = await useFetch("/api/sites")
const { data: me } = await useFetch("/api/me")
const { data: availableLanguages } = await useFetch("/api/languages")

const isCreateModalOpen = ref(false)
const name = ref("")
const selectedLanguage = ref<{ value: string; display: string }>({
  value: "en",
  display: "English (English)"
})
const query = ref("")

const { toast } = useToast()

const formattedLanguages = computed(() => {
  if (!availableLanguages.value) return []
  return availableLanguages.value.map((lang) => ({
    value: lang.code,
    display: `${lang.name} (${lang.nativeName})`
  }))
})

const filteredLanguages = computed(() => {
  if (!formattedLanguages.value) return []
  return formattedLanguages.value.filter((lang) =>
    lang.display.toLowerCase().includes(query.value.toLowerCase())
  )
})

async function createSite() {
  if (!name.value) {
    toast.error({
      description: "Please enter a name for the site."
    })
    return
  }
  if (!selectedLanguage.value) {
    toast.error({
      description: "Please select a language for the site."
    })
    return
  }

  isCreateModalOpen.value = false
  await useRequestFetch()("/api/sites", {
    method: "POST",
    body: {
      name: name.value,
      defaultLanguage: selectedLanguage.value.value
    }
  })
  name.value = ""
  selectedLanguage.value = null
  query.value = ""
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
    @close="
      () => {
        isCreateModalOpen = false
        name.value = ''
        selectedLanguage.value = null
        query.value = ''
      }
    "
    @confirm="createSite"
  >
    <form
      class="flex flex-col gap-4"
      @submit.prevent="createSite"
    >
      <DFormGroup>
        <DFormLabel>Site name</DFormLabel>
        <DInput
          v-if="me"
          type="text"
          v-model="name"
          placeholder="Name of the site"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel>Default Language</DFormLabel>
        <DCombobox
          v-model="selectedLanguage"
          :options="filteredLanguages"
          placeholder="Search for a language..."
        />
      </DFormGroup>
    </form>
  </DModal>
</template>
