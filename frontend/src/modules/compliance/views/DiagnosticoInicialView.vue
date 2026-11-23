<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import {
  UiAlert,
  UiBadge,
  UiBasePage,
  UiButton,
  UiCard,
  UiDialog,
  UiField,
  UiText,
} from '../../../shared/components'
import { normalizeApiError } from '../../../shared/api/apiErrors'
import { me } from '../../auth/api/authApi'
import type { UserResponse } from '../../auth/types/auth'
import { complianceApi } from '../api/complianceApi'
import { DeliverableStatusBadge } from '../components'
import type {
  DeliverableTask,
  DiagnosticoInicialPayload,
  PreviewFormat,
  TemplatePreviewResult,
} from '../types/compliance'

const SHEET_KEY = 'informe_del_diagnostico' as const
const EXCEL_SHEET_NAME = 'Informe del Diagnóstico '

const route = useRoute()
const router = useRouter()

const currentUser = ref<UserResponse | null>(null)
const task = ref<DeliverableTask | null>(null)
const isLoading = ref(true)
const isSaving = ref(false)
const isPreviewing = ref(false)
const isExporting = ref(false)
const isDirty = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Vista previa
const isPreviewOpen = ref(false)
const previewFormat = ref<PreviewFormat>('pdf')
const previewResult = ref<TemplatePreviewResult | null>(null)
const previewError = ref('')

const SHIFT_OPTIONS = [
  { value: 'Matutino', label: 'Matutino' },
  { value: 'Vespertino', label: 'Vespertino' },
]

// Campos string para UiField numérico/fecha y conversión segura
const tutorName = ref('')
const reportDate = ref(new Date().toISOString().slice(0, 10))
const groupName = ref('1°A')
const shift = ref<'Matutino' | 'Vespertino'>('Matutino')
const periodLabel = ref('Enero - Junio 2026')
const totalReceivedInput = ref('0')
const droppedOutInput = ref('0')
const dropoutReasons = ref('')
const approvedInput = ref('0')
const failedInput = ref('0')
const groupCharacteristics = ref('')

const isReadOnly = computed(() => currentUser.value?.role === 'Admin')

const totalReceived = computed(() => Number(totalReceivedInput.value))
const droppedOut = computed(() => Number(droppedOutInput.value))
const approved = computed(() => Number(approvedInput.value))
const failed = computed(() => Number(failedInput.value))

const consistencySummary = computed(() => {
  const total = Number.isFinite(totalReceived.value) && totalReceived.value > 0 ? totalReceived.value : 0
  const sumResult = (Number.isFinite(approved.value) ? approved.value : 0) +
    (Number.isFinite(failed.value) ? failed.value : 0)
  const approvalPct = total > 0 ? Number(((approved.value * 100) / total).toFixed(1)) : 0
  const failurePct = total > 0 ? Number(((failed.value * 100) / total).toFixed(1)) : 0
  const dropoutPct = total > 0 ? Number(((droppedOut.value * 100) / total).toFixed(1)) : 0
  return { total, sumResult, approvalPct, failurePct, dropoutPct }
})

function markDirty(): void {
  isDirty.value = true
}

function hydrateForm(loadedTask: DeliverableTask, user: UserResponse | null): void {
  const pre = loadedTask.prefilledData ?? {}
  const saved = (loadedTask.formPayload ?? {}) as Partial<DiagnosticoInicialPayload>
  const defaultPeriod =
    loadedTask.periodoId === 2 ? 'Agosto - Diciembre 2026' : 'Enero - Junio 2026'

  tutorName.value =
    saved.tutorName || String(pre.docente_nombre ?? '') || user?.name || 'Docente Tutor'
  reportDate.value = saved.reportDate || new Date().toISOString().slice(0, 10)
  groupName.value = saved.groupName || String(pre.grupo ?? '1°A')
  shift.value = saved.shift === 'Vespertino' || pre.turno === 'Vespertino' ? 'Vespertino' : 'Matutino'
  periodLabel.value = saved.periodLabel || defaultPeriod

  const prefilledTotal = typeof pre.total_alumnos === 'number' ? pre.total_alumnos : 0
  totalReceivedInput.value = String(saved.totalReceivedStudents ?? prefilledTotal)
  droppedOutInput.value = String(saved.droppedOutCount ?? 0)
  dropoutReasons.value = saved.dropoutReasons ?? ''
  approvedInput.value = String(saved.approvedCount ?? 0)
  failedInput.value = String(saved.failedCount ?? 0)
  groupCharacteristics.value = saved.groupCharacteristics ?? ''
  isDirty.value = false
}

