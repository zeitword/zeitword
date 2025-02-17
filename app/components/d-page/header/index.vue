<script lang="ts" setup>
type Props = {
  navigation: Array<{ name: string; to: string }>
}
const { navigation } = defineProps<Props>()

const siteId = useRouteParams<string>("siteId")
const storyId = useRouteParams<string>("storyId")

const { data: site } = await useFetch(`/api/sites/${siteId.value}`)
const { data: story } = await useFetch(
  `/api/sites/${siteId.value}/stories/${storyId.value}`
)
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
        <template v-if="siteId && site">
          <DPageHeaderSeparator />
          <DPageHeaderBreadcrumbLink
            :name="site?.name"
            :to="`/sites/${siteId}/content`"
          />
        </template>

        <template v-if="storyId && story">
          <DPageHeaderSeparator />
          <DPageHeaderBreadcrumbLink
            :name="story?.title"
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
