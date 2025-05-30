<script setup lang="ts">
import type { AssetConfig, RichTextConfig } from "~/types"
import { ArrowLeftIcon, PlusIcon, Trash2Icon, GripVerticalIcon } from "lucide-vue-next"
import { useSortable } from "@vueuse/integrations/useSortable"
import { uuidv7 } from "uuidv7"

const siteId = useRouteParams("siteId")
const componentId = useRouteParams("componentId")
const fieldKey = useRouteParams("fieldKey")

type Config = AssetConfig | RichTextConfig | null

type FormData = {
  fieldKey: string
  fieldType: string
  required: boolean
  description: string
  displayName: string
  defaultValue: string
  minValue: number | null
  maxValue: number | null
  options?: {
    id: string
    optionName: string
    optionValue: string
  }[]
  componentWhitelist?: string[]
  config: Config
}

const formData = ref<FormData>({
  fieldKey: "",
  fieldType: "text",
  required: false,
  description: "",
  displayName: "",
  defaultValue: "",
  minValue: 0,
  maxValue: 0,
  options: [],
  componentWhitelist: [],
  config: null
})

const optionsList = shallowRef<FormData["options"]>([])

const fieldTypeOptions = computed(() => {
  return fieldTypes.map((fieldType) => ({
    display: fieldType.charAt(0).toUpperCase() + fieldType.slice(1),
    value: fieldType
  }))
})

const { data: field, refresh } = await useFetch(
  `/api/sites/${siteId.value}/components/${componentId.value}/fields/${fieldKey.value}`
)

const { data: components } = await useFetch(`/api/sites/${siteId.value}/components`)

//TODO: don't use watch me no likey
watch(
  field,
  (newField) => {
    if (newField) {
      const newOptions = (newField.options || []).map((option) => ({
        id: option.id || uuidv7(),
        optionName: option.optionName,
        optionValue: option.optionValue
      }))

      formData.value = {
        fieldKey: newField.fieldKey,
        fieldType: newField.type || "text",
        required: newField.required,
        description: newField.description || "",
        displayName: newField.displayName || "",
        defaultValue: newField.defaultValue || "",
        minValue: newField.minValue,
        maxValue: newField.maxValue,
        options: newOptions,
        componentWhitelist: newField.componentWhitelist || [],
        config: newField.config || null
      }
      optionsList.value = [...newOptions]
    }
  },
  { immediate: true }
)

watch(
  optionsList,
  (newOptions) => {
    formData.value.options = [...newOptions]
  },
  { deep: true }
)

const { toast } = useToast()

function addOption() {
  optionsList.value = [
    ...optionsList.value,
    {
      id: uuidv7(),
      optionName: "",
      optionValue: ""
    }
  ]
}

function removeOption(index: number) {
  optionsList.value = [...optionsList.value.slice(0, index), ...optionsList.value.slice(index + 1)]
}

const optionsContainer = ref<HTMLElement | null>(null)

const { option } = useSortable(optionsContainer, optionsList, {
  handle: ".drag-handle",
  animation: 150,
  onEnd: () => {
    nextTick(() => {})
  }
})

const selectedAssetTypes = computed({
  get: () => {
    const config = formData.value.config as AssetConfig
    if (!config?.assetTypes) return []
    return config.assetTypes
  },
  set: (newVal) => {
    formData.value.config = {
      assetTypes: newVal
    }
  }
})

const assetTypes = ref([
  { value: "image", display: "Image" },
  { value: "video", display: "Video" },
  { value: "audio", display: "Audio" },
  { value: "pdf", display: "PDF" },
  { value: "other", display: "Other" }
])

const selectedComponentIds = computed({
  get: () => {
    if (!components.value) return []
    return components.value
      .filter((component: any) => formData.value.componentWhitelist?.includes(component.name))
      .map((component: any) => ({
        value: component.name,
        display: component.displayName
      }))
  },
  set: (newVal) => {
    formData.value.componentWhitelist = newVal.map((option: any) => option.value)
  }
})

const componentOptions = computed(() => {
  if (!components?.value) return []
  return components.value.map((component: any) => ({
    value: component.name,
    display: component.displayName
  }))
})

async function save() {
  try {
    console.log(formData.value.componentWhitelist)
    await $fetch(
      `/api/sites/${siteId.value}/components/${componentId.value}/fields/${fieldKey.value}`,
      {
        method: "PUT",
        body: {
          ...formData.value
        }
      }
    )
    refresh()
    toast.success({ description: "Field saved successfully" })
  } catch (error) {
    console.error("Error saving field:", error)
    toast.error({ description: "Error saving field" })
  }
}

const isDeleteModalOpen = ref(false)

