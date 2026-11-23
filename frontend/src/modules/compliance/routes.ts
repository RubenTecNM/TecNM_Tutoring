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
  {
    path: '/compliance/anexo-14/:deliverableId',
    name: 'compliance-anexo-14',
    component: () => import('./views/Anexo14View.vue'),
    meta: {
      requiresAuth: true,
      title: 'Anexo 14 — Trayectoria Académica',
    },
  },
  {
    path: '/compliance/anexo-15/:deliverableId',
    name: 'compliance-anexo-15',
    component: () => import('./views/Anexo15View.vue'),
    meta: {
      requiresAuth: true,
      title: 'Anexo 15 — Desempeño Académico',
    },
  },
]
