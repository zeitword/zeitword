<script setup lang="ts">
const siteId = useRouteParams("siteId")
const componentId = useRouteParams("componentId")

const navigation = ref([
  { name: "Fields", to: `/sites/${siteId.value}/components/${componentId.value}` },
  { name: "Settings", to: `/sites/${siteId.value}/components/${componentId.value}/settings` }
])
</script>

<template>
  <div class="bg-neutral-subtle flex flex-1 flex-col">
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
    <div class="flex min-h-0 flex-1 flex-col">
      <slot></slot>
    </div>
  </div>
</template>
