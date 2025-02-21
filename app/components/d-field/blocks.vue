<script setup lang="ts">
import { PlusIcon, GripVertical } from "lucide-vue-next"
import type { DField, DComponent } from "~/types/models"
import { LexoRank } from "lexorank"
import { nextTick, ref, watch, onMounted, onBeforeUnmount } from "vue" // Corrected imports
import Sortable from "sortablejs"
import { uuidv7 } from "uuidv7"

type Props = {
  field: DField
  path?: string[]
  value: any
}

const { field, path = [], value } = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:value", value: any): void
  (e: "delete-block", path: string[], index: number): void
}>()

const siteId = useRouteParams("siteId")

const { data: availableComponents } = await useFetch<DComponent[]>(
  `/api/sites/${siteId.value}/components`
)

const isAddModalOpen = ref(false)

function initializeBlockContent(component: DComponent): any {
  const content: any = {}
  for (const field of component.fields) {
    if (field.type === "blocks") {
      content[field.fieldKey] = []
    } else {
      content[field.fieldKey] = undefined
    }
  }
  return content
}

function addBlock(componentId: string) {
  isAddModalOpen.value = false

  const component = availableComponents.value?.find((c) => c.id === componentId)
  if (!component) {
    console.error("Component not found:", componentId)
    return
  }

  const currentBlocks = Array.isArray(value) ? [...value] : []
  let newRank: LexoRank
  if (currentBlocks.length === 0) {
    newRank = LexoRank.middle()
  } else {
    const lastBlock = currentBlocks.at(-1)
    newRank = LexoRank.parse(lastBlock!.order)
  }
  const newBlock = {
    id: uuidv7(),
    componentId: componentId,
    content: initializeBlockContent(component),
    order: newRank.toString()
  }
  currentBlocks.push(newBlock)
  emit("update:value", currentBlocks)
}

function getBlock(blockId: string) {
  return availableComponents.value?.find((block) => block.id === blockId)
}

const blocksContainer = ref<HTMLElement | null>(null)
const sortedBlocks = ref<any[]>([])
const sortableInstance = ref<Sortable | null>(null)
const isMounted = ref(false)

async function initSortable() {
  if (!blocksContainer.value || !Array.isArray(sortedBlocks.value)) {
    return // Early return if container or array is not ready
  }
  await nextTick() // Ensure DOM is updated

  if (sortableInstance.value) {
    sortableInstance.value.destroy()
  }

  sortableInstance.value = new Sortable(blocksContainer.value, {
    handle: ".drag-handle",
    animation: 200,
    onUpdate: (evt: any) => {
      const [movedBlock] = sortedBlocks.value.splice(evt.oldIndex, 1)
      sortedBlocks.value.splice(evt.newIndex, 0, movedBlock)

      let newRank: LexoRank
      if (evt.newIndex === 0) {
        newRank = LexoRank.parse(sortedBlocks.value[1].order).genPrev()
      } else if (evt.newIndex === sortedBlocks.value.length - 1) {
        newRank = LexoRank.parse(sortedBlocks.value[evt.newIndex - 1].order).genNext()
      } else {
        const prevRank = LexoRank.parse(sortedBlocks.value[evt.newIndex - 1].order)
        const nextRank = LexoRank.parse(sortedBlocks.value[evt.newIndex + 1].order)
        newRank = prevRank.between(nextRank)
      }
      movedBlock.order = newRank.toString()

      const newValue = sortedBlocks.value.map((block) => {
        const originalBlock = value.find((b: any) => b.id === block.id && b.order === block.order)
        return originalBlock ? { ...originalBlock, order: block.order } : block
      })
      emit("update:value", newValue)
    }
  })
}
// Watcher to update sortedBlocks and initialize/re-initialize Sortable
watch(
  [() => value, () => isMounted.value], // Watch both value and isMounted
  ([newValue, mounted]) => {
    if (mounted) {
      // Only proceed if mounted
      if (Array.isArray(newValue)) {
        sortedBlocks.value = [...newValue].sort((a: { order: string }, b: { order: string }) =>
          a.order.localeCompare(b.order)
        )
      } else {
        sortedBlocks.value = []
      }
      initSortable()
    }
  },
  { deep: true, immediate: true } // Still use immediate: true
)

function updateNestedBlock(index: number, updatedBlock: any) {
  if (!Array.isArray(value)) {
    console.error("Value is not an array in updateNestedBlock", value)
    return
  }
  const newBlocks = [...value]
  const oldBlockIndex = newBlocks.findIndex((b) => b.order === updatedBlock.order)
  if (oldBlockIndex === -1) {
    console.error("Could not find the block to update", updatedBlock, "in", newBlocks)
    return
  }

  newBlocks[oldBlockIndex] = updatedBlock
  emit("update:value", newBlocks)
}

function deleteBlock(path: string[], index: number) {
  emit("delete-block", path, index)
}

onMounted(() => {
  isMounted.value = true
})

onBeforeUnmount(() => {
  if (sortableInstance.value) {
    sortableInstance.value.destroy()
  }
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>

    <div class="border-neutral bg-neutral-subtle overflow-hidden rounded-lg border">
      <div
        class="overflow-hidden rounded-lg shadow-md"
        ref="blocksContainer"
      >
        <DFieldBlock
          v-for="(block, index) in sortedBlocks"
          :key="block.id + '-' + block.order"
          :block="getBlock(block.componentId)"
          :block-content="block"
          :path="[...path]"
          class="border-neutral overflow-hidden border-b last:border-none"
          @update:value="updateNestedBlock(index, $event)"
          @delete-block="(path, index) => deleteBlock(path, index)"
        >
          <template #controls>
            <DButton
              class="drag-handle"
              :icon-left="GripVertical"
              size="sm"
              variant="transparent"
            />
          </template>
        </DFieldBlock>
      </div>

      <div class="p-1">
        <DButton
          variant="transparent"
          size="sm"
          :icon-left="PlusIcon"
          @click="isAddModalOpen = true"
          class="w-full"
        >
          Add Block
        </DButton>
      </div>
    </div>

    <DModal
      :open="isAddModalOpen"
      title="Add Block"
      @close="isAddModalOpen = false"
    >
      <div class="flex flex-col gap-2 p-5">
        <DList>
          <DListItem
            v-for="block in availableComponents"
            :key="block.id"
            @click="addBlock(block.id)"
          >
            <div class="text-copy flex w-full items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-60">
                  {{ block?.displayName }}
                </div>
              </div>
            </div>
          </DListItem>
        </DList>
      </div>
    </DModal>
  </div>
</template>
<style>
.sortable-drag {
  border-radius: 8px;
  opacity: 1;
}

.sortable-ghost {
  opacity: 0;
}
</style>
