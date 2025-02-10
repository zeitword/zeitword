<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const siteId = route.params.siteId
const { data: components, refresh } = await useFetch(`/api/sites/${siteId}/components`)
import { XIcon, Ellipsis, BlocksIcon } from "lucide-vue-next"

const siteStore = useSiteStore()

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
  router.back()
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
    <DButton @click="isCreateModalOpen = true">Create Component</DButton>
  </DPageTitle>

  <DPageWrapper>
    <div class="py-5">
      <div
        v-if="components && components.length > 0"
        class="border-neutral overflow-hidden rounded-md border"
      >
        <NuxtLink
          v-for="component in components"
          :key="component.id"
          class="hover:bg-neutral-hover group border-neutral flex border-b bg-white px-4 py-3 last:border-transparent"
          :to="`/sites/${siteId}/components/${component.id}`"
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
        </NuxtLink>
      </div>
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

  <div
    class="fixed inset-0"
    :class="isComponentSubRoute ? '' : 'pointer-events-none'"
  >
    <div
      class="bg-neutral-inverse/30 pointer-events-none absolute inset-0 z-10 backdrop-blur-xs transition-all"
      :class="isComponentSubRoute ? 'opacity-100' : 'opacity-0'"
    ></div>
    <Transition name="slide-fade">
      <div
        v-if="isComponentSubRoute"
        class="absolute top-0 right-0 z-20 flex h-full w-[500px] flex-col p-5"
      >
        <div class="bg-neutral relative flex-1 rounded-lg p-5 shadow-lg">
          <div class="absolute top-2 right-2">
            <DButton
              @click="navigateBack"
              variant="transparent"
              :icon-left="XIcon"
            />
          </div>
          <NuxtPage />
        </div>
      </div>
    </Transition>
  </div>

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
          v-model="name"
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
