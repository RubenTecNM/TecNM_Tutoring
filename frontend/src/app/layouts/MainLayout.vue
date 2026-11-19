<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import { LogoutButton } from '../../modules/auth'
import { me } from '../../modules/auth/api/authApi'
import { useReferralNotifications } from '../../modules/referrals'
import { UiHeader, UiShell, UiSidebar, UiToggle } from '../../shared/components'
import type { NavigationItem } from '../../shared/components/navigation'
import { useTheme } from '../../shared/composables/useTheme'
import { headerNavigation, mainLayoutConfig, sidebarNavigation } from './mainLayout.config'

const { dark } = useTheme()
const { unreadReferralsCount, refreshUnreadCount, clearUnreadCount } = useReferralNotifications()
const isAdmin = ref(false)

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
    isAdmin.value = user.role === 'Admin'
    if (isAdmin.value) {
      await refreshUnreadCount()
    } else {
      clearUnreadCount()
    }
  } catch {
    isAdmin.value = false
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
    <RouterView />
    <template #footer>
      <span>Tecnológico Nacional de México</span>
      <span>Campus Monclova · Sistema de diseño institucional</span>
      <LogoutButton v-if="!mainLayoutConfig.showHeader && !mainLayoutConfig.showSidebar" />
    </template>
  </UiShell>
</template>
