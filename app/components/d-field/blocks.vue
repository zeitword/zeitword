<script setup lang="ts">
import { PlusIcon } from "lucide-vue-next"
import type { DField, DComponent } from "~/types/models"
import { computed, ref } from "vue"
import { LexoRank } from "lexorank"

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

// --- Block Management Functions ---
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
    newRank = LexoRank.middle() //Initial rank
  } else {
    const lastBlock = currentBlocks.at(-1)
    const lastRank = LexoRank.parse(lastBlock.order)
    newRank = lastRank.genNext()
  }

  const newBlock = {
    id: componentId,
    content: initializeBlockContent(component),
    order: newRank.toString()
  }

  currentBlocks.push(newBlock)
  emit("update:value", currentBlocks)
}

function getBlock(blockId: string) {
  return availableComponents.value?.find((block) => block.id === blockId)
}

const sortedBlocks = computed(() => {
  if (!Array.isArray(value)) {
    return []
  }
  return [...value].sort((a, b) => a.order.localeCompare(b.order))
})

function updateBlockOrder(blocks: any[], currentIndex: number, newIndex: number) {
  if (
    !Array.isArray(blocks) ||
    currentIndex < 0 ||
    currentIndex >= blocks.length ||
    newIndex < 0 ||
    newIndex >= blocks.length
  ) {
    console.error("Invalid indices or not an array in updateBlockOrder")
    return
  }

  if (currentIndex === newIndex) return

  const updatedBlocks = [...blocks]
  const [movedBlock] = updatedBlocks.splice(currentIndex, 1)

  let newRank: LexoRank

  if (newIndex === 0) {
    // Moving to the beginning
    newRank = LexoRank.parse(updatedBlocks[0].order).genPrev()
  } else if (newIndex === updatedBlocks.length) {
    // Moving to the end
    newRank = LexoRank.parse(updatedBlocks[updatedBlocks.length - 1].order).genNext()
  } else {
    // Moving between two blocks
    const prevRank = LexoRank.parse(updatedBlocks[newIndex - 1].order)
    const nextRank = LexoRank.parse(updatedBlocks[newIndex].order)
    newRank = prevRank.between(nextRank)
  }

  movedBlock.order = newRank.toString()

  // Insert the block back into the array at the new position
  updatedBlocks.splice(newIndex, 0, movedBlock)

  // Re-emit the updated blocks array
  emit("update:value", updatedBlocks)
}

function moveBlockUp(index: number) {
  updateBlockOrder(value, index, index - 1)
}

function moveBlockDown(index: number) {
  updateBlockOrder(value, index, index + 1)
}

function updateNestedBlock(index: number, updatedBlock: any) {
  if (!Array.isArray(value)) {
    console.error("Value is not an array in updateNestedBlock", value)
    return
  }
  const newBlocks = [...value]
  const oldBlockIndex = newBlocks.findIndex((b) => b.order === updatedBlock.order)

  newBlocks[oldBlockIndex] = updatedBlock
  emit("update:value", newBlocks)
}

function deleteBlock(path: string[], index: number) {
  emit("delete-block", path, index)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <DFormLabel :required="field.required">
      {{ field.displayName || field.fieldKey }}
    </DFormLabel>
    <div class="border-neutral bg-neutral-subtle overflow-hidden rounded-lg border">
      <div
        v-if="value"
        class="overflow-hidden rounded-lg shadow-md"
      >
        <DFieldBlock
          v-for="(block, index) in sortedBlocks"
          :key="block.id + '-' + block.order"
          :block="getBlock(block.id)"
          :block-content="block"
          :path="[...path]"
          class="border-neutral overflow-hidden border-b last:border-none"
          @update:value="updateNestedBlock(index, $event)"
          @delete-block="(path, index) => deleteBlock(path, index)"
        >
          <template #controls>
            <DButton
              v-if="index > 0"
              variant="transparent"
              size="xs"
              @click.stop="moveBlockUp(index)"
            >
              Up
            </DButton>
            <DButton
              v-if="index < value.length - 1"
              variant="transparent"
              size="xs"
              @click.stop="moveBlockDown(index)"
            >
              Down
            </DButton>
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
