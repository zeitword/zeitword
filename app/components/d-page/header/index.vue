<script lang="ts" setup>
import { storeToRefs } from "pinia"

const route = useRoute()
const siteStore = useSiteStore()

// Use storeToRefs for reactive state
const { currentSite, isLoading } = storeToRefs(siteStore)

const siteId = computed(() => route.params.siteId)

// Fetch site when siteId changes
watch(siteId, async (newSiteId) => {
  if (newSiteId) {
    await siteStore.fetchSite(newSiteId as string)
  }
})

const mainNavigation = [
  { name: "Sites", to: "/sites" },
  { name: "Settings", to: "/settings" }
]

const siteNavigation = computed(() => {
  return [
    { name: "Components", to: `/sites/${siteId.value}/components` },
    { name: "Content", to: `/sites/${siteId.value}/content` },
    { name: "Settings", to: `/sites/${siteId.value}/settings` }
  ]
})

const currentNavigation = computed(() => {
  if (siteId.value) {
    return siteNavigation.value
  } else {
    return mainNavigation
  }
})
</script>

<template>
  <header class="bg-neutral border-neutral w-full border-b">
    <div class="flex items-center justify-between px-6 py-3">
      <div class="flex items-center gap-2">
        <NuxtLink
          :to="`/sites`"
          class="flex flex-shrink-0 items-center gap-2"
        >
          <z-logo />
        </NuxtLink>
        <DPageHeaderSeparator />
        <DPageHeaderBreadcrumbLink
          name="Zeitword"
          to="/sites"
        />
        <template v-if="siteId">
          <DPageHeaderSeparator />
          <DPageHeaderBreadcrumbLink
            :name="siteStore.currentSite?.name"
            :to="`/sites/${siteId}`"
          />
        </template>
      </div>
      <div>
        <div
          class="bg-neutral-inverse text-neutral-inverse text-copy-sm grid size-8 place-items-center rounded-full font-semibold uppercase"
        >
          am
        </div>
      </div>
    </div>
    <div class="px-4">
      <div class="flex">
        <NuxtLink
          v-for="item in currentNavigation"
          :key="item?.name"
          :to="item?.to"
          :class="
            route.path.startsWith(item?.to)
              ? 'text-neutral border-neutral-strong'
              : 'text-neutral-subtle border-transparent'
          "
          class="group border-b-2 py-2 transition duration-150 ease-in-out hover:text-gray-900"
        >
          <div class="group-hover:bg-neutral-subtle text-copy rounded-lg px-3 py-1">
            {{ item?.name }}
          </div>
        </NuxtLink>
      </div>
    </div>
  </header>
</template>
