<script setup lang="ts">
import { computed } from 'vue'
import { UiButton, UiCard, UiField } from '../../../shared/components'
import type { ReferralFilters, ReferralReason, ReferralStatus, SupportArea } from '../types/referrals'

const props = withDefaults(
  defineProps<{
    modelValue: ReferralFilters
    availablePeriodos?: { id: number; label: string }[]
    isAdmin?: boolean
  }>(),
  {
    availablePeriodos: () => [
      { id: 1, label: 'Ene - Jun 2026' },
      { id: 2, label: 'Ago - Dic 2026' },
    ],
    isAdmin: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [filters: ReferralFilters]
}>()

const periodoOptions = computed(() =>
  props.availablePeriodos.map((p) => ({ value: String(p.id), label: p.label })),
)

const areaOptions = [
  { value: '', label: 'Todas las áreas' },
  { value: 'Psychology', label: 'Psicología' },
  { value: 'Nursing', label: 'Enfermería' },
  { value: 'Performance', label: 'Desempeño' },
  { value: 'Tutoring', label: 'Tutorías' },
  { value: 'SocialWork', label: 'Trabajo Social' },
  { value: 'Academic', label: 'Académico' },
]

const reasonOptions = [
  { value: '', label: 'Todos los motivos' },
  { value: 'Academic', label: 'Académico' },
  { value: 'Emotional', label: 'Emocional' },
  { value: 'Personal', label: 'Personal' },
  { value: 'Discipline', label: 'Indisciplina' },
  { value: 'Health', label: 'Salud' },
  { value: 'Socioeconomic', label: 'Socioeconómico' },
]

const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'Sent', label: 'Enviado' },
  { value: 'Received', label: 'Recibido' },
  { value: 'Read', label: 'Leído' },
  { value: 'Unread', label: 'Sin leer' },
  { value: 'Unattended', label: 'Sin atender' },
  { value: 'Attended', label: 'Atendido' },
]

function onPeriodoChange(val: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    periodoId: Number(val) || 1,
  })
}

function onAreaChange(val: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    supportArea: (val as SupportArea) || undefined,
  })
}

function onReasonChange(val: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    referralReason: (val as ReferralReason) || undefined,
  })
}

function onStatusChange(val: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    status: (val as ReferralStatus) || undefined,
    kpiBucket: 'all',
  })
}

const hasActiveFilters = computed(() =>
  Boolean(
    props.modelValue.supportArea ||
      props.modelValue.referralReason ||
      props.modelValue.status ||
      (props.modelValue.kpiBucket && props.modelValue.kpiBucket !== 'all') ||
      props.modelValue.search?.trim(),
  ),
)

function onSearchChange(val: string) {
  emit('update:modelValue', {
    ...props.modelValue,
    search: val || undefined,
  })
}

function clearFilters() {
  emit('update:modelValue', {
    periodoId: props.modelValue.periodoId,
    supportArea: undefined,
    referralReason: undefined,
    status: undefined,
    kpiBucket: 'all',
    search: undefined,
  })
}
</script>

<template>
  <UiCard
    title="Filtros de Canalizaciones"
    :description="
      isAdmin
        ? 'Filtrar por periodo, área, motivo, estatus, alumno o docente tutor'
        : 'Filtrar por periodo, área de apoyo, motivo, estatus o matrícula'
    "
  >
    <div class="filters-grid">
      <UiField
        :model-value="String(modelValue.periodoId)"
        label="Periodo escolar"
        as="select"
        :options="periodoOptions"
        @update:model-value="onPeriodoChange"
      />

      <UiField
        :model-value="modelValue.supportArea ?? ''"
        label="Área a canalizar"
        as="select"
        :options="areaOptions"
        @update:model-value="onAreaChange"
      />

      <UiField
        :model-value="modelValue.referralReason ?? ''"
        label="Motivo de canalización"
        as="select"
        :options="reasonOptions"
        @update:model-value="onReasonChange"
      />

      <UiField
        :model-value="modelValue.status ?? ''"
        label="Estatus del reporte"
        as="select"
        :options="statusOptions"
        @update:model-value="onStatusChange"
      />

      <UiField
        :model-value="modelValue.search ?? ''"
        :label="isAdmin ? 'Buscar alumno o tutor' : 'Buscar estudiante'"
        :placeholder="isAdmin ? 'Matrícula, alumno, carrera o tutor...' : 'Matrícula, nombre o carrera...'"
        @update:model-value="onSearchChange"
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
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.filters-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.875rem;
}

.btn-clear {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}
</style>
