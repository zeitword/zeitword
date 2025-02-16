<script lang="ts" setup>
type Props = {
  navigation: Array<{ name: string; to: string }>
}

const { navigation } = defineProps<Props>()

const route = useRoute()
const siteStore = useSiteStore()
const storyStore = useStoryStore()

const siteId = computed(() => route.params.siteId)
const storyId = computed(() => route.params.storyId)

</script>

<template>
  <header class="bg-neutral w-full border-b border-neutral">
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
            :name="siteStore.currentSite?.name as string"
            :to="`/sites/${siteId}/content`"
          />
        </template>

        <template v-if="storyId">
          <DPageHeaderSeparator />
          <DPageHeaderBreadcrumbLink
            :name="storyStore.currentStory?.title as string"
            :to="`/sites/${siteId}/content/${storyId}`"
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

		<!-- <pre> -->
		<!-- {{navigation}} -->
		<!-- </pre> -->
		<DPageHeaderNavigation :navigation="navigation" />
  </header>
</template>
