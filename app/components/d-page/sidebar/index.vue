<script setup lang="ts">
import { useSessionStorage } from "@vueuse/core"
import { SchoolIcon, MenuIcon, SaveIcon } from "lucide-vue-next"

const route = useRoute()

const organisationName = ref("Zeitword")

const collapsed = useSessionStorage("collapsed", false)

const isPublicRoute = computed(() => {
  return ["/login", "/logout"].includes(route.path)
})

const mobileMenu = ref(false)

function toggleMobileMenu() {
  collapsed.value = false
  mobileMenu.value = !mobileMenu.value
}

onBeforeRouteUpdate(() => {
  mobileMenu.value = false
})
</script>

<template>
  <div class="flex">
    <header v-if="!isPublicRoute" class="flex w-full border-b border-neutral-200 bg-neutral-50 sm:hidden">
      <div class="group flex h-14 w-full cursor-default items-center justify-between gap-2 rounded-md p-2 px-2 text-sm text-neutral-800">
        <NuxtLink to="/entries" v-show="!collapsed" class="flex items-center gap-2 px-2 py-1.5">
          <!-- <SaveIcon class="size-4" /> -->
          <!-- <img src="/file_folder_color.svg" class="size-5" /> -->
          <div class="line-clamp-1 flex-1">{{ organisationName }}</div>
        </NuxtLink>
        <div class="p-1" @click="toggleMobileMenu">
          <menu-icon class="size-4" />
        </div>
      </div>
    </header>

    <div v-if="mobileMenu" class="fixed top-0 left-0 z-50 flex h-full w-full flex-col justify-between bg-white sm:hidden">
      <d-page-sidebar-content @close="toggleMobileMenu" />
    </div>

    <header
      v-if="!isPublicRoute"
      class="hidden flex-col justify-between border-r border-neutral-200 bg-neutral-50 sm:flex"
      :class="collapsed ? 'w-fit' : 'w-[230px]'"
    >
      <d-page-sidebar-content />
    </header>
  </div>
</template>
