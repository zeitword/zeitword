<script setup lang="ts">
definePageMeta({
  layout: "site"
})

const siteId = useRouteParams("siteId")
const { data: site } = await useFetch(`/api/sites/${siteId.value}`)
</script>

<template>
  <DPageTitle title="Site Settings" />
  <DPageWrapper>
    <div
      class="py-5"
      v-if="site"
    >
      <div
        class="bg-neutral border-neutral flex flex-col gap-2 rounded-lg border p-4"
      >
        <div class="flex flex-col gap-1">
          <div class="text-title-md text-neutral font-medium">Site name</div>
          <div class="text-copy text-neutral-subtle">
            Used to identify the site
          </div>
        </div>
        <div>
          <DInput
            v-model="site.name"
            label="Site name"
          />
        </div>
      </div>
    </div>
  </DPageWrapper>
</template>
