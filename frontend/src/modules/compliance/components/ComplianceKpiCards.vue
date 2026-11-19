<script setup lang="ts">
import { computed } from 'vue'
import { UiCard, UiMetric } from '../../../shared/components'

const props = withDefaults(
  defineProps<{
    onTimeCount: number
    lateCount: number
    pendingCount: number
    totalCount?: number
    totalDelayDays?: number
  }>(),
  {
    totalCount: undefined,
    totalDelayDays: undefined,
  },
)

const computedTotal = computed(() =>
  props.totalCount !== undefined
    ? props.totalCount
    : props.onTimeCount + props.lateCount + props.pendingCount,
)
</script>

<template>
  <div class="kpi-grid">
    <UiCard metric class="kpi-card on-time">
      <UiMetric
        label="En tiempo"
        :value="onTimeCount"
        description="Formatos entregados en ventana oficial (días 5 al 10)"
      />
    </UiCard>

    <UiCard metric class="kpi-card late">
      <UiMetric
        label="Con retraso"
        :value="lateCount"
        :description="
          totalDelayDays !== undefined
            ? `${totalDelayDays} días de retraso acumulados`
            : 'Entregados fuera de plazo normativo'
        "
      />
    </UiCard>

    <UiCard metric class="kpi-card pending">
      <UiMetric
        label="Pendientes"
        :value="pendingCount"
        description="Entregables en espera de subida por el docente"
      />
    </UiCard>

    <UiCard v-if="computedTotal > 0" metric class="kpi-card total">
      <UiMetric
        label="Total entregables"
        :value="computedTotal"
        description="Lista de formatos del periodo lectivo"
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

.kpi-card.on-time {
  border-top-color: var(--color-success, #22c55e);
}

.kpi-card.late {
  border-top-color: var(--color-danger, #ef4444);
}

.kpi-card.pending {
  border-top-color: var(--color-warning, #f59e0b);
}

.kpi-card.total {
  border-top-color: var(--color-primary, #1b396a);
}
</style>
