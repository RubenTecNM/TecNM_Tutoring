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
  Anexo14IncidenceCode,
  Anexo14Payload,
  Anexo14StudentRow,
  DeliverableTask,
  PlanTrabajoSignatureMode,
  PreviewFormat,
  TemplatePreviewResult,
} from '../types/compliance'

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

// Firma canvas opcional
const signatureCanvas = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)

const INCIDENCE_CATALOG: { code: Anexo14IncidenceCode; short: string; label: string }[] = [
  { code: 1, short: '1', label: '1. Competencia no alcanzada' },
  { code: 2, short: '2', label: '2. Inasistencias' },
  { code: 3, short: '3', label: '3. Indisciplina' },
  { code: 4, short: '4', label: '4. No entrega trab/pract' },
  { code: 5, short: '5', label: '5. Apoyo psicológico' },
  { code: 6, short: '6', label: '6. Apoyo económico (beca)' },
  { code: 7, short: '7', label: '7. Otro' },
]

const CAREER_OPTIONS = [
  { value: 'Ingeniería en Sistemas Computacionales', label: 'Ingeniería en Sistemas Computacionales' },
  { value: 'Ingeniería Industrial', label: 'Ingeniería Industrial' },
  { value: 'Ingeniería Mecánica', label: 'Ingeniería Mecánica' },
  { value: 'Ingeniería Electrónica', label: 'Ingeniería Electrónica' },
  { value: 'Ingeniería en Gestión Empresarial', label: 'Ingeniería en Gestión Empresarial' },
  { value: 'Ingeniería en Energías Renovables', label: 'Ingeniería en Energías Renovables' },
  { value: 'Ingeniería Informática', label: 'Ingeniería Informática' },
]

const MONTH_OPTIONS = [
  { value: 'Febrero', label: 'Febrero' },
  { value: 'Marzo', label: 'Marzo' },
  { value: 'Abril', label: 'Abril' },
  { value: 'Mayo', label: 'Mayo' },
  { value: 'Junio', label: 'Junio' },
  { value: 'Septiembre', label: 'Septiembre' },
  { value: 'Octubre', label: 'Octubre' },
  { value: 'Noviembre', label: 'Noviembre' },
  { value: 'Diciembre', label: 'Diciembre' },
]

const EVALUATION_OPTIONS = [
  { value: '1ra Evaluación Parcial', label: '1ra Evaluación Parcial' },
  { value: '2da Evaluación Parcial', label: '2da Evaluación Parcial' },
  { value: '3ra Evaluación Parcial', label: '3ra Evaluación Parcial' },
  { value: 'Evaluación Final / Ordinaria', label: 'Evaluación Final / Ordinaria' },
]

const SIGNATURE_MODE_OPTIONS: { value: PlanTrabajoSignatureMode; label: string }[] = [
  { value: 'name_confirmation', label: 'Confirmación con nombre del tutor' },
  { value: 'canvas', label: 'Firma dibujada en pantalla (canvas)' },
  { value: 'image', label: 'Cargar imagen de firma (PNG/JPG)' },
]

const DEFAULT_SUBJECTS = [
  'Cálculo Diferencial',
  'Fundamentos de Programación',
  'Taller de Ética',
  'Matemáticas Discretas',
  'Taller de Administración',
  'Fundamentos de Investigación',
]

function buildDefaultStudents(): Anexo14StudentRow[] {
  const sample = [
    { controlNumber: 'I21050012', studentName: 'Ana Sofía Rodríguez Fuentes' },
    { controlNumber: 'I22050411', studentName: 'Luis Fernando Torres Aguilar' },
    { controlNumber: 'I21050330', studentName: 'Jorge Eduardo Morales Dávila' },
    { controlNumber: 'I20050844', studentName: 'Mateo Alejandro Garza Silva' },
    { controlNumber: 'I22050189', studentName: 'Mariana Lizeth Cantú Ortiz' },
  ]
  return sample.map((s, idx) => ({
    listNumber: idx + 1,
    controlNumber: s.controlNumber,
    studentName: s.studentName,
    incidencesBySubject: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] },
  }))
}

