<script setup lang="ts">
import { ChevronDownIcon, GripVertical, Trash2Icon } from "lucide-vue-next"
import type { DComponent } from "~/types/models"
import { computed, ref } from "vue"

const siteId = useRouteParams("siteId")

type Props = {
  block: DComponent | undefined
  blockContent: { id: string; content: { [key: string]: any }; order: string } // Include order
  path?: string[]
}

const { block, path = [], blockContent } = defineProps<Props>()

const isBlockOpen = ref(false)
const emit = defineEmits<{
  (e: "update:value", value: any): void
  (e: "delete-block", path: string[], index: number): void
}>()

function updateNestedBlockField(fieldKey: string, value: any) {
  if (!blockContent) return
  blockContent.content[fieldKey] = value

  emit("update:value", blockContent)
}

function deleteBlock() {
  // Emit the path *to the array*. No index needed!
  emit("delete-block", path, -1) // Pass -1 for consistency
}

defineSlots<{
  default(props: {}): any
  controls(props: {}): any
}>()
</script>

<template>
  <div>
    <div
      class="bg-neutral flex w-full flex-col"
      v-if="block"
    >
      <div class="flex w-full items-center gap-2 px-2 py-2">
        <!--  Controls Slot -->
        <slot name="controls" />

        <button
          class="flex flex-1 items-center gap-2 text-left"
          @click="isBlockOpen = !isBlockOpen"
        >
          <div class="grid size-7 place-items-center rounded-md">
            <ChevronDownIcon
              class="size-4"
              :class="[isBlockOpen ? 'rotate-180' : '']"
            />
          </div>
          <div class="text-copy text-neutral flex flex-1 items-baseline gap-2">
            <div>{{ block.displayName }}</div>
            <div class="text-neutral-subtle line-clamp-1">
              {{ blockContent.content[block.previewField] }}
            </div>
          </div>
        </button>
        <div class="hidden group-hover:flex">
          <DButton
            variant="secondary"
            size="sm"
            :icon-left="Trash2Icon"
            @click="deleteBlock"
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
            :path="[...path, 'content', blockContent.id]"
            :value="blockContent.content ? blockContent.content[field.fieldKey] : undefined"
            @update:value="updateNestedBlockField(field.fieldKey, $event)"
            @delete-block="(path, index) => $emit('delete-block', path, index)"
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
            :to="`/sites/${siteId}/components/${block.id}`"
          >
            Edit component
          </DButton>
        </DEmpty>
      </div>
    </div>
  </div>
</template>
