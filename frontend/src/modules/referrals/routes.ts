import type { RouteRecordRaw } from 'vue-router'

export const referralsRoutes: RouteRecordRaw[] = [
  {
    path: 'referrals',
    name: 'referrals-list',
    component: () => import('./views/ReferralsView.vue'),
    meta: {
      title: 'Canalizaciones',
    },
  },
]
