<script setup lang="ts">
import { PlusIcon } from "lucide-vue-next"
import type { DField, DComponent } from "~/types/models"
import { computed } from "vue"

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

// --- Lexical Order Functions ---

function generateNextOrder(prevOrder: string | undefined, nextOrder: string | undefined): string {
  if (!prevOrder && !nextOrder) {
    return "A" // First element
  }
  if (!prevOrder) {
    // Insert at the beginning. Prepend " "
    return " " + nextOrder
  }
  if (!nextOrder) {
    // Insert at the end. Append "A"
    return prevOrder + "A"
  }
  // Insert in the middle.
  return insertBetween(prevOrder, nextOrder)
}

function insertBetween(a: string, b: string): string {
  // Pad the shorter string with spaces (smallest possible character)
  let maxLength = Math.max(a.length, b.length)
  a = a.padEnd(maxLength, " ")
  b = b.padEnd(maxLength, " ")

  let result = ""
  for (let i = 0; i < maxLength; i++) {
    if (a[i] === b[i]) {
      result += a[i]
    } else {
      const charCodeA = a.charCodeAt(i)
      const charCodeB = b.charCodeAt(i)

      if (charCodeB - charCodeA === 1) {
        // Adjacent characters
        result += a[i] + "A" // Append 'A' to the first
        return result
      } else {
        const newCharCode = Math.floor((charCodeA + charCodeB) / 2)
        result += String.fromCharCode(newCharCode) // Middle character
        return result
      }
    }
  }
  return result + "A" // Should not be reachable, but add as failsafe.
}

// --- Block Management Functions ---

// Helper function to get the next letter in sequence (A, B, C, ... Z, AA, AB...)
function getNextLetter(order: string | undefined): string {
  if (!order) {
    return "A"
  }
  if (order === "Z") {
    return "AA"
  }

  let lastChar = order.slice(-1)
  let prefix = order.slice(0, -1)

  if (lastChar === "Z" && prefix.length > 0) {
    return getNextLetter(prefix) + "A" // carry over to next char
  } else if (lastChar === "Z") {
    return "AA"
  } else {
    return prefix + String.fromCharCode(lastChar.charCodeAt(0) + 1)
  }
}

function addBlock(componentId: string) {
  isAddModalOpen.value = false

  const component = availableComponents.value?.find((c) => c.id === componentId)
  if (!component) {
    console.error("Component not found:", componentId)
    return
  }

  const currentBlocks = Array.isArray(value) ? [...value] : []

  // Use getNextLetter for the initial sequence
  let newOrder = getNextLetter(currentBlocks.at(-1)?.order)

  const newBlock = {
    id: componentId,
    content: initializeBlockContent(component),
    order: newOrder
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

  // Determine the orders before and after the new position
  const prevOrder = updatedBlocks[newIndex - 1]?.order
  const nextOrder = updatedBlocks[newIndex]?.order

  // Generate the new order for the moved block
  movedBlock.order = generateNextOrder(prevOrder, nextOrder)

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
