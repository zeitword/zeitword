<script setup lang="ts">
const mainNavigation = [
  { name: "Sites", to: "/sites" },
  { name: "Settings", to: "/settings" }
]
</script>

<template>
  <DPageHeader :navigation="mainNavigation" />
  <div class="flex h-full max-h-screen flex-col sm:flex-row">
    <main class="flex flex-1 flex-col overflow-scroll">
      <slot></slot>
    </main>
  </div>
</template>
