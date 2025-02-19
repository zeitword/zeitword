<script setup lang="ts">
import { Trash2 } from "lucide-vue-next"

definePageMeta({
  layout: "site"
})

const siteId = useRouteParams("siteId")
const componentId = useRouteParams("componentId")

const { data: components, refresh } = await useFetch(`/api/sites/${siteId.value}/components`)
import { BlocksIcon } from "lucide-vue-next"

const isCreateModalOpen = ref(false)

const isComponentSubRoute = computed(() => {
  if (componentId.value) {
    return true
  }
  return false
})

onMounted(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape" && isComponentSubRoute.value) {
      navigateBack()
    }
  }

  window.addEventListener("keydown", handleEsc)

  onUnmounted(() => {
    window.removeEventListener("keydown", handleEsc)
  })
})

function navigateBack() {
  navigateTo(`/sites/${siteId.value}/components`)
}

const name = ref("")
const displayName = ref("")

async function createComponent() {
  try {
    await useRequestFetch()(`/api/sites/${siteId.value}/components`, {
      method: "POST",
      body: { name: name.value, displayName: displayName.value }
    })
  } finally {
    isCreateModalOpen.value = false
    name.value = ""
    displayName.value = ""
    await refresh()
  }
}

const isDeleteModalOpen = ref(false)
const selectedComponentId = ref<string | null>(null)

function showDeleteModal(id: string) {
  isDeleteModalOpen.value = true
  selectedComponentId.value = id
}
async function deleteComponent() {
  if (!selectedComponentId.value) return
  try {
    await useRequestFetch()(`/api/sites/${siteId.value}/components/${selectedComponentId.value}`, {
      method: "DELETE"
    })
  } finally {
    selectedComponentId.value = null
    isDeleteModalOpen.value = false
    await refresh()
  }
}
</script>

<template>
  <DPageTitle title="Components">
    <DButton @click="isCreateModalOpen = true">Add Component</DButton>
  </DPageTitle>

  <DPageWrapper>
    <div class="py-5">
      <DList v-if="components && components.length > 0">
        <DListItem
          v-for="component in components"
          :key="component.id"
          class="group h-14 select-none"
          @click="navigateTo(`/sites/${siteId}/components/${component.id}`)"
        >
          <div class="text-copy flex w-full items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-60">
                {{ component?.displayName }}
              </div>
              <div class="text-copy-sm bg-neutral border-neutral rounded-full border px-2 py-px">
                {{ component?.name }}
              </div>
            </div>
            <div class="hidden group-hover:block">
              <DButton
                :icon-left="Trash2"
                size="sm"
                variant="secondary"
                @click.stop="showDeleteModal(component.id)"
              />
            </div>
          </div>
        </DListItem>
      </DList>

      <div v-else>
        <DEmpty
          title="No components yet"
          description="Create your first component to get started"
          :icon="BlocksIcon"
          size="lg"
        >
          <DButton
            @click="isCreateModalOpen = true"
            variant="secondary"
          >
            Create Component
          </DButton>
        </DEmpty>
      </div>
    </div>
  </DPageWrapper>

  <DDrawer
    :open="isComponentSubRoute"
    @close="navigateBack"
  >
    <NuxtPage />
  </DDrawer>

  <DModal
    :open="isCreateModalOpen"
    title="Create Component"
    confirm-text="Create Component"
    @close="isCreateModalOpen = false"
    @confirm="createComponent"
  >
    <form
      @submit.prevent="createComponent"
      class="flex w-full flex-col gap-4 p-5"
    >
      <DFormGroup>
        <DFormLabel
          name="domain"
          required
        >
          Technical name
        </DFormLabel>
        <DInput
          id="name"
          name="name"
          v-model.sanitize="name"
          required
          placeholder="some-button"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel
          name="display-name"
          required
        >
          Display name
        </DFormLabel>
        <DInput
          id="display-name"
          name="display-name"
          v-model="displayName"
          required
          placeholder="Some Buttton"
        />
      </DFormGroup>
    </form>
  </DModal>

  <DModal
    :open="isDeleteModalOpen"
    title="Delete Component"
    description="All related stories will be deleted"
    confirm-text="Delete Component"
    danger
    @confirm="deleteComponent"
    @close="isDeleteModalOpen = false"
  ></DModal>
</template>
