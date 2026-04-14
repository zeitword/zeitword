<script setup lang="ts">
import { useDebounceFn } from "@vueuse/core"
import { EyeOffIcon } from "lucide-vue-next"

const siteId = useRouteParams("siteId")

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
const contentDelivered = ref(false)
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

function sendContentToIframe(updatedContent: any) {
  const previewFrame = document.getElementById("previewFrame") as HTMLIFrameElement | null
  if (!previewFrame?.contentWindow) return
  previewFrame.contentWindow.postMessage(
    {
      type: "updatePreview",
      data: JSON.parse(JSON.stringify(updatedContent))
    },
    domain.value
  )
}

const sendPreviewUpdate = useDebounceFn((updatedContent) => {
  sendContentToIframe(updatedContent)
}, 200)

// Push content to the iframe, retrying until it's likely been received.
// The iframe may not have its message listener ready when @load fires,
// so we retry several times to cover the Nuxt hydration window.
const sendInitialContent = (retries = 0) => {
  if (contentDelivered.value) return

  const previewFrame = document.getElementById("previewFrame") as HTMLIFrameElement | null
  if (!previewFrame?.contentWindow) {
    if (retries < maxRetries) {
      setTimeout(() => sendInitialContent(retries + 1), retryDelay)
    }
    return
  }

  sendContentToIframe(content.value)

  if (retries < maxRetries) {
    setTimeout(() => sendInitialContent(retries + 1), retryDelay)
  }
}

const handleIframeLoad = () => {
  isIframeReady.value = true
  sendInitialContent()
}

// Handle incoming messages from the preview iframe
const handleMessage = (event: MessageEvent) => {
  const allowedOrigins = ["https://app.zeitword.com", "http://localhost:", domain.value]
  if (!allowedOrigins.some((prefix) => event.origin.startsWith(prefix))) {
    return
  }

  if (event.data.type === "requestInitialData") {
    // The iframe is ready and asking for content — send immediately (no debounce)
    sendContentToIframe(content.value)
    contentDelivered.value = true
    isIframeReady.value = true
    emit("ready")
  } else if (event.data.type === "componentClick") {
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
      class="bg-neutral-weak absolute inset-0 flex items-center justify-center"
    >
      <div class="text-neutral">Loading preview...</div>
    </div>
    <iframe
      id="previewFrame"
      class="h-full w-full"
      :src="iframeUrl"
      sandbox="allow-scripts allow-same-origin allow-popups"
      @load="handleIframeLoad"
    />
  </div>
  <div
    v-else
    class="p-5"
  >
    <d-empty
      title="No preview available"
      description="Setup a domain to preview to start previewing your site."
      size="sm"
      class="mx-auto max-w-md"
      :icon="EyeOffIcon"
    >
      <d-button
        variant="secondary"
        @click="navigateTo(`/sites/${siteId}/settings`)"
      >
        Setup Domain
      </d-button>
    </d-empty>
  </div>
</template>
