<template>
  <d-page>
    <d-page-header>
      <d-page-title>Test Chunk Upload</d-page-title>
    </d-page-header>

    <d-page-content>
      <div class="mx-auto max-w-2xl space-y-4">
        <div class="rounded-lg bg-white p-6 shadow">
          <h2 class="mb-4 text-lg font-semibold">Test Single Chunk Upload</h2>

          <d-button
            @click="testChunkUpload"
            :disabled="testing"
          >
            {{ testing ? "Testing..." : "Test Chunk Upload" }}
          </d-button>

          <div
            v-if="result"
            class="mt-4 rounded bg-neutral-50 p-4"
          >
            <pre>{{ result }}</pre>
          </div>

          <div
            v-if="error"
            class="bg-danger-50 mt-4 rounded p-4"
          >
            <pre class="text-danger-700">{{ error }}</pre>
          </div>
        </div>
      </div>
    </d-page-content>
  </d-page>
</template>

<script setup lang="ts">
import { ref } from "vue"
// @ts-ignore
import { uuidv7 } from "uuidv7"

const testing = ref(false)
const result = ref("")
const error = ref("")

async function testChunkUpload() {
  testing.value = true
  result.value = ""
  error.value = ""

  try {
    // Create a test file
    const testContent = "This is a test chunk content"
    const blob = new Blob([testContent], { type: "text/plain" })
    const file = new File([blob], "test.txt", { type: "text/plain" })

    // Create form data
    const formData = new FormData()
    formData.append("chunk", file)
    formData.append("chunkId", uuidv7())
    formData.append("chunkIndex", "0")
    formData.append("uploadId", uuidv7())
    formData.append("totalChunks", "1")
    formData.append("fileName", "test.txt")
    formData.append("fileSize", file.size.toString())
    formData.append("contentType", "text/plain")

    // Test with fetch first
    console.log("Testing chunk upload with fetch...")
    const response = await fetch("/api/assets/chunk", {
      method: "POST",
      body: formData,
      credentials: "include"
    })

    console.log("Response status:", response.status)
    const responseText = await response.text()
    console.log("Response text:", responseText)

    if (response.ok) {
      const data = JSON.parse(responseText)
      result.value = JSON.stringify(data, null, 2)
    } else {
      error.value = `Status: ${response.status}\n${responseText}`
    }
  } catch (err) {
    console.error("Test failed:", err)
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    testing.value = false
  }
}
</script>
