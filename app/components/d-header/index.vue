<template>
  <header class="px-2 pt-2.5 pb-0 sm:px-4">
    <div class="flex h-10 items-start justify-between gap-2 border-b border-neutral-200 pb-2 pl-2 sm:items-center">
      <div class="flex w-full flex-col items-start gap-2 sm:flex-row sm:items-center">
        <slot></slot>
      </div>
      <div class="flex w-full items-start justify-end gap-2 sm:items-center">
        <slot name="right"></slot>
      </div>
    </div>
  </header>
</template>
