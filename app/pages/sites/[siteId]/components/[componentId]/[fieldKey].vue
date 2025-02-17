<script setup lang="ts">
import { ArrowLeftIcon } from "lucide-vue-next"

const route = useRoute()
const siteId = route.params.siteId
const componentId = route.params.componentId
const fieldKey = route.params.fieldKey

const formData = ref({
  fieldKey: "",
  fieldType: "text",
  required: false,
  description: "",
  displayName: "",
  defaultValue: "",
  minValue: 0,
  maxValue: 0
})

const fieldTypeOptions = computed(() => {
  return fieldTypes.map((fieldType) => ({
    display: fieldType.charAt(0).toUpperCase() + fieldType.slice(1),
    value: fieldType
  }))
})

const { data: field, refresh } = await useFetch(`/api/sites/${siteId}/components/${componentId}/fields/${fieldKey}`)

watch(
  field,
  (newField) => {
    if (newField) {
      formData.value = {
        fieldKey: newField.fieldKey,
        fieldType: newField.type || "text",
        required: newField.required,
        description: newField.description || "",
        displayName: newField.displayName || "",
        defaultValue: newField.defaultValue || "",
        minValue: newField.minValue,
        maxValue: newField.maxValue
      }
    }
  },
  { immediate: true }
)

const hasChanges = computed(() => {
  return JSON.stringify(field.value) !== JSON.stringify(formData.value)
})

async function save() {
  if (hasChanges.value) {
    console.log("saving", formData.value)
    await $fetch(`/api/sites/${siteId}/components/${componentId}/fields/${fieldKey}`, {
      method: "PUT",
      body: formData.value
    })
    console.log("saved")
    refresh()
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <NuxtLink
        class="text-accent text-copy mb-2 flex items-center gap-1 hover:underline"
        :to="`/sites/${siteId}/components/${componentId}`"
      >
        <ArrowLeftIcon class="size-4" />
        All fields
      </NuxtLink>
      <div class="text-title-sm">
        Edit
        <span class="border-neutral bg-neutral-weak rounded-md border px-1">{{ field?.fieldKey }}</span>
        Field
      </div>
    </div>
    <form
      class="flex flex-col gap-4"
      @submit.prevent="save"
    >
      <DFormGroup>
        <DFormLabel name="field-key">Field Key</DFormLabel>
        <DInput
          id="field-key"
          name="field-key"
          v-model="formData.fieldKey"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel name="field-type">Field Type</DFormLabel>
        <DSelect
          id="field-type"
          name="field-type"
          v-model="formData.fieldType"
          :options="fieldTypeOptions"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel name="required">Required</DFormLabel>
        <DInputSwitch
          id="required"
          name="required"
          v-model="formData.required"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel name="description">Description</DFormLabel>
        <textarea
          class="border-neutral rounded-lg border p-4 ring-offset-0 transition-all outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-300"
          v-model="formData.description"
          rows="5"
          cols="50"
        ></textarea>
      </DFormGroup>
      <DFormGroup>
        <DFormLabel name="display-name">Display Name</DFormLabel>
        <DInput
          id="display-name"
          name="display-name"
          v-model="formData.displayName"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel name="default-value">Default Value</DFormLabel>
        <DInput
          id="default-value"
          name="default-value"
          v-model="formData.defaultValue"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel name="minimum-value">Minimum Value</DFormLabel>
        <DInput
          id="minimum-value"
          name="minimum-value"
          type="number"
          v-model="formData.minValue"
        />
      </DFormGroup>
      <DFormGroup>
        <DFormLabel name="maximum-value">Maximum Value</DFormLabel>
        <DInput
          id="maximum-value"
          name="maximum-value"
          type="number"
          v-model="formData.maxValue"
        />
      </DFormGroup>
      <div>
        <DButton
          @click="save"
          type="submit"
          :disabled="!hasChanges"
        >
          Save
        </DButton>
      </div>
    </form>
  </div>
</template>
