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
const model = defineModel<Option | Option[] | null>()
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
      class="bg-neutral border-neutral hover: focus:bg-neutral flex min-h-[2.25rem] w-full cursor-default items-center justify-between rounded-lg border px-2 py-1.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-300"
      :class="[
        props.disabled
          ? 'bg-neutral-subtle cursor-not-allowed opacity-50'
          : 'hover:border-neutral-strong/30'
      ]"
    >
      <div class="flex min-h-6 flex-1 flex-wrap items-center gap-1 overflow-hidden">
        <template v-if="props.multiple">
          <template v-if="Array.isArray(model) && model.length">
            <div
              v-for="item in model"
              :key="String(item.value)"
              class="bg-neutral-subtle flex items-center gap-1 rounded-lg py-1 pr-1 pl-2 text-xs"
            >
              <span>{{ item.display }}</span>
              <button
                type="button"
                @click.stop="model = model.filter((i) => i.value !== item.value)"
                class="hover:bg-neutral grid size-5 place-items-center rounded"
              >
                <XIcon class="size-3" />
              </button>
            </div>
          </template>
          <ComboboxInput
            :placeholder="Array.isArray(model) && model.length ? '' : props.placeholder"
            class="flex-1 resize-y border-0 bg-transparent px-0 text-sm outline-none placeholder:text-neutral-500"
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
      <div class="flex items-center gap-1">
        <ComboboxCancel
          v-if="
            (props.multiple && Array.isArray(model) && model.length) || (!props.multiple && model)
          "
          @click="handleClear"
          as-child
        >
          <DButton
            :icon-left="XIcon"
            variant="secondary"
            size="sm"
          ></DButton>
        </ComboboxCancel>
        <ComboboxTrigger>
          <DButton
            :icon-left="open ? ChevronUpIcon : ChevronDownIcon"
            variant="secondary"
            size="sm"
          ></DButton>
        </ComboboxTrigger>
      </div>
    </ComboboxAnchor>

    <ComboboxPortal>
      <ComboboxContent
        position="popper"
        side="bottom"
        align="start"
        class="border-neutral bg-neutral z-[9999] w-[var(--reka-combobox-trigger-width)] rounded-lg border shadow-sm"
        :side-offset="5"
      >
        <ComboboxViewport class="max-h-48 overflow-auto p-1">
          <ComboboxItem
            v-for="option in filteredOptions"
            :key="String(option.value)"
            :value="option"
            class="hover:bg-neutral-hover focus:bg-neutral-hover text-neutral flex cursor-default items-center justify-between rounded-md px-2.5 py-1.5 text-sm select-none focus:outline-0"
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
