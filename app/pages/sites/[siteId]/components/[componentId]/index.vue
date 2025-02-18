<script setup lang="ts">
import { GripVertical } from "lucide-vue-next"
const route = useRoute()
const siteId = route.params.siteId
const componentId = route.params.componentId

const name = ref("")
const fieldType = ref("text")

const { data: component, refresh } = await useFetch(
  `/api/sites/${siteId}/components/${componentId}`
)

async function addField() {
  await useRequestFetch()(`/api/sites/${siteId}/components/${componentId}/fields`, {
    method: "POST",
    body: { name: name.value, fieldType: fieldType.value }
  })
  name.value = ""
  fieldType.value = "text"
  await refresh()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="text-title-sm">
      Edit
      <span class="border-neutral bg-neutral-weak rounded-md border px-1">
        {{ component?.displayName }}
      </span>
      Component
    </div>
    <form
      @submit.prevent="addField"
      class="mb-4 flex flex-col gap-2"
    >
      <DInput
        type="text"
        v-model.sanitize="name"
        placeholder="Field name"
      />
      <DSelect
        v-model="fieldType"
        class="bg-neutral-subtle text-copy w-full rounded-md p-2"
        :options="fieldTypes.map((type) => ({ display: type, value: type }))"
      />
      <DButton type="submit">Add Field</DButton>
    </form>
    <div
      v-if="component?.fields && component?.fields.length > 0"
      class="border-neutral overflow-hidden rounded-md border"
    >
      <NuxtLink
        v-for="(field, index) in component?.fields"
        :key="index"
        class="hover:bg-neutral-hover group border-neutral flex border-b bg-white px-4 py-3 last:border-transparent"
        :to="`/sites/${siteId}/components/${component.id}/${field?.fieldKey}`"
      >
        <div class="text-copy flex w-full items-center justify-between">
          <div class="flex items-center gap-3">
            <DButton
              :icon-left="GripVertical"
              size="sm"
              variant="transparent"
            />
            <div>
              {{ field?.fieldKey }}
            </div>
          </div>
          <div class="text-copy-sm bg-neutral border-neutral rounded-full border px-2 py-px">
            {{ field?.type }}
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
