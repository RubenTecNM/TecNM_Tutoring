<script setup lang="ts">
import { computed } from 'vue'
import { UiCard, UiMetric } from '../../../shared/components'

const props = defineProps<{
  totalCount: number
  unreadCount: number
  pendingCount: number
  attendedCount: number
}>()

const attendedRate = computed(() => {
  if (props.totalCount === 0) return '0%'
  return `${Math.round((props.attendedCount / props.totalCount) * 100)}%`
})
</script>

<template>
  <div class="kpi-grid">
    <UiCard metric class="kpi-card total">
      <UiMetric
        label="Total canalizaciones"
        :value="totalCount"
        description="Reportes registrados en el periodo"
      />
    </UiCard>

    <UiCard metric class="kpi-card unread">
      <UiMetric
        label="Nuevos / Sin leer"
        :value="unreadCount"
        description="Reportes recientes pendientes de lectura"
      />
    </UiCard>

    <UiCard metric class="kpi-card pending">
      <UiMetric
        label="Pendientes / Sin atender"
        :value="pendingCount"
        description="Casos recibidos o leídos en proceso"
      />
    </UiCard>

    <UiCard metric class="kpi-card attended">
      <UiMetric
        label="Casos atendidos"
        :value="attendedCount"
        :description="`Tasa de atención del ${attendedRate}`"
      />
    </UiCard>
  </div>
</template>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.kpi-card {
  border-top: 4px solid var(--color-border);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.kpi-card.total {
  border-top-color: var(--color-primary, #1b396a);
}

.kpi-card.unread {
  border-top-color: var(--color-danger, #ef4444);
}

.kpi-card.pending {
  border-top-color: var(--color-warning, #f59e0b);
}

.kpi-card.attended {
  border-top-color: var(--color-success, #22c55e);
}
</style>
