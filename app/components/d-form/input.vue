<script setup lang="ts">
type Props = {
  name: string
  type?: "text" | "password" | "email" | "number" | "tel" | "date" | "datetime-local" | "url"
  required?: boolean
  placeholder?: string
  autocomplete?: string
  label?: string
  disabled?: boolean
  hideArrows?: boolean
  leading?: string
	leadingBackground?: boolean
  trailing?: string
	trailingBackground?: boolean
}

const {
  name,
  type = "text",
  required = false,
  placeholder = "",
  autocomplete = "",
  label = "",
  disabled = false,
  hideArrows,
  leading = "",
  trailing = "",
	leadingBackground = true,
	trailingBackground = true,
} = defineProps<Props>()

const model = defineModel<string | number>()
</script>

<template>
  <div
    class="border-neutral text-neutral text-copy flex overflow-hidden rounded-lg border leading-none shadow-sm transition-all outline-none has-[:focus]:border-blue-600 has-[:focus]:bg-white has-[:focus]:ring-2 has-[:focus]:ring-blue-300"
    :class="[disabled ? 'cursor-not-allowed bg-gray-100 opacity-50' : 'hover:border-neutral-strong/30']"
  >
    <div
      v-if="$slots.leading || leading"
      class="border-neutral border-r px-4 flex items-center"
			:class="leadingBackground ? 'bg-neutral-subtle' : ''"
    >
      <template v-if="leading">
        {{ leading }}
      </template>
      <template v-else>
        <slot name="leading"></slot>
      </template>
    </div>
    <input
      :id="name"
      :name="name"
      :type="type"
      :required="required"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :label="label"
      v-model="model"
      class="h-9 w-full px-2.5 text-copy texte-neutral outline-none"
      :class="[hideArrows ? 'hide-arrows' : '']"
    />

    <div
      v-if="$slots.trailing"
      class="border-neutral border-l px-3 flex items-center"
			:class="leadingBackground ? 'bg-neutral-subtle' : ''"
    >
      <template v-if="trailing">
        {{ trailing }}
      </template>
      <template v-else>
        <slot name="trailing"></slot>
      </template>
    </div>
  </div>
</template>
