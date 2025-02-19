<script setup lang="ts">
const siteId = useRouteParams("siteId")
const componentId = useRouteParams("componentId")
const { toast } = useToast()

const { data: component } = await useFetch(
  `/api/sites/${siteId.value}/components/${componentId.value}`
)

async function saveChanges() {
  await $fetch(`/api/sites/${siteId.value}/components/${componentId.value}`, {
    method: "PUT",
    body: component.value
  })
  toast.success({
    description: "Your changes have been saved",
    duration: 3000
  })
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
          v-model.sanitize="component.name"
          placeholder="Technical name (e.g., page, header)"
          disabled
        />
      </DFormGroup>

      <!-- Display Name Field -->
      <DFormGroup>
        <DFormLabel required>Display Name</DFormLabel>
        <DInput
          v-model="component.displayName"
          placeholder="Human-readable name (e.g., Page, Header)"
        />
      </DFormGroup>

      <!-- Preview Image Field -->
      <!-- TODO: ADD image selector -->

      <!-- Preview Field -->
      <DFormGroup v-if="component.fields.length > 0">
        <DFormLabel>Preview Field</DFormLabel>
        <DSelect
          v-model="component.previewField"
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
