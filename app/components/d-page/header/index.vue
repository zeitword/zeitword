<script lang="ts" setup>
import { LogOutIcon } from "lucide-vue-next"
type Props = {
  navigation: Array<{ name: string; to: string }>
}
const { navigation } = defineProps<Props>()

const siteId = useRouteParams<string>("siteId")
const storyId = useRouteParams<string>("storyId")

const site = ref()
if (siteId.value) {
  let { data } = await useFetch(`/api/sites/${siteId.value}`)
  site.value = data.value
}

const story = ref()

if (siteId.value && storyId.value) {
  const { data } = await useFetch(
    `/api/sites/${siteId.value}/stories/${storyId.value}`
  )
  story.value = data.value
}

const { data: me } = await useFetch(`/api/me`)

const initials = computed(() => {
  if (!me.value) return ""
  const name = me.value.name?.split(" ")
  return (name[0]?.charAt(0) || "") + (name[1]?.charAt(0) || "")
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
          :name="me?.organisationName as string"
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
      <div class="flex items-center gap-2">
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
