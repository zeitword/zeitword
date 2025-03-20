<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core"

const props = defineProps({
  siteDomain: {
    type: String,
    required: true
  },
  storySlug: {
    type: String,
    required: true
  },
  content: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(["ready", "componentClick"])

const { content } = toRefs(props)
const isIframeReady = ref(false)
const maxRetries = 5
const retryDelay = 1000

const domain = computed(() => {
  let d = props.siteDomain
  if (d.endsWith("/")) d = d.slice(0, -1)
  return d
})

const iframeUrl = computed(() => {
  if (!props.siteDomain || !props.storySlug) return null
  const slug = props.storySlug.replace("index", "")
  return `${domain.value}/preview/${slug}`
})

const sendPreviewUpdate = useDebounceFn((updatedContent) => {
  const previewFrame = document.getElementById("previewFrame")
  if (previewFrame && previewFrame.contentWindow) {
    previewFrame.contentWindow.postMessage(
      {
        type: "updatePreview",
        data: JSON.parse(JSON.stringify(updatedContent))
      },
      domain.value
    )
  }
}, 200)

// Function to send content and retry if needed
const sendInitialContent = async (retries = 0) => {
  const previewFrame = document.getElementById("previewFrame")
  if (!previewFrame || !previewFrame.contentWindow) {
    if (retries < maxRetries) {
      setTimeout(() => sendInitialContent(retries + 1), retryDelay)
    }
    return
  }

  try {
    previewFrame.contentWindow.postMessage(
      {
        type: "updatePreview",
        data: JSON.parse(JSON.stringify(content.value))
      },
      domain.value
    )
    isIframeReady.value = true
  } catch (error) {
    console.error("Failed to send initial content:", error)
    if (retries < maxRetries) {
      setTimeout(() => sendInitialContent(retries + 1), retryDelay)
    }
  }
}

// Handle iframe load event
const handleIframeLoad = () => {
  sendInitialContent()
}

// Handle incoming messages
const handleMessage = (event) => {
  const allowedOrigins = ["https://app.zeitword.com", "http://localhost:", domain.value]
  if (!allowedOrigins.some((prefix) => event.origin.startsWith(prefix))) {
    console.warn("CMS: Message rejected - Invalid origin", event.origin)
    return
  }

  if (event.data.type === "requestInitialData") {
    sendPreviewUpdate(content.value)
    emit("ready")
  } else if (event.data.type === "componentClick") {
    console.log(event.data.data)
    emit("componentClick", event.data.data)
  }
}

watch(
  content,
  (newContent) => {
    sendPreviewUpdate(newContent)
  },
  { deep: true }
)

onMounted(() => {
  window.addEventListener("message", handleMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener("message", handleMessage)
})
</script>

<template>
  <div
    v-if="iframeUrl"
    class="relative h-full w-full"
  >
    <div
      v-if="!isIframeReady"
      class="absolute inset-0 flex items-center justify-center bg-gray-50"
    >
      <div class="text-gray-500">Loading preview...</div>
    </div>
    <iframe
      id="previewFrame"
      class="h-full w-full"
      :src="iframeUrl"
      sandbox="allow-scripts allow-same-origin allow-popups"
      @load="handleIframeLoad"
    />
  </div>
  <div v-else>
    <d-empty title="No preview available" />
  </div>
</template>
