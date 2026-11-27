<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUnsavedChangesGuard } from '../../../shared/composables/useUnsavedChangesGuard'
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
import { sanitizePreviewUrl } from '../../../shared/utils/safePreviewUrl'
import { me } from '../../auth/api/authApi'
import type { UserResponse } from '../../auth/types/auth'
import { complianceApi } from '../api/complianceApi'
import { DeliverableStatusBadge } from '../components'
import type {
  Anexo15Payload,
  Anexo15SubjectRow,
  DeliverableTask,
  PreviewFormat,
  TemplatePreviewResult,
} from '../types/compliance'

const PASSING_GRADE = 70
const TOPIC_HEADERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const

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

const STUDENT_PRESETS: { value: string; controlNumber: string; label: string }[] = [
  { value: '', controlNumber: '', label: 'Capturar manualmente...' },
  { value: 'Ana Sofía Rodríguez Fuentes', controlNumber: 'I21050012', label: 'I21050012 · Ana Sofía Rodríguez Fuentes' },
  { value: 'Luis Fernando Torres Aguilar', controlNumber: 'I22050411', label: 'I22050411 · Luis Fernando Torres Aguilar' },
  { value: 'Jorge Eduardo Morales Dávila', controlNumber: 'I21050330', label: 'I21050330 · Jorge Eduardo Morales Dávila' },
  { value: 'Mateo Alejandro Garza Silva', controlNumber: 'I20050844', label: 'I20050844 · Mateo Alejandro Garza Silva' },
  { value: 'Mariana Lizeth Cantú Ortiz', controlNumber: 'I22050189', label: 'I22050189 · Mariana Lizeth Cantú Ortiz' },
]

const DEFAULT_SUBJECT_NAMES = [
  'Cálculo Diferencial',
  'Fundamentos de Programación',
  'Taller de Ética',
  'Matemáticas Discretas',
  'Taller de Administración',
  'Fundamentos de Investigación',
  '',
]

function buildDefaultSubjects(): Anexo15SubjectRow[] {
  return Array.from({ length: 7 }, (_, idx) => ({
    rowNumber: idx + 1,
    subjectName: DEFAULT_SUBJECT_NAMES[idx] ?? '',
    topics: ['', '', '', '', '', '', '', ''],
    observations: '',
  }))
}

const semester = ref('1er Semestre')
const studentPreset = ref('')
const studentControlNumber = ref('')
const studentName = ref('')
const subjects = ref<Anexo15SubjectRow[]>(buildDefaultSubjects())

const isReadOnly = computed(() => currentUser.value?.role === 'Admin')

function markDirty(): void {
  isDirty.value = true
}

function toText(raw: string | number | null | undefined): string {
  return raw === null || raw === undefined ? '' : String(raw).trim()
}

function parseGrade(raw: string | number | null | undefined): number | null {
  const clean = toText(raw)
  if (!clean) return null
  const num = Number(clean)
  return Number.isFinite(num) ? num : null
}

function isFailingGrade(raw: string | number | null | undefined): boolean {
  const num = parseGrade(raw)
  return num !== null && num >= 0 && num < PASSING_GRADE
}

function isPassingGrade(raw: string | number | null | undefined): boolean {
  const num = parseGrade(raw)
  return num !== null && num >= PASSING_GRADE && num <= 100
}

function isOutOfRange(raw: string | number | null | undefined): boolean {
  const clean = toText(raw)
  if (!clean) return false
  const num = Number(clean)
  return !Number.isFinite(num) || num < 0 || num > 100
}

function updateTopicGrade(row: Anexo15SubjectRow, topicIndex: number, event: Event): void {
  const target = event.target as HTMLInputElement
  row.topics[topicIndex] = target.value
  markDirty()
}

function failedTopicsInRow(row: Anexo15SubjectRow): number {
  return row.topics.filter((t) => isFailingGrade(t)).length
}

function isRowAlert(row: Anexo15SubjectRow): boolean {
  return failedTopicsInRow(row) > 1
}

const alertSubjects = computed(() =>
  subjects.value.filter((row) => isRowAlert(row)),
)

const totalFailedTopics = computed(() =>
  subjects.value.reduce((acc, row) => acc + failedTopicsInRow(row), 0),
)

function onStudentPresetChange(val: string): void {
  studentPreset.value = val
  const found = STUDENT_PRESETS.find((p) => p.value === val)
  if (val && found) {
    studentName.value = found.value
    studentControlNumber.value = found.controlNumber
    markDirty()
  }
}

