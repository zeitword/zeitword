<script setup lang="ts">
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxTrigger,
  ComboboxPortal,
  ComboboxContent,
  ComboboxViewport,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxCancel
} from "reka-ui"
import { ChevronDownIcon, ChevronUpIcon, CheckIcon, XIcon } from "lucide-vue-next"
import { ref, computed } from "vue"

interface Props {
  options: { value: string | number | boolean | null; display: string }[]
  placeholder?: string
  disabled?: boolean
  multiple?: boolean
}

interface Option {
  value: string | number | boolean | null
  display: string
}

const props = defineProps<Props>()
const model = defineModel<Option | Option[] | null>() // Explicit type
const open = ref(false)

const filteredOptions = computed(() => {
  const modelValue = model.value

  if (!props.multiple && modelValue && !Array.isArray(modelValue)) {
    return props.options.filter((option) => option.value !== modelValue.value)
  }

  return props.options
})

const isSelected = (option: Option) => {
  if (props.multiple) {
    return Array.isArray(model.value) && model.value.some((item) => item.value === option.value)
  } else {
    return model.value && !Array.isArray(model.value) && model.value.value === option.value
  }
}

const handleClear = (e: Event) => {
  e.stopPropagation()
  if (props.multiple) {
    model.value = []
  } else {
    model.value = null
  }
}
</script>

<template>
  <ComboboxRoot
    v-model="model"
    :multiple="props.multiple"
    :open="open"
    @update:open="open = $event"
    :disabled="props.disabled"
  >
    <ComboboxAnchor
      class="bg-neutral border-neutral hover: flex min-h-[2.25rem] w-full cursor-default items-center justify-between rounded-lg border text-sm outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-300"
      :class="[
        props.disabled
          ? 'cursor-not-allowed bg-neutral-100 opacity-50'
          : 'hover:border-neutral-strong/30'
      ]"
    >
      <div class="flex min-h-6 flex-1 flex-wrap items-center gap-1 overflow-hidden pl-2.5">
        <template v-if="props.multiple">
          <template v-if="Array.isArray(model) && model.length">
            <div
              v-for="item in model"
              :key="String(item.value)"
              class="flex items-center rounded bg-neutral-100 px-1 text-xs"
            >
              <span>{{ item.display }}</span>
              <button
                type="button"
                @click.stop="model = model.filter((i) => i.value !== item.value)"
                class="ml-1"
              >
                <XIcon class="size-3" />
              </button>
            </div>
          </template>
          <ComboboxInput
            :placeholder="Array.isArray(model) && model.length ? '' : props.placeholder"
            class="h-7 flex-1 resize-y border-0 bg-transparent px-0 py-1.5 text-sm outline-none placeholder:text-neutral-500"
          />
        </template>
        <template v-else>
          <ComboboxInput
            v-if="!model"
            :placeholder="props.placeholder"
            class="h-7 flex-1 border-0 bg-transparent px-0 py-1.5 text-sm outline-none placeholder:text-neutral-500"
          />
          <span
            v-else-if="!Array.isArray(model) && model"
            class="truncate py-1.5 text-sm"
          >
            {{ model.display }}
          </span>
        </template>
      </div>
      <div class="flex items-center pr-2.5">
        <ComboboxCancel
          v-if="
            (props.multiple && Array.isArray(model) && model.length) || (!props.multiple && model)
          "
          @click="handleClear"
        >
          <XIcon class="size-4 text-neutral-700" />
        </ComboboxCancel>
        <ComboboxTrigger>
          <ChevronDownIcon
            v-if="!open"
            class="size-4 text-neutral-700"
          />
          <ChevronUpIcon
            v-else
            class="size-4 text-neutral-700"
          />
        </ComboboxTrigger>
      </div>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        side="bottom"
        align="start"
        class="border-neutral z-[9999] w-[var(--reka-combobox-trigger-width)] rounded-lg border bg-white shadow-sm"
        :side-offset="5"
      >
        <ComboboxViewport class="max-h-48 overflow-auto p-1">
          <ComboboxItem
            v-for="option in filteredOptions"
            :key="String(option.value)"
            :value="option"
            class="hover:bg-neutral-hover focus:bg-neutral-hover flex cursor-default items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-neutral-900 select-none focus:outline-0"
          >
            <span>
              {{ option.display }}
            </span>
            <ComboboxItemIndicator v-if="isSelected(option)">
              <CheckIcon class="ml-2 size-4" />
            </ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxViewport>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
