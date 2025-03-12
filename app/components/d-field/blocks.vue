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
  (e: "delete-block", id: string): void
}>()

const siteId = useRouteParams("siteId")

const { data: availableComponents } = await useFetch<DComponent[]>(
  `/api/sites/${siteId.value}/components`
)

const filteredComponents = computed(() => {
  if (!availableComponents.value) return []
  if (Array.isArray(field.componentWhitelist) && field.componentWhitelist.length > 0) {
    const componentWhitelist: string[] = field.componentWhitelist
    return availableComponents.value.filter((component) =>
      componentWhitelist.includes(component.name)
    )
  } else {
    return availableComponents.value
  }
})

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
    newRank = LexoRank.parse(lastBlock!.order).genNext() // Use genNext for new blocks
  }
  const newBlock = {
    id: uuidv7(),
    componentId: componentId,
    componentFieldKey: component.fieldKey,
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

// --- NEW FUNCTION ---
function recalculateBlockOrders() {
  const blocks = [...sortedBlocks.value]
  let currentRank = LexoRank.middle()

  for (const block of blocks) {
    block.order = currentRank.toString() // Modify directly, no API call needed
    currentRank = currentRank.genNext()
  }

  // IMPORTANT: Emit the updated blocks *after* recalculation.
  const newValue = value.map((block: any) => {
    const updatedBlock = blocks.find((b) => b.id === block.id)
    return updatedBlock ? { ...block, order: updatedBlock.order } : block // Return updated block, keep the other props.
  })

  emit("update:value", newValue)
}

async function initSortable() {
  if (!blocksContainer.value || !Array.isArray(sortedBlocks.value)) {
    return
  }
  await nextTick()

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

        // --- COLLISION CHECK ---
        if (prevRank.toString() === nextRank.toString()) {
          console.error("Ranks are equal, regenerating order (blocks.vue)")
          recalculateBlockOrders()
          return // Stop further processing
        }

        newRank = prevRank.between(nextRank)
      }
      movedBlock.order = newRank.toString()

      const newValue = value.map((block: any) => {
        if (block.id === movedBlock.id) {
          return { ...block, order: movedBlock.order }
        }
        return block
      })
      emit("update:value", newValue)
    }
  })
}

// Watcher to update sortedBlocks and initialize/re-initialize Sortable
watch(
  [() => value, () => isMounted.value],
  ([newValue, mounted]) => {
    if (mounted) {
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
  { deep: true, immediate: true }
)

function updateNestedBlock(_index: number, updatedBlock: any) {
  if (!Array.isArray(value)) {
    console.error("Value is not an array in updateNestedBlock", value)
    return
  }
  const newBlocks = [...value]
  const oldBlockIndex = newBlocks.findIndex(
    (b) => b.id === updatedBlock.id && b.order === updatedBlock.order
  )
  if (oldBlockIndex === -1) {
    console.error("Could not find the block to update", updatedBlock, "in", newBlocks)
    return
  }

  newBlocks[oldBlockIndex] = updatedBlock // Replace the entire block.
  emit("update:value", newBlocks)
}

function deleteBlock(id: string) {
  emit("delete-block", id)
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
          :path="[...path, block.id]"
          class="border-neutral overflow-hidden border-b last:border-none"
          @update:value="updateNestedBlock(index, $event)"
          @delete-block="(id) => deleteBlock(id)"
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
            v-for="block in filteredComponents"
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
