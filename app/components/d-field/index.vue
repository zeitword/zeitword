<script setup lang="ts">
import { componentFields, components } from "~~/server/database/schema"

type Field = typeof componentFields.$inferSelect
type Component = typeof components.$inferSelect

type Props = { field: Field; path?: string[]; components?: Component[] }

const { field, path = [] } = defineProps<Props>()

const storyStore = useStoryStore()

const currentValue = computed(() => {
  return storyStore.getNestedValue([...path, field.fieldKey])
})

function updateValue(value: any) {
  storyStore.updateNestedField([...path, field.fieldKey], value)
}
</script>

<template>
  <DFormGroup v-if="field.type === 'text'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DInput
      :model-value="currentValue"
      @input="updateValue($event.target.value)"
      :placeholder="field.displayName || field.fieldKey"
    />
  </DFormGroup>

  <DFormGroup v-else-if="field.type === 'textarea'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DTextarea
      :model-value="currentValue"
      @input="updateValue(($event.target as HTMLTextAreaElement).value)"
    />
  </DFormGroup>

  <DFieldBlocks
    v-else-if="field.type === 'blocks'"
    :field="field"
    :path="path"
    :blocks="components"
  />

  <div
    class="bg-warn text-copy text-warn-onsurface rounded-md p-4"
    v-else-if="field.type === 'asset'"
  >
    Image
    <pre>{{ currentValue }}</pre>
  </div>
</template>
