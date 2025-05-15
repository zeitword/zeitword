<script setup lang="ts">
import type { DField, DComponent } from "~/types/models"
import type { AssetConfig } from "~/types"
import { computed } from "vue"

type Props = {
  field: DField
  path?: string[]
  components?: DComponent[]
  targetBlockId?: string | undefined
  value: any
  currentLanguage: string
  defaultLanguage: string
  defaultLanguageValue?: any
}

const {
  field,
  path = [],
  value,
  currentLanguage,
  defaultLanguage,
  defaultLanguageValue
} = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:value", value: any): void
  (e: "delete-block", id: string): void
}>()

const labelText = computed(() => field.displayName || field.fieldKey)

const modelValue = computed({
  get: () => {
    return value === undefined || value === null ? field.defaultValue : value
  },
  set: (newValue) => emit("update:value", newValue)
})

const showDefaultLanguageReference = computed(() => {
  return (
    currentLanguage !== defaultLanguage &&
    defaultLanguageValue !== undefined &&
    ["text", "textarea", "richtext"].includes(field.type)
  )
})

function deleteBlock(id: string) {
  emit("delete-block", id)
}
</script>

<template>
  <DFormGroup>
    <DFormLabel :required="field.required">
      {{ labelText }}
    </DFormLabel>

    <p
      v-if="field.description"
      class="text-copy-sm text-neutral-subtle mb-1"
    >
      {{ field.description }}
    </p>

    <p
      v-if="showDefaultLanguageReference"
      class="text-copy-sm text-neutral-subtle mb-1 italic"
    >
      {{ defaultLanguageValue }}
    </p>

    <DInput
      v-if="field.type === 'text'"
      v-model="modelValue"
      :placeholder="labelText"
    />
    <DTextarea
      v-else-if="field.type === 'textarea'"
      v-model="modelValue"
      :required="field.required"
    />
    <DRichText
      v-else-if="field.type === 'richtext'"
      v-model="modelValue"
    />
    <DFieldBlocks
      v-else-if="field.type === 'blocks'"
      :field="field"
      :path="path"
      :value="value"
      :target-block-id="targetBlockId"
      :current-language="currentLanguage"
      :default-language="defaultLanguage"
      :default-language-value="defaultLanguageValue"
      @update:value="modelValue = $event"
      @delete-block="deleteBlock"
    />
    <DAsset
      v-else-if="field.type === 'asset'"
      :value="value"
      :config="field.config as AssetConfig"
      @update:value="modelValue = $event"
    />
    <DFieldAssets
      v-else-if="field.type === 'assets'"
      :field="field"
      :path="path"
      :value="value"
      @update:value="modelValue = $event"
    />
    <DFieldLink
      v-else-if="field.type === 'link'"
      v-model="modelValue"
      :site-id="$route.params.siteId as string"
      placeholder="Enter link URL or search for a page"
    />
    <DInput
      v-else-if="field.type === 'number'"
      v-model="modelValue"
      type="number"
    />
    <DInput
      v-else-if="field.type === 'datetime'"
      v-model="modelValue"
      type="datetime-local"
    />
    <DFormSwitch
      v-else-if="field.type === 'boolean'"
      v-model="modelValue"
    />
    <DSelect
      v-else-if="field.type === 'option' || field.type === 'options'"
      v-model="modelValue"
      :options="field.options?.map((o) => ({ display: o.optionName, value: o.optionValue })) || []"
    />

    <!-- Placeholder for unimplemented types -->
    <template v-else-if="['section', 'custom'].includes(field.type)">
      <div class="bg-warn rounded-md p-2">Not implemented yet: {{ field.type }}</div>
      <pre class="text-code">{{ value }}</pre>
    </template>
  </DFormGroup>
</template>
