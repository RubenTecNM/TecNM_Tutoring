import type { RouteRecordRaw } from 'vue-router'

export const complianceRoutes: RouteRecordRaw[] = [
  {
    path: '/compliance',
    name: 'compliance-dashboard',
    component: () => import('./views/ComplianceView.vue'),
    meta: {
      requiresAuth: true,
      roles: ['Docente', 'Tutor'],
    },
  },
  {
    path: '/compliance/plan-trabajo/:deliverableId',
    name: 'compliance-plan-trabajo',
    component: () => import('./views/PlanTrabajoView.vue'),
    meta: {
      requiresAuth: true,
      title: 'Plan de Trabajo de Tutorías',
    },
  },
  {
    path: '/compliance/diagnostico-inicial/:deliverableId',
    name: 'compliance-diagnostico-inicial',
    component: () => import('./views/DiagnosticoInicialView.vue'),
    meta: {
      requiresAuth: true,
      title: 'Análisis del Diagnóstico Inicial',
    },
  },
]
