<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import { LogoutButton } from '../../modules/auth'
import { me } from '../../modules/auth/api/authApi'
import type { UserResponse } from '../../modules/auth/types/auth'
import { useReferralNotifications } from '../../modules/referrals'
import { UiHeader, UiShell, UiSidebar, UiToggle } from '../../shared/components'
import type { NavigationItem } from '../../shared/components/navigation'
import { useTheme } from '../../shared/composables/useTheme'
import { headerNavigation, mainLayoutConfig, sidebarNavigation } from './mainLayout.config'

const { dark } = useTheme()
const { unreadReferralsCount, refreshUnreadCount, clearUnreadCount } = useReferralNotifications()
const currentUser = ref<UserResponse | null>(null)
const isAdmin = computed(() => currentUser.value?.role === 'Admin')

const roleDisplayLabel = computed(() => {
  if (!currentUser.value) return ''
  return currentUser.value.role === 'Admin'
    ? 'Rol: Coordinador(a) Trabajo Social'
    : 'Rol: Tutor'
})

const userInitials = computed(() => {
  const name = currentUser.value?.name?.trim()
  if (!name) return 'U'
  // Omitir títulos académicos cortos al generar iniciales
  const parts = name
    .split(/\s+/)
    .filter((p) => !/^(Ing\.|Lic\.|Dr\.|Dra\.|M\.C\.|M\.A\.)$/i.test(p))
  if (parts.length === 0) return name.slice(0, 2).toUpperCase()
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return `${first}${last}`.toUpperCase()
})

function attachReferralBadge(items: NavigationItem[]): NavigationItem[] {
  return items.map((item) => {
    if ('to' in item && item.to === '/referrals') {
      return {
        ...item,
        badge: isAdmin.value ? unreadReferralsCount.value : 0,
        badgeTitle:
          unreadReferralsCount.value === 1
            ? '1 nuevo reporte de canalización'
            : `${unreadReferralsCount.value} nuevos reportes de canalización`,
      }
    }
    return item
  })
}

const resolvedHeaderNavigation = computed(() => attachReferralBadge(headerNavigation))
const resolvedSidebarNavigation = computed(() => attachReferralBadge(sidebarNavigation))

onMounted(async () => {
  try {
    const user = await me()
    currentUser.value = user
    if (user.role === 'Admin') {
      await refreshUnreadCount()
    } else {
      clearUnreadCount()
    }
  } catch {
    currentUser.value = null
    clearUnreadCount()
  }
})
</script>

<template>
  <UiShell :show-header="mainLayoutConfig.showHeader" :show-sidebar="mainLayoutConfig.showSidebar">
    <template #header>
      <UiHeader v-bind="mainLayoutConfig.header" :items="resolvedHeaderNavigation">
        <UiToggle v-model="dark" type="switch" label="Modo oscuro" class="theme" />
        <LogoutButton v-if="!mainLayoutConfig.showSidebar" />
      </UiHeader>
    </template>
    <template #sidebar>
      <UiSidebar v-bind="mainLayoutConfig.sidebar" :items="resolvedSidebarNavigation" note="Identidad institucional. Excelencia técnica. Solidez académica.">
        <UiToggle v-if="!mainLayoutConfig.showHeader" v-model="dark" type="switch" label="Modo oscuro" />
        <LogoutButton />
      </UiSidebar>
    </template>

    <div v-if="currentUser" class="session-topbar" aria-label="Usuario activo en la sesión">
      <div class="session-user-card">
        <div class="session-user-info">
          <span class="session-user-name">{{ currentUser.name }}</span>
          <span class="session-user-role">{{ roleDisplayLabel }}</span>
        </div>
        <span class="session-user-avatar" aria-hidden="true">{{ userInitials }}</span>
      </div>
    </div>

    <RouterView />

    <template #footer>
      <span>Tecnológico Nacional de México</span>
      <span>Campus Monclova · Sistema de diseño institucional</span>
      <LogoutButton v-if="!mainLayoutConfig.showHeader && !mainLayoutConfig.showSidebar" />
    </template>
  </UiShell>
</template>

<style scoped>
.session-topbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.session-user-card {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.875rem;
  background-color: var(--color-surface-white, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  box-shadow: var(--card-shadow);
}

.session-user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.3;
}

.session-user-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary, #1e293b);
}

.session-user-role {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary, #64748b);
}

.session-user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background-color: var(--color-primary, #1b396a);
  color: var(--color-white, #ffffff);
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .session-topbar {
    justify-content: stretch;
  }
  .session-user-card {
    width: 100%;
    justify-content: space-between;
  }
  .session-user-info {
    align-items: flex-start;
  }
}
</style>
