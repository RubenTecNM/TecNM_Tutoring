<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { NavigationLink } from './navigation'

const props = defineProps<{ item: NavigationLink }>()
const route = useRoute()
const router = useRouter()
const active = computed(() => {
  const target = router.resolve(props.item.to)
  return route.path === target.path && route.hash === target.hash
})
</script>

<template>
  <RouterLink v-slot="{ href, navigate }" :to="item.to" custom>
    <a
      :href="href"
      :class="['nav-link', { active }]"
      :aria-current="active ? 'location' : undefined"
      @click="navigate"
    >
      <span class="nav-link-label">{{ item.label }}</span>
      <span
        v-if="item.badge && item.badge > 0"
        class="nav-floating-alert"
        :title="item.badgeTitle || `${item.badge} reportes nuevos`"
        :aria-label="item.badgeTitle || `${item.badge} reportes nuevos`"
      >
        {{ item.badge > 99 ? '99+' : item.badge }}
      </span>
    </a>
  </RouterLink>
</template>

<style scoped>
.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  overflow: visible;
}

.nav-floating-alert {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background-color: var(--color-danger-strong, #dc2626);
  color: var(--color-white, #ffffff);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 20px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(220, 38, 38, 0.45);
  border: 2px solid var(--color-surface-white, #ffffff);
  pointer-events: none;
  z-index: 2;
}
</style>
