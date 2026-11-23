<script setup lang="ts">
import { computed } from 'vue'
import { UiBadge, UiButton, UiCard } from '../../../shared/components'
import type { FinalReportReadiness } from '../types/metrics'

const props = withDefaults(
  defineProps<{
    readiness: FinalReportReadiness
    isAdmin?: boolean
    isFinalizing?: boolean
    isAlreadyFinalized?: boolean
  }>(),
  {
    isAdmin: false,
    isFinalizing: false,
    isAlreadyFinalized: false,
  },
)

const emit = defineEmits<{
  finalize: []
}>()

const clampedPercent = computed(() =>
  Math.max(0, Math.min(100, props.readiness.compliancePercentage)),
)
</script>

<template>
  <UiCard
    title="Umbral del 90% — Reporte Semestral Final"
    description="Habilitado al alcanzar al menos 9 de 10 entregas (90%) de los tutores en el periodo."
  >
    <div class="readiness-body">
      <div class="readiness-top">
        <div class="readiness-stats">
          <span class="readiness-percent">{{ readiness.compliancePercentage }}%</span>
          <span class="readiness-detail">
            {{ readiness.completedDeliveries }} de {{ readiness.totalExpectedDeliveries }} entregas ·
            {{ readiness.totalTutors }} tutores
          </span>
        </div>

        <div class="readiness-badges">
          <UiBadge v-if="isAlreadyFinalized" tone="success">
            Reporte Finalizado
          </UiBadge>
          <UiBadge v-else-if="readiness.canGenerateFinalReport" tone="success">
            Umbral cumplido (>= 90%)
          </UiBadge>
          <UiBadge v-else tone="warning">
            Bloqueado (< 90%)
          </UiBadge>
        </div>
      </div>

      <div
        class="progress-track"
        role="progressbar"
        :aria-valuenow="clampedPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Porcentaje de cumplimiento para Reporte Semestral Final"
      >
        <div
          class="progress-fill"
          :class="{ ready: readiness.canGenerateFinalReport }"
          :style="{ width: `${clampedPercent}%` }"
        />
        <div class="threshold-marker" title="Umbral obligatorio: 90%" />
      </div>

      <div v-if="isAdmin" class="readiness-actions">
        <span class="threshold-hint">
          {{
            readiness.canGenerateFinalReport
              ? 'El umbral del 90% se ha cumplido. Puedes consolidar y cerrar el Reporte Semestral Final.'
              : 'Puedes editar borradores y previsualizar; el cierre oficial se habilita al llegar al 90% (9 de 10).'
          }}
        </span>
        <UiButton
          variant="primary"
          class="btn-sm"
          :disabled="!readiness.canGenerateFinalReport || isAlreadyFinalized || isFinalizing"
          :loading="isFinalizing"
          @click="emit('finalize')"
        >
          {{ isAlreadyFinalized ? 'Reporte Semestral Cerrado' : 'Cerrar Reporte Semestral Final' }}
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>

<style scoped>
.readiness-body {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.readiness-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.readiness-stats {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.625rem;
}

.readiness-percent {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-primary, #1b396a);
}

.readiness-detail {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #64748b);
}

.progress-track {
  position: relative;
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background-color: var(--color-gray-200, #e2e8f0);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--color-warning, #f59e0b);
  transition: width 0.25s ease;
}

.progress-fill.ready {
  background-color: var(--color-success, #22c55e);
}

.threshold-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 90%;
  width: 2px;
  background-color: var(--color-primary, #1b396a);
}

.readiness-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.threshold-hint {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #64748b);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}
</style>
