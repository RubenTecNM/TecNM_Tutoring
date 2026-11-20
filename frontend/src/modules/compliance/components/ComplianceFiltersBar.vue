<script setup lang="ts">
import { computed } from 'vue'
import { UiCard, UiField } from '../../../shared/components'
import type { ComplianceFilters, DeliverableStatus, ReportType } from '../types/compliance'

const props = withDefaults(
  defineProps<{
    modelValue: ComplianceFilters
    availablePeriodos?: { id: number; label: string }[]
    showTeacherSearch?: boolean
  }>(),
  {
    availablePeriodos: () => [
      { id: 1, label: 'Ene - Jun 2026' },
      { id: 2, label: 'Ago - Dic 2026' },
    ],
    showTeacherSearch: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [filters: ComplianceFilters]
}>()

const periodoOptions = computed(() =>
  props.availablePeriodos.map((p) => ({ value: String(p.id), label: p.label })),
)

const monthOptions = computed(() => {
  const allOption = { value: '', label: 'Todos los meses' }

  // Periodo 1: Ene - Jun (Meses hábiles de entrega: Feb a Jun)
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

  // Periodo 2: Ago - Dic (Meses hábiles de entrega: Sep a Dic)
  if (props.modelValue.periodoId === 2) {
    return [
      allOption,
      { value: '9', label: 'Septiembre' },
      { value: '10', label: 'Octubre' },
      { value: '11', label: 'Noviembre' },
      { value: '12', label: 'Diciembre' },
    ]
  }

  // Otros periodos: conjunto general de meses lectivos
  return [
    allOption,
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ]
})

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'OnTime', label: 'En tiempo' },
  { value: 'Late', label: 'Con retraso' },
  { value: 'Pending', label: 'Pendiente' },
]

const reportTypeOptions = [
  { value: '', label: 'Todos los formatos' },
  { value: 'PlanTrabajo', label: 'Plan de Trabajo (Semestral)' },
  { value: 'DiagnosticoInicial', label: 'Diagnóstico Inicial' },
  { value: 'Anexo14', label: 'Anexo 14 (Trayectoria)' },
  { value: 'Anexo15', label: 'Anexo 15 (Desempeño)' },
  { value: 'Anexo19AMensual', label: 'Anexo 19A (Reporte Mensual)' },
  { value: 'Asistencia', label: 'Lista de Asistencia' },
  { value: 'Anexo19Final', label: 'Anexo 19 Final' },
]

function onPeriodoChange(val: string) {
  const newPeriodoId = Number(val) || 1
  const validMonthsForNewPeriodo =
    newPeriodoId === 1 ? [2, 3, 4, 5, 6] : newPeriodoId === 2 ? [9, 10, 11, 12] : []

  const isCurrentMonthValid =
    props.modelValue.month !== undefined && validMonthsForNewPeriodo.includes(props.modelValue.month)

  emit('update:modelValue', {
    ...props.modelValue,
    periodoId: newPeriodoId,
    month: isCurrentMonthValid ? props.modelValue.month : undefined,
  })
}

function onMonthChange(val: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    month: val ? Number(val) : undefined,
  })
}

function onStatusChange(val: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    status: (val as DeliverableStatus) || undefined,
  })
}

function onReportTypeChange(val: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    reportType: (val as ReportType) || undefined,
  })
}

function onSearchChange(val: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    search: val || undefined,
  })
}
</script>

<template>
  <UiCard title="Filtros de Búsqueda" description="Filtrar por periodo lectivo, mes o estatus">
    <div class="filters-grid">
      <UiField
        :model-value="String(modelValue.periodoId)"
        label="Periodo escolar"
        as="select"
        :options="periodoOptions"
        @update:model-value="onPeriodoChange"
      />

      <UiField
        :model-value="modelValue.month !== undefined ? String(modelValue.month) : ''"
        label="Mes de evaluación"
        as="select"
        :options="monthOptions"
        @update:model-value="onMonthChange"
      />

      <UiField
        :model-value="modelValue.status ?? ''"
        label="Estado de entrega"
        as="select"
        :options="statusOptions"
        @update:model-value="onStatusChange"
      />

      <UiField
        :model-value="modelValue.reportType ?? ''"
        label="Tipo de formato"
        as="select"
        :options="reportTypeOptions"
        @update:model-value="onReportTypeChange"
      />

      <UiField
        v-if="showTeacherSearch"
        :model-value="modelValue.search ?? ''"
        label="Buscar docente"
        placeholder="Clave o nombre del docente..."
        @update:model-value="onSearchChange"
      />
    </div>
  </UiCard>
</template>

<style scoped>
.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
</style>
