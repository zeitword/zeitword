<script setup lang="ts">
// code here
</script>

<template>
  <div class="flex h-full max-h-screen flex-col sm:flex-row">
    <DPageSidebar />
    <main class="flex-1 overflow-scroll">
      <slot></slot>
    </main>
  </div>
</template>
