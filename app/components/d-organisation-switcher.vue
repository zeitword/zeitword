<script setup lang="ts">
import {
  CheckIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  LogOutIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon
} from "@lucide/vue"
import { useStorage } from "@vueuse/core"
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItemIndicator,
  DropdownMenuSeparator,
  DropdownMenuItem
} from "reka-ui"

const { data } = await useFetch("/api/organisations", { key: "organisations" })
const { transition, switching } = useOrganisationTransition()
const active = computed(() =>
  data.value?.organisations.find((org) => org.id === data.value?.activeOrganisationId)
)
const busy = ref(false)
const showCreate = ref(false)
const mode = useStorage("theme-mode", "system")
const themes = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon }
]
watchEffect(() => {
  if (import.meta.client) {
    document.documentElement.style.colorScheme = mode.value === "system" ? "light dark" : mode.value
    document.documentElement.style.setProperty("--current-mode", mode.value)
  }
})
const { toast } = useToast()
async function switchOrganisation(id: string) {
  if (id === data.value?.activeOrganisationId || busy.value) return
  busy.value = true
  try {
    await transition(() => $fetch(`/api/organisations/${id}/switch`, { method: "POST" }))
  } catch {
    toast.error({ description: "Unable to switch organisation" })
  } finally {
    busy.value = false
  }
}
const itemClass =
  "data-[highlighted]:bg-neutral-hover flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm outline-none select-none"
</script>

<template>
  <div class="flex min-w-0 items-center gap-0.5">
    <NuxtLink
      to="/sites"
      class="text-neutral hover:bg-neutral-hover flex h-8 min-w-0 items-center gap-2 rounded-md px-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <span
        class="bg-neutral-subtle grid size-5 shrink-0 place-items-center rounded text-xs font-medium uppercase"
        aria-hidden="true"
      >
        {{ active?.name.slice(0, 1) }}
      </span>
      <span class="max-w-48 truncate">{{ active?.name || "Organisation" }}</span>
    </NuxtLink>
    <DropdownMenuRoot>
      <DropdownMenuTrigger
        aria-label="Switch organisation"
        :disabled="busy || switching"
        class="text-neutral-subtle hover:bg-neutral-hover hover:text-neutral data-[state=open]:bg-neutral-hover grid size-8 shrink-0 place-items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
      >
        <ChevronsUpDownIcon class="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          :side-offset="5"
          :collision-padding="12"
          @close-auto-focus="showCreate && $event.preventDefault()"
          class="bg-neutral text-neutral border-neutral z-50 w-60 max-w-[calc(100vw-24px)] rounded-lg border p-1 shadow-lg outline-none"
        >
          <DropdownMenuRadioGroup
            :model-value="data?.activeOrganisationId ?? ''"
            @update:model-value="switchOrganisation"
            class="max-h-64 overflow-y-auto"
          >
            <DropdownMenuRadioItem
              v-for="org in data?.organisations"
              :key="org.id"
              :value="org.id"
              :disabled="busy"
              :class="itemClass"
            >
              <span
                class="bg-neutral-subtle grid size-5 shrink-0 place-items-center rounded text-xs font-medium uppercase"
                aria-hidden="true"
              >
                {{ org.name.slice(0, 1) }}
              </span>
              <span class="flex-1 truncate">{{ org.name }}</span>
              <DropdownMenuItemIndicator><CheckIcon class="size-4" /></DropdownMenuItemIndicator>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator class="bg-neutral-strong my-1 h-px" />
          <DropdownMenuItem
            :class="itemClass"
            @select="showCreate = true"
          >
            <PlusIcon class="text-neutral-subtle size-4" />
            New organisation
          </DropdownMenuItem>
          <DropdownMenuSeparator class="bg-neutral-strong my-1 h-px" />
          <DropdownMenuRadioGroup v-model="mode">
            <DropdownMenuRadioItem
              v-for="theme in themes"
              :key="theme.value"
              :value="theme.value"
              :class="itemClass"
              @select.prevent
            >
              <component
                :is="theme.icon"
                class="text-neutral-subtle size-4"
              />
              <span class="flex-1">{{ theme.label }}</span>
              <DropdownMenuItemIndicator><CheckIcon class="size-4" /></DropdownMenuItemIndicator>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator class="bg-neutral-strong my-1 h-px" />
          <DropdownMenuItem
            as-child
            :class="itemClass"
          >
            <NuxtLink to="/logout">
              <LogOutIcon class="text-neutral-subtle size-4" />
              Sign out
            </NuxtLink>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
  <DCreateOrganisation
    :open="showCreate"
    @close="showCreate = false"
  />
</template>
