<script setup lang="ts">
definePageMeta({
  layout: "site"
})

const siteId = useRouteParams("siteId")
const { data: site, refresh } = await useFetch(`/api/sites/${siteId.value}`)
const { data: me } = await useFetch(`/api/me`)

const showDeleteModal = ref(false)

const formData = ref({ name: "", domain: "" })
watchEffect(() => {
  if (site.value) {
    formData.value = { name: site.value.name, domain: site.value.domain || "" }
  }
})

const hasChanges = computed(() => {
  return site.value?.name !== formData.value.name || site.value?.domain !== formData.value.domain
})

function resetChanges() {
  formData.value = { name: site.value?.name || "", domain: site.value?.domain || "" }
}

const { toast } = useToast()

const saveChanges = async () => {
  try {
    await $fetch(`/api/sites/${siteId.value}`, {
      method: "PUT",
      body: formData.value
    })
    toast.success({ description: "Settings saved successfully" })
    refresh()
  } catch (error: any) {
    toast.error({ description: "Error saving settings" })
    console.error(error)
  }
}

async function deleteSite() {
  try {
    await $fetch(`/api/sites/${siteId.value}`, {
      method: "DELETE"
    })
    navigateTo("/sites")
  } catch (error: any) {
    console.error(error)
  }
}
</script>

<template>
  <DPageTitle title="Site Settings" />
  <DPageWrapper>
    <div
      class="flex flex-col gap-5 py-5"
      v-if="site"
    >
      <d-settings-container v-if="site">
        <d-settings-row
          title="Site name"
          subtitle="Used to identify the site"
        >
          <DInput
            v-model="formData.name"
            class="w-full"
          />
        </d-settings-row>
        <d-settings-row
          title="Domain"
          subtitle="Used to preview the site"
        >
          <DInput
            v-model="formData.domain"
            class="w-full"
            type="url"
            placeholder="https://example.com/"
          />
        </d-settings-row>
      </d-settings-container>
      <d-settings-container>
        <d-settings-row
          title="Delete Site"
          subtitle="This project will be permanently deleted. This action is irreversible and cannot be undone."
        >
          <DButton
            @click="showDeleteModal = true"
            variant="danger"
          >
            Delete
          </DButton>
        </d-settings-row>
      </d-settings-container>
    </div>

    <DModal
      :open="showDeleteModal"
      title="Delete Site"
      description="Do you want to delete this site permanently?"
      confirm-text="Delete Site"
      danger
      @confirm="deleteSite"
      @close="showDeleteModal = false"
    ></DModal>

    <d-settings-save-banner
      :show="hasChanges"
      @reset="resetChanges"
      @save="saveChanges"
      class="left-1/2 -translate-x-1/2"
    />
  </DPageWrapper>
</template>
