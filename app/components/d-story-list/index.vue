<script setup lang="ts">
import { Trash2, FolderIcon, LetterTextIcon, SearchIcon } from "lucide-vue-next"

export type Item = {
  id: string
  title: string
  slug: string
  type: "story" | "folder"
  component?: { displayName: string }
}

type Props = {
  stories: Item[]
  parentSlug?: string
  isSearching: boolean
  searchTerm?: string
}

const props = defineProps<Props>()
const emit = defineEmits(["delete-story", "create-story", "create-folder", "navigate"])

function getDisplaySlug(itemSlug: string) {
  if (props.isSearching) {
    return itemSlug === "index" ? "/" : `/${itemSlug}`
  }
  const parent = props.parentSlug || "/"
  if (parent === "/") {
    return itemSlug === "index" ? "/" : `/${itemSlug}`
  }
  const parentPrefix = parent.endsWith("/") ? parent : parent + "/"
  if (itemSlug.startsWith(parentPrefix)) {
    return itemSlug.substring(parentPrefix.length) || "/"
  }
  return `/${itemSlug}`
}

function showDeleteModal(id: string) {
  emit("delete-story", id)
}
function createStory() {
  emit("create-story")
}
function createFolder() {
  emit("create-folder")
}
function requestNavigation(item: Item) {
  emit("navigate", item)
}
</script>

<template>
  <DList v-if="stories.length > 0">
    <DListItem
      v-for="item in stories"
      :key="item.id"
      @click="requestNavigation(item)"
      class="group cursor-pointer"
    >
      <div class="text-copy flex w-full items-center justify-between">
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <div class="flex flex-1 items-center gap-2 truncate">
            <div
              class="border-neutral grid size-8 min-w-8 shrink-0 place-items-center rounded-md border"
            >
              <LetterTextIcon
                v-if="item.type === 'story'"
                class="text-neutral-subtle size-4"
              />
              <FolderIcon
                v-else
                class="text-neutral-subtle size-4 fill-neutral-500"
              />
            </div>
            <span class="min-w-0 truncate">{{ item.title }}</span>
            <div
              v-if="item.type === 'story' && item.component"
              class="text-copy-sm bg-neutral border-neutral inline-flex shrink-0 rounded-full border px-2 py-px"
            >
              {{ item.component.displayName }}
            </div>
          </div>
          <div class="flex flex-1 justify-end">
            <div class="text-copy-sm text-neutral-subtle px-2 py-px">
              {{ getDisplaySlug(item.slug) }}
            </div>
          </div>
        </div>
        <div
          class="ml-2 flex shrink-0 gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        >
          <DButton
            :icon-left="Trash2"
            size="sm"
            variant="secondary"
            @click.stop="showDeleteModal(item.id)"
            aria-label="Delete Item"
          />
        </div>
      </div>
    </DListItem>
  </DList>

  <DEmpty
    v-else-if="isSearching && stories.length === 0"
    title="No matches found"
    :description="`Your search for '${searchTerm}' did not return any results.`"
    :icon="SearchIcon"
    size="lg"
  />

  <DEmpty
    v-else-if="!isSearching && stories.length === 0"
    title="No items yet"
    description="Create your first story or folder to get started."
    :icon="FolderIcon"
    size="lg"
  >
    <div class="flex gap-2">
      <DButton
        @click="createFolder"
        variant="secondary"
      >
        Create Folder
      </DButton>
      <DButton @click="createStory">Create Story</DButton>
    </div>
  </DEmpty>
</template>
