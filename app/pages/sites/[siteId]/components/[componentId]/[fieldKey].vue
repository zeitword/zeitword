<script setup lang="ts">
import { ArrowLeftIcon } from "lucide-vue-next"

const siteId = useRouteParams("siteId")
const componentId = useRouteParams("componentId")
const fieldKey = useRouteParams("fieldKey")

type FormData = {
  fieldKey: string
  fieldType: string
  required: boolean
  description: string
  displayName: string
  defaultValue: string
  minValue: number | null
  maxValue: number | null
}

const formData = ref<FormData>({
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

const { data: field, refresh } = await useFetch(
  `/api/sites/${siteId.value}/components/${componentId.value}/fields/${fieldKey.value}`
)

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

const { toast } = useToast()

async function save() {
  console.log("saving")
  try {
    await $fetch(
      `/api/sites/${siteId.value}/components/${componentId.value}/fields/${fieldKey.value}`,
      {
        method: "PUT",
        body: formData.value
      }
    )
    console.log("saved")
    refresh()
    toast.success({ description: "Field saved successfully" })
  } catch (error) {
    console.error("Error saving field:", error)
    toast.error({ description: "Error saving field" })
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-neutral border-b p-5 pb-2">
      <NuxtLink
        class="text-accent text-copy mb-2 flex items-center gap-1 hover:underline"
        :to="`/sites/${siteId}/components/${componentId}`"
      >
        <ArrowLeftIcon class="size-4" />
        All fields
      </NuxtLink>
      <div class="text-title-sm">
        Edit
        <span class="border-neutral bg-neutral-weak rounded-md border px-1">
          {{ field?.fieldKey }}
        </span>
        Field
      </div>
    </div>
    <div class="flex-1 overflow-y-auto p-5">
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

        <!-- specific fields for "string" -->
        <template v-if="formData.fieldType === 'text'">
          <DFormGroup>
            <DFormLabel name="default-value">Default Value</DFormLabel>
            <DInput
              id="default-value"
              name="default-value"
              v-model="formData.defaultValue"
            />
          </DFormGroup>
        </template>

        <template v-if="formData.fieldType === 'textarea'">
          <DFormGroup>
            <DFormLabel name="default-value">Default Value</DFormLabel>
            <DTextarea
              id="default-value"
              name="default-value"
              v-model="formData.defaultValue"
            />
          </DFormGroup>
        </template>

        <!-- specific fields for "number" -->
        <template v-if="formData.fieldType === 'number'">
          <DFormGroup>
            <DFormLabel name="default-value">Default Value</DFormLabel>
            <DInput
              id="default-value"
              name="default-value"
              type="number"
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
        </template>

        <!-- specific fields for "datetime" -->
        <template v-if="formData.fieldType === 'datetime'">
          <DFormGroup>
            <DFormLabel name="default-value">Default Value</DFormLabel>
            <DInput
              id="default-value"
              name="default-value"
              type="datetime-local"
              v-model="formData.defaultValue"
            />
          </DFormGroup>
        </template>

        <template v-if="formData.fieldType === 'option'">
          <DFormGroup>
            <DFormLabel name="default-value">Default Value</DFormLabel>
            <DInput
              id="default-value"
              name="default-value"
              type="datetime-local"
              v-model="formData.defaultValue"
            />
          </DFormGroup>
        </template>

        <!-- specific fields for "boolean" -->
        <template v-if="formData.fieldType === 'boolean'">
          <DFormGroup>
            <DFormLabel name="default-value">Default Value</DFormLabel>
            <DInputSwitch
              id="default-value"
              name="default-value"
              v-model="formData.defaultValue"
            />
          </DFormGroup>
        </template>

        <div>
          <DButton
            type="submit"
            :disabled="!hasChanges"
          >
            Save
          </DButton>
        </div>
      </form>
    </div>
  </div>
</template>
