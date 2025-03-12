// zeitword/app/components/d-story-list/index.vue
<script setup lang="ts">
import { Trash2, CornerRightDown, LetterText } from "lucide-vue-next"

type Story = {
  id: string
  title: string
  slug: string
  component?: { displayName: string }
}

type Props = {
  stories: Story[]
  siteId: string
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

function showDeleteModal(id: string) {
  emit("delete-story", id)
}
function createStory() {
  emit("create-story")
}
</script>

<template>
  <DList v-if="stories && stories.length > 0">
    <DListItem
      v-for="story in stories"
      :key="story.id"
      @click="navigateTo(`/sites/${siteId}/content/${story.id}/content`)"
      class="group"
    >
      <div class="text-copy flex w-full items-center justify-between">
        <div class="flex flex-1 items-center gap-2">
          <div class="flex flex-1 items-baseline gap-2">
            <span class="truncate">
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