const instituteName = ref('Instituto Tecnológico Superior de Monclova')
const career = ref('Ingeniería en Sistemas Computacionales')
const semester = ref('1er Semestre')
const monthLabel = ref('Marzo')
const tutorName = ref('')
const groupName = ref('1°A')
const classroom = ref('A-102')
const partialEvaluation = ref('1ra Evaluación Parcial')
const subjects = ref<string[]>([...DEFAULT_SUBJECTS])
const students = ref<Anexo14StudentRow[]>(buildDefaultStudents())
const individualSessionsInput = ref('0')
const groupSessionsInput = ref('0')
const observations = ref('')
const reportDate = ref(new Date().toISOString().slice(0, 10))
const tutorSignatureConfirmed = ref(false)
const signatureMode = ref<PlanTrabajoSignatureMode>('name_confirmation')
const signatureDataUrl = ref<string | undefined>(undefined)
const coordinatorName = ref('Lic. María Fernanda López Garza')

const isReadOnly = computed(() => currentUser.value?.role === 'Admin')

const totalMarkedIncidences = computed(() =>
  students.value.reduce((acc, row) => {
    const rowCount = Object.values(row.incidencesBySubject).reduce(
      (sum, list) => sum + list.length,
      0,
    )
    return acc + rowCount
  }, 0),
)

function markDirty(): void {
  isDirty.value = true
}

function isIncidenceChecked(
  row: Anexo14StudentRow,
  subjectIdx: number,
  code: Anexo14IncidenceCode,
): boolean {
  return (row.incidencesBySubject[subjectIdx] ?? []).includes(code)
}

function toggleIncidence(
  row: Anexo14StudentRow,
  subjectIdx: number,
  code: Anexo14IncidenceCode,
): void {
  if (isReadOnly.value) return
  const current = row.incidencesBySubject[subjectIdx] ?? []
  if (current.includes(code)) {
    row.incidencesBySubject[subjectIdx] = current.filter((c) => c !== code)
  } else {
    row.incidencesBySubject[subjectIdx] = [...current, code].sort((a, b) => a - b)
  }
  markDirty()
}

function addStudentRow(): void {
  if (isReadOnly.value) return
  students.value.push({
    listNumber: students.value.length + 1,
    controlNumber: '',
    studentName: '',
    incidencesBySubject: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] },
  })
  markDirty()
}

function removeStudentRow(idx: number): void {
  if (isReadOnly.value || students.value.length <= 1) return
  students.value.splice(idx, 1)
  students.value.forEach((s, i) => {
    s.listNumber = i + 1
  })
  markDirty()
}

function hydrateForm(loadedTask: DeliverableTask, user: UserResponse | null): void {
  const pre = loadedTask.prefilledData ?? {}
  const saved = (loadedTask.formPayload ?? {}) as Partial<Anexo14Payload>

  instituteName.value = saved.instituteName || String(pre.plantel ?? 'Instituto Tecnológico Superior de Monclova')
  career.value = saved.career || String(pre.carrera ?? 'Ingeniería en Sistemas Computacionales')
  semester.value = saved.semester || String(pre.semestre ?? '1er Semestre')
  monthLabel.value = saved.monthLabel || (loadedTask.periodoId === 2 ? 'Octubre' : 'Marzo')
  tutorName.value = saved.tutorName || String(pre.docente_nombre ?? '') || user?.name || 'Docente Tutor'
  groupName.value = saved.groupName || String(pre.grupo ?? '1°A')
  classroom.value = saved.classroom || String(pre.aula ?? 'A-102')
  partialEvaluation.value = saved.partialEvaluation || '1ra Evaluación Parcial'

  subjects.value =
    Array.isArray(saved.subjects) && saved.subjects.length === 6
      ? [...saved.subjects]
      : [...DEFAULT_SUBJECTS]

  students.value =
    Array.isArray(saved.students) && saved.students.length > 0
      ? saved.students.map((s, idx) => ({
          listNumber: idx + 1,
          controlNumber: s.controlNumber ?? '',
          studentName: s.studentName ?? '',
          incidencesBySubject: {
            0: [...(s.incidencesBySubject?.[0] ?? [])],
            1: [...(s.incidencesBySubject?.[1] ?? [])],
            2: [...(s.incidencesBySubject?.[2] ?? [])],
            3: [...(s.incidencesBySubject?.[3] ?? [])],
            4: [...(s.incidencesBySubject?.[4] ?? [])],
            5: [...(s.incidencesBySubject?.[5] ?? [])],
          },
        }))
      : buildDefaultStudents()

  individualSessionsInput.value = String(saved.individualSessions ?? 0)
  groupSessionsInput.value = String(saved.groupSessions ?? 0)
  observations.value = saved.observations ?? ''
  reportDate.value = saved.reportDate || new Date().toISOString().slice(0, 10)
  tutorSignatureConfirmed.value = Boolean(saved.tutorSignatureConfirmed)
  signatureMode.value = saved.signatureMode ?? 'name_confirmation'
  signatureDataUrl.value = saved.signatureDataUrl
  coordinatorName.value = saved.coordinatorName || 'Lic. María Fernanda López Garza'
  isDirty.value = false
}

