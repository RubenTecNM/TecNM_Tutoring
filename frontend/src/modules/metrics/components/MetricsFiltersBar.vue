<script setup lang="ts">
import { computed } from 'vue'
import { UiButton, UiCard, UiField } from '../../../shared/components'
import type { MetricsFilters, RiskLevel } from '../types/metrics'

const props = withDefaults(
  defineProps<{
    modelValue: MetricsFilters
    availablePeriodos?: { id: number; label: string }[]
  }>(),
  {
    availablePeriodos: () => [
      { id: 1, label: 'Ene - Jun 2026' },
      { id: 2, label: 'Ago - Dic 2026' },
    ],
  },
)

const emit = defineEmits<{
  'update:modelValue': [filters: MetricsFilters]
}>()

const periodoOptions = computed(() =>
  props.availablePeriodos.map((p) => ({ value: String(p.id), label: p.label })),
)

const monthOptions = computed(() => {
  const allOption = { value: '', label: 'Todos los meses' }
  if (props.modelValue.periodoId === 1) {
    return [
      allOption,
      { value: '2', label: 'Febrero' },
      { value: '3', label: 'Marzo' },
      { value: '4', label: 'Abril' },
      { value: '5', label: 'Mayo' },
      { value: '6', label: 'Junio' },
    ]
  }
  return [
    allOption,
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ]
})

const riskOptions: { value: RiskLevel | ''; label: string }[] = [
  { value: '', label: 'Todos los riesgos' },
  { value: 'Critical', label: 'Crítico (>= 45%)' },
  { value: 'High', label: 'Alto (30% - 44%)' },
  { value: 'Medium', label: 'Medio (15% - 29%)' },
  { value: 'Low', label: 'Bajo (< 15%)' },
]

const hasActiveFilters = computed(() =>
  Boolean(props.modelValue.month || props.modelValue.riskLevel || props.modelValue.search?.trim()),
)

function update(patch: Partial<MetricsFilters>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

function clearFilters() {
  emit('update:modelValue', {
    periodoId: props.modelValue.periodoId,
    month: undefined,
    riskLevel: undefined,
    search: undefined,
  })
}
</script>

<template>
  <UiCard title="Filtros de Métricas y Reprobación" description="Filtrar por periodo, mes, nivel de riesgo o materia/docente">
    <div class="filters-grid">
      <UiField
        :model-value="String(modelValue.periodoId)"
        label="Periodo escolar"
        as="select"
        :options="periodoOptions"
        @update:model-value="(val) => update({ periodoId: Number(val) || 1, month: undefined })"
      />
      <UiField
        :model-value="modelValue.month !== undefined ? String(modelValue.month) : ''"
        label="Mes evaluado"
        as="select"
        :options="monthOptions"
        @update:model-value="(val) => update({ month: val ? Number(val) : undefined })"
      />
      <UiField
        :model-value="modelValue.riskLevel ?? ''"
        label="Nivel de riesgo"
        as="select"
        :options="riskOptions"
        @update:model-value="(val) => update({ riskLevel: (val as RiskLevel) || undefined })"
      />
      <UiField
        :model-value="modelValue.search ?? ''"
        label="Buscar materia, grupo o docente"
        placeholder="Ej. Cálculo, ACF-0901, 1A..."
        @update:model-value="(val) => update({ search: val || undefined })"
      />
    </div>

    <div v-if="hasActiveFilters" class="filters-footer">
      <UiButton variant="secondary" class="btn-clear" @click="clearFilters">
        Limpiar filtros
      </UiButton>
    </div>
  </UiCard>
</template>

<style scoped>
.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1rem;
}

.filters-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.75rem;
}

.btn-clear {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}
</style>
