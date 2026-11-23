<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
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
  PlanTrabajoPayload,
  PlanTrabajoSession,
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

// Firma en canvas opcional
const signatureCanvas = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)

const NORMATIVE_MONTHLY_ACTIVITIES = [
  'Tutorías individuales.',
  'Asistencia Obligatoria.',
  'Anexos 14, 15, 19-A y 19 según corresponda.',
  'Monitoreo de alumnos con faltas, reprobación, disciplina, etc.',
  'Diferentes actividades de acuerdo a las necesidades, sugerencias y propuestas del grupo tutorado y por la Coordinación de Tutorías.',
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

const SHIFT_OPTIONS = [
  { value: 'Matutino', label: 'Matutino' },
  { value: 'Vespertino', label: 'Vespertino' },
]

const SIGNATURE_MODE_OPTIONS: { value: PlanTrabajoSignatureMode; label: string }[] = [
  { value: 'name_confirmation', label: 'Confirmación con nombre del tutor' },
  { value: 'canvas', label: 'Firma dibujada en pantalla (canvas)' },
  { value: 'image', label: 'Cargar imagen de firma (PNG/JPG)' },
]

const DEFAULT_DATES_ENE_JUN_2026 = [
  'Del 2-6 de febrero 2026',
  'Del 9-13 de febrero 2026',
  'Del 16-20 de febrero 2026',
  'Del 23-27 de febrero 2026',
  'Del 2-6 de marzo 2026',
  'Del 9-13 de marzo 2026',
  'Del 16-20 de marzo 2026',
  'Del 23-27 de marzo 2026',
  'Del 13-17 de abril 2026',
  'Del 20-24 de abril 2026',
  'Del 27 abril - 1 mayo 2026',
  'Del 4-8 de mayo 2026',
  'Del 11-15 de mayo 2026',
  'Del 18-22 de mayo 2026',
  'Del 25-29 de mayo 2026',
  'Del 1-5 de junio 2026',
]

const DEFAULT_DATES_AGO_DIC_2026 = [
  'Del 17-21 de agosto 2026',
  'Del 24-28 de agosto 2026',
  'Del 31 agosto - 4 septiembre 2026',
  'Del 7-11 de septiembre 2026',
  'Del 14-18 de septiembre 2026',
  'Del 21-25 de septiembre 2026',
  'Del 28 septiembre - 2 octubre 2026',
  'Del 5-9 de octubre 2026',
  'Del 12-16 de octubre 2026',
  'Del 19-23 de octubre 2026',
  'Del 26-30 de octubre 2026',
  'Del 2-6 de noviembre 2026',
  'Del 9-13 de noviembre 2026',
  'Del 16-20 de noviembre 2026',
  'Del 23-27 de noviembre 2026',
  'Del 30 noviembre - 4 diciembre 2026',
]

function buildDefaultSessions(periodoId: number): PlanTrabajoSession[] {
  const dates = periodoId === 2 ? DEFAULT_DATES_AGO_DIC_2026 : DEFAULT_DATES_ENE_JUN_2026
  return Array.from({ length: 16 }, (_, idx) => ({
    sessionNumber: idx + 1,
    dateRange: dates[idx] ?? `Semana ${idx + 1}`,
    title: '',
    objective: '',
    strategicActivities: '',
  }))
}

const form = ref<PlanTrabajoPayload>({
  semesterLabel: 'Enero - Junio 2026',
  groupSemester: '1°A (1er Semestre)',
  career: 'Ingeniería en Sistemas Computacionales',
  shift: 'Matutino',
  generalObjective: '',
  sessions: buildDefaultSessions(1),
  monthlyActivitiesConfirmed: true,
  monthlyActivitiesNotes: '',
  tutorName: '',
  tutorSignatureConfirmed: false,
  signatureMode: 'name_confirmation',
  signatureDataUrl: undefined,
})

const isReadOnly = computed(() => currentUser.value?.role === 'Admin')

const completedSessionsCount = computed(() =>
  form.value.sessions.filter(
    (s) => s.title.trim() && s.objective.trim() && s.strategicActivities.trim(),
  ).length,
)

function markDirty(): void {
  isDirty.value = true
}

function hydrateForm(loadedTask: DeliverableTask, user: UserResponse | null): void {
  const pre = loadedTask.prefilledData ?? {}
  const saved = (loadedTask.formPayload ?? {}) as Partial<PlanTrabajoPayload>
  const defaultPeriodLabel =
    loadedTask.periodoId === 2 ? 'Agosto - Diciembre 2026' : 'Enero - Junio 2026'

  const savedSessions = Array.isArray(saved.sessions) && saved.sessions.length === 16
    ? saved.sessions
    : buildDefaultSessions(loadedTask.periodoId)

  form.value = {
    semesterLabel: saved.semesterLabel || defaultPeriodLabel,
    groupSemester: saved.groupSemester || String(pre.grupo ?? '1°A (1er Semestre)'),
    career: saved.career || String(pre.carrera ?? 'Ingeniería en Sistemas Computacionales'),
    shift: saved.shift === 'Vespertino' ? 'Vespertino' : 'Matutino',
    generalObjective: saved.generalObjective ?? '',
    sessions: savedSessions.map((s, idx) => ({
      sessionNumber: idx + 1,
      dateRange: s.dateRange ?? '',
      title: s.title ?? '',
      objective: s.objective ?? '',
      strategicActivities: s.strategicActivities ?? '',
    })),
    monthlyActivitiesConfirmed: saved.monthlyActivitiesConfirmed ?? true,
    monthlyActivitiesNotes: saved.monthlyActivitiesNotes ?? '',
    tutorName:
      saved.tutorName ||
      String(pre.docente_nombre ?? '') ||
      user?.name ||
      'Docente Tutor',
    tutorSignatureConfirmed: Boolean(saved.tutorSignatureConfirmed),
    signatureMode: saved.signatureMode ?? 'name_confirmation',
    signatureDataUrl: saved.signatureDataUrl,
  }
  isDirty.value = false
}

async function loadPlanTrabajo(): Promise<void> {
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

function validateBeforeSubmit(): string | null {
  if (!form.value.semesterLabel.trim() || !form.value.groupSemester.trim() || !form.value.career) {
    return 'Completa Periodo, Grupo/Semestre y Carrera en el encabezado.'
  }
  if (!form.value.generalObjective.trim()) {
    return 'Captura el Objetivo General del Curso.'
  }
  if (completedSessionsCount.value < 16) {
    return `Completa las 16 sesiones semanales (llevas ${completedSessionsCount.value} de 16 con título, objetivo y actividades).`
  }
  if (!form.value.monthlyActivitiesConfirmed) {
    return 'Confirma las actividades mensuales normativas.'
  }
  if (!form.value.tutorSignatureConfirmed) {
    return 'Confirma la firma del tutor en la sección TUTOR antes de entregar.'
  }
  return null
}

async function handleSave(submit: boolean): Promise<void> {
  if (!task.value || isSaving.value || isReadOnly.value) return

  if (submit) {
    const err = validateBeforeSubmit()
    if (err) {
      errorMessage.value = err
      return
    }
  }

  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const updated = await complianceApi.saveDeliverableForm(task.value.id, {
      formPayload: { ...form.value },
      submit,
    })
    task.value = updated
    isDirty.value = false
    successMessage.value = submit
      ? 'Plan de Trabajo de Tutorías entregado correctamente.'
      : 'Borrador del Plan de Trabajo guardado.'
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
  form.value.signatureDataUrl = signatureCanvas.value.toDataURL('image/png')
  markDirty()
}

function clearCanvas(): void {
  const canvas = signatureCanvas.value
  if (canvas) {
    const ctx = canvas.getContext('2d')
    ctx?.clearRect(0, 0, canvas.width, canvas.height)
  }
  form.value.signatureDataUrl = undefined
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
    form.value.signatureDataUrl = String(reader.result ?? '')
    markDirty()
  }
  reader.readAsDataURL(file)
  input.value = ''
}

async function onSignatureModeChange(mode: string): Promise<void> {
  form.value.signatureMode = mode as PlanTrabajoSignatureMode
  markDirty()
  if (mode === 'canvas') {
    await nextTick()
  }
}

// Vista previa y exportación
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

  const warning = validateBeforeSubmit()
  if (warning && !window.confirm(`${warning}\n\n¿Deseas exportar el borrador actual de todos modos?`)) {
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
    link.download = `FORMATO_PLAN_DE_TRABAJO_${task.value.docenteClave}.docx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = 'Plan de Trabajo exportado desde la plantilla oficial.'
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
  return window.confirm('Hay cambios sin guardar en el Plan de Trabajo. ¿Deseas salir?')
})

onMounted(() => {
  void loadPlanTrabajo()
})
</script>

<template>
  <UiBasePage
    fluid
    title="Plan de Trabajo de Tutorías"
    description="Instituto Tecnológico Superior de Monclova · Programa Institucional de Tutorías (FORMATO PLAN DE TRABAJO TUTORIAS ene-junio-26.docx)"
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

    <UiAlert v-if="errorMessage" tone="danger" title="Aviso">
      <UiText>{{ errorMessage }}</UiText>
    </UiAlert>

    <UiAlert v-if="isLoading" tone="info" title="Cargando Plan de Trabajo..." />

    <template v-else-if="task">
      <!-- 1. Encabezado y Datos Generales -->
      <div class="plan-block">
        <UiCard
          title="1. Encabezado y Datos Generales"
          description="Datos pre-rellenados desde PostgreSQL; edita los campos aplicables al grupo tutorado."
        >
          <div class="status-strip">
            <div class="status-meta">
              <DeliverableStatusBadge :status="task.status" />
              <UiBadge tone="info">Sesiones completas: {{ completedSessionsCount }} / 16</UiBadge>
              <code class="meta-code">Clave tutor: {{ task.docenteClave }}</code>
            </div>
            <UiBadge v-if="isDirty" tone="warning">Cambios sin guardar</UiBadge>
          </div>

          <div class="header-grid">
            <UiField
              v-model="form.semesterLabel"
              label="Periodo / duración del semestre *"
              placeholder="Ej. Enero - Junio 2026"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
            <UiField
              v-model="form.groupSemester"
              label="Grupo (indicando semestre) *"
              placeholder="Ej. 4°A (4to Semestre)"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
            <UiField
              v-model="form.career"
              label="Carrera *"
              as="select"
              :options="CAREER_OPTIONS"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
            <UiField
              v-model="form.shift"
              label="Turno *"
              as="select"
              :options="SHIFT_OPTIONS"
              :disabled="isReadOnly"
              @update:model-value="markDirty"
            />
          </div>

          <div class="form-field-textarea">
            <label for="general-objective" class="textarea-label">Objetivo General del Curso *</label>
            <textarea
              id="general-objective"
              v-model="form.generalObjective"
              rows="3"
              class="custom-textarea"
              :disabled="isReadOnly"
              placeholder="Describe el objetivo general del programa tutorial para el grupo durante el semestre..."
              @input="markDirty"
            />
          </div>
        </UiCard>
      </div>

      <!-- 2. Tabla de 16 Sesiones Semanales -->
      <div class="plan-block">
        <UiCard
          title="2. Calendarización de 16 Sesiones Semanales"
          description="Actividades que promuevan la integración del grupo y las establecidas por la Coordinación de Tutorías."
        >
          <div class="sessions-table-wrap">
            <table class="sessions-table" aria-label="Tabla de 16 sesiones semanales">
              <thead>
                <tr>
                  <th scope="col" class="col-session">Núm. y fecha de Sesión</th>
                  <th scope="col" class="col-title">Título de la sesión</th>
                  <th scope="col" class="col-objective">Objetivo de la Sesión</th>
                  <th scope="col" class="col-activities">Actividades estratégicas</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="session in form.sessions" :key="session.sessionNumber">
                  <td class="col-session">
                    <div class="session-num">Sesión {{ session.sessionNumber }}</div>
                    <input
                      v-model="session.dateRange"
                      type="text"
                      class="cell-input"
                      :disabled="isReadOnly"
                      :aria-label="`Fecha de sesión ${session.sessionNumber}`"
                      @input="markDirty"
                    />
                  </td>
                  <td class="col-title">
                    <input
                      v-model="session.title"
                      type="text"
                      class="cell-input"
                      :disabled="isReadOnly"
                      placeholder="Título de la sesión..."
                      :aria-label="`Título de sesión ${session.sessionNumber}`"
                      @input="markDirty"
                    />
                  </td>
                  <td class="col-objective">
                    <textarea
                      v-model="session.objective"
                      rows="2"
                      class="cell-textarea"
                      :disabled="isReadOnly"
                      placeholder="Objetivo esperado..."
                      :aria-label="`Objetivo de sesión ${session.sessionNumber}`"
                      @input="markDirty"
                    />
                  </td>
                  <td class="col-activities">
                    <textarea
                      v-model="session.strategicActivities"
                      rows="2"
                      class="cell-textarea"
                      :disabled="isReadOnly"
                      placeholder="Dinámicas, temas o actividades estratégicas..."
                      :aria-label="`Actividades de sesión ${session.sessionNumber}`"
                      @input="markDirty"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </UiCard>
      </div>

      <!-- 3. Bloque de Actividades Mensuales Normativas -->
      <div class="plan-block">
        <UiCard
          title="3. Actividades Mensuales Normativas"
          description="Además de las actividades indicadas en el Plan Tutorial, se trabajará mensualmente:"
        >
          <ul class="normative-list">
            <li v-for="item in NORMATIVE_MONTHLY_ACTIVITIES" :key="item">
              {{ item }}
            </li>
          </ul>

          <label class="confirm-checkbox">
            <input
              v-model="form.monthlyActivitiesConfirmed"
              type="checkbox"
              :disabled="isReadOnly"
              @change="markDirty"
            />
            <span>Confirmo el compromiso de ejecutar estas actividades mensuales normativas con el grupo tutorado.</span>
          </label>

          <div class="form-field-textarea">
            <label for="monthly-notes" class="textarea-label">Notas o propuestas adicionales del grupo / Coordinación (opcional)</label>
            <textarea
              id="monthly-notes"
              v-model="form.monthlyActivitiesNotes"
              rows="2"
              class="custom-textarea"
              :disabled="isReadOnly"
              placeholder="Agrega acuerdos o actividades adicionales propuestas por el grupo o Coordinación..."
              @input="markDirty"
            />
          </div>
        </UiCard>
      </div>

      <!-- 4. Firma del Tutor -->
      <div class="plan-block">
        <UiCard
          title="4. Validación y Firma (TUTOR:)"
          description="Confirma el plan con el nombre del tutor autenticado o adjunta firma trazada / imagen."
        >
          <div class="signature-grid">
            <UiField
              v-model="form.tutorName"
              label="TUTOR (Nombre completo)"
              :disabled="true"
            />
            <UiField
              :model-value="form.signatureMode"
              label="Modalidad de firma"
              as="select"
              :options="SIGNATURE_MODE_OPTIONS"
              :disabled="isReadOnly"
              @update:model-value="onSignatureModeChange"
            />
          </div>

          <div v-if="form.signatureMode === 'canvas' && !isReadOnly" class="canvas-wrap">
            <span class="textarea-label">Dibuja tu firma dentro del recuadro:</span>
            <canvas
              ref="signatureCanvas"
              width="420"
              height="130"
              class="signature-canvas"
              @pointerdown="startDrawing"
              @pointermove="drawMove"
              @pointerup="endDrawing"
              @pointerleave="endDrawing"
            />
            <div>
              <UiButton variant="secondary" class="btn-sm" @click="clearCanvas">
                Limpiar firma
              </UiButton>
            </div>
          </div>

          <div v-if="form.signatureMode === 'image' && !isReadOnly" class="image-signature-wrap">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              @change="handleSignatureImageUpload"
            />
            <span class="hint-text">PNG, JPG o WEBP · Máximo 2 MB.</span>
          </div>

          <div v-if="form.signatureDataUrl" class="signature-preview-box">
            <img :src="form.signatureDataUrl" alt="Firma del tutor" class="signature-img" />
          </div>

          <label class="confirm-checkbox">
            <input
              v-model="form.tutorSignatureConfirmed"
              type="checkbox"
              :disabled="isReadOnly"
              @change="markDirty"
            />
            <span>
              <strong>TUTOR: {{ form.tutorName }}</strong> — Valido y firmo el presente Plan de Trabajo de Tutorías.
            </span>
          </label>
        </UiCard>
      </div>
    </template>

    <!-- Diálogo de Vista Previa del Documento Oficial -->
    <UiDialog v-model="isPreviewOpen" title="Vista previa: Plan de Trabajo de Tutorías" class="preview-dialog">
      <div class="dialog-body">
        <UiAlert v-if="previewError" tone="danger" title="Aviso">
          <UiText>{{ previewError }}</UiText>
        </UiAlert>
        <UiAlert v-if="isPreviewing" tone="info" title="Generando vista previa..." />

        <iframe
          v-else-if="previewResult?.previewUrlOrContent"
          :src="previewResult.previewUrlOrContent"
          class="preview-frame"
          title="Vista previa PDF Plan de Trabajo"
        />

        <!-- Vista previa estructurada fiel al formato DOCX oficial -->
        <div v-else class="docx-preview">
          <div class="docx-header">
            <h3>Instituto Tecnológico Superior de Monclova</h3>
            <p>Programa Institucional de Tutorías · Plan de Trabajo</p>
          </div>
          <div class="docx-meta">
            <div><strong>Periodo:</strong> {{ form.semesterLabel }}</div>
            <div><strong>Grupo:</strong> {{ form.groupSemester }}</div>
            <div><strong>Carrera:</strong> {{ form.career }}</div>
            <div><strong>Turno:</strong> {{ form.shift }}</div>
          </div>
          <p class="docx-obj"><strong>Objetivo General del Curso:</strong> {{ form.generalObjective || '—' }}</p>

          <table class="docx-table">
            <thead>
              <tr>
                <th>Sesión y Fecha</th>
                <th>Título</th>
                <th>Objetivo</th>
                <th>Actividades estratégicas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in form.sessions" :key="s.sessionNumber">
                <td><strong>{{ s.sessionNumber }}</strong> · {{ s.dateRange }}</td>
                <td>{{ s.title || '—' }}</td>
                <td>{{ s.objective || '—' }}</td>
                <td>{{ s.strategicActivities || '—' }}</td>
              </tr>
            </tbody>
          </table>

          <div class="docx-monthly">
            <strong>Actividades mensuales:</strong>
            <ul>
              <li v-for="item in NORMATIVE_MONTHLY_ACTIVITIES" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div class="docx-sign">
            <img v-if="form.signatureDataUrl" :src="form.signatureDataUrl" alt="Firma" class="signature-img" />
            <div class="sign-line">TUTOR: {{ form.tutorName }}</div>
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
.plan-block {
  margin-bottom: 1.25rem;
}

.plan-block:last-child {
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

.header-grid,
.signature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-field-textarea {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-top: 0.5rem;
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

.sessions-table-wrap {
  overflow-x: auto;
}

.sessions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.sessions-table th,
.sessions-table td {
  border: 1px solid var(--color-border, #e2e8f0);
  padding: 0.5rem;
  vertical-align: top;
  text-align: left;
}

.sessions-table th {
  background-color: var(--color-bg-light, #f8fafc);
  font-weight: 600;
  color: var(--color-primary, #1b396a);
}

.col-session { min-width: 185px; }
.col-title { min-width: 180px; }
.col-objective { min-width: 220px; }
.col-activities { min-width: 240px; }

.session-num {
  font-weight: 700;
  color: var(--color-primary, #1b396a);
  margin-bottom: 0.25rem;
}

.cell-input,
.cell-textarea {
  width: 100%;
  padding: 0.375rem 0.5rem;
  font-family: inherit;
  font-size: 0.8125rem;
  color: var(--color-text-primary, #0f172a);
  background-color: var(--input-bg, #ffffff);
  border: 1px solid var(--input-border, #cbd5e1);
  border-radius: 4px;
}

.cell-textarea {
  resize: vertical;
}

.normative-list {
  margin: 0 0 1rem 1.25rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: var(--color-text-primary, #1e293b);
}

.confirm-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  margin: 0.75rem 0;
  cursor: pointer;
}

.canvas-wrap,
.image-signature-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.signature-canvas {
  border: 1px dashed var(--color-border-medium, #94a3b8);
  border-radius: 6px;
  background-color: #ffffff;
  touch-action: none;
  max-width: 100%;
}

.signature-preview-box {
  padding: 0.5rem;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  background-color: #ffffff;
  width: fit-content;
  margin-bottom: 0.5rem;
}

.signature-img {
  max-height: 80px;
  max-width: 260px;
  display: block;
}

.hint-text {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
}

.preview-dialog {
  max-width: 860px;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preview-frame {
  width: 100%;
  height: 500px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
}

.docx-preview {
  padding: 1.25rem;
  background-color: #ffffff;
  color: #0f172a;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  max-height: 520px;
  overflow-y: auto;
  font-size: 0.8125rem;
}

.docx-header {
  text-align: center;
  margin-bottom: 0.875rem;
}

.docx-header h3 {
  margin: 0;
  color: #1b396a;
}

.docx-header p {
  margin: 0.25rem 0 0;
  font-weight: 600;
}

.docx-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.375rem 1rem;
  margin-bottom: 0.75rem;
}

.docx-obj {
  margin: 0 0 0.75rem;
}

.docx-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.875rem;
  font-size: 0.75rem;
}

.docx-table th,
.docx-table td {
  border: 1px solid #cbd5e1;
  padding: 0.35rem;
  text-align: left;
}

.docx-table th {
  background-color: #f1f5f9;
}

.docx-monthly ul {
  margin: 0.35rem 0 1rem 1.25rem;
}

.docx-sign {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1.25rem;
}

.sign-line {
  border-top: 1px solid #0f172a;
  padding-top: 0.35rem;
  min-width: 260px;
  text-align: center;
  font-weight: 600;
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
