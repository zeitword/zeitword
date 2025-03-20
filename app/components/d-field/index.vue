<script setup lang="ts">
import type { DField, DComponent } from "~/types/models"

type Props = {
  field: DField
  path?: string[]
  components?: DComponent[]
  targetBlockId?: string | undefined
  value: any
}

const { field, path = [], value } = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:value", value: any): void
  (e: "delete-block", id: string): void // Expect full path
}>()

function deleteBlock(id: string) {
  console.log("index.vue")
  console.log(id)
  emit("delete-block", id)
}

const { files, open, reset, onCancel, onChange } = useFileDialog({
  // accept: 'image/*', // Set to accept only image files
  directory: false // Select directories instead of files if set true
})

onChange(async (selectedFiles) => {
  if (!selectedFiles) return

  const file = selectedFiles[0]

  if (file) {
    const formData = new FormData()
    formData.append("file", file)
    const fileId = await $fetch("/api/assets", {
      method: "POST",
      body: formData
    })
    emit("update:value", fileId)
  }
})

function openFileSelector() {
  open()
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
      :required="field.required"
      @update:modelValue="emit('update:value', $event)"
    />
  </DFormGroup>

  <DFormGroup v-else-if="field.type === 'richtext'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DRichText
      :model-value="value"
      @update:modelValue="emit('update:value', $event)"
    />
  </DFormGroup>

  <DFieldBlocks
    v-else-if="field.type === 'blocks'"
    :field="field"
    :path="path"
    :blocks="components"
    :value="value"
    :target-block-id="targetBlockId"
    @update:value="emit('update:value', $event)"
    @delete-block="(id) => deleteBlock(id)"
  />

  <DFormGroup v-else-if="field.type === 'asset'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <div v-if="value">
      <img
        v-if="typeof value === 'string'"
        :src="value"
        alt="Asset"
        class="h-auto max-w-full"
      />
      <pre
        v-else
        class="text-code"
        >{{ value }}</pre
      >
    </div>
    <DButton @click="openFileSelector">Select Asset</DButton>
  </DFormGroup>

  <DFormGroup v-else-if="field.type === 'assets'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <!-- Basic multiple assets display (replace with your assets component) -->
    <div v-if="Array.isArray(value) && value.length > 0">
      <div
        v-for="(asset, index) in value"
        :key="index"
        class="mb-2"
      >
        <img
          v-if="typeof asset === 'string'"
          :src="asset"
          alt="Asset"
          class="h-auto max-w-full"
        />
        <pre
          v-else
          class="text-code"
          >{{ asset }}</pre
        >
      </div>
    </div>
    <DButton
      @click="
        $emit('update:value', ['https://placehold.co/600x400/', 'https://placehold.co/600x400/'])
      "
    >
      Select Assets (Placeholder)
    </DButton>
  </DFormGroup>

  <DFormGroup v-else-if="field.type === 'link'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DInput
      :model-value="value"
      @update:modelValue="emit('update:value', $event)"
      placeholder="Enter link URL"
    />
    <!-- You might want a more sophisticated link component here -->
  </DFormGroup>

  <DFormGroup v-else-if="field.type === 'number'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DInput
      type="number"
      :model-value="value"
      @update:modelValue="emit('update:value', $event)"
    />
  </DFormGroup>

  <DFormGroup v-else-if="field.type === 'datetime'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DInput
      type="datetime-local"
      :model-value="value"
      @update:modelValue="emit('update:value', $event)"
    />
  </DFormGroup>

  <DFormGroup v-else-if="field.type === 'boolean'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DFormSwitch
      :model-value="value"
      @update:modelValue="emit('update:value', $event)"
    />
  </DFormGroup>

  <DFormGroup v-else-if="field.type === 'option' || field.type === 'options'">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <DSelect
      :model-value="value"
      @update:modelValue="emit('update:value', $event)"
      :options="
        field.options
          ? field.options.map((option) => ({
              display: option.optionName,
              value: option.optionValue
            }))
          : []
      "
    />
  </DFormGroup>

  <!--  Placeholder for other types -->
  <template v-else-if="['section', 'custom'].includes(field.type)">
    <DFormGroup>
      <DFormLabel :required="field.required">
        {{ field.displayName || field.fieldKey }} ({{ field.type }})
      </DFormLabel>
      <div class="bg-warn rounded-md p-2">Not implemented yet: {{ field.type }}</div>
      <pre class="text-code">{{ value }}</pre>
    </DFormGroup>
  </template>

  <p class="text-copy-sm text-neutral-subtle">
    {{ field.description }}
  </p>
</template>
