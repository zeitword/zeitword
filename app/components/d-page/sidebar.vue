<script setup lang="ts">
import { useSessionStorage } from "@vueuse/core"
import { LogOutIcon, PanelLeftClose, PanelRightClose, ComponentIcon, XIcon, FolderIcon, FoldersIcon, FileIcon } from "lucide-vue-next"

const organisationName = ref("Zeitword")

const route = useRoute()

const collapsed = useSessionStorage("collapsed", false)

const links = [
  {
    name: "Sites",
    to: "/sites",
    icon: FileIcon,
  },
]

const footerLinks = [
  // {
  //   name: "Einstellungen",
  //   to: "/settings",
  //   icon: Settings2Icon
  // },
  {
    name: "Sign out",
    to: "/logout",
    icon: LogOutIcon,
  },
]

const emit = defineEmits(["close"])

function close() {
  collapsed.value = true
}
</script>

<template>
  <div class="flex">
    <header class="flex flex-col justify-between border-r border-neutral-200 bg-neutral-50" :class="collapsed ? 'w-fit' : 'w-[230px]'">
      <nav class="flex flex-col gap-0.5 p-2">
        <div class="group flex h-9 cursor-default items-center justify-between gap-2 rounded-md text-sm text-neutral-700">
          <div v-show="!collapsed" class="flex items-center gap-2 px-2 py-2">
            <!-- <img src="/file_folder_color.svg" class="size-5" /> -->
            <div class="line-clamp-1 leading-[1em] font-medium">{{ organisationName }}</div>
          </div>
          <div
            class="hidden items-center rounded-md p-2 hover:bg-neutral-200 sm:flex"
            :class="collapsed ? '' : 'opacity-0 group-hover:opacity-100'"
            @click="collapsed = !collapsed"
          >
            <PanelLeftClose v-show="!collapsed" class="size-4" />
            <PanelRightClose v-show="collapsed" class="size-4" />
          </div>
          <div class="block sm:hidden">
            <DButton :icon-left="XIcon" class="!px-1" @click="close" />
          </div>
        </div>
        <hr class="mt-1 mb-1.5 text-neutral-200" />
        <NuxtLink
          v-for="link in links"
          class="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-200"
          :to="link.to"
          :class="route.path.startsWith(link.to) ? 'bg-neutral-200 text-neutral-700' : ''"
        >
          <div class="flex h-5 items-center justify-center">
            <component :is="link.icon" class="size-4" />
          </div>
          <div class="" v-show="!collapsed">{{ link.name }}</div>
        </NuxtLink>
      </nav>

      <nav class="flex flex-col gap-0.5 p-2">
        <NuxtLink
          v-for="link in footerLinks"
          class="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-200"
          :to="link.to"
          :class="route.path.startsWith(link.to) ? 'bg-neutral-200' : ''"
        >
          <div class="flex h-5 items-center justify-center">
            <component :is="link.icon" class="size-4" />
          </div>
          <div v-show="!collapsed">{{ link.name }}</div>
        </NuxtLink>
      </nav>
    </header>
  </div>
</template>
