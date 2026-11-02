import type { RouteRecordRaw } from 'vue-router';

export const complianceRoutes: RouteRecordRaw[] = [
  {
    path: '/compliance',
    name: 'compliance-dashboard',
    component: () => import('@/modules/compliance/views/ComplianceView.vue'),
    meta: {
      requiresAuth: true,
      roles: ['Docente', 'Tutor']
    }
  }
];