<script setup lang="ts">
const route = useRoute()
const siteId = route.params.siteId

const { data: components } = await useFetch(`/api/sites/${siteId}/components`)
const { data: stories, refresh: refreshStories } = await useFetch(`/api/sites/${siteId}/stories`)

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

async function createStory() {
  await useRequestFetch()(`/api/sites/${siteId}/stories`, {
    method: "POST",
    body: {
      slug: slug.value.length > 0 ? slug.value : "index",
      title: name.value,
      content: {},
      componentId: contentType.value
    }
  })
  closeCreateModal()
  refreshStories()
}

function closeCreateModal() {
  name.value = ""
  slug.value = ""
  contentType.value = ""
  isCreateModalOpen.value = false
}
</script>
<template>
  <DPageTitle title="Content">
    <DButton @click="isCreateModalOpen = true">Add Story</DButton>
  </DPageTitle>
  <pre>

  {{ stories }}
  </pre>

  <DModal
    :open="isCreateModalOpen"
    title=" New Content Story "
    confirm-text="Create Story"
    @close="closeCreateModal"
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
          v-model.slug="slug"
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
