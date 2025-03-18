<script setup>
import { useEditor, EditorContent } from "@tiptap/vue-3"
import StarterKit from "@tiptap/starter-kit"
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  MinusIcon,
  TextIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon
} from "lucide-vue-next"
import Underline from "@tiptap/extension-underline"
import HorizontalRule from "@tiptap/extension-horizontal-rule"

const props = defineProps({
  modelValue: {
    type: String,
    default: ""
  }
})

const emit = defineEmits(["update:modelValue"])

const isEditorReady = ref(false)
const selectedHeading = ref(null)

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3]
      },
      horizontalRule: false
    }),
    Underline,
    HorizontalRule
  ],
  editorProps: {
    attributes: {
      class: "prose prose-sm  p-5 focus:outline-none"
    }
  },
  onUpdate: ({ editor }) => {
    emit("update:modelValue", editor.getHTML())
  },
  onTransaction: ({ editor }) => {
    isEditorReady.value = true
    const { level } = editor.getAttributes("heading")
    selectedHeading.value = level ? `h${level}` : null
  }
})

watch(
  () => props.modelValue,
  (newValue) => {
    if (!editor.value) return
    const isSame = editor.value.getHTML() === newValue
    if (isSame) return
    nextTick(() => {
      editor.value.commands.setContent(newValue, false)
    })
  },
  { immediate: false }
)

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})

// --- Helper Functions ---
const setHeading = (level) => {
  if (!editor.value) return
  const numericLevel = parseInt(level.slice(1), 10)
  editor.value.chain().focus().toggleHeading({ level: numericLevel }).run()
}

watch(selectedHeading, (newHeading) => {
  if (newHeading) {
    setHeading(newHeading)
  } else {
    editor.value?.chain().focus().setParagraph().run()
  }
})

const headingOptions = computed(() => [
  { display: "Heading 1", value: "h1", icon: Heading1Icon },
  { display: "Heading 2", value: "h2", icon: Heading2Icon },
  { display: "Heading 3", value: "h3", icon: Heading3Icon },
  { display: "Paragraph", value: null, icon: TextIcon }
])

const getActiveHeadingValue = () => {
  if (!editor.value) return null
  const activeHeading = [1, 2, 3].find((level) => editor.value.isActive("heading", { level }))
  return activeHeading ? `h${activeHeading}` : null
}

const getButtonIcon = (type) => {
  if (!editor.value) return null
  switch (type) {
    case "bold":
      return editor.value.isActive("bold") ? BoldIcon : BoldIcon
    case "italic":
      return editor.value.isActive("italic") ? ItalicIcon : ItalicIcon
    case "underline":
      return editor.value.isActive("underline") ? UnderlineIcon : UnderlineIcon
    case "bulletList":
      return editor.value.isActive("bulletList") ? ListIcon : ListIcon
    case "orderedList":
      return editor.value.isActive("orderedList") ? ListOrderedIcon : ListOrderedIcon
    case "blockquote":
      return editor.value.isActive("blockquote") ? QuoteIcon : QuoteIcon
    case "horizontalRule":
      return MinusIcon
    case "clearFormatting":
      return TextIcon
    default:
      return null
  }
}
</script>

<template>
  <div
    class="tiptap-editor border-neutral rounded-md border bg-white"
    v-if="isEditorReady"
  >
    <div class="tiptap-toolbar flex gap-2 border-b border-gray-200 p-2">
      <DButton
        :icon-left="getButtonIcon('bold')"
        variant="secondary"
        size="sm"
        @click="editor.chain().focus().toggleBold().run()"
        :title="'Bold'"
      />

      <DButton
        :icon-left="getButtonIcon('italic')"
        variant="secondary"
        size="sm"
        @click="editor.chain().focus().toggleItalic().run()"
        :title="'Italic'"
      />

      <DButton
        :icon-left="getButtonIcon('underline')"
        variant="secondary"
        size="sm"
        @click="editor.chain().focus().toggleUnderline().run()"
        :title="'Underline'"
      />

      <!-- Headings Dropdown (using d-select) -->
      <DSelect
        :options="headingOptions"
        v-model="selectedHeading"
        placeholder="Heading"
        :get-option-value="getActiveHeadingValue"
        size="sm"
      />

      <DButton
        :icon-left="getButtonIcon('bulletList')"
        variant="secondary"
        @click="editor.chain().focus().toggleBulletList().run()"
        size="sm"
        :title="'Bullet List'"
      />

      <DButton
        :icon-left="getButtonIcon('orderedList')"
        variant="secondary"
        @click="editor.chain().focus().toggleOrderedList().run()"
        size="sm"
        :title="'Ordered List'"
      />

      <DButton
        :icon-left="getButtonIcon('blockquote')"
        variant="secondary"
        size="sm"
        @click="editor.chain().focus().toggleBlockquote().run()"
        :title="'Blockquote'"
      />

      <DButton
        :icon-left="getButtonIcon('horizontalRule')"
        variant="secondary"
        size="sm"
        @click="editor.chain().focus().setHorizontalRule().run()"
        :title="'Horizontal Rule'"
      />
      <DButton
        :icon-left="getButtonIcon('clearFormatting')"
        size="sm"
        variant="secondary"
        @click="editor.chain().focus().unsetAllMarks().clearNodes().run()"
        :title="'Clear Formatting'"
      />
    </div>

    <div class="tiptap-content prose">
      <EditorContent :editor="editor" />
    </div>
  </div>
  <div v-else>Loading Editor...</div>
</template>

<style scoped>
.tiptap-content blockquote {
  border-left: 3px solid #ccc;
  margin-left: 1em;
  padding-left: 1em;
}

.ProseMirror {
  outline: none;
}

.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #ced4da;
  pointer-events: none;
  height: 0;
}
</style>
