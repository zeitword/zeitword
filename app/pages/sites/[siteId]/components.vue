<script setup lang="ts">
definePageMeta({
  layout: "site"
})

const route = useRoute()
const router = useRouter()
const siteId = route.params.siteId
const { data: components, refresh } = await useFetch(`/api/sites/${siteId}/components`)
import { Ellipsis, BlocksIcon } from "lucide-vue-next"

const isCreateModalOpen = ref(false)

const isComponentSubRoute = computed(() => {
  if (route.params.componentId) {
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
  router.push(`/sites/${siteId}/components`)
}

const name = ref("")
const displayName = ref("")

async function createComponent() {
  isCreateModalOpen.value = false
  await useRequestFetch()(`/api/sites/${siteId}/components`, {
    method: "POST",
    body: { name: name.value, displayName: displayName.value }
  })
  await refresh()
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
          :to="`/sites/${siteId}/components/${component.id}`"
          v-for="component in components"
          :key="component.id"
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
            <DButton
              :icon-left="Ellipsis"
              size="sm"
              variant="secondary"
            />
          </div>
        </DListItem>
      </DList>

      <div v-else>
        <DEmpty
          title="No components yet"
          description="Create your first component to get started"
          :icon="BlocksIcon"
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
</template>
