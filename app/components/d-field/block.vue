<script setup lang="ts">
import { ChevronDownIcon, GripVertical, Trash2Icon } from "lucide-vue-next"
import { componentFields, components } from "~~/server/database/schema"

type Component = typeof components.$inferSelect

type Props = {
  block: Component | undefined
  blockContent: { id: string; content: { [key: string]: any } } // the content of the block
  index: number
  path?: string[]
}

const { block, index, path = [], blockContent } = defineProps<Props>()

const isBlockOpen = ref(false)
const emit = defineEmits<{
  (e: "update:value", value: any): void
  (e: "delete-block", index: number): void
}>()

// Correctly calculate blockPath
const blockPath = computed(() => [...path, "content"])

// Corrected update function
function updateNestedBlockField(fieldKey: string, value: any) {
  if (!blockContent) return

  const updatedContent = { ...blockContent.content, [fieldKey]: value }
  const updatedBlock = { ...blockContent, content: updatedContent }

  emit("update:value", updatedBlock)
}
</script>

<template>
  <div>
    <div
      class="bg-neutral flex w-full flex-col"
      v-if="block"
    >
      <div class="group flex w-full items-center gap-2 px-2 py-2">
        <DButton
          :icon-left="GripVertical"
          size="sm"
          variant="transparent"
        />
        <button
          class="flex flex-1 items-center gap-2 text-left"
          @click="isBlockOpen = !isBlockOpen"
        >
          <div
            class="group-hover:border-neutral grid size-7 place-items-center rounded-md group-hover:border"
          >
            <ChevronDownIcon
              class="size-4"
              :class="[isBlockOpen ? 'rotate-180' : '']"
            />
          </div>
          <div class="text-copy text-neutral flex-1">
            {{ block.displayName }}
          </div>
        </button>
        <div class="hidden group-hover:flex">
          <DButton
            variant="secondary"
            size="sm"
            :icon-left="Trash2Icon"
            @click="$emit('delete-block', index)"
          ></DButton>
        </div>
      </div>
      <div
        class="bg-neutral-subtle flex flex-col gap-2 p-2"
        v-show="isBlockOpen"
      >
        <template
          v-if="block.fields.length > 0"
          v-for="field in block.fields"
          :key="field.id"
        >
          <DField
            :field="field"
            :path="blockPath"
            :value="blockContent.content ? blockContent.content[field.fieldKey] : undefined"
            @update:value="updateNestedBlockField(field.fieldKey, $event)"
          />
        </template>
        <DEmpty
          v-else
          title="No fields available"
          description="Add fields to the component"
        >
          <DButton
            variant="secondary"
            size="sm"
            :to="`/sites/${$route.params.siteId}/components/${block.id}`"
          >
            Edit component
          </DButton>
        </DEmpty>
      </div>
    </div>
  </div>
</template>
