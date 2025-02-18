<script setup lang="ts">
const siteId = useRouteParams("siteId")
const componentId = useRouteParams("componentId")

const { data: component } = await useFetch(
  `/api/sites/${siteId.value}/components/${componentId.value}`
)

const navigation = ref([
  { name: "Fields", to: `/sites/${siteId.value}/components/${componentId.value}` },
  { name: "Settings", to: `/sites/${siteId.value}/components/${componentId.value}/settings` }
])
</script>

<template>
  <div class="bg-neutral-subtle flex min-h-0 flex-1 flex-col">
    <div class="bg-neutral border-neutral border-b">
      <div class="text-title-sm px-4 pt-4 pb-2">
        Edit
        <span class="border-neutral bg-neutral-weak rounded-md border px-1">
          {{ component?.displayName }}
        </span>
        Component
      </div>

      <DPageHeaderNavigation :navigation="navigation" />
    </div>
    <div class="flex min-h-0 flex-1 flex-col overflow-scroll">
      <div class="p-4">
        <slot></slot>
      </div>
    </div>
  </div>
</template>
