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
  {
    path: 'metrics/matriz-control/:periodoId?',
    name: 'metrics-matriz-control',
    component: () => import('./views/MatrizControlCoordinacionView.vue'),
    meta: {
      requiresAuth: true,
      title: 'Matriz de Control de Coordinación',
    },
  },
  {
    path: 'metrics/reporte-semestral/:periodoId?',
    name: 'metrics-reporte-semestral',
    component: () => import('./views/ReporteSemestralCoordinadorView.vue'),
    meta: {
      requiresAuth: true,
      title: 'Reporte Semestral del Coordinador',
    },
  },
]