function buildPayload(): Anexo14Payload {
  return {
    instituteName: instituteName.value.trim(),
    career: career.value,
    semester: semester.value.trim(),
    monthLabel: monthLabel.value,
    tutorName: tutorName.value.trim(),
    groupName: groupName.value.trim(),
    classroom: classroom.value.trim(),
    partialEvaluation: partialEvaluation.value,
    subjects: subjects.value.map((s, i) => s.trim() || `Asignatura ${i + 1}`),
    students: students.value.map((s, idx) => ({
      listNumber: idx + 1,
      controlNumber: s.controlNumber.trim().toUpperCase(),
      studentName: s.studentName.trim(),
      incidencesBySubject: s.incidencesBySubject,
    })),
    individualSessions: Number(individualSessionsInput.value),
    groupSessions: Number(groupSessionsInput.value),
    observations: observations.value.trim(),
    reportDate: reportDate.value,
    tutorSignatureConfirmed: tutorSignatureConfirmed.value,
    signatureMode: signatureMode.value,
    signatureDataUrl: signatureDataUrl.value,
    coordinatorName: coordinatorName.value.trim(),
  }
}

function validateForm(strictSubmit: boolean): string | null {
  const ind = Number(individualSessionsInput.value)
  const grp = Number(groupSessionsInput.value)
  if (!Number.isInteger(ind) || ind < 0 || !Number.isInteger(grp) || grp < 0) {
    return 'Las sesiones individuales y grupales deben ser números enteros mayores o iguales a 0.'
  }

  if (!strictSubmit) return null

  if (!instituteName.value.trim() || !career.value || !semester.value.trim() || !groupName.value.trim()) {
    return 'Completa los datos obligatorios del encabezado (Instituto, Carrera, Semestre y Grupo).'
  }
  const hasInvalidStudent = students.value.some((s) => !s.controlNumber.trim() || !s.studentName.trim())
  if (hasInvalidStudent) {
    return 'Todos los renglones de estudiantes deben incluir No. de Control y Nombre.'
  }
  if (!observations.value.trim()) {
    return 'Captura las Observaciones de la sesión y estrategias utilizadas.'
  }
  if (!tutorSignatureConfirmed.value) {
    return 'Confirma la firma del tutor antes de entregar el Anexo 14.'
  }
  return null
}

async function loadAnexo14(): Promise<void> {
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
      ? 'Anexo 14 — Seguimiento de la Trayectoria Académica entregado correctamente.'
      : 'Borrador del Anexo 14 guardado.'
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isSaving.value = false
  }
}

// Firma en canvas HTML5
function startDrawing(event: PointerEvent): void {
  const canvas = signatureCanvas.value
  if (!canvas || isReadOnly.value) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const rect = canvas.getBoundingClientRect()
  isDrawing.value = true
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#1b396a'
  ctx.beginPath()
  ctx.moveTo(event.clientX - rect.left, event.clientY - rect.top)
}