function onStudentNameInput(val: string): void {
  studentName.value = val
  const found = STUDENT_PRESETS.find((p) => p.value === val)
  studentPreset.value = found ? found.value : ''
  if (found) {
    studentControlNumber.value = found.controlNumber
  }
  markDirty()
}

function hydrateForm(loadedTask: DeliverableTask): void {
  const pre = loadedTask.prefilledData ?? {}
  const saved = (loadedTask.formPayload ?? {}) as Partial<Anexo15Payload>

  semester.value = saved.semester || String(pre.semestre ?? '1er Semestre')
  studentName.value = saved.studentName || String(pre.alumno_nombre ?? '')
  const matchedPreset = STUDENT_PRESETS.find((p) => p.value === studentName.value)
  studentPreset.value = matchedPreset ? matchedPreset.value : ''
  studentControlNumber.value =
    saved.studentControlNumber ||
    String(pre.matricula ?? '') ||
    matchedPreset?.controlNumber ||
    ''

  if (Array.isArray(saved.subjects) && saved.subjects.length === 7) {
    subjects.value = saved.subjects.map((row, idx) => ({
      rowNumber: idx + 1,
      subjectName: toText(row.subjectName),
      topics: Array.from({ length: 8 }, (_, tIdx) => toText(row.topics?.[tIdx])),
      observations: toText(row.observations),
    }))
  } else {
    subjects.value = buildDefaultSubjects()
  }

  isDirty.value = false
}

function buildPayload(): Anexo15Payload {
  return {
    semester: toText(semester.value),
    studentControlNumber: toText(studentControlNumber.value) || undefined,
    studentName: toText(studentName.value),
    passingGrade: PASSING_GRADE,
    subjects: subjects.value.map((row, idx) => ({
      rowNumber: idx + 1,
      subjectName: toText(row.subjectName),
      topics: row.topics.map((t) => toText(t)),
      observations: toText(row.observations),
    })),
  }
}

function validateForm(strictSubmit: boolean): string | null {
  for (const row of subjects.value) {
    for (let i = 0; i < row.topics.length; i += 1) {
      if (isOutOfRange(row.topics[i])) {
        return `Asignatura ${row.rowNumber}, Tema ${TOPIC_HEADERS[i]}: la calificación debe estar entre 0 y 100.`
      }
    }
  }

  if (!strictSubmit) return null

  if (!toText(semester.value) || !toText(studentName.value)) {
    return 'Completa Semestre y Nombre del estudiante antes de entregar.'
  }

  const hasAtLeastOneSubject = subjects.value.some((r) => toText(r.subjectName).length > 0)
  if (!hasAtLeastOneSubject) {
    return 'Registra al menos una asignatura en la tabla.'
  }

  return null
}

async function loadAnexo15(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    currentUser.value = await me()
    const deliverableId = String(route.params.deliverableId ?? '')
    const loaded = await complianceApi.getDeliverableForm(deliverableId)
    task.value = loaded
    hydrateForm(loaded)
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
      ? 'Anexo 15 — Registro para Desempeño Académico entregado correctamente.'
      : 'Borrador del Anexo 15 guardado.'
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isSaving.value = false
  }
}

async function openPreview(): Promise<void> {
  if (!task.value || isPreviewing.value) return
  isPreviewOpen.value = true
  isPreviewing.value = true
  previewError.value = ''

  try {
    previewResult.value = await complianceApi.previewDeliverableTemplate(
      task.value.id,
      undefined,
      previewFormat.value,
    )
  } catch (error) {
    previewError.value = normalizeApiError(error).message
  } finally {
    isPreviewing.value = false
  }
}

