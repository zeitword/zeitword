<script setup lang="ts">
import type { DField, DComponent } from "~/types/models"

type Props = {
  field: DField
  path?: string[]
  components?: DComponent[]
  value: any
}

const { field, path = [], value } = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:value", value: any): void
  (e: "delete-block", path: string[], index: number): void
}>()

function deleteBlock(path: string[], index: number) {
  emit("delete-block", path, index)
}
</script>

<template>
  <DFormGroup v-if="field.type === 'text'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DInput
      :model-value="value"
      @update:modelValue="emit('update:value', $event)"
      :placeholder="field.displayName || field.fieldKey"
    />
  </DFormGroup>

  <DFormGroup v-else-if="field.type === 'textarea'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DTextarea
      :model-value="value"
      @update:modelValue="emit('update:value', $event)"
    />
  </DFormGroup>

  <DFieldBlocks
    v-else-if="field.type === 'blocks'"
    :field="field"
    :path="[...path, field.fieldKey]"
    :blocks="components"
    :value="value"
    @update:value="emit('update:value', $event)"
    @delete-block="(path, index) => deleteBlock(path, index)"
  />

  <div
    class="bg-warn text-copy text-warn-onsurface rounded-md p-4"
    v-else-if="field.type === 'asset'"
  >
    Image
    <pre>{{ value }}</pre>
  </div>

  <p class="text-copy-sm text-neutral-subtle">
    {{ field.description }}
  </p>
</template>
