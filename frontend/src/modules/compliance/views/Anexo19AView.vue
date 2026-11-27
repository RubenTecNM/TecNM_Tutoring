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
  Anexo19APayload,
  Anexo19AStudentRow,
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

const PROGRAM_OPTIONS = [
  { value: 'Ingeniería en Sistemas Computacionales', label: 'Ingeniería en Sistemas Computacionales' },
  { value: 'Ingeniería Industrial', label: 'Ingeniería Industrial' },
  { value: 'Ingeniería Mecánica', label: 'Ingeniería Mecánica' },
  { value: 'Ingeniería Electrónica', label: 'Ingeniería Electrónica' },
  { value: 'Ingeniería en Gestión Empresarial', label: 'Ingeniería en Gestión Empresarial' },
  { value: 'Ingeniería en Energías Renovables', label: 'Ingeniería en Energías Renovables' },
  { value: 'Ingeniería Informática', label: 'Ingeniería Informática' },
]

const REFERRED_AREA_OPTIONS = [
  { value: '', label: 'Ninguna' },
  { value: 'Psicología', label: 'Psicología' },
  { value: 'Trabajo Social', label: 'Trabajo Social' },
  { value: 'Enfermería', label: 'Enfermería' },
  { value: 'Tutorías', label: 'Tutorías' },
  { value: 'Académico', label: 'Académico' },
  { value: 'Desempeño', label: 'Desempeño' },
]

const SIGNATURE_MODE_OPTIONS: { value: PlanTrabajoSignatureMode; label: string }[] = [
  { value: 'name_confirmation', label: 'Confirmación con nombre del tutor' },
  { value: 'canvas', label: 'Firma dibujada en pantalla (canvas)' },
  { value: 'image', label: 'Cargar imagen de firma (PNG/JPG)' },
]

const SAMPLE_STUDENTS = [
  'Ana Sofía Rodríguez Fuentes',
  'Luis Fernando Torres Aguilar',
  'Jorge Eduardo Morales Dávila',
  'Mateo Alejandro Garza Silva',
  'Mariana Lizeth Cantú Ortiz',
]

function toText(raw: string | number | null | undefined): string {
  return raw === null || raw === undefined ? '' : String(raw).trim()
}

