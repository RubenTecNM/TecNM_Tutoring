<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UiAlert, UiBadge, UiButton, UiCard, UiText } from '../../../shared/components'
import { normalizeApiError } from '../../../shared/api/apiErrors'
import { metricsApi } from '../api/metricsApi'
import type { UnitFailureRow } from '../types/metrics'

const UNIT_HEADERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const

const props = defineProps<{
  periodoId: number
}>()

const emit = defineEmits<{
  saved: []
}>()

const rows = ref<UnitFailureRow[]>([])
const comments = ref('')
const isLoading = ref(false)
const isSaving = ref(false)
const isDirty = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

function toText(raw: string | number | null | undefined): string {
  return raw === null || raw === undefined ? '' : String(raw).trim()
}

function parsePercent(raw: string | number | null | undefined): number | null {
  const clean = toText(raw)
  if (!clean) return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}

function isHighFailure(raw: string | number | null | undefined): boolean {
  const n = parsePercent(raw)
  return n !== null && n > 30 && n <= 100
}

function calcRowAvg(units: string[]): number | null {
  const valid = units
    .map((u) => parsePercent(u))
    .filter((v): v is number => v !== null && v >= 0 && v <= 100)
  if (valid.length === 0) return null
  const sum = valid.reduce((acc, v) => acc + v, 0)
  return Number((sum / valid.length).toFixed(1))
}

const finalAverage = computed<number | null>(() => {
  const avgs = rows.value
    .map((r) => calcRowAvg(r.units))
    .filter((v): v is number => v !== null)
  if (avgs.length === 0) return null
  const sum = avgs.reduce((acc, v) => acc + v, 0)
  return Number((sum / avgs.length).toFixed(1))
})

function updateRowField(row: UnitFailureRow, key: 'subjectName' | 'teacherName', event: Event): void {
  row[key] = (event.target as HTMLInputElement).value
  isDirty.value = true
}

function updateUnit(row: UnitFailureRow, idx: number, event: Event): void {
  row.units[idx] = (event.target as HTMLInputElement).value
  isDirty.value = true
}

function addRow(): void {
  rows.value.push({
    id: `ut-${Date.now()}-${rows.value.length + 1}`,
    subjectName: '',
    teacherName: '',
    units: ['', '', '', '', '', '', '', ''],
  })
  isDirty.value = true
}

async function loadTracking(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const data = await metricsApi.getUnitFailureTracking(props.periodoId)
    rows.value = data.rows.map((r) => ({
      id: r.id,
      subjectName: toText(r.subjectName),
      teacherName: toText(r.teacherName),
      units: Array.from({ length: 8 }, (_, i) => toText(r.units?.[i])),
    }))
    comments.value = toText(data.comments)
    isDirty.value = false
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isLoading.value = false
  }
}

function validate(): string | null {
  for (let i = 0; i < rows.value.length; i++) {
    const row = rows.value[i]
    for (let u = 0; u < row.units.length; u++) {
      const clean = toText(row.units[u])
      if (clean) {
        const n = Number(clean)
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          return `Fila ${i + 1} (${row.subjectName || 'Materia'}, Unidad ${UNIT_HEADERS[u]}): el porcentaje debe estar entre 0 y 100%.`
        }
      }
    }
  }
  return null
}

async function handleSave(): Promise<void> {
  if (isSaving.value) return
  const err = validate()
  if (err) {
    errorMessage.value = err
    return
  }

  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await metricsApi.saveUnitFailureTracking({
      periodoId: props.periodoId,
      rows: rows.value.map((r) => ({
        id: r.id,
        subjectName: toText(r.subjectName),
        teacherName: toText(r.teacherName),
        units: r.units.map((u) => toText(u)),
      })),
      comments: toText(comments.value),
    })
    isDirty.value = false
    successMessage.value = 'Seguimiento de índices de reprobación por unidad guardado en el sistema.'
    emit('saved')
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isSaving.value = false
  }
}

watch(
  () => props.periodoId,
  () => {
    void loadTracking()
  },
  { immediate: true },
)
</script>

