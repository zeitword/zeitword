<script setup lang="ts">
const mainNavigation = [
  { name: "Sites", to: "/sites" },
  { name: "Settings", to: "/settings" }
]
</script>

<template>
  <div class="flex h-full max-h-screen flex-col">
    <DPageHeader :navigation="mainNavigation" />
    <main class="flex flex-1 flex-col overflow-auto">
      <slot></slot>
    </main>
  </div>
</template>