function buildPayload(): DiagnosticoInicialPayload {
  return {
    sheetKey: SHEET_KEY,
    excelSheetName: EXCEL_SHEET_NAME,
    tutorName: tutorName.value.trim(),
    reportDate: reportDate.value,
    groupName: groupName.value.trim(),
    shift: shift.value,
    periodLabel: periodLabel.value.trim(),
    totalReceivedStudents: Number(totalReceivedInput.value),
    droppedOutCount: Number(droppedOutInput.value),
    dropoutReasons: dropoutReasons.value.trim(),
    approvedCount: Number(approvedInput.value),
    failedCount: Number(failedInput.value),
    groupCharacteristics: groupCharacteristics.value.trim(),
  }
}

function validateForm(strictSubmit: boolean): string | null {
  const total = totalReceived.value
  const drop = droppedOut.value
  const appr = approved.value
  const fail = failed.value

  if (!Number.isInteger(total) || total < 0) {
    return 'Pregunta 1: el total de alumnos recibidos debe ser un entero mayor o igual a 0.'
  }
  if (!Number.isInteger(drop) || drop < 0) {
    return 'Pregunta 2: la cantidad de alumnos que desertaron debe ser un entero mayor o igual a 0.'
  }
  if (drop > total) {
    return 'Pregunta 2: los alumnos que desertaron no pueden superar el total recibido.'
  }
  if (!Number.isInteger(appr) || appr < 0 || !Number.isInteger(fail) || fail < 0) {
    return 'Pregunta 3: aprobados y reprobados deben ser enteros mayores o igual a 0.'
  }
  if (appr + fail > total) {
    return `Pregunta 3: aprobados (${appr}) + reprobados (${fail}) supera el total de alumnos recibidos (${total}).`
  }

  if (!strictSubmit) return null

  if (!tutorName.value.trim() || !reportDate.value || !groupName.value.trim() || !periodLabel.value.trim()) {
    return 'Completa todos los campos del encabezado (Tutor, Fecha, Grupo, Turno y Período).'
  }
  if (drop > 0 && !dropoutReasons.value.trim()) {
    return 'Pregunta 2: describe los motivos de deserción para los alumnos registrados.'
  }
  if (total > 0 && appr + fail + drop > total) {
    return `Inconsistencia: aprobados (${appr}) + reprobados (${fail}) + desertores (${drop}) excede el total recibido (${total}).`
  }
  if (!groupCharacteristics.value.trim()) {
    return 'Pregunta 4: especifica las características generales del grupo que recibes.'
  }
  return null
}

async function loadDiagnostico(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    currentUser.value = await me()
    const deliverableId = String(route.params.deliverableId ?? '')
    const loaded = await complianceApi.getDeliverableForm(deliverableId)
    task.value = loaded
    hydrateForm(loaded, currentUser.value)
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isLoading.value = false
  }
}

async function handleSave(submit: boolean): Promise<void> {
  if (!task.value || isSaving.value || isReadOnly.value) return

  const err = validateForm(submit)
  if (err) {
    errorMessage.value = err
    return
  }

  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const updated = await complianceApi.saveDeliverableForm(task.value.id, {
      formPayload: buildPayload() as unknown as Record<string, unknown>,
      submit,
    })
    task.value = updated
    isDirty.value = false
    successMessage.value = submit
      ? 'Diagnóstico Inicial del Grupo Tutorado entregado correctamente.'
      : 'Borrador del Diagnóstico Inicial guardado.'
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isSaving.value = false
  }
}

async function openPreview(): Promise<void> {
  if (!task.value || isPreviewing.value) return
  isPreviewOpen.value = true
  await fetchPreview()
}

async function fetchPreview(): Promise<void> {
  if (!task.value || isPreviewing.value) return
  isPreviewing.value = true
  previewError.value = ''

  try {
    previewResult.value = await complianceApi.previewDeliverableTemplate(
      task.value.id,
      SHEET_KEY,
      previewFormat.value,
    )
  } catch (error) {
    previewError.value = normalizeApiError(error).message
  } finally {
    isPreviewing.value = false
  }
}

async function switchPreviewFormat(fmt: PreviewFormat): Promise<void> {
  if (previewFormat.value === fmt || isPreviewing.value) return
  previewFormat.value = fmt
  await fetchPreview()
}

