<script setup lang="ts">
const siteId = useRouteParams("siteId")
const componentId = useRouteParams("componentId")
const { toast } = useToast()

const { data: component } = await useFetch(
  `/api/sites/${siteId.value}/components/${componentId.value}`
)

const formData = reactive({
  name: component.value?.name,
  displayName: component.value?.displayName,
  previewField: component.value?.previewField,
  previwImage: null
})

async function saveChanges() {
  try {
    await $fetch(`/api/sites/${siteId.value}/components/${componentId.value}`, {
      method: "PUT",
      body: formData
    })
    toast.success({
      description: "Your changes have been saved",
      duration: 3000
    })
  } catch (error) {
    toast.error({
      description: "Failed to save changes",
      duration: 3000
    })
  }
}
</script>

<template>
  <LayoutSidebarComponent>
    <div
      v-if="component"
      class="space-y-4"
    >
      <!-- Name Field -->
      <DFormGroup>
        <DFormLabel required>Technical Name</DFormLabel>
        <DInput
          :model-value="formData.name"
          placeholder="Technical name (e.g., page, header)"
          disabled
        />
      </DFormGroup>

      <!-- Display Name Field -->
      <DFormGroup>
        <DFormLabel required>Display Name</DFormLabel>
        <DInput
          v-model="formData.displayName"
          placeholder="Human-readable name (e.g., Page, Header)"
        />
      </DFormGroup>

      <!-- Preview Image Field -->
      <!-- TODO: ADD image selector -->

      <!-- Preview Field -->
      <DFormGroup v-if="component.fields.length > 0">
        <DFormLabel>Preview Field</DFormLabel>
        <DSelect
          v-model="formData.previewField"
          placeholder="Select a field"
          :options="
            component.fields.map((field) => ({
              display: field.displayName || '',
              value: field.fieldKey
            }))
          "
        />
      </DFormGroup>

      <!-- Save Button -->
      <div class="flex justify-end">
        <DButton
          @click="saveChanges"
          variant="primary"
        >
          Save Changes
        </DButton>
      </div>
    </div>
  </LayoutSidebarComponent>
</template>
