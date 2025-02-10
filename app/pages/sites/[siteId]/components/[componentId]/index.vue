<script setup lang="ts">
const route = useRoute()
const siteId = route.params.siteId
const componentId = route.params.componentId

const name = ref("")
const fieldType = ref("text")

const { data: component, refresh } = await useFetch(`/api/sites/${siteId}/components/${componentId}`)

async function addField() {
  await useRequestFetch()(`/api/sites/${siteId}/components/${componentId}/fields`, {
    method: "POST",
    body: { name: name.value, fieldType: fieldType.value },
  })
  await refresh()
}
</script>

<template>
  <div class="p-4">
    <div class="text-title-md">Component: {{ component?.displayName }}</div>
    <form @submit.prevent="addField" class="mb-4 flex max-w-sm flex-col gap-2">
      <DInput type="text" v-model="name" placeholder="Field name" />
      <select v-model="fieldType" class="bg-neutral-subtle text-copy w-full rounded-md p-2">
        <option value="">Select a field type</option>
        <!-- TODO: use fieldTypeEnum from server -->
        <option v-for="type in fieldTypes" :key="type" :value="type">{{ type }}</option>
      </select>
      <DButton type="submit">Add Field</DButton>
    </form>
    <div>
      <div class="border-neutral-subtle text-copy flex border-b p-2 last:border-none" v-for="(field, index) in component?.fields" :key="index">
        <div class="w-40">
          {{ field?.fieldKey }}
        </div>
        <div>
          {{ field?.type }}
        </div>
      </div>
    </div>
  </div>
</template>