async function handleExport(): Promise<void> {
  if (!task.value || isExporting.value) return

  const warning = validateForm(true)
  if (warning && !window.confirm(`${warning}\n\n¿Deseas exportar la plantilla .docx de todos modos?`)) {
    return
  }

  isExporting.value = true
  errorMessage.value = ''
  previewError.value = ''

  try {
    const blob = await complianceApi.exportDeliverableTemplate(task.value.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Anexo_15_${task.value.docenteClave}.docx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = 'Anexo 15 exportado desde la plantilla oficial (.docx).'
  } catch (error) {
    const normalized = normalizeApiError(error)
    const msg =
      normalized.status === 404 || normalized.status === 0
        ? 'El servicio de exportación .docx en backend aún no está activo.'
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

useUnsavedChangesGuard(isDirty, 'Hay cambios sin guardar en el Anexo 15. ¿Deseas salir?')

onMounted(() => {
  void loadAnexo15()
})
</script>

<template>
  <UiBasePage
    fluid
    title="Anexo 15 — Formato de Registro para Desempeño Académico"
    description="Control de calificaciones por tema (I a VIII) y detección de focos de alerta · Plantilla oficial: Anexo 15.docx"
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
          Exportar .docx
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

    <UiAlert v-if="isLoading" tone="info" title="Cargando Anexo 15..." />

    <template v-else-if="task">
      <!-- Alerta global de focos de alerta (>1 tema reprobado en alguna asignatura) -->
      <div v-if="alertSubjects.length > 0" class="anexo-block">
        <UiAlert tone="danger" title="Foco de alerta detectado">
          <UiText>
            {{ alertSubjects.length }} asignatura(s) presentan más de un tema reprobado (&lt; {{ PASSING_GRADE }}):
            <strong>
              {{ alertSubjects.map((s) => s.subjectName || `Asignatura ${s.rowNumber}`).join(', ') }}
            </strong>.
            Se recomienda revisar procesos de estudio y acudir con el tutor o Coordinador de Tutorías del Departamento Académico.
          </UiText>
        </UiAlert>
      </div>

      <!-- 1. Encabezado y Datos Generales -->
      <div class="anexo-block">
        <UiCard
          title="1. Datos Generales del Estudiante"
          description="Selecciona un estudiante del grupo o captura el nombre manualmente."
        >
          <div class="status-strip">
            <div class="status-meta">
              <DeliverableStatusBadge :status="task.status" />
              <UiBadge :tone="totalFailedTopics > 0 ? 'danger' : 'success'">
                Temas reprobados (&lt; {{ PASSING_GRADE }}): {{ totalFailedTopics }}
              </UiBadge>
              <UiBadge v-if="alertSubjects.length > 0" tone="danger">
                Focos de alerta: {{ alertSubjects.length }}
              </UiBadge>
            </div>
            <UiBadge v-if="isDirty" tone="warning">Cambios sin guardar</UiBadge>
          </div>

          <div class="header-grid">
            <UiField
              v-model="semester"
              label="Semestre *"
              placeholder="Ej. 1er Semestre"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
            <UiField
              v-if="!isReadOnly"
              :model-value="studentPreset"
              label="Seleccionar estudiante (catálogo del grupo)"
              as="select"
              :options="STUDENT_PRESETS"
              @update:model-value="onStudentPresetChange"
            />
            <UiField
              :model-value="studentName"
              label="Nombre del estudiante *"
              placeholder="Nombre completo y apellidos"
              :disabled="isReadOnly"
              @update:model-value="onStudentNameInput"
            />
          </div>
        </UiCard>
      </div>

      <!-- 2. Tabla de Asignaturas (1 a 7), Temas (I a VIII) y Observaciones -->
      <div class="anexo-block">
        <UiCard
          title="2. Registro de Calificaciones por Asignatura y Tema (I a VIII)"
          description="Calificaciones menores a 70 se resaltan en rojo automáticamente. Más de 1 tema reprobado activa foco de alerta."
        >
          <div class="grades-wrap">
            <table class="grades-table" aria-label="Registro de desempeño académico por tema">
              <thead>
                <tr>
                  <th scope="col" class="col-num">#</th>
                  <th scope="col" class="col-subj">Asignaturas</th>
                  <th v-for="topic in TOPIC_HEADERS" :key="topic" scope="col" class="col-topic">
                    {{ topic }}
                  </th>
                  <th scope="col" class="col-obs">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in subjects"
                  :key="row.rowNumber"
                  :class="{ 'row-alert': isRowAlert(row) }"
                >
                  <td class="col-num">{{ row.rowNumber }}.</td>
                  <td class="col-subj">
                    <div class="subj-cell">
                      <input
                        v-model="row.subjectName"
                        type="text"
                        class="cell-input"
                        :placeholder="`Asignatura ${row.rowNumber}`"
                        :disabled="isReadOnly"
                        :aria-label="`Asignatura ${row.rowNumber}`"
                        @input="markDirty"
                      />
                      <span v-if="isRowAlert(row)" class="alert-pill">
                        Foco de alerta ({{ failedTopicsInRow(row) }} reprobados)
                      </span>
                    </div>
                  </td>
                  <td v-for="(topic, tIdx) in TOPIC_HEADERS" :key="`${row.rowNumber}-${topic}`" class="col-topic">
                    <input
                      :value="row.topics[tIdx]"
                      type="number"
                      min="0"
                      max="100"
                      class="grade-input"
                      :class="{
                        failing: isFailingGrade(row.topics[tIdx]),
                        passing: isPassingGrade(row.topics[tIdx]),
                        invalid: isOutOfRange(row.topics[tIdx]),
                      }"
                      placeholder="—"
                      :disabled="isReadOnly"
                      :aria-label="`Asignatura ${row.rowNumber} tema ${topic}`"
                      @input="updateTopicGrade(row, tIdx, $event)"
                    />
                  </td>
                  <td class="col-obs">
                    <input
                      v-model="row.observations"
                      type="text"
                      class="cell-input"
                      placeholder="Observaciones..."
                      :disabled="isReadOnly"
                      :aria-label="`Observaciones asignatura ${row.rowNumber}`"
                      @input="markDirty"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UiCard>
      </div>

      <!-- 3. Instrucciones y Nota de Apoyo Oficial -->
      <div class="anexo-block">
        <UiCard title="Instrucciones y Orientación Institucional">
          <div class="instructions-box">
            <p>
              <strong>INSTRUCCIONES:</strong> En la primera columna anotas las asignaturas que estás cursando;
              en las casillas de temas vas anotando las calificaciones obtenidas en cada uno de los temas evaluados.
              Esto te permite llevar un registro y control de tus calificaciones así como visualizar tu desempeño global
              durante el transcurso de tu semestre, detectar <strong>“focos” de alerta</strong> en caso de que tengas
              más de un tema reprobado en las asignaturas que cursas, lo cual te indica que debes realizar una revisión
              en tus procesos de estudio e introducir cambios para obtener los resultados deseados.
            </p>
            <p class="red-ink-note">
              Las calificaciones reprobatorias (&lt; 70) se resaltan en <strong>tinta roja</strong> y las aprobatorias (&gt;= 70) en color normal.
            </p>
            <p class="support-note">
              En caso de que no puedas controlar tú solo(a) la situación, acude a tu <strong>tutor</strong> o
              <strong>Coordinador de Tutorías del Departamento Académico</strong> en busca de apoyo y orientación.
            </p>
          </div>
        </UiCard>
      </div>
    </template>

    <!-- Diálogo de Vista Previa (DOCX / PDF) -->
    <UiDialog v-model="isPreviewOpen" title="Vista previa: Anexo 15 — Desempeño Académico" class="preview-dialog">
      <div class="dialog-body">
        <UiAlert v-if="previewError" tone="danger" title="Aviso">
          <UiText>{{ previewError }}</UiText>
        </UiAlert>
        <UiAlert v-if="isPreviewing" tone="info" title="Generando vista previa..." />

        <iframe
          v-else-if="sanitizePreviewUrl(previewResult?.previewUrlOrContent)"
          :src="sanitizePreviewUrl(previewResult?.previewUrlOrContent)"
          sandbox="allow-same-origin"
          class="preview-frame"
          title="Vista previa Anexo 15"
        />

        <div v-else class="docx-preview">
          <div class="docx-header">
            <h3>ANEXO 15 · FORMATO DE REGISTRO PARA DESEMPEÑO ACADÉMICO</h3>
            <p><strong>Semestre:</strong> {{ semester }} · <strong>Estudiante:</strong> {{ studentName || '—' }}</p>
          </div>
          <table class="docx-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Asignaturas</th>
                <th v-for="t in TOPIC_HEADERS" :key="`pt-${t}`">{{ t }}</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in subjects" :key="`pr-${row.rowNumber}`">
                <td>{{ row.rowNumber }}.</td>
                <td>{{ row.subjectName || '—' }}</td>
                <td
                  v-for="(_, tIdx) in TOPIC_HEADERS"
                  :key="`pc-${row.rowNumber}-${tIdx}`"
                  :class="{ 'preview-failing': isFailingGrade(row.topics[tIdx]) }"
                >
                  {{ row.topics[tIdx] || '—' }}
                </td>
                <td>{{ row.observations || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <div class="docx-instructions">
            <p>
              <strong>INSTRUCCIONES:</strong> En la primera columna anotas las asignaturas que estás cursando; en las casillas de temas, las calificaciones obtenidas en cada tema evaluado para detectar focos de alerta (&gt; 1 tema reprobado).
            </p>
            <p>
              Calificaciones reprobatorias (&lt; {{ PASSING_GRADE }}) resaltadas en tinta roja. En caso de requerir apoyo, acude a tu tutor o Coordinador de Tutorías del Departamento Académico.
            </p>
          </div>
        </div>

        <div class="dialog-actions">
          <UiButton variant="secondary" @click="isPreviewOpen = false">Cerrar</UiButton>
          <UiButton variant="primary" :loading="isExporting" @click="handleExport">
            Exportar .docx
          </UiButton>
        </div>
      </div>
    </UiDialog>
  </UiBasePage>
</template>

<style scoped>
.anexo-block {
  margin-bottom: 1.25rem;
}

.anexo-block:last-child {
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

.header-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.grades-wrap {
  overflow-x: auto;
}

.grades-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.grades-table th,
.grades-table td {
  border: 1px solid var(--color-border, #e2e8f0);
  padding: 0.45rem;
  vertical-align: middle;
}

.grades-table th {
  background-color: var(--color-bg-light, #f8fafc);
  color: var(--color-primary, #1b396a);
  text-align: center;
}

.grades-table tr.row-alert {
  background-color: var(--color-danger-bg, #fef2f2);
}

.col-num { width: 36px; text-align: center; font-weight: 700; }
.col-subj { min-width: 210px; }
.col-topic { min-width: 84px; width: 84px; text-align: center; }
.col-obs { min-width: 200px; }

.subj-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.alert-pill {
  display: inline-block;
  width: fit-content;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.08rem 0.45rem;
  border-radius: 999px;
  background-color: var(--color-danger-badge, #fee2e2);
  color: var(--color-danger-text, #991b1b);
  border: 1px solid var(--color-danger-border, #fecaca);
}

.cell-input,
.grade-input {
  width: 100%;
  padding: 0.35rem 0.45rem;
  font-size: 0.8125rem;
  border: 1px solid var(--input-border, #cbd5e1);
  border-radius: 4px;
  background-color: var(--input-bg, #ffffff);
  color: var(--color-text-primary, #0f172a);
}

.grade-input {
  min-width: 68px;
  padding: 0.4rem 0.5rem;
  text-align: center;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  appearance: textfield;
  -moz-appearance: textfield;
}

.grade-input::-webkit-inner-spin-button,
.grade-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.grade-input.failing {
  color: var(--color-danger-strong, #dc2626);
  background-color: var(--color-danger-bg, #fef2f2);
  border-color: var(--color-danger, #ef4444);
}

.grade-input.passing {
  color: var(--color-success-strong, #15803d);
}

.grade-input.invalid {
  border-color: var(--color-warning-strong, #d97706);
}

.instructions-box {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--color-text-primary, #1e293b);
}

.instructions-box p {
  margin: 0;
}

.red-ink-note strong {
  color: var(--color-danger-strong, #dc2626);
}

.support-note {
  padding: 0.625rem 0.875rem;
  background-color: var(--color-primary-subtle, #ebf3ff);
  border-left: 4px solid var(--color-primary, #1b396a);
  border-radius: 6px;
}

.preview-dialog {
  max-width: 880px;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-frame {
  width: 100%;
  height: 460px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
}

.docx-preview {
  padding: 1rem;
  background-color: #ffffff;
  color: #0f172a;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  max-height: 480px;
  overflow: auto;
  font-size: 0.8rem;
}

.docx-header {
  text-align: center;
  margin-bottom: 0.75rem;
}

.docx-header h3 {
  margin: 0;
  color: #1b396a;
}

.docx-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

.docx-table th,
.docx-table td {
  border: 1px solid #cbd5e1;
  padding: 0.35rem;
  text-align: center;
}

.docx-table th:nth-child(2),
.docx-table td:nth-child(2),
.docx-table th:last-child,
.docx-table td:last-child {
  text-align: left;
}

.preview-failing {
  color: #dc2626;
  font-weight: 700;
  background-color: #fef2f2;
}

.docx-instructions {
  margin-top: 0.875rem;
  font-size: 0.74rem;
  line-height: 1.45;
  color: #334155;
}

.docx-instructions p {
  margin: 0.3rem 0;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (max-width: 640px) {
  .top-actions {
    width: 100%;
  }
  .top-actions :deep(button) {
    flex: 1 1 auto;
  }
}
</style>
