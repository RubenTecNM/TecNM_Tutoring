import { createRouter, createWebHistory } from 'vue-router'

import { authRoutes, authenticatedAuthRoutes } from '../../modules/auth'
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

router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return true

  if (!hasActiveSession()) {
    clearSessionMarker()
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  return true
})

export default router