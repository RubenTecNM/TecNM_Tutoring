import { createRouter, createWebHistory } from 'vue-router'

import { authRoutes, authenticatedAuthRoutes } from '../../modules/auth'
import { me } from '../../modules/auth/api/authApi'
import { clearAuthSession } from '../../modules/auth/composables/useAuthSession'
import { complianceRoutes } from '../../modules/compliance'
import { metricsRoutes } from '../../modules/metrics'
import { referralsRoutes } from '../../modules/referrals'
import {
  clearSessionMarker,
  hasActiveSession,
} from '../../shared/utils/sessionCookie'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...authRoutes,
    {
      path: '/',
      component: () => import('../layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: { name: 'compliance-dashboard' },
        },
        ...authenticatedAuthRoutes,
        ...complianceRoutes,
        ...referralsRoutes,
        ...metricsRoutes,
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior(to, _from, savedPosition) {
    return savedPosition ?? (to.hash ? { el: to.hash, top: 24 } : { top: 0 })
  },
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true

  if (!hasActiveSession()) {
    clearAuthSession()
    clearSessionMarker()
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  const allowedRoles = to.meta.roles as string[] | undefined
  if (allowedRoles && allowedRoles.length > 0) {
    try {
      const user = await me()
      if (!allowedRoles.includes(user.role)) {
        return { name: 'compliance-dashboard' }
      }
    } catch {
      clearAuthSession()
      clearSessionMarker()
      return {
        name: 'login',
        query: { redirect: to.fullPath },
      }
    }
  }

  return true
})

export default router