function openDeleteModal() {
  isDeleteModalOpen.value = true
}

function closeDeleteModal() {
  isDeleteModalOpen.value = false
}

async function deleteField() {
  try {
    await $fetch(
      `/api/sites/${siteId.value}/components/${componentId.value}/fields/${fieldKey.value}`,
      {
        method: "DELETE"
      }
    )
    refresh()
    toast.success({ description: "Field deleted successfully" })
    closeDeleteModal()
    navigateTo(`/sites/${siteId.value}/components/${componentId.value}`)
  } catch (error) {
    console.error("Error deleting field:", error)
    toast.error({ description: "Error deleting field" })
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
          <DFormSwitch
            id="required"
            name="required"
            v-model="formData.required"
          />
        </DFormGroup>
        <DFormGroup>
          <DFormLabel name="description">Description</DFormLabel>
          <DTextarea v-model="formData.description"></DTextarea>
        </DFormGroup>
        <DFormGroup>
          <DFormLabel name="display-name">Display Name</DFormLabel>
          <DInput
            id="display-name"
            name="display-name"
            v-model="formData.displayName"
          />
        </DFormGroup>

        <!-- specific fields for "blocks" -->
        <template v-if="formData.fieldType === 'blocks'">
          <DFormGroup>
            <DFormLabel name="display-name">Allowed Components</DFormLabel>
            <DCombobox
              v-model="selectedComponentIds"
              :options="componentOptions"
              multiple
              placeholder="Select a component"
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

        <template v-if="formData.fieldType === 'textarea'">
          <DFormGroup>
            <DFormLabel name="default-value">Default Value</DFormLabel>
            <DTextarea
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

        <!-- specific fields for "boolean" -->
        <template v-if="formData.fieldType === 'boolean'">
          <DFormGroup>
            <DFormLabel name="default-value">Default Value</DFormLabel>
            <DFormSwitch
              id="default-value"
              name="default-value"
              v-model="formData.defaultValue"
            />
          </DFormGroup>
        </template>

        <!-- specific fields for "asset(s)" -->
        <template v-if="formData.fieldType === 'asset' || formData.fieldType === 'assets'">
          <DFormGroup>
            <DFormLabel name="asset-types">Allowed Asset-Types</DFormLabel>
            <DCombobox
              id="asset-types"
              name="asset-types"
              multiple
              v-model="selectedAssetTypes"
              :options="assetTypes"
            />
          </DFormGroup>
        </template>

        <!-- Options and Options -->
        <template v-if="formData.fieldType === 'option' || formData.fieldType === 'options'">
          <DFormGroup>
            <DFormLabel name="default-value">Default Value</DFormLabel>
            <!-- TODO: Implement select here ? (reactivity broken) -->
            <!-- <DSelect
              v-model="formData.defaultValue"
              :options="
                optionsList
                  .map((option) => ({
                    display: option.optionName,
                    value: option.optionValue
                  }))
                  .filter((option) => option.value !== '')
              "
            /> -->
            <DInput
              id="default-value"
              name="default-value"
              v-model="formData.defaultValue"
            />
          </DFormGroup>

          <DFormGroup>
            <DFormLabel>Options</DFormLabel>
            <!-- Container for useSortable -->
            <div
              ref="optionsContainer"
              class="flex flex-col gap-2"
            >
              <div
                v-for="(option, index) in optionsList"
                :key="option.id"
                class="border-neutral bg-neutral flex items-center gap-2 rounded-md border p-2"
              >
                <div class="drag-handle text-neutral cursor-grab active:cursor-grabbing">
                  <GripVerticalIcon class="size-4" />
                </div>
                <DInput
                  placeholder="Option Name"
                  v-model="option.optionName"
                  class="flex-1"
                />
                <DInput
                  placeholder="Option Value"
                  v-model="option.optionValue"
                  class="flex-1"
                />

                <DButton
                  variant="transparent"
                  @click="removeOption(index)"
                  :icon-left="Trash2Icon"
                />
              </div>
            </div>

            <DButton
              variant="secondary"
              @click="addOption"
              :icon-left="PlusIcon"
            >
              Add Option
            </DButton>
          </DFormGroup>
        </template>

        <div class="flex justify-end gap-2">
          <DButton
            variant="danger"
            @click="openDeleteModal"
          >
            Delete
          </DButton>
          <DButton type="submit">Save</DButton>
        </div>
      </form>
    </div>
  </div>

  <DModal
    :open="isDeleteModalOpen"
    title="Delete Field"
    description="All content with this field will be deleted"
    confirm-text="Delete Field"
    danger
    @confirm="deleteField"
    @close="isDeleteModalOpen = false"
  ></DModal>
</template>

<style scoped>
.drag-handle {
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}
</style>