function drawMove(event: PointerEvent): void {
  if (!isDrawing.value || !signatureCanvas.value) return
  const ctx = signatureCanvas.value.getContext('2d')
  if (!ctx) return
  const rect = signatureCanvas.value.getBoundingClientRect()
  ctx.lineTo(event.clientX - rect.left, event.clientY - rect.top)
  ctx.stroke()
}

function endDrawing(): void {
  if (!isDrawing.value || !signatureCanvas.value) return
  isDrawing.value = false
  signatureDataUrl.value = signatureCanvas.value.toDataURL('image/png')
  markDirty()
}

function clearCanvas(): void {
  const canvas = signatureCanvas.value
  if (canvas) {
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }
  signatureDataUrl.value = undefined
  markDirty()
}

function handleSignatureImageUpload(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    errorMessage.value = 'Formato de firma inválido. Usa PNG, JPG o WEBP (415).'
    input.value = ''
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    errorMessage.value = 'La imagen de firma excede 2 MB (413).'
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    signatureDataUrl.value = String(reader.result ?? '')
    markDirty()
  }
  reader.readAsDataURL(file)
  input.value = ''
}

// Vista previa y exportación .docx
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
    link.download = `Anexo_14_${task.value.docenteClave}.docx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = 'Anexo 14 exportado desde la plantilla oficial (.docx).'
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

onBeforeRouteLeave(() => {
  if (!isDirty.value) return true
  return window.confirm('Hay cambios sin guardar en el Anexo 14. ¿Deseas salir?')
})

onMounted(() => {
  void loadAnexo14()
})
</script>

<template>
  <UiBasePage
    fluid
    title="Anexo 14 — Formato de Seguimiento de la Trayectoria Académica"
    description="Programa Institucional de Tutoría · Plantilla oficial: Anexo 14.docx"
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

    <UiAlert v-if="isLoading" tone="info" title="Cargando Anexo 14..." />

    <template v-else-if="task">
      <!-- 1. Encabezado y Datos Generales -->
      <div class="anexo-block">
        <UiCard
          title="1. Encabezado y Datos Generales"
          description="Programa Institucional de Tutoría — Datos pre-rellenados del grupo y evaluación parcial."
        >
          <div class="status-strip">
            <div class="status-meta">
              <DeliverableStatusBadge :status="task.status" />
              <UiBadge tone="info">Estudiantes: {{ students.length }}</UiBadge>
              <UiBadge :tone="totalMarkedIncidences > 0 ? 'warning' : 'success'">
                Incidencias marcadas: {{ totalMarkedIncidences }}
              </UiBadge>
            </div>
            <UiBadge v-if="isDirty" tone="warning">Cambios sin guardar</UiBadge>
          </div>

          <div class="header-grid">
            <UiField v-model="instituteName" label="Instituto Tecnológico *" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="career" label="Carrera *" as="select" :options="CAREER_OPTIONS" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="semester" label="Semestre *" placeholder="Ej. 1er Semestre" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="monthLabel" label="Mes *" as="select" :options="MONTH_OPTIONS" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="tutorName" label="Tutor *" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="groupName" label="Grupo *" placeholder="Ej. 1°A" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="classroom" label="Aula *" placeholder="Ej. A-102" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField
              v-model="partialEvaluation"
              label="Evaluación parcial (Nivel de desempeño) *"
              as="select"
              :options="EVALUATION_OPTIONS"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
          </div>
        </UiCard>
      </div>

      <!-- 2. Matriz de Estudiantes, Asignaturas (1-6) e Incidencias (1-7) -->
      <div class="anexo-block">
        <UiCard
          title="2. Matriz de Estudiantes, Asignaturas (1 a 6) e Incidencias (1 a 7)"
          description="Marca los códigos de incidencia (1 a 7) que apliquen a cada estudiante por asignatura."
        >
          <div class="legend-bar" aria-label="Catálogo de incidencias">
            <span v-for="inc in INCIDENCE_CATALOG" :key="inc.code" class="legend-chip">
              {{ inc.label }}
            </span>
          </div>

          <div class="subjects-grid">
            <UiField
              v-for="(_, idx) in subjects"
              :key="`subj-${idx}`"
              v-model="subjects[idx]"
              :label="`Asignatura ${idx + 1}`"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
          </div>

          <div class="matrix-wrap">
            <table class="matrix-table" aria-label="Matriz de seguimiento de trayectoria académica">
              <thead>
                <tr>
                  <th scope="col" class="col-num">#</th>
                  <th scope="col" class="col-ctrl">No. de Control</th>
                  <th scope="col" class="col-name">Nombre del estudiante</th>
                  <th v-for="(subj, sIdx) in subjects" :key="`th-${sIdx}`" scope="col" class="col-subj">
                    <span class="subj-head-idx">Asig. {{ sIdx + 1 }}</span>
                    <span class="subj-head-name">{{ subj || `Asignatura ${sIdx + 1}` }}</span>
                  </th>
                  <th v-if="!isReadOnly" scope="col" class="col-del">Quitar</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rIdx) in students" :key="`row-${rIdx}`">
                  <td class="col-num">{{ row.listNumber }}</td>
                  <td class="col-ctrl">
                    <input
                      v-model="row.controlNumber"
                      type="text"
                      class="cell-input mono"
                      placeholder="I12345678"
                      :disabled="isReadOnly"
                      :aria-label="`No. de control fila ${row.listNumber}`"
                      @input="markDirty"
                    />
                  </td>
                  <td class="col-name">
                    <input
                      v-model="row.studentName"
                      type="text"
                      class="cell-input"
                      placeholder="Nombre completo del estudiante"
                      :disabled="isReadOnly"
                      :aria-label="`Nombre fila ${row.listNumber}`"
                      @input="markDirty"
                    />
                  </td>
                  <td v-for="(_, sIdx) in subjects" :key="`cell-${rIdx}-${sIdx}`" class="col-subj">
                    <div class="inc-pills">
                      <button
                        v-for="inc in INCIDENCE_CATALOG"
                        :key="inc.code"
                        type="button"
                        class="inc-btn"
                        :class="{ active: isIncidenceChecked(row, sIdx, inc.code) }"
                        :title="inc.label"
                        :aria-pressed="isIncidenceChecked(row, sIdx, inc.code)"
                        :disabled="isReadOnly"
                        @click="toggleIncidence(row, sIdx, inc.code)"
                      >
                        {{ inc.short }}
                      </button>
                    </div>
                  </td>
                  <td v-if="!isReadOnly" class="col-del">
                    <button
                      type="button"
                      class="remove-row-btn"
                      :disabled="students.length <= 1"
                      @click="removeStudentRow(rIdx)"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="!isReadOnly" class="matrix-footer">
            <UiButton variant="secondary" class="btn-sm" @click="addStudentRow">
              + Agregar estudiante
            </UiButton>
          </div>
        </UiCard>
      </div>

      <!-- 3. Sesiones, Observaciones y Firmas -->
      <div class="anexo-block">
        <UiCard
          title="3. Sesiones de Tutoría, Observaciones y Firmas"
          description="Registra el número de sesiones realizadas, estrategia utilizada y validación de firmas."
        >
          <div class="sessions-grid">
            <UiField
              v-model="individualSessionsInput"
              label="Sesiones individuales de tutoría *"
              type="number"
              min="0"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
            <UiField
              v-model="groupSessionsInput"
              label="Sesiones grupales de tutoría *"
              type="number"
              min="0"
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
          </div>

          <div class="form-field-textarea">
            <label for="anexo14-observations" class="textarea-label">
              Observaciones (descripción de la sesión, eventos que dificultan el alcance de la competencia y estrategia utilizada) *
            </label>
            <textarea
              id="anexo14-observations"
              v-model="observations"
              rows="4"
              class="custom-textarea"
              :disabled="isReadOnly"
              placeholder="Anota cada evento que dificulte el alcance de la competencia y qué estrategia se utilizó para lograrlo..."
              @input="markDirty"
            />
          </div>

          <div class="signatures-grid">
            <div class="sign-box">
              <span class="sign-heading">Firma del Tutor</span>
              <UiField
                :model-value="signatureMode"
                label="Modalidad de firma"
                as="select"
                :options="SIGNATURE_MODE_OPTIONS"
                :disabled="isReadOnly"
                @update:model-value="(val) => { signatureMode = val as PlanTrabajoSignatureMode; markDirty() }"
              />

              <div v-if="signatureMode === 'canvas' && !isReadOnly" class="canvas-wrap">
                <canvas
                  ref="signatureCanvas"
                  width="360"
                  height="110"
                  class="signature-canvas"
                  @pointerdown="startDrawing"
                  @pointermove="drawMove"
                  @pointerup="endDrawing"
                  @pointerleave="endDrawing"
                />
                <UiButton variant="secondary" class="btn-sm" @click="clearCanvas">
                  Limpiar firma
                </UiButton>
              </div>

              <div v-if="signatureMode === 'image' && !isReadOnly" class="image-wrap">
                <input type="file" accept="image/png,image/jpeg,image/webp" @change="handleSignatureImageUpload" />
              </div>

              <img v-if="signatureDataUrl" :src="signatureDataUrl" alt="Firma del tutor" class="signature-img" />

              <label class="confirm-checkbox">
                <input
                  v-model="tutorSignatureConfirmed"
                  type="checkbox"
                  :disabled="isReadOnly"
                  @change="markDirty"
                />
                <span>Confirmo y firmo como Tutor: <strong>{{ tutorName }}</strong></span>
              </label>
            </div>

            <div class="sign-box">
              <span class="sign-heading">Firma del Coordinador de Tutoría del Departamento Académico</span>
              <UiField
                v-model="coordinatorName"
                label="Nombre del Coordinador de Tutoría"
                :disabled="!isReadOnly"
                @update:model-value="markDirty"
              />
              <span class="hint-text">
                Se entrega al Coordinador de Tutoría del Departamento Académico con copia para el tutor.
              </span>
            </div>
          </div>
        </UiCard>
      </div>
    </template>

    <!-- Diálogo de Vista Previa (DOCX / PDF) -->
    <UiDialog v-model="isPreviewOpen" title="Vista previa: Anexo 14 — Trayectoria Académica" class="preview-dialog">
      <div class="dialog-body">
        <UiAlert v-if="previewError" tone="danger" title="Aviso">
          <UiText>{{ previewError }}</UiText>
        </UiAlert>
        <UiAlert v-if="isPreviewing" tone="info" title="Generando vista previa..." />

        <iframe
          v-else-if="previewResult?.previewUrlOrContent"
          :src="previewResult.previewUrlOrContent"
          class="preview-frame"
          title="Vista previa Anexo 14"
        />

        <div v-else class="docx-preview">
          <div class="docx-header">
            <h3>ANEXO 14 · FORMATO DE SEGUIMIENTO DE LA TRAYECTORIA ACADÉMICA</h3>
            <p>{{ instituteName }} · {{ career }} · {{ semester }} · Grupo {{ groupName }} (Aula {{ classroom }})</p>
            <p>Mes: {{ monthLabel }} · {{ partialEvaluation }} · Tutor: {{ tutorName }}</p>
          </div>
          <table class="docx-table">
            <thead>
              <tr>
                <th>#</th>
                <th>No. Control</th>
                <th>Estudiante</th>
                <th v-for="(s, idx) in subjects" :key="`p-${idx}`">{{ s }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in students" :key="row.listNumber">
                <td>{{ row.listNumber }}</td>
                <td>{{ row.controlNumber }}</td>
                <td>{{ row.studentName }}</td>
                <td v-for="(_, sIdx) in subjects" :key="`pc-${row.listNumber}-${sIdx}`">
                  {{ (row.incidencesBySubject[sIdx] ?? []).join(', ') || '—' }}
                </td>
              </tr>
            </tbody>
          </table>
          <p><strong>Sesiones Individuales:</strong> {{ individualSessionsInput }} · <strong>Sesiones Grupales:</strong> {{ groupSessionsInput }} · <strong>Fecha:</strong> {{ reportDate }}</p>
          <p><strong>Observaciones:</strong> {{ observations || '—' }}</p>
          <div class="docx-signs">
            <div><strong>Firma del tutor:</strong> {{ tutorName }}</div>
            <div><strong>Coordinador de Tutoría:</strong> {{ coordinatorName }}</div>
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
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.875rem;
}

.legend-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1rem;
}

.legend-chip {
  font-size: 0.74rem;
  font-weight: 500;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background-color: var(--color-primary-subtle, #ebf3ff);
  color: var(--color-primary, #1b396a);
  border: 1px solid var(--color-border-medium, #cbd5e1);
}

.subjects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.matrix-wrap {
  overflow-x: auto;
}

.matrix-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.matrix-table th,
.matrix-table td {
  border: 1px solid var(--color-border, #e2e8f0);
  padding: 0.4rem;
  text-align: left;
  vertical-align: middle;
}

.matrix-table th {
  background-color: var(--color-bg-light, #f8fafc);
  color: var(--color-primary, #1b396a);
}

.col-num { width: 36px; text-align: center; font-weight: 600; }
.col-ctrl { min-width: 120px; }
.col-name { min-width: 200px; }
.col-subj { min-width: 152px; }
.col-del { width: 52px; text-align: center; }

.subj-head-idx {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--color-text-secondary, #64748b);
}

.subj-head-name {
  font-size: 0.76rem;
  font-weight: 600;
}

.cell-input {
  width: 100%;
  padding: 0.3rem 0.45rem;
  font-size: 0.8rem;
  border: 1px solid var(--input-border, #cbd5e1);
  border-radius: 4px;
  background-color: var(--input-bg, #ffffff);
  color: var(--color-text-primary, #0f172a);
}

.cell-input.mono {
  font-family: monospace;
}

.inc-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.inc-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 4px;
  border: 1px solid var(--color-border-medium, #cbd5e1);
  background-color: var(--color-surface-white, #ffffff);
  color: var(--color-text-secondary, #475569);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

.inc-btn.active {
  background-color: var(--color-primary, #1b396a);
  border-color: var(--color-primary, #1b396a);
  color: #ffffff;
}

.remove-row-btn {
  border: 0;
  background: transparent;
  color: var(--color-danger-strong, #dc2626);
  font-weight: 700;
  cursor: pointer;
}

.matrix-footer {
  margin-top: 0.75rem;
}

.sessions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-field-textarea {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 1rem;
}

.textarea-label {
  font-size: 0.875rem;
  font-weight: 500;
}

.custom-textarea {
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-family: inherit;
  font-size: 0.875rem;
  background-color: var(--input-bg, #ffffff);
  color: var(--color-text-primary, #0f172a);
  border: 1px solid var(--input-border, #cbd5e1);
  border-radius: 6px;
  resize: vertical;
}

.signatures-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.sign-box {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.875rem;
  background-color: var(--color-bg-light, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
}

.sign-heading {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-primary, #1b396a);
}

.canvas-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.signature-canvas {
  border: 1px dashed var(--color-border-medium, #94a3b8);
  border-radius: 6px;
  background-color: #ffffff;
  touch-action: none;
  max-width: 100%;
}

.signature-img {
  max-height: 70px;
  max-width: 220px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  background-color: #ffffff;
  padding: 0.25rem;
}

.confirm-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.84rem;
  cursor: pointer;
}

.hint-text {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
}

.preview-dialog {
  max-width: 900px;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-frame {
  width: 100%;
  height: 480px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
}

.docx-preview {
  padding: 1rem;
  background-color: #ffffff;
  color: #0f172a;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  max-height: 500px;
  overflow: auto;
  font-size: 0.78rem;
}

.docx-header {
  text-align: center;
  margin-bottom: 0.75rem;
}

.docx-header h3 {
  margin: 0;
  color: #1b396a;
  font-size: 0.92rem;
}

.docx-header p {
  margin: 0.2rem 0 0;
}

.docx-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.75rem;
  font-size: 0.72rem;
}

.docx-table th,
.docx-table td {
  border: 1px solid #cbd5e1;
  padding: 0.3rem;
}

.docx-table th {
  background-color: #f1f5f9;
}

.docx-signs {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #cbd5e1;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.3rem 0.7rem;
  font-size: 0.8125rem;
}
</style>
