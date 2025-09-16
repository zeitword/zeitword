<script lang="ts" setup>
import { LogOutIcon } from "lucide-vue-next"

type Props = {
  navigation: Array<{ name: string; to: string }>
}
const { navigation } = defineProps<Props>()

const siteId = useRouteParams<string>("siteId")
const storyId = useRouteParams<string>("storyId")
const folderId = useRouteParams<string>("folderId")

const { data: me } = await useFetch(`/api/me`)

const initials = computed(() => {
  if (!me.value) return ""
  const name = me.value.name?.split(" ")
  return (name[0]?.charAt(0) || "") + (name[1]?.charAt(0) || "")
})

const { data: site } = await useAsyncData(
  `/api/sites`,
  async () => {
    if (!siteId.value) return undefined

    const data = await $fetch(`/api/sites/${siteId.value}`)
    return data
  },
  {
    watch: [siteId]
  }
)

const { data: story } = await useAsyncData(
  "/api/sites/stories",
  async () => {
    if (!siteId.value || (!storyId.value && !folderId.value)) return undefined

    const data = await $fetch(
      `/api/sites/${siteId.value}/stories/${storyId.value || folderId.value}`
    )
    return data
  },
  {
    watch: [storyId, folderId]
  }
)

const breadcrumbContainer = ref<HTMLElement | undefined>()
const { width: breadcrumbContainerWidth } = useElementSize(breadcrumbContainer)

const maxVisibleBreadcrumbItems = computed(() => {
  const containerWidth = breadcrumbContainerWidth.value || 0
  const itemWidth = 234 // max-width 200px + icon 26px + gap 8px
  return Math.floor(containerWidth / itemWidth) - 1
})

const visibleBreadcrumbItems = computed(() => {
  const breadcrumbItems = story.value?.parents || []
  const breadcrumbLength = breadcrumbItems.length

  return breadcrumbItems.slice(Math.max(breadcrumbLength - maxVisibleBreadcrumbItems.value, 0))
})
</script>

<template>
  <header class="bg-neutral border-neutral w-full border-b">
    <div class="flex items-center justify-between px-6 py-3">
      <div class="flex grow items-center gap-2">
        <NuxtLink
          :to="`/sites`"
          class="flex flex-shrink-0 items-center gap-2"
        >
          <z-logo />
        </NuxtLink>
        <DPageHeaderSeparator />
        <DPageHeaderBreadcrumbLink
          :name="me?.organisationName as string"
          to="/sites"
        />
        <template v-if="siteId && site">
          <DPageHeaderSeparator />
          <DPageHeaderBreadcrumbLink
            :name="site?.name"
            :to="`/sites/${siteId}/stories`"
          />
        </template>

        <div
          ref="breadcrumbContainer"
          class="flex grow items-center gap-2"
        >
          <template v-if="story">
            <template v-if="story.parents.length > maxVisibleBreadcrumbItems">
              <DPageHeaderSeparator />
              <span class="text-neutral-subtle">...</span>
            </template>

            <template
              v-for="breadcrumb in visibleBreadcrumbItems"
              :key="breadcrumb.id"
            >
              <DPageHeaderSeparator />
              <DPageHeaderBreadcrumbLink
                :name="breadcrumb.title"
                :to="`/sites/${siteId}/stories/${breadcrumb.id}`"
              />
            </template>

            <DPageHeaderSeparator />
            <DPageHeaderBreadcrumbLink
              :name="story?.title"
              to="#"
            />
          </template>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <DThemeSwitcher />
        <DButton
          :icon-left="LogOutIcon"
          variant="secondary"
          size="md"
          to="/logout"
        />
        <div
          class="bg-neutral-inverse text-neutral-inverse text-copy-sm grid size-8 place-items-center rounded-full font-semibold uppercase"
        >
          {{ initials }}
        </div>
      </div>
    </div>

    <DPageHeaderNavigation :navigation="navigation" />
  </header>
</template>
