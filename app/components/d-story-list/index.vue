<script setup lang="ts">
import { Trash2, CornerRightDown, LetterText, FolderIcon, LetterTextIcon } from "lucide-vue-next"

const siteId = useRouteParams("siteId")

type Story = {
  id: string
  title: string
  slug: string
  component?: { displayName: string }
  content?: Record<string, any>
}

type Props = {
  stories: Story[]
  parentSlug?: string
}

const props = defineProps<Props>()
const emit = defineEmits(["delete-story", "create-story"])

function getSlugName(slug: string) {
  if (!props.parentSlug) {
    return slug === "index" ? "/" : `/${slug}`
  }
  // Remove the parent slug and leading/trailing slashes
  const relativeSlug = slug.replace(props.parentSlug, "").replace(/^\/+|\/+$/g, "")
  return relativeSlug === "index" ? "/" : `/${relativeSlug}`
}

const sortedStories = computed(() => {
  return props.stories.sort((a, b) => {
    let slugA = getSlugName(a.slug)
    let slugB = getSlugName(b.slug)
    return slugA.localeCompare(slugB)
  })
})

function showDeleteModal(id: string) {
  emit("delete-story", id)
}

function createStory() {
  emit("create-story", props.parentSlug)
}

function hasContent(story: Story) {
  if (!story.content) return false
  return Object.keys(story.content).length > 0
}

function nav(story: Story) {
  if (hasContent(story)) {
    navigateTo(`/sites/${siteId.value}/content/${story.id}/content`)
  } else {
    navigateTo(`/sites/${siteId.value}/content/${story.id}`)
  }
}
</script>

<template>
  <DList v-if="stories && stories.length > 0">
    <DListItem
      v-for="story in sortedStories"
      :key="story.id"
      @click="nav(story)"
      class="group cursor-pointer"
    >
      <div class="text-copy flex w-full items-center justify-between">
        <div class="flex flex-1 items-center gap-2">
          <div class="flex flex-1 items-center gap-2 truncate">
            <div class="border-neutral grid size-8 min-w-8 place-items-center rounded-md border">
              <LetterTextIcon
                v-if="hasContent(story)"
                class="text-neutral-subtle size-4"
              />
              <FolderIcon
                v-else
                class="text-neutral-subtle size-4 fill-neutral-500"
              />
            </div>
            <span class="min-w-0 truncate">
              {{ story.title }}
            </span>
            <div
              v-if="story.component"
              class="text-copy-sm bg-neutral border-neutral inline-flex rounded-full border px-2 py-px"
            >
              {{ story.component.displayName }}
            </div>
          </div>
          <div class="flex-start flex flex-1">
            <div class="text-copy-sm bg-neutral border-neutral rounded-full border px-2 py-px">
              {{ getSlugName(story.slug) }}
            </div>
          </div>
        </div>
        <div class="flex gap-2 opacity-0 group-hover:opacity-100">
          <DButton
            :icon-left="CornerRightDown"
            size="sm"
            variant="secondary"
            @click.stop="navigateTo(`/sites/${siteId}/content/${story.id}`)"
          />
          <DButton
            :icon-left="Trash2"
            size="sm"
            variant="secondary"
            @click.stop="showDeleteModal(story.id)"
          />
        </div>
      </div>
    </DListItem>
  </DList>
  <DEmpty
    v-else
    title="No stories yet"
    description="Create your first story to get started"
    :icon="LetterText"
    size="lg"
  >
    <DButton
      @click="createStory"
      variant="secondary"
    >
      Create Story
    </DButton>
  </DEmpty>
</template>