function parseCount(raw: string | number | null | undefined): number {
  const clean = toText(raw)
  if (!clean) return 0
  const n = Number(clean)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

function isInvalidCount(raw: string | number | null | undefined): boolean {
  const clean = toText(raw)
  if (!clean) return false
  const n = Number(clean)
  return !Number.isInteger(n) || n < 0
}

function buildDefaultRows(): Anexo19AStudentRow[] {
  return Array.from({ length: 25 }, (_, idx) => ({
    listNumber: idx + 1,
    studentName: SAMPLE_STUDENTS[idx] ?? '',
    groupTutoringCount: '',
    individualTutoringCount: '',
    referredCount: '',
    referredArea: '',
  }))
}

const instituteName = ref('Instituto Tecnológico Superior de Monclova')
const tutorName = ref('')
const reportDate = ref(new Date().toISOString().slice(0, 10))
const educationalProgram = ref('Ingeniería en Sistemas Computacionales')
const groupName = ref('1°A')
const scheduleHour = ref('10:00 - 11:00')
const students = ref<Anexo19AStudentRow[]>(buildDefaultRows())
const observations = ref('')
const deliveryDate = ref(new Date().toISOString().slice(0, 10))
const tutorSignatureConfirmed = ref(false)
const tutorSignedAt = ref<string | undefined>(undefined)
const signatureMode = ref<PlanTrabajoSignatureMode>('name_confirmation')
const signatureDataUrl = ref<string | undefined>(undefined)
const coordinatorName = ref('Lic. María Fernanda López Garza')
const departmentHeadName = ref('M.C. Jefe de Departamento Académico')

const isReadOnly = computed(() => currentUser.value?.role === 'Admin')

const totals = computed(() => {
  let activeStudents = 0
  let groupTotal = 0
  let individualTotal = 0
  let referredTotal = 0

  for (const row of students.value) {
    if (toText(row.studentName)) activeStudents += 1
    groupTotal += parseCount(row.groupTutoringCount)
    individualTotal += parseCount(row.individualTutoringCount)
    referredTotal += parseCount(row.referredCount)
  }

  return { activeStudents, groupTotal, individualTotal, referredTotal }
})

function markDirty(): void {
  isDirty.value = true
}

function updateRowField(
  row: Anexo19AStudentRow,
  field: 'studentName' | 'groupTutoringCount' | 'individualTutoringCount' | 'referredCount' | 'referredArea',
  event: Event,
): void {
  const target = event.target as HTMLInputElement | HTMLSelectElement
  row[field] = target.value
  markDirty()
}

function onSignatureCheckboxChange(): void {
  tutorSignedAt.value = tutorSignatureConfirmed.value ? new Date().toLocaleString('es-MX') : undefined
  markDirty()
}

function hydrateForm(loadedTask: DeliverableTask, user: UserResponse | null): void {
  const pre = loadedTask.prefilledData ?? {}
  const saved = (loadedTask.formPayload ?? {}) as Partial<Anexo19APayload>

  instituteName.value = saved.instituteName || String(pre.plantel ?? 'Instituto Tecnológico Superior de Monclova')
  tutorName.value = saved.tutorName || String(pre.docente_nombre ?? '') || user?.name || 'Docente Tutor'
  reportDate.value = saved.reportDate || new Date().toISOString().slice(0, 10)
  educationalProgram.value = saved.educationalProgram || String(pre.carrera ?? 'Ingeniería en Sistemas Computacionales')
  groupName.value = saved.groupName || String(pre.grupo ?? '1°A')
  scheduleHour.value = saved.scheduleHour || String(pre.hora ?? '10:00 - 11:00')

  if (Array.isArray(saved.students) && saved.students.length === 25) {
    students.value = saved.students.map((row, idx) => ({
      listNumber: idx + 1,
      studentName: toText(row.studentName),
      groupTutoringCount: toText(row.groupTutoringCount),
      individualTutoringCount: toText(row.individualTutoringCount),
      referredCount: toText(row.referredCount),
      referredArea: toText(row.referredArea),
    }))
  } else {
    students.value = buildDefaultRows()
  }

  observations.value = saved.observations ?? ''
  deliveryDate.value = saved.deliveryDate || new Date().toISOString().slice(0, 10)
  tutorSignatureConfirmed.value = Boolean(saved.tutorSignatureConfirmed)
  tutorSignedAt.value = saved.tutorSignedAt
  signatureMode.value = saved.signatureMode ?? 'name_confirmation'
  signatureDataUrl.value = saved.signatureDataUrl
  coordinatorName.value = saved.coordinatorName || 'Lic. María Fernanda López Garza'
  departmentHeadName.value = saved.departmentHeadName || 'M.C. Jefe de Departamento Académico'
  isDirty.value = false
}

function buildPayload(): Anexo19APayload {
  return {
    instituteName: toText(instituteName.value),
    tutorName: toText(tutorName.value),
    reportDate: reportDate.value,
    educationalProgram: educationalProgram.value,
    groupName: toText(groupName.value),
    scheduleHour: toText(scheduleHour.value),
    students: students.value.map((row, idx) => ({
      listNumber: idx + 1,
      studentName: toText(row.studentName),
      groupTutoringCount: toText(row.groupTutoringCount),
      individualTutoringCount: toText(row.individualTutoringCount),
      referredCount: toText(row.referredCount),
      referredArea: toText(row.referredArea),
    })),
    observations: toText(observations.value),
    deliveryDate: deliveryDate.value,
    tutorSignatureConfirmed: tutorSignatureConfirmed.value,
    tutorSignedAt: tutorSignedAt.value,
    signatureMode: signatureMode.value,
    signatureDataUrl: signatureDataUrl.value,
    coordinatorName: toText(coordinatorName.value),
    departmentHeadName: toText(departmentHeadName.value),
  }
}

function validateForm(strictSubmit: boolean): string | null {
  for (const row of students.value) {
    if (
      isInvalidCount(row.groupTutoringCount) ||
      isInvalidCount(row.individualTutoringCount) ||
      isInvalidCount(row.referredCount)
    ) {
      return `Fila ${row.listNumber}: las cantidades de atención y canalización deben ser enteros mayores o iguales a 0.`
    }
    if (parseCount(row.referredCount) > 0 && !toText(row.referredArea)) {
      return `Fila ${row.listNumber}: selecciona el Área canalizada cuando el estudiante tenga canalizaciones.`
    }
  }

  if (!strictSubmit) return null

  if (!toText(instituteName.value) || !toText(tutorName.value) || !toText(groupName.value) || !toText(scheduleHour.value)) {
    return 'Completa todos los campos del encabezado (Instituto, Tutor, Fecha, Programa, Grupo y Hora).'
  }
  if (totals.value.activeStudents === 0) {
    return 'Registra al menos un estudiante en la lista (filas 1 a 25).'
  }
  if (!toText(observations.value)) {
    return 'Captura el apartado de Observaciones según el instructivo de llenado.'
  }
  if (!tutorSignatureConfirmed.value) {
    return 'Confirma la firma del tutor antes de entregar el Anexo 19-A.'
  }
  return null
}

async function loadAnexo19A(): Promise<void> {
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
      ? 'Anexo 19-A — Reporte Mensual del Tutor entregado correctamente.'
      : 'Borrador del Anexo 19-A guardado.'
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
    link.download = `Anexo_19A_${task.value.docenteClave}.docx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = 'Anexo 19-A exportado desde la plantilla oficial (.docx).'
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

useUnsavedChangesGuard(isDirty, 'Hay cambios sin guardar en el Anexo 19-A. ¿Deseas salir?')

onMounted(() => {
  void loadAnexo19A()
})
</script>

<template>
  <UiBasePage
    fluid
    title="Anexo 19-A — Reporte Mensual del Tutor"
    description="Seguimiento mensual de atención grupal, individual y canalizaciones · Plantilla oficial: Anexo 19-A.docx"
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

    <UiAlert v-if="isLoading" tone="info" title="Cargando Anexo 19-A..." />

    <template v-else-if="task">
      <!-- 1. Encabezado y Datos Generales -->
      <div class="anexo-block">
        <UiCard
          title="1. Encabezado y Datos Generales"
          description="Datos pre-rellenados del tutor, programa educativo, grupo y horario."
        >
          <div class="status-strip">
            <div class="status-meta">
              <DeliverableStatusBadge :status="task.status" />
              <UiBadge tone="info">Estudiantes en lista: {{ totals.activeStudents }} / 25</UiBadge>
              <UiBadge tone="success">Grupal: {{ totals.groupTotal }} · Individual: {{ totals.individualTotal }}</UiBadge>
              <UiBadge :tone="totals.referredTotal > 0 ? 'warning' : 'info'">
                Canalizados: {{ totals.referredTotal }}
              </UiBadge>
            </div>
            <UiBadge v-if="isDirty" tone="warning">Cambios sin guardar</UiBadge>
          </div>

          <div class="header-grid">
            <UiField v-model="instituteName" label="Instituto Tecnológico *" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="tutorName" label="Nombre del Tutor *" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="reportDate" label="Fecha *" type="date" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField
              v-model="educationalProgram"
              label="Programa educativo *"
              as="select"
              :options="PROGRAM_OPTIONS"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
            <UiField v-model="groupName" label="Grupo *" placeholder="Ej. 1°A" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="scheduleHour" label="Hora *" placeholder="Ej. 10:00 - 11:00" :disabled="isReadOnly" @update:model-value="markDirty" />
          </div>
        </UiCard>
      </div>

      <!-- 2. Tabla de Estudiantes (1 a 25), Atención y Canalización -->
      <div class="anexo-block">
        <UiCard
          title="2. Lista de Estudiantes (1 a 25), Atención y Canalización"
          description="Registra sesiones de Tutoría Grupal, Tutoría Individual, canalizaciones y área asignada."
        >
          <div class="table-wrap">
            <table class="report-table" aria-label="Tabla mensual del tutor 1 a 25">
              <thead>
                <tr>
                  <th scope="col" rowspan="2" class="col-num">#</th>
                  <th scope="col" rowspan="2" class="col-student">Lista de estudiantes</th>
                  <th scope="colgroup" colspan="2" class="col-group-head">
                    Estudiantes atendidos en el semestre
                  </th>
                  <th scope="col" rowspan="2" class="col-count">
                    Estudiantes canalizados en el semestre
                  </th>
                  <th scope="col" rowspan="2" class="col-area">Área canalizada</th>
                </tr>
                <tr>
                  <th scope="col" class="col-count">Tutoría Grupal</th>
                  <th scope="col" class="col-count">Tutoría Individual</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in students" :key="row.listNumber">
                  <td class="col-num">{{ row.listNumber }}</td>
                  <td class="col-student">
                    <input
                      :value="row.studentName"
                      type="text"
                      class="cell-input"
                      placeholder="Nombre completo del estudiante..."
                      :disabled="isReadOnly"
                      :aria-label="`Estudiante ${row.listNumber}`"
                      @input="updateRowField(row, 'studentName', $event)"
                    />
                  </td>
                  <td class="col-count">
                    <input
                      :value="row.groupTutoringCount"
                      type="number"
                      min="0"
                      class="num-input"
                      :class="{ invalid: isInvalidCount(row.groupTutoringCount) }"
                      placeholder="0"
                      :disabled="isReadOnly"
                      :aria-label="`Tutoría grupal fila ${row.listNumber}`"
                      @input="updateRowField(row, 'groupTutoringCount', $event)"
                    />
                  </td>
                  <td class="col-count">
                    <input
                      :value="row.individualTutoringCount"
                      type="number"
                      min="0"
                      class="num-input"
                      :class="{ invalid: isInvalidCount(row.individualTutoringCount) }"
                      placeholder="0"
                      :disabled="isReadOnly"
                      :aria-label="`Tutoría individual fila ${row.listNumber}`"
                      @input="updateRowField(row, 'individualTutoringCount', $event)"
                    />
                  </td>
                  <td class="col-count">
                    <input
                      :value="row.referredCount"
                      type="number"
                      min="0"
                      class="num-input"
                      :class="{ invalid: isInvalidCount(row.referredCount) }"
                      placeholder="0"
                      :disabled="isReadOnly"
                      :aria-label="`Canalizados fila ${row.listNumber}`"
                      @input="updateRowField(row, 'referredCount', $event)"
                    />
                  </td>
                  <td class="col-area">
                    <select
                      :value="row.referredArea"
                      class="cell-select"
                      :disabled="isReadOnly"
                      :aria-label="`Área canalizada fila ${row.listNumber}`"
                      @change="updateRowField(row, 'referredArea', $event)"
                    >
                      <option v-for="opt in REFERRED_AREA_OPTIONS" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </option>
                    </select>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="totals-row">
                  <td colspan="2"><strong>Totales del reporte</strong></td>
                  <td class="col-count"><strong>{{ totals.groupTotal }}</strong></td>
                  <td class="col-count"><strong>{{ totals.individualTotal }}</strong></td>
                  <td class="col-count"><strong>{{ totals.referredTotal }}</strong></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </UiCard>
      </div>

      <!-- 3. Observaciones, Instructivo y Firmas -->
      <div class="anexo-block">
        <UiCard title="3. Observaciones, Instructivo de Llenado y Firmas">
          <div class="instructivo-box">
            <strong>Instructivo de llenado:</strong>
            <ul>
              <li>Anote las <strong>10 actividades adicionales más importantes</strong> realizadas en el semestre.</li>
              <li>Anote las <strong>acciones de mayor impacto</strong> para alcanzar la competencia de la asignatura.</li>
              <li>Este reporte deberá ser llenado por el Tutor y entregado al <strong>Coordinador de Tutoría del Departamento Académico</strong> con copia para el Tutor.</li>
            </ul>
          </div>

          <div class="form-field-textarea">
            <label for="anexo19a-obs" class="textarea-label">Observaciones *</label>
            <textarea
              id="anexo19a-obs"
              v-model="observations"
              rows="5"
              class="custom-textarea"
              :disabled="isReadOnly"
              placeholder="Anota las 10 actividades adicionales más importantes y las acciones de mayor impacto..."
              @input="markDirty"
            />
          </div>

          <div class="delivery-row">
            <UiField
              v-model="deliveryDate"
              label="Fecha de entrega de este reporte *"
              type="date"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
          </div>

          <div class="signatures-grid">
            <div class="sign-box">
              <span class="sign-heading">Nombre y firma del tutor</span>
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
                  width="340"
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

              <div v-if="signatureMode === 'image' && !isReadOnly">
                <input type="file" accept="image/png,image/jpeg,image/webp" @change="handleSignatureImageUpload" />
              </div>

              <img v-if="signatureDataUrl" :src="signatureDataUrl" alt="Firma del tutor" class="signature-img" />

              <label class="confirm-checkbox">
                <input
                  v-model="tutorSignatureConfirmed"
                  type="checkbox"
                  :disabled="isReadOnly"
                  @change="onSignatureCheckboxChange"
                />
                <span>
                  Valido y firmo: <strong>{{ tutorName }}</strong>
                  <template v-if="tutorSignedAt"> ({{ tutorSignedAt }})</template>
                </span>
              </label>
            </div>

            <div class="sign-box">
              <span class="sign-heading">Nombre y firma del Coordinador de Tutoría del Departamento Académico</span>
              <UiField
                v-model="coordinatorName"
                label="Coordinador de Tutoría"
                :disabled="!isReadOnly"
                @update:model-value="markDirty"
              />
            </div>

            <div class="sign-box">
              <span class="sign-heading">Nombre y firma del Jefe de Departamento Académico</span>
              <UiField
                v-model="departmentHeadName"
                label="Jefe de Departamento Académico"
                :disabled="!isReadOnly"
                @update:model-value="markDirty"
              />
            </div>
          </div>
        </UiCard>
      </div>
    </template>

    <!-- Diálogo de Vista Previa -->
    <UiDialog v-model="isPreviewOpen" title="Vista previa: Anexo 19-A — Reporte Mensual del Tutor" class="preview-dialog">
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
          title="Vista previa Anexo 19-A"
        />

        <div v-else class="docx-preview">
          <div class="docx-header">
            <h3>ANEXO 19-A · REPORTE MENSUAL DEL TUTOR</h3>
            <p>{{ instituteName }} · {{ educationalProgram }} · Grupo {{ groupName }} · Hora: {{ scheduleHour }}</p>
            <p>Tutor: {{ tutorName }} · Fecha: {{ reportDate }} · Entrega: {{ deliveryDate }}</p>
          </div>
          <table class="docx-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Lista de estudiantes</th>
                <th>Grupal</th>
                <th>Individual</th>
                <th>Canalizados</th>
                <th>Área canalizada</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in students.filter((s) => toText(s.studentName) || parseCount(s.groupTutoringCount) || parseCount(s.individualTutoringCount) || parseCount(s.referredCount))" :key="`p-${row.listNumber}`">
                <td>{{ row.listNumber }}</td>
                <td>{{ row.studentName || '—' }}</td>
                <td>{{ row.groupTutoringCount || '0' }}</td>
                <td>{{ row.individualTutoringCount || '0' }}</td>
                <td>{{ row.referredCount || '0' }}</td>
                <td>{{ row.referredArea || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p><strong>Observaciones:</strong> {{ observations || '—' }}</p>
          <div class="docx-signs">
            <div><strong>Tutor:</strong> {{ tutorName }}</div>
            <div><strong>Coordinador de Tutoría:</strong> {{ coordinatorName }}</div>
            <div><strong>Jefe de Departamento:</strong> {{ departmentHeadName }}</div>
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

.table-wrap {
  overflow-x: auto;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.report-table th,
.report-table td {
  border: 1px solid var(--color-border, #e2e8f0);
  padding: 0.4rem;
  vertical-align: middle;
}

.report-table th {
  background-color: var(--color-bg-light, #f8fafc);
  color: var(--color-primary, #1b396a);
  text-align: center;
}

.col-num { width: 42px; text-align: center; font-weight: 700; }
.col-student { min-width: 240px; text-align: left; }
.col-group-head { text-align: center; }
.col-count { min-width: 110px; width: 110px; text-align: center; }
.col-area { min-width: 165px; }

.cell-input,
.cell-select,
.num-input {
  width: 100%;
  padding: 0.35rem 0.5rem;
  font-size: 0.8125rem;
  border: 1px solid var(--input-border, #cbd5e1);
  border-radius: 4px;
  background-color: var(--input-bg, #ffffff);
  color: var(--color-text-primary, #0f172a);
}

.num-input {
  min-width: 72px;
  text-align: center;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  appearance: textfield;
  -moz-appearance: textfield;
}

.num-input::-webkit-inner-spin-button,
.num-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.num-input.invalid {
  border-color: var(--color-danger, #ef4444);
  background-color: var(--color-danger-bg, #fef2f2);
}

.totals-row td {
  background-color: var(--color-bg-light, #f8fafc);
}

.instructivo-box {
  padding: 0.875rem 1rem;
  margin-bottom: 1rem;
  background-color: var(--color-primary-subtle, #ebf3ff);
  border-left: 4px solid var(--color-primary, #1b396a);
  border-radius: 6px;
  font-size: 0.84rem;
}

.instructivo-box ul {
  margin: 0.375rem 0 0 1.25rem;
  padding: 0;
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

.delivery-row {
  max-width: 280px;
  margin-bottom: 1rem;
}

.signatures-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
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
  font-size: 0.8rem;
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
  font-size: 0.78rem;
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
  margin-bottom: 0.75rem;
  font-size: 0.74rem;
}

.docx-table th,
.docx-table td {
  border: 1px solid #cbd5e1;
  padding: 0.35rem;
  text-align: center;
}

.docx-table td:nth-child(2) {
  text-align: left;
}

.docx-signs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
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

@media (max-width: 640px) {
  .top-actions {
    width: 100%;
  }
  .top-actions :deep(button) {
    flex: 1 1 auto;
  }
}
</style>
