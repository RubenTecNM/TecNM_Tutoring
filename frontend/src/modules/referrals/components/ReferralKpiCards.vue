<script setup lang="ts">
import { computed } from 'vue'
import { UiCard, UiMetric } from '../../../shared/components'
import type { ReferralKpiBucket } from '../types/referrals'

const props = withDefaults(
  defineProps<{
    totalCount: number
    unreadCount: number
    pendingCount: number
    attendedCount: number
    activeBucket?: ReferralKpiBucket
  }>(),
  {
    activeBucket: 'all',
  },
)

const emit = defineEmits<{
  select: [bucket: ReferralKpiBucket]
}>()

const attendedRate = computed(() => {
  if (props.totalCount === 0) return '0%'
  return `${Math.round((props.attendedCount / props.totalCount) * 100)}%`
})

function handleSelect(bucket: ReferralKpiBucket) {
  // Si se vuelve a dar clic en el mismo filtro activo, regresar a "all"
  emit('select', props.activeBucket === bucket ? 'all' : bucket)
}
</script>

<template>
  <div class="kpi-grid">
    <button
      type="button"
      class="kpi-btn"
      :class="{ active: activeBucket === 'all' }"
      :aria-pressed="activeBucket === 'all'"
      @click="handleSelect('all')"
    >
      <UiCard metric class="kpi-card total">
        <UiMetric
          label="Total canalizaciones"
          :value="totalCount"
          description="Clic para ver todos los reportes"
        />
      </UiCard>
    </button>

    <button
      type="button"
      class="kpi-btn"
      :class="{ active: activeBucket === 'unread' }"
      :aria-pressed="activeBucket === 'unread'"
      @click="handleSelect('unread')"
    >
      <UiCard metric class="kpi-card unread">
        <UiMetric
          label="Nuevos / Sin leer"
          :value="unreadCount"
          description="Reportes recientes pendientes de lectura"
        />
      </UiCard>
    </button>

    <button
      type="button"
      class="kpi-btn"
      :class="{ active: activeBucket === 'pending' }"
      :aria-pressed="activeBucket === 'pending'"
      @click="handleSelect('pending')"
    >
      <UiCard metric class="kpi-card pending">
        <UiMetric
          label="Pendientes / Sin atender"
          :value="pendingCount"
          description="Casos recibidos o leídos en proceso"
        />
      </UiCard>
    </button>

    <button
      type="button"
      class="kpi-btn"
      :class="{ active: activeBucket === 'attended' }"
      :aria-pressed="activeBucket === 'attended'"
      @click="handleSelect('attended')"
    >
      <UiCard metric class="kpi-card attended">
        <UiMetric
          label="Casos atendidos"
          :value="attendedCount"
          :description="`Tasa de atención del ${attendedRate}`"
        />
      </UiCard>
    </button>
  </div>
</template>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
}

.kpi-btn {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  border-radius: 10px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.kpi-btn:hover {
  transform: translateY(-2px);
}

.kpi-btn.active :deep(.card),
.kpi-btn.active .kpi-card {
  box-shadow: 0 0 0 2px var(--color-primary, #1b396a);
}

.kpi-card {
  border-top: 4px solid var(--color-border);
  height: 100%;
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
