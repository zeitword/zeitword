<script setup lang="ts">
import { LoaderCircleIcon } from "@lucide/vue"
const { switching, revision } = useOrganisationTransition()
</script>

<template>
  <NuxtLoadingIndicator />
  <div
    class="h-full"
    :inert="switching || undefined"
    :aria-busy="switching"
  >
    <NuxtLayout>
      <NuxtPage :page-key="(route) => `${revision}:${route.path}`" />
    </NuxtLayout>
  </div>
  <div
    v-if="switching"
    role="status"
    aria-live="polite"
    class="bg-neutral/30 fixed inset-0 z-[100] flex items-center justify-center"
  >
    <div
      class="bg-neutral text-neutral border-neutral flex items-center gap-3 rounded-lg border px-5 py-3 shadow-lg"
    >
      <LoaderCircleIcon
        class="size-4 animate-spin"
        aria-hidden="true"
      />
      Switching organisation…
    </div>
  </div>
  <DToastContainer />
</template>
