<script setup lang="ts">
import { LucideKey } from "lucide-vue-next"

definePageMeta({
  layout: "site"
})

const siteId = useRouteParams("siteId")
const { data: site, refresh } = await useFetch(`/api/sites/${siteId.value}`)
const { data: me } = await useFetch(`/api/me`)
const { data: availableLanguages } = await useFetch("/api/languages")
const { data: apiKeys, refresh: refreshApiKeys } = await useFetch(
  `/api/sites/${siteId.value}/apiKeys`
)

const showDeleteModal = ref(false)
const showAddLanguageModal = ref(false)

const formData = ref({ name: "", domain: "", defaultLanguage: "" })

const query = ref("")
const selectedLanguage = ref<{ value: string; display: string } | null>(null)

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

watchEffect(() => {
  if (site.value) {
    formData.value = {
      name: site.value.name,
      domain: site.value.domain || "",
      defaultLanguage: site.value.defaultLanguage
    }
  }
})

const hasChanges = computed(() => {
  return (
    site.value?.name !== formData.value.name ||
    site.value?.domain !== formData.value.domain ||
    site.value?.defaultLanguage !== formData.value.defaultLanguage
  )
})

function resetChanges() {
  formData.value = {
    name: site.value?.name || "",
    domain: site.value?.domain || "",
    defaultLanguage: site.value?.defaultLanguage || ""
  }
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

async function addLanguage() {
  if (!selectedLanguage.value) return

  try {
    await $fetch(`/api/sites/${siteId.value}/languages`, {
      method: "POST",
      body: {
        code: selectedLanguage.value.value
      }
    })
    showAddLanguageModal.value = false
    selectedLanguage.value = null
    query.value = ""
    refresh()
    toast.success({ description: "Language added successfully" })
  } catch (error: any) {
    toast.error({ description: "Error adding language" })
    console.error(error)
  }
}

async function deleteLanguage(languageId: string) {
  try {
    await $fetch(`/api/sites/${siteId.value}/languages/${languageId}`, {
      method: "DELETE"
    })
    refresh()
    toast.success({ description: "Language removed successfully" })
  } catch (error: any) {
    toast.error({ description: "Error removing language" })
    console.error(error)
  }
}

const showAddApiKeyModal = ref(false)
const showApiKeySuccessModal = ref(false)
const apiKeyName = ref("")
const apiKeySecret = ref("")
const { copy } = useClipboard()

const onCopyApiKey = () => {
  copy(apiKeySecret.value)
  toast.success({ description: "API key copied to clipboard" })
}

async function createApiKey() {
  try {
    const apiKey = await $fetch(`/api/sites/${siteId.value}/apiKeys`, {
      method: "POST",
      body: {
        name: apiKeyName.value
      }
    })
    apiKeySecret.value = apiKey.key
    showApiKeySuccessModal.value = true
    refreshApiKeys()
    toast.success({ description: "API key created successfully" })
  } catch (error: any) {
    toast.error({ description: "Error creating API key" })
    console.error(error)
  }

  showAddApiKeyModal.value = false
}

async function deleteApiKey(apiKeyId: string) {
  try {
    await $fetch(`/api/sites/${siteId.value}/apiKeys`, {
      method: "DELETE",
      body: {
        id: apiKeyId
      }
    })
    refreshApiKeys()
    toast.success({ description: "API key deleted successfully" })
  } catch (error: any) {
    toast.error({ description: "Error deleting API key" })
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
          title="Languages"
          subtitle="Manage the languages available for your site"
        >
          <div class="flex w-full flex-col gap-4">
            <div class="flex items-center justify-between">
              <DSelect
                v-model="formData.defaultLanguage"
                :options="
                  site.languages?.map((lang) => ({
                    value: lang.language.code,
                    display: `${lang.language.name} (${lang.language.nativeName})`
                  })) || []
                "
                label="Default Language"
              />
              <DButton
                variant="secondary"
                @click="showAddLanguageModal = true"
              >
                Add Language
              </DButton>
            </div>
            <DList>
              <DListItem
                v-for="lang in site.languages"
                :key="lang.languageCode"
                class="flex items-center justify-between"
              >
                <div>
                  <div class="flex items-center gap-1 font-medium">
                    <p class="text-copy">{{ lang.language.name }}</p>
                    <div
                      class="bg-neutral-strong text-neutral-subtle text-copy-sm flex items-center rounded px-2 py-0.5 leading-tight"
                      v-if="lang.language.code === formData.defaultLanguage"
                    >
                      Default
                    </div>
                  </div>
                  <div class="text-sm text-gray-500">
                    {{ lang.language.nativeName }} ({{ lang.language.code }})
                  </div>
                </div>
                <div class="flex gap-2">
                  <DButton
                    variant="secondary"
                    size="sm"
                    @click="deleteLanguage(lang.languageCode)"
                    :disabled="lang.language.code === formData.defaultLanguage"
                  >
                    Remove
                  </DButton>
                </div>
              </DListItem>
            </DList>
          </div>
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

      <d-settings-container>
        <d-settings-row
          title="API Keys"
          subtitle="Manage the API keys for your site"
        >
          <div class="flex w-full flex-col gap-4">
            <div class="flex items-center justify-end">
              <DButton
                @click="showAddApiKeyModal = true"
                variant="secondary"
              >
                Add API Key
              </DButton>
            </div>
            <DList v-if="apiKeys && apiKeys.length > 0">
              <DListItem
                v-for="apiKey in apiKeys"
                :key="apiKey.id"
                class="flex items-center justify-between"
              >
                <div>
                  <div class="flex items-center gap-1 font-medium">
                    <p class="text-copy">{{ apiKey.name }}</p>
                  </div>
                  <div class="text-sm text-gray-500">ID: {{ apiKey.id }}</div>
                </div>
                <div class="flex gap-2">
                  <DButton
                    variant="secondary"
                    size="sm"
                    @click="deleteApiKey(apiKey.id)"
                  >
                    Remove
                  </DButton>
                </div>
              </DListItem>
            </DList>
          </div>
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

    <DModal
      :open="showAddLanguageModal"
      title="Add Language"
      confirm-text="Add Language"
      @close="
        () => {
          showAddLanguageModal = false
          selectedLanguage.value = null
          query.value = ''
        }
      "
      @confirm="addLanguage"
    >
      <div class="flex flex-col gap-4">
        <DFormGroup>
          <DLabel>Search Language</DLabel>
          <DCombobox
            v-model="selectedLanguage"
            :options="filteredLanguages"
            placeholder="Search for a language..."
          />
        </DFormGroup>
      </div>
    </DModal>

    <DModal
      :open="showAddApiKeyModal"
      title="Add API Key"
      confirm-text="Create"
      @close="showAddApiKeyModal = false"
      @confirm="createApiKey"
    >
      <div class="flex flex-col gap-4">
        <DFormGroup>
          <DLabel>Name</DLabel>
          <DInput
            v-model="apiKeyName"
            placeholder="Enter a name for the API key"
          />
        </DFormGroup>
      </div>
    </DModal>

    <DModal
      :open="showApiKeySuccessModal"
      title="Your API Key"
      @close="showApiKeySuccessModal = false"
      @confirm="showApiKeySuccessModal = false"
    >
      <div class="flex flex-col gap-4">
        <DFormGroup>
          <DLabel>API Key</DLabel>
          <p class="text-sm text-gray-500">
            This is your API key. Please copy it and keep it safe. You will not be able to access it
            again.
          </p>
          <DInput
            v-if="apiKeySecret"
            v-model="apiKeySecret"
            disabled
            class="mt-2"
          >
            <template #leading>
              <LucideKey class="h-4 w-4" />
            </template>
            <template #trailing>
              <DButton
                variant="transparent"
                size="sm"
                @click="onCopyApiKey"
              >
                Copy
              </DButton>
            </template>
          </DInput>
        </DFormGroup>
      </div>
    </DModal>

    <d-settings-save-banner
      :show="hasChanges"
      @reset="resetChanges"
      @save="saveChanges"
      class="left-1/2 -translate-x-1/2"
    />
  </DPageWrapper>
</template>
