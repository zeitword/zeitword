<script setup lang="ts">
import {
  LucideMail,
  LucideUser,
  LucideArchive,
  LucideArchiveRestore,
  LucideX
} from "lucide-vue-next"

interface User {
  id: string
  name: string
  email: string
  createdAt: string
  deletedAt: string | null
}

interface Invitation {
  id: string
  email: string
  invitedBy: string
  invitedByName: string
  expiresAt: string
  createdAt: string
}

const { data: me } = await useFetch(`/api/me`)
const { data: users, refresh: refreshUsers } = await useFetch<User[]>("/api/organisations/users")
const { data: invitations, refresh: refreshInvitations } = await useFetch<Invitation[]>(
  "/api/organisations/invitations"
)

const { toast } = useToast()

const showInviteModal = ref(false)
const inviteEmail = ref("")
const isInviting = ref(false)

const activeUsers = computed(() => users.value?.filter((u) => !u.deletedAt) || [])
const archivedUsers = computed(() => users.value?.filter((u) => u.deletedAt) || [])

async function inviteUser() {
  if (!inviteEmail.value) return

  isInviting.value = true
  try {
    await $fetch("/api/organisations/invitations", {
      method: "POST",
      body: { email: inviteEmail.value }
    })
    toast.success({ description: "Invitation sent successfully" })
    inviteEmail.value = ""
    showInviteModal.value = false
    refreshInvitations()
  } catch (error: any) {
    toast.error({ description: error.data?.statusMessage || "Failed to send invitation" })
  } finally {
    isInviting.value = false
  }
}

async function archiveUser(userId: string) {
  try {
    await $fetch(`/api/organisations/users/${userId}/archive`, {
      method: "PUT"
    })
    toast.success({ description: "User archived successfully" })
    refreshUsers()
  } catch (error: any) {
    toast.error({ description: error.data?.statusMessage || "Failed to archive user" })
  }
}

async function unarchiveUser(userId: string) {
  try {
    await $fetch(`/api/organisations/users/${userId}/unarchive`, {
      method: "PUT"
    })
    toast.success({ description: "User restored successfully" })
    refreshUsers()
  } catch (error: any) {
    toast.error({ description: error.data?.statusMessage || "Failed to restore user" })
  }
}

async function cancelInvitation(invitationId: string) {
  try {
    await $fetch(`/api/organisations/invitations/${invitationId}`, {
      method: "DELETE"
    })
    toast.success({ description: "Invitation cancelled" })
    refreshInvitations()
  } catch (error: any) {
    toast.error({ description: error.data?.statusMessage || "Failed to cancel invitation" })
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  })
}
</script>

<template>
  <DPageTitle title="Organization Settings"></DPageTitle>
  <DPageWrapper>
    <div class="flex flex-col gap-5 py-5">
      <!-- Active Users -->
      <d-settings-container>
        <d-settings-row
          title="Team Members"
          subtitle="Manage users in your organization"
        >
          <div class="flex w-full flex-col gap-4">
            <div class="flex items-center justify-end">
              <DButton
                @click="showInviteModal = true"
                variant="secondary"
                :icon-left="LucideMail"
              >
                Invite User
              </DButton>
            </div>
            <DList v-if="activeUsers.length > 0">
              <DListItem
                v-for="user in activeUsers"
                :key="user.id"
                class="flex items-center justify-between"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200"
                  >
                    <LucideUser class="h-5 w-5 text-neutral-600" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <p class="text-copy font-medium">{{ user.name }}</p>
                      <div
                        v-if="user.id === me?.id"
                        class="bg-neutral-strong text-neutral-subtle text-copy-sm rounded px-2 py-0.5 leading-tight"
                      >
                        You
                      </div>
                    </div>
                    <div class="text-copy-sm text-neutral-600">{{ user.email }}</div>
                  </div>
                </div>
                <div class="flex gap-2">
                  <DButton
                    v-if="user.id !== me?.id"
                    variant="secondary"
                    size="sm"
                    :icon-left="LucideArchive"
                    @click="archiveUser(user.id)"
                  >
                    Archive
                  </DButton>
                </div>
              </DListItem>
            </DList>
          </div>
        </d-settings-row>
      </d-settings-container>

      <!-- Pending Invitations -->
      <d-settings-container v-if="invitations && invitations.length > 0">
        <d-settings-row
          title="Pending Invitations"
          subtitle="Invitations waiting to be accepted"
        >
          <div class="flex w-full flex-col gap-4">
            <DList>
              <DListItem
                v-for="invitation in invitations"
                :key="invitation.id"
                class="flex items-center justify-between"
              >
                <div>
                  <div class="text-copy font-medium">{{ invitation.email }}</div>
                  <div class="text-copy-sm text-neutral-600">
                    Invited by {{ invitation.invitedByName }} on
                    {{ formatDate(invitation.createdAt) }}
                  </div>
                  <div class="text-copy-sm text-neutral-600">
                    Expires {{ formatDate(invitation.expiresAt) }}
                  </div>
                </div>
                <div class="flex gap-2">
                  <DButton
                    variant="secondary"
                    size="sm"
                    :icon-left="LucideX"
                    @click="cancelInvitation(invitation.id)"
                  >
                    Cancel
                  </DButton>
                </div>
              </DListItem>
            </DList>
          </div>
        </d-settings-row>
      </d-settings-container>

      <!-- Archived Users -->
      <d-settings-container v-if="archivedUsers.length > 0">
        <d-settings-row
          title="Archived Users"
          subtitle="Users who have been archived"
        >
          <div class="flex w-full flex-col gap-4">
            <DList>
              <DListItem
                v-for="user in archivedUsers"
                :key="user.id"
                class="flex items-center justify-between opacity-60"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200"
                  >
                    <LucideUser class="h-5 w-5 text-neutral-600" />
                  </div>
                  <div>
                    <p class="text-copy font-medium">{{ user.name }}</p>
                    <div class="text-copy-sm text-neutral-600">{{ user.email }}</div>
                    <div
                      v-if="user.deletedAt"
                      class="text-copy-sm text-neutral-600"
                    >
                      Archived {{ formatDate(user.deletedAt) }}
                    </div>
                  </div>
                </div>
                <div class="flex gap-2">
                  <DButton
                    variant="secondary"
                    size="sm"
                    :icon-left="LucideArchiveRestore"
                    @click="unarchiveUser(user.id)"
                  >
                    Restore
                  </DButton>
                </div>
              </DListItem>
            </DList>
          </div>
        </d-settings-row>
      </d-settings-container>
    </div>

    <!-- Invite User Modal -->
    <DModal
      :open="showInviteModal"
      title="Invite User"
      confirm-text="Send Invitation"
      @close="showInviteModal = false"
      @confirm="inviteUser"
      :disabled="!inviteEmail || isInviting"
    >
      <div class="flex flex-col gap-4">
        <DFormGroup>
          <DLabel>Email Address</DLabel>
          <DInput
            v-model="inviteEmail"
            type="email"
            placeholder="user@example.com"
            @keyup.enter="inviteUser"
          />
          <p class="text-copy-sm mt-2 text-neutral-600">
            An email will be sent with instructions to join your organization. The invitation will
            be valid for 30 days.
          </p>
        </DFormGroup>
      </div>
    </DModal>
  </DPageWrapper>
</template>
