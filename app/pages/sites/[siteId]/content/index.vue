<script setup lang="ts">
import { Compass } from "lucide-vue-next"

const route = useRoute()
const siteId = route.params.siteId

const { data: components, refresh } = await useFetch(`/api/sites/${siteId}/components`)

const isCreateModalOpen = ref(false)

const contentTypeOptions = computed(() => {
  if (!components.value) return
  return components.value.map((component) => ({
    display: component.displayName,
    value: component.id
  }))
})

const name = ref("")
const slug = ref("")
const contentType = ref("")

function createStory() {
  // Implement the logic to create a new story
}
</script>
<template>
  <DPageTitle title="Content">
    <DButton @click="isCreateModalOpen = true">Add Story</DButton>
  </DPageTitle>

  <DModal
    :open="isCreateModalOpen"
    title="Create Component"
    confirm-text="Create Component"
    @close="isCreateModalOpen = false"
    @confirm="createStory"
  >
    <form
      @submit.prevent="createStory"
      class="flex w-full flex-col gap-4 p-5"
    >
      <DFormGroup>
        <DFormLabel
          name="domain"
          required
        >
          Name
        </DFormLabel>
        <DInput
          id="name"
          name="name"
          v-model="name"
          required
          placeholder="e.g. Landing"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel
          name="slug"
          required
        >
          Slug
        </DFormLabel>
        <DInput
          id="slug"
          name="slug"
          v-model="slug"
          required
          leading="/"
          placeholder="landing"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel
          name="contentType"
          required
        >
          Content Type
        </DFormLabel>
        <DSelect
          id="contentType"
          name="contentType"
          v-model="contentType"
          required
          placeholder="Select Type"
          :options="contentTypeOptions"
        ></DSelect>
      </DFormGroup>
    </form>
  </DModal>
</template>
