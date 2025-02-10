<script setup lang="ts">
type Props = {
  open: boolean
  fileId: string
}

const { open, fileId } = defineProps<Props>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const { data: users, refresh } = await useFetch(() => `/api/files/${fileId}/shares`, {
  cache: "no-cache",
})

const permissionOptions = [
  { value: null, display: "Keine" },
  { value: "read", display: "Lesen" },
  { value: "write", display: "Schreiben" },
  { value: "admin", display: "Admin" },
]

function close() {
  emit("close")
}

async function onPermissionChange(userId: string, value: string | null) {
  // if value is null then delete the user
  if (value === null) {
    await useRequestFetch()(`/api/files/${fileId}/shares/${userId}`, {
      method: "DELETE",
    })
  } else {
    await useRequestFetch()(`/api/files/${fileId}/shares/${userId}`, {
      method: "PATCH",
      body: { permission: value },
    })
  }

  await refresh()
}
</script>

<template>
  <DModal titel="Mitglieder verwalten" v-if="open" @close="close" @confirm="close">
    <div class="flex flex-col gap-2 p-4 text-sm">
      <div v-for="user in users" class="flex items-center justify-between gap-4">
        <div>
          <div class="text-medium text-neutral-900">{{ user.name }}</div>
          <div class="text-xs text-neutral-500">{{ user.email }}</div>
        </div>
        <div class="w-[160px]">
          <DSelect v-model="user.permission" :options="permissionOptions" @change="(value) => onPermissionChange(user.id, value)" />
        </div>
      </div>
    </div>
  </DModal>
</template>
