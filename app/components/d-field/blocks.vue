<script setup lang="ts">
import { PlusIcon, GripVertical } from "lucide-vue-next"
import type { DField, DComponent } from "~/types/models"
import { LexoRank } from "lexorank"
import Sortable from "sortablejs"
import { uuidv7 } from "uuidv7"

type Props = {
  field: DField
  path?: string[]
  value: any
  targetBlockId: string | undefined
}

const { field, path = [], value, targetBlockId } = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:value", value: any): void
  (e: "delete-block", id: string): void
}>()

const siteId = useRouteParams("siteId")

const { data: availableComponents } = await useFetch<DComponent[]>(
  `/api/sites/${siteId.value}/components`
)

// Component Search
const searchTerm = ref("")

const filteredComponents = computed(() => {
  // Assume availableComponents.value is always an array or undefined/null
  let components = availableComponents.value || []

  // 1. Apply whitelist filter if present
  if (Array.isArray(field?.componentWhitelist) && field.componentWhitelist.length > 0) {
    const whitelist = field.componentWhitelist
    // Assume 'components' is an array here
    components = components.filter(
      (component) => component?.name && whitelist.includes(component.name)
    )
  }

  // 2. Apply search term filter if present
  if (searchTerm.value) {
    const lowerSearch = searchTerm.value.toLowerCase()
    // Assume 'components' is an array here
    components = components.filter(
      (component) =>
        (component?.displayName?.toLowerCase() || "").includes(lowerSearch) ||
        (component?.name?.toLowerCase() || "").includes(lowerSearch)
    )
  }

  return components
})

const isAddModalOpen = ref(false)
const isDeleteModalOpen = ref(false)
const selectedBlockId = ref<string | null>(null)

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
  closeAddModal()

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
    newRank = LexoRank.parse(lastBlock!.order).genNext()
  }
  const newBlock = {
    id: uuidv7(),
    componentId: componentId,
    componentFieldKey: component.name,
    content: initializeBlockContent(component),
    order: newRank.toString()
  }
  console.log(newBlock, component)
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

function recalculateBlockOrders() {
  const blocks = [...sortedBlocks.value]
  let currentRank = LexoRank.middle()

  for (const block of blocks) {
    block.order = currentRank.toString()
    currentRank = currentRank.genNext()
  }

  const newValue = value.map((block: any) => {
    const updatedBlock = blocks.find((b) => b.id === block.id)
    return updatedBlock ? { ...block, order: updatedBlock.order } : block
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
          return
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
  async ([newValue, mounted]) => {
    if (mounted) {
      if (Array.isArray(newValue)) {
        sortedBlocks.value = [...newValue].sort((a: { order: string }, b: { order: string }) =>
          a.order.localeCompare(b.order)
        )
        await nextTick()
        initSortable()
      } else {
        sortedBlocks.value = []
      }
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
  console.log(id)
  emit("delete-block", id)
}

function openDeleteModal(id: string) {
  selectedBlockId.value = id
  isDeleteModalOpen.value = true
}

onMounted(() => {
  isMounted.value = true
})

onBeforeUnmount(() => {
  if (sortableInstance.value) {
    sortableInstance.value.destroy()
  }
})

const isMaxReached = computed(() => {
  if (!field.maxValue) return false
  return sortedBlocks.value.length >= field.maxValue
})

const searchInput = ref<HTMLInputElement | null>(null)
async function openAddModal() {
  isAddModalOpen.value = true
  await nextTick(() => {
    searchInput.value?.focus()
  })
}

function closeAddModal() {
  isAddModalOpen.value = false
  searchTerm.value = ""
}
</script>

<template>
  <div
    class="bg-neutral border-neutral blocks-container overflow-hidden rounded-[10px] border p-0.5"
  >
    <div
      class="border-neutral overflow-hidden rounded-lg border shadow-md"
      ref="blocksContainer"
      v-if="sortedBlocks.length > 0"
    >
      <template
        v-for="(block, index) in sortedBlocks"
        :key="block.id + '-' + block.order"
      >
        <DFieldBlock
          :block="getBlock(block.componentId)"
          :block-content="block"
          :is-targeted="targetBlockId === block.id"
          :path="[...path, block.id]"
          class="border-neutral overflow-hidden border-b last:border-none"
          @update:value="updateNestedBlock(index, $event)"
          @delete-block="(id) => deleteBlock(id)"
        >
          <template #controls>
            <DButton
              class="drag-handle cursor-grab opacity-50 transition-all group-hover:opacity-100"
              :icon-left="GripVertical"
              size="sm"
              variant="transparent"
              no-cursor
            />
          </template>
        </DFieldBlock>
      </template>
    </div>

    <div class="flex items-center justify-between p-1">
      <button
        @click="openAddModal()"
        class="text-neutral-subtle text-copy group/button relative inline-flex items-center gap-2 rounded-md px-1.5 py-0.5 ring-blue-500 transition-all outline-none focus-visible:ring-2"
        :class="[isMaxReached ? 'scale-50 opacity-0' : '']"
      >
        <div
          class="bg-neutral-strong absolute inset-0 scale-50 rounded-md opacity-0 transition-all group-hover/button:scale-100 group-hover/button:opacity-100"
        ></div>
        <div class="relative z-10 flex items-center gap-2">
          <PlusIcon class="size-4" />
          <span>Add Block</span>
        </div>
      </button>
      <p
        v-if="field.maxValue"
        class="text-copy-sm text-neutral-subtle flex gap-0.5 rounded-md px-2 py-0.5"
        :class="[isMaxReached ? 'bg-neutral-strong' : '']"
      >
        <span
          class="mr-1"
          v-if="isMaxReached"
        >
          Block limit reached
        </span>
        <span :class="[isMaxReached ? 'text-warn-onsurface' : 'text-neutral']">
          {{ sortedBlocks.length }}
        </span>
        <span>/</span>
        <span>
          {{ field.maxValue }}
        </span>
      </p>
    </div>
  </div>

  <DModal
    :open="isAddModalOpen"
    title="Add Block"
    @close="closeAddModal"
  >
    <div class="flex flex-col gap-2">
      <DInput
        ref="searchInput"
        v-model="searchTerm"
        placeholder="Search blocks by name..."
        aria-label="Search blocks"
        autofocus
      />
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
</template>
<style>
@reference "../../app.css";

.blocks-container {
  background: var(--background-color-neutral-weak) url("/stripes.svg");
  background-blend-mode: overlay;
}

.sortable-drag {
  border-radius: 8px;
  opacity: 1;
}

.sortable-ghost {
  position: relative;
  border-color: transparent;
}
.sortable-ghost > div {
  opacity: 0;
}
</style>
