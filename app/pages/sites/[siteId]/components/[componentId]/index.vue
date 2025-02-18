<script setup lang="ts">
import { GripVertical } from "lucide-vue-next"

const siteId = useRouteParams("siteId")
const componentId = useRouteParams("componentId")

const name = ref("")
const fieldType = ref("text")

const { data: component, refresh } = await useFetch(
  `/api/sites/${siteId.value}/components/${componentId.value}`
)

async function addField() {
  await useRequestFetch()(`/api/sites/${siteId.value}/components/${componentId.value}/fields`, {
    method: "POST",
    body: { name: name.value, fieldType: fieldType.value }
  })
  name.value = ""
  fieldType.value = "text"
  await refresh()
}
</script>

<template>
  <LayoutSidebarComponent>
    <form
      @submit.prevent="addField"
      class="mb-4 flex flex-col gap-4"
    >
      <div class="grid grid-cols-3 gap-2">
        <DFormGroup class="col-span-2">
          <DFormLabel>Field Name</DFormLabel>
          <DInput
            type="text"
            v-model.sanitize="name"
            placeholder="Field name"
          />
        </DFormGroup>
        <DFormGroup>
          <DFormLabel>Field Type</DFormLabel>
          <DSelect
            v-model="fieldType"
            class="bg-neutral-subtle text-copy w-full rounded-md p-2"
            :options="fieldTypes.map((type) => ({ display: type, value: type }))"
          />
        </DFormGroup>
      </div>
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
  </LayoutSidebarComponent>
</template>