async function handleExport(): Promise<void> {
  if (!task.value || isExporting.value) return

  const warning = validateForm(true)
  if (warning && !window.confirm(`${warning}\n\n¿Deseas exportar la plantilla .xlsx de todos modos?`)) {
    return
  }

  isExporting.value = true
  errorMessage.value = ''
  previewError.value = ''

  try {
    const blob = await complianceApi.exportDeliverableTemplate(task.value.id, SHEET_KEY)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `DIAGNOSTICO-INICIAL_${task.value.docenteClave}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = 'Diagnóstico Inicial exportado desde la plantilla oficial (.xlsx).'
  } catch (error) {
    const normalized = normalizeApiError(error)
    const msg =
      normalized.status === 404 || normalized.status === 0
        ? 'El servicio de exportación .xlsx en backend aún no está activo.'
        : normalized.message
    if (isPreviewOpen.value) {
      previewError.value = msg
    } else {
      errorMessage.value = msg
    }
  } finally {
    isExporting.value = false
  }
}

function goBack(): void {
  void router.push({ name: 'compliance-dashboard' })
}

onBeforeRouteLeave(() => {
  if (!isDirty.value) return true
  return window.confirm('Hay cambios sin guardar en el Diagnóstico Inicial. ¿Deseas salir?')
})

onMounted(() => {
  void loadDiagnostico()
})
</script>

<template>
  <UiBasePage
    fluid
    title="Análisis del Diagnóstico Inicial del Grupo Tutorado"
    description="Instituto Tecnológico Superior de Monclova · Plantilla oficial: DIAGNOSTICO-INICIAL TUTORIAS - FJ-26.xlsx (Hoja: Informe del Diagnóstico)"
  >
    <template #actions>
      <div class="top-actions">
        <UiButton variant="secondary" @click="goBack">
          ← Volver a Cumplimiento
        </UiButton>
        <UiButton variant="secondary" :disabled="isLoading || isPreviewing" @click="openPreview">
          Vista previa
        </UiButton>
        <UiButton variant="secondary" :loading="isExporting" :disabled="isLoading" @click="handleExport">
          Exportar .xlsx
        </UiButton>
        <UiButton
          v-if="!isReadOnly"
          variant="secondary"
          :loading="isSaving"
          :disabled="isLoading"
          @click="handleSave(false)"
        >
          Guardar borrador
        </UiButton>
        <UiButton
          v-if="!isReadOnly"
          variant="primary"
          :loading="isSaving"
          :disabled="isLoading"
          @click="handleSave(true)"
        >
          Guardar y entregar
        </UiButton>
      </div>
    </template>

    <UiAlert
      v-if="successMessage"
      tone="success"
      title="Operación exitosa"
      dismissible
      @dismiss="successMessage = ''"
    >
      <UiText>{{ successMessage }}</UiText>
    </UiAlert>

    <UiAlert v-if="errorMessage" tone="danger" title="Validación">
      <UiText>{{ errorMessage }}</UiText>
    </UiAlert>

    <UiAlert v-if="isLoading" tone="info" title="Cargando Diagnóstico Inicial..." />

    <template v-else-if="task">
      <!-- 1. Encabezado y Datos Generales -->
      <div class="diag-block">
        <UiCard
          title="Encabezado y Datos Generales"
          description="Datos pre-rellenados del tutor, grupo y periodo escolar."
        >
          <div class="status-strip">
            <div class="status-meta">
              <DeliverableStatusBadge :status="task.status" />
              <code class="meta-code">Clave tutor: {{ task.docenteClave }}</code>
              <code class="meta-code">Hoja: {{ EXCEL_SHEET_NAME.trim() }}</code>
            </div>
            <UiBadge v-if="isDirty" tone="warning">Cambios sin guardar</UiBadge>
          </div>

          <div class="header-grid">
            <UiField
              v-model="tutorName"
              label="Tutor *"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
            <UiField
              v-model="reportDate"
              label="Fecha *"
              type="date"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
            <UiField
              v-model="groupName"
              label="Grupo *"
              placeholder="Ej. 1°A / 4°B"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
            <UiField
              v-model="shift"
              label="Turno *"
              as="select"
              :options="SHIFT_OPTIONS"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
            <UiField
              v-model="periodLabel"
              label="Período *"
              placeholder="Ej. Enero - Junio 2026"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
          </div>
        </UiCard>
      </div>

      <!-- 2. Preguntas Estructuradas (1 a 4) -->
      <div class="diag-block">
        <UiCard
          title="Cuestionario del Diagnóstico Inicial (Preguntas 1 a 4)"
          description="Completa los conteos numéricos y descripciones solicitadas en el formato oficial."
        >
          <div class="questions-stack">
            <!-- Pregunta 1 -->
            <div class="question-box">
              <span class="question-title">
                1. Mencione el total de alumnos que recibió en su grupo tutorado
              </span>
              <div class="q1-row">
                <UiField
                  v-model="totalReceivedInput"
                  label="Total de alumnos recibidos *"
                  type="number"
                  min="0"
                  :disabled="isReadOnly"
                  @update:model-value="markDirty"
                />
                <div class="live-metrics">
                  <UiBadge tone="success">Aprobación: {{ consistencySummary.approvalPct }}%</UiBadge>
                  <UiBadge tone="danger">Reprobación: {{ consistencySummary.failurePct }}%</UiBadge>
                  <UiBadge tone="warning">Deserción: {{ consistencySummary.dropoutPct }}%</UiBadge>
                </div>
              </div>
            </div>

            <!-- Pregunta 2 -->
            <div class="question-box">
              <span class="question-title">
                2. ¿Cuántos alumnos desertaron? Describa los motivos de cada uno.
              </span>
              <div class="q2-grid">
                <UiField
                  v-model="droppedOutInput"
                  label="Cantidad de alumnos que desertaron *"
                  type="number"
                  min="0"
                  :disabled="isReadOnly"
                  @update:model-value="markDirty"
                />
                <div class="form-field-textarea">
                  <label for="dropout-reasons" class="textarea-label">
                    Descripción de los motivos de cada alumno
                  </label>
                  <textarea
                    id="dropout-reasons"
                    v-model="dropoutReasons"
                    rows="3"
                    class="custom-textarea"
                    :disabled="isReadOnly"
                    placeholder="Indica los motivos de deserción detectados (económicos, personales, cambio de carrera, etc.)..."
                    @input="markDirty"
                  />
                </div>
              </div>
            </div>

            <!-- Pregunta 3 -->
            <div class="question-box">
              <span class="question-title">
                3. ¿Del total de alumnos recibidos, especifique cuántos alumnos aprobaron y cuántos reprobaron?
              </span>
              <div class="q3-grid">
                <UiField
                  v-model="approvedInput"
                  label="Alumnos que aprobaron *"
                  type="number"
                  min="0"
                  :disabled="isReadOnly"
                  @update:model-value="markDirty"
                />
                <UiField
                  v-model="failedInput"
                  label="Alumnos que reprobaron *"
                  type="number"
                  min="0"
                  :disabled="isReadOnly"
                  @update:model-value="markDirty"
                />
              </div>
              <span
                class="consistency-note"
                :class="{ invalid: consistencySummary.sumResult > consistencySummary.total && consistencySummary.total > 0 }"
              >
                Suma Aprobados + Reprobados: {{ consistencySummary.sumResult }} / {{ consistencySummary.total }} recibidos.
              </span>
            </div>

            <!-- Pregunta 4 -->
            <div class="question-box">
              <span class="question-title">
                4. Especifique las características generales del grupo que recibe
              </span>
              <div class="form-field-textarea">
                <label for="group-characteristics" class="textarea-label">
                  Características generales del grupo *
                </label>
                <textarea
                  id="group-characteristics"
                  v-model="groupCharacteristics"
                  rows="5"
                  class="custom-textarea"
                  :disabled="isReadOnly"
                  placeholder="Describe dinámica grupal, nivel académico, áreas de oportunidad, necesidades de apoyo y fortalezas..."
                  @input="markDirty"
                />
              </div>
            </div>
          </div>
        </UiCard>
      </div>
    </template>

    <!-- Diálogo de Vista Previa (PDF / XLSX) -->
    <UiDialog v-model="isPreviewOpen" title="Vista previa: Diagnóstico Inicial del Grupo Tutorado" class="preview-dialog">
      <div class="dialog-body">
        <div class="preview-toolbar">
          <div class="format-switch">
            <UiButton
              :variant="previewFormat === 'pdf' ? 'primary' : 'secondary'"
              class="btn-sm"
              :disabled="isPreviewing"
              @click="switchPreviewFormat('pdf')"
            >
              Vista PDF
            </UiButton>
            <UiButton
              :variant="previewFormat === 'xlsx' ? 'primary' : 'secondary'"
              class="btn-sm"
              :disabled="isPreviewing"
              @click="switchPreviewFormat('xlsx')"
            >
              Vista XLSX
            </UiButton>
          </div>
          <UiButton variant="primary" class="btn-sm" :loading="isExporting" @click="handleExport">
            Exportar .xlsx
          </UiButton>
        </div>

        <UiAlert v-if="previewError" tone="danger" title="Aviso">
          <UiText>{{ previewError }}</UiText>
        </UiAlert>
        <UiAlert v-if="isPreviewing" tone="info" title="Generando vista previa..." />

        <iframe
          v-else-if="previewResult?.previewUrlOrContent"
          :src="previewResult.previewUrlOrContent"
          class="preview-frame"
          title="Vista previa Diagnóstico Inicial"
        />

        <!-- Vista previa estructurada fiel a la hoja Informe del Diagnóstico -->
        <div v-else class="sheet-preview">
          <div class="sheet-header">
            <h3>INSTITUTO TECNOLÓGICO SUPERIOR DE MONCLOVA</h3>
            <p>ANÁLISIS DEL DIAGNÓSTICO INICIAL DEL GRUPO TUTORADO</p>
          </div>
          <div class="sheet-meta">
            <div><strong>Tutor:</strong> {{ tutorName }}</div>
            <div><strong>Fecha:</strong> {{ reportDate }}</div>
            <div><strong>Grupo:</strong> {{ groupName }}</div>
            <div><strong>Turno:</strong> {{ shift }}</div>
            <div><strong>Período:</strong> {{ periodLabel }}</div>
          </div>
          <table class="sheet-table">
            <tbody>
              <tr>
                <th>1. Total de alumnos recibidos</th>
                <td>{{ totalReceivedInput }}</td>
              </tr>
              <tr>
                <th>2. Alumnos que desertaron y motivos</th>
                <td>
                  <strong>{{ droppedOutInput }} desertores</strong>
                  <div v-if="dropoutReasons">{{ dropoutReasons }}</div>
                </td>
              </tr>
              <tr>
                <th>3. Aprobados y reprobados</th>
                <td>Aprobados: <strong>{{ approvedInput }}</strong> · Reprobados: <strong>{{ failedInput }}</strong></td>
              </tr>
              <tr>
                <th>4. Características generales del grupo</th>
                <td>{{ groupCharacteristics || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="dialog-actions">
          <UiButton variant="secondary" @click="isPreviewOpen = false">Cerrar</UiButton>
        </div>
      </div>
    </UiDialog>
  </UiBasePage>
</template>

<style scoped>
.diag-block {
  margin-bottom: 1.25rem;
}

.diag-block:last-child {
  margin-bottom: 0;
}

.top-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.status-strip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.status-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.meta-code {
  font-family: monospace;
  font-size: 0.8rem;
  padding: 0.15rem 0.45rem;
  background-color: var(--color-gray-100, #f1f5f9);
  border-radius: 4px;
}

.header-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.questions-stack {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.question-box {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background-color: var(--color-bg-light, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-left: 4px solid var(--color-primary, #1b396a);
  border-radius: 8px;
}

.question-title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text-primary, #0f172a);
}

.q1-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 1rem;
}

.live-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.q2-grid {
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr;
  gap: 1rem;
  align-items: start;
}

.q3-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 260px));
  gap: 1rem;
}

@media (max-width: 640px) {
  .q2-grid {
    grid-template-columns: 1fr;
  }
}

.consistency-note {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #64748b);
}

.consistency-note.invalid {
  color: var(--color-danger-strong, #dc2626);
  font-weight: 600;
}

.form-field-textarea {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.textarea-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary, #0f172a);
}

.custom-textarea {
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-family: inherit;
  font-size: 0.875rem;
  color: var(--color-text-primary, #0f172a);
  background-color: var(--input-bg, #ffffff);
  border: 1px solid var(--input-border, #cbd5e1);
  border-radius: 6px;
  resize: vertical;
}

.preview-dialog {
  max-width: 820px;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.format-switch,
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.preview-frame {
  width: 100%;
  height: 460px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
}

.sheet-preview {
  padding: 1.25rem;
  background-color: #ffffff;
  color: #0f172a;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.84rem;
}

.sheet-header {
  text-align: center;
  margin-bottom: 1rem;
}

.sheet-header h3 {
  margin: 0;
  color: #1b396a;
}

.sheet-header p {
  margin: 0.25rem 0 0;
  font-weight: 600;
}

.sheet-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.5rem 1rem;
  margin-bottom: 1rem;
}

.sheet-table {
  width: 100%;
  border-collapse: collapse;
}

.sheet-table th,
.sheet-table td {
  border: 1px solid #cbd5e1;
  padding: 0.6rem;
  text-align: left;
  vertical-align: top;
}

.sheet-table th {
  width: 38%;
  background-color: #f1f5f9;
}

.btn-sm {
  padding: 0.3rem 0.7rem;
  font-size: 0.8125rem;
}
</style>
