import type { RouteRecordRaw } from 'vue-router'

export const metricsRoutes: RouteRecordRaw[] = [
  {
    path: 'metrics',
    name: 'metrics-dashboard',
    component: () => import('./views/MetricsView.vue'),
    meta: {
      title: 'Métricas',
    },
  },
]