<template>
  <UiCard
    title="Seguimiento de Índices de Reprobación en Examen (Unidades I a VIII)"
    description="Captura y consulta directa en sistema sin subir archivos · Porcentajes 0–100% con alerta automática (> 30%)."
    :aria-busy="isLoading"
  >
    <div class="tracking-body">
      <div class="toolbar">
        <div class="toolbar-meta">
          <UiBadge tone="info">Periodo: {{ periodoId === 2 ? 'Agosto - Diciembre 2026' : 'Enero - Junio 2026' }}</UiBadge>
          <UiBadge v-if="isDirty" tone="warning">Cambios sin guardar</UiBadge>
        </div>
        <div class="toolbar-actions">
          <UiButton variant="secondary" class="btn-sm" :disabled="isSaving" @click="addRow">
            + Agregar materia
          </UiButton>
          <UiButton variant="primary" class="btn-sm" :loading="isSaving" :disabled="isLoading" @click="handleSave">
            Guardar seguimiento
          </UiButton>
        </div>
      </div>

      <UiAlert v-if="successMessage" tone="success" title="Guardado" dismissible @dismiss="successMessage = ''">
        <UiText>{{ successMessage }}</UiText>
      </UiAlert>
      <UiAlert v-if="errorMessage" tone="danger" title="Validación">
        <UiText>{{ errorMessage }}</UiText>
      </UiAlert>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th rowspan="2">Materia</th>
              <th rowspan="2">Docente</th>
              <th colspan="8" class="text-center">Unidades (% de reprobación, 0–100%)</th>
              <th rowspan="2" class="col-num-cell">Resultado % Reprob.</th>
            </tr>
            <tr>
              <th v-for="u in UNIT_HEADERS" :key="u" class="col-num-cell">{{ u }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>
                <input
                  :value="row.subjectName"
                  type="text"
                  class="cell-input min-name"
                  placeholder="Nombre de materia"
                  @input="updateRowField(row, 'subjectName', $event)"
                />
              </td>
              <td>
                <input
                  :value="row.teacherName"
                  type="text"
                  class="cell-input min-name"
                  placeholder="Docente titular"
                  @input="updateRowField(row, 'teacherName', $event)"
                />
              </td>
              <td v-for="(u, uIdx) in UNIT_HEADERS" :key="`${row.id}-${u}`" class="col-num-cell">
                <input
                  :value="row.units[uIdx]"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  class="num-input"
                  :class="{ failing: isHighFailure(row.units[uIdx]) }"
                  placeholder="—"
                  @input="updateUnit(row, uIdx, $event)"
                />
              </td>
              <td class="col-num-cell">
                <strong :class="{ 'text-danger': (calcRowAvg(row.units) ?? 0) > 30 }">
                  {{ calcRowAvg(row.units) !== null ? `${calcRowAvg(row.units)}%` : '—' }}
                </strong>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="totals-row">
              <td colspan="10" class="text-right"><strong>PROMEDIO FINAL DE REPROB. =</strong></td>
              <td class="col-num-cell">
                <strong :class="{ 'text-danger': (finalAverage ?? 0) > 30 }">
                  {{ finalAverage !== null ? `${finalAverage}%` : '—' }}
                </strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="comments-wrap">
        <label class="field-label">Comentarios del seguimiento por unidad</label>
        <textarea
          :value="comments"
          rows="2"
          class="textarea-input"
          placeholder="Observaciones y acuerdos preventivos sobre el índice de reprobación..."
          @input="comments = ($event.target as HTMLTextAreaElement).value; isDirty = true"
        />
      </div>
    </div>
  </UiCard>
</template>

<style scoped>
.tracking-body { display: flex; flex-direction: column; gap: 0.875rem; }
.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; }
.toolbar-meta, .toolbar-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.data-table th, .data-table td { border: 1px solid var(--color-border, #e2e8f0); padding: 0.35rem; vertical-align: middle; }
.data-table th { background-color: var(--color-bg-light, #f8fafc); color: var(--color-primary, #1b396a); white-space: nowrap; }
.totals-row td { background-color: var(--color-bg-light, #f8fafc); }
.text-center { text-align: center; }
.text-right { text-align: right; }
.col-num-cell { min-width: 80px; width: 80px; text-align: center; }
.min-name { min-width: 170px; }
.cell-input, .num-input, .textarea-input { width: 100%; padding: 0.35rem 0.45rem; font-size: 0.8rem; border: 1px solid var(--input-border, #cbd5e1); border-radius: 4px; background-color: var(--input-bg, #ffffff); color: var(--color-text-primary, #0f172a); font-family: inherit; }
.num-input { min-width: 64px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; appearance: textfield; -moz-appearance: textfield; }
.num-input::-webkit-inner-spin-button, .num-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.num-input.failing { color: var(--color-danger-strong, #dc2626); background-color: var(--color-danger-bg, #fef2f2); border-color: var(--color-danger, #ef4444); }
.text-danger { color: var(--color-danger-strong, #dc2626); }
.comments-wrap { display: flex; flex-direction: column; gap: 0.35rem; }
.field-label { font-size: 0.82rem; font-weight: 600; color: var(--color-text-primary, #0f172a); }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.8125rem; width: fit-content; }
</style>
