<script setup lang="ts">
import { computed } from "vue"

import type { AssetConfig } from "~/types"
import type { DField, DComponent } from "~/types/models"

type Props = {
  field: DField
  path?: string[]
  components?: DComponent[]
  targetBlockId?: string | undefined
  value: any
  currentLanguage: string
  defaultLanguage: string
  defaultLanguageValue?: any
  // validation errors keyed "language:blockId1:blockId2:...:fieldKey"
  errors?: Record<string, string>
  // ids of the blocks this field is nested in (empty for top level fields)
  blockIds?: string[]
  // chain of block ids that should expand to reveal the targeted field
  expandPath?: string[]
  // validation key of the issue selected in the error navigator
  activeErrorKey?: string
}

const {
  field,
  path = [],
  value,
  currentLanguage,
  defaultLanguage,
  defaultLanguageValue,
  errors = {},
  blockIds = [],
  expandPath = [],
  activeErrorKey
} = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:value", value: any): void
  (e: "delete-block", id: string): void
}>()

const labelText = computed(() => field.displayName || field.fieldKey)

const ownErrorKey = computed(() => [currentLanguage, ...blockIds, field.fieldKey].join(":"))

const errorMessage = computed(() => errors[ownErrorKey.value])
const isTargeted = computed(() => activeErrorKey === ownErrorKey.value)
const fieldRef = ref<HTMLElement | null>(null)

watch(
  isTargeted,
  async (targeted) => {
    if (!targeted) return
    await nextTick()
    fieldRef.value?.scrollIntoView({ behavior: "smooth", block: "center" })
  },
  { immediate: true }
)

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

const optionChoices = computed(() =>
  (field.options || []).map((option) => ({
    display: option.optionName,
    value: option.optionValue
  }))
)

const multiOptionModel = computed({
  get: () => {
    const selected = Array.isArray(modelValue.value) ? modelValue.value : []
    return optionChoices.value.filter((option) => selected.includes(option.value))
  },
  set: (selected: { value: string }[] | null) => {
    const values = (selected || []).map((option) => option.value)
    modelValue.value =
      field.maxValue === null || field.maxValue === undefined
        ? values
        : values.slice(0, field.maxValue)
  }
})

function deleteBlock(id: string) {
  emit("delete-block", id)
}
</script>

<template>
  <div
    ref="fieldRef"
    class="scroll-m-4 rounded-lg transition-shadow"
    :class="isTargeted ? 'ring-danger ring-2 ring-offset-2' : ''"
    :data-validation-key="ownErrorKey"
  >
    <DFormGroup :error="errorMessage">
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
        :required="field.required"
        :minlength="field.minValue ?? undefined"
        :maxlength="field.maxValue ?? undefined"
      />
      <DTextarea
        v-else-if="field.type === 'textarea'"
        v-model="modelValue"
        :required="field.required"
        :minlength="field.minValue ?? undefined"
        :maxlength="field.maxValue ?? undefined"
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
        :errors="errors"
        :block-ids="blockIds"
        :expand-path="expandPath"
        :active-error-key="activeErrorKey"
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
        :required="field.required"
        :min="field.minValue ?? undefined"
        :max="field.maxValue ?? undefined"
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
        v-else-if="field.type === 'option'"
        v-model="modelValue"
        :options="optionChoices"
      />
      <DCombobox
        v-else-if="field.type === 'options'"
        v-model="multiOptionModel"
        :options="optionChoices"
        multiple
        placeholder="Select options"
      />

      <!-- Placeholder for unimplemented types -->
      <template v-else-if="['section', 'custom'].includes(field.type)">
        <div class="bg-warn rounded-md p-2">Not implemented yet: {{ field.type }}</div>
        <pre class="text-code">{{ value }}</pre>
      </template>
    </DFormGroup>
  </div>
</template>
