<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUnsavedChangesGuard } from '../../../shared/composables/useUnsavedChangesGuard'
import { sanitizePreviewUrl } from '../../../shared/utils/safePreviewUrl'
import { getCurrentAcademicPeriod, getPeriodLabel } from '../../../shared/utils/academicPeriod'
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
  PlanTrabajoSignatureMode,
  PreviewFormat,
  SeguimientoFinalTabKey,
  TemplatePreviewResult,
} from '../types/compliance'

interface TabMeta {
  tabKey: SeguimientoFinalTabKey
  label: string
  excelSheetName: string
}

const TABS: TabMeta[] = [
  {
    tabKey: 'anexo_19_reporte_semestral',
    label: 'Anexo 19 Reporte Semestral',
    excelSheetName: 'Anexo 19 Reporte Semestral',
  },
  {
    tabKey: 'informe_final_tutores',
    label: 'informe final de tutores',
    excelSheetName: 'informe final de tutores',
  },
  {
    tabKey: 'resultados_indice_reprob',
    label: 'RESULTADOS DE INDICE DE REPROB.',
    excelSheetName: 'RESULTADOS DE INDICE DE REPROB.',
  },
  {
    tabKey: 'caracteristicas_gpo',
    label: 'CARACTERISTICAS DEL GPO.',
    excelSheetName: 'CARACTERISTICAS DEL GPO.',
  },
]

const UNIT_HEADERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const

const REFERRED_AREAS = [
  '',
  'Psicología',
  'Trabajo Social',
  'Enfermería',
  'Tutorías',
  'Académico',
  'Desempeño',
]

const SIGNATURE_MODE_OPTIONS: { value: PlanTrabajoSignatureMode; label: string }[] = [
  { value: 'name_confirmation', label: 'Confirmación con nombre del tutor' },
  { value: 'canvas', label: 'Firma dibujada en pantalla (canvas)' },
  { value: 'image', label: 'Cargar imagen de firma (PNG/JPG)' },
]

const BASE_ROSTER = [
  'Ana Sofía Rodríguez Fuentes',
  'Luis Fernando Torres Aguilar',
  'Jorge Eduardo Morales Dávila',
  'Mateo Alejandro Garza Silva',
  'Mariana Lizeth Cantú Ortiz',
]

const route = useRoute()
const router = useRouter()

const currentUser = ref<UserResponse | null>(null)
const task = ref<DeliverableTask | null>(null)
const activeTabKey = ref<SeguimientoFinalTabKey>('anexo_19_reporte_semestral')
const completedTabs = ref<Set<SeguimientoFinalTabKey>>(new Set())

const isLoading = ref(true)
const isSaving = ref(false)
const isPreviewing = ref(false)
const isExporting = ref(false)
const isTabDirty = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Evidencia fotográfica (Anexo 19 — sesiones y lista de asistencia)
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const MAX_PHOTO_COUNT = 10
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const pendingPhotos = ref<File[]>([])
const photoError = ref('')

// Vista previa
const isPreviewOpen = ref(false)
const previewFormat = ref<PreviewFormat>('pdf')
const previewResult = ref<TemplatePreviewResult | null>(null)
const previewError = ref('')

// Encabezado compartido
const header = ref({
  instituteName: 'Instituto Tecnológico Superior de Monclova',
  tutorName: '',
  periodLabel: getCurrentAcademicPeriod().label,
  reportDate: new Date().toISOString().slice(0, 10),
  educationalProgram: 'Ingeniería en Sistemas Computacionales',
  semester: '1°',
  groupName: '1°A',
  shift: 'Matutino',
  scheduleHour: '09:00 - 10:00',
})

// Firma provisional del tutor (extensible a canvas / imagen)
const tutorSignatureConfirmed = ref(false)
const tutorSignedAt = ref<string | undefined>(undefined)
const signatureMode = ref<PlanTrabajoSignatureMode>('name_confirmation')
const signatureDataUrl = ref<string | undefined>(undefined)
const signatureCanvas = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)
const coordinatorName = ref('')
const departmentHeadName = ref('')
const deliveryDate = ref(new Date().toISOString().slice(0, 10))

// Pestaña 1: Anexo 19 Reporte Semestral
const tab19Rows = ref(
  Array.from({ length: 10 }, (_, idx) => ({
    listNumber: idx + 1,
    studentName: BASE_ROSTER[idx] ?? '',
    groupCount: '',
    individualCount: '',
    referredCount: '',
    referredArea: '',
  })),
)
const tab19Observations = ref('')

// Pestaña 2: informe final de tutores
const tabInforme = ref({
  activitiesPerformed: '',
  droppedOutCount: '0',
  dropoutReasons: '',
  totalStudents: '35',
  approvedCount: '30',
  failedCount: '5',
  goalsMetSummary: '',
  tutorialFeedback: '',
})
const tabInformeFailureCauses = ref([
  {
    subjectName: 'Cálculo Diferencial',
    teacherName: '',
    students: '',
    failureCause: '',
  },
  {
    subjectName: 'Fundamentos de Programación',
    teacherName: '',
    students: '',
    failureCause: '',
  },
])

// Pestaña 3: RESULTADOS DE INDICE DE REPROB.
const tabReprobRows = ref([
  {
    subjectName: 'Cálculo Diferencial',
    teacherName: '',
    units: ['', '', '', '', '', '', '', ''],
  },
  {
    subjectName: 'Fundamentos de Programación',
    teacherName: '',
    units: ['', '', '', '', '', '', '', ''],
  },
  {
    subjectName: 'Matemáticas Discretas',
    teacherName: '',
    units: ['', '', '', '', '', '', '', ''],
  },
])
const tabReprobComments = ref('')

// Pestaña 4: CARACTERISTICAS DEL GPO.
const tabCaracteristicas = ref({
  groupDescription: '',
  strengths: '',
  opportunityAreas: '',
  recommendations: '',
})

const isReadOnly = computed(() => currentUser.value?.role === 'Admin')
const activeTabMeta = computed(() => TABS.find((t) => t.tabKey === activeTabKey.value) ?? TABS[0])

function toText(raw: string | number | null | undefined): string {
  return raw === null || raw === undefined ? '' : String(raw).trim()
}

function parseNonNegativeInt(raw: string | number | null | undefined): number {
  const clean = toText(raw)
  if (!clean) return 0
  const n = Number(clean)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

function parsePercentSafe(raw: string | number | null | undefined): number | null {
  const clean = toText(raw)
  if (!clean) return null
  const n = Number(clean)
  return Number.isFinite(n) ? n : null
}

function isHighFailurePercent(raw: string | number | null | undefined): boolean {
  const n = parsePercentSafe(raw)
  return n !== null && n > 30 && n <= 100
}

function calcRowReprobAvg(units: string[]): number | null {
  const vals = units.map((u) => parsePercentSafe(u)).filter((v): v is number => v !== null && v >= 0 && v <= 100)
  if (vals.length === 0) return null
  const sum = vals.reduce((acc, v) => acc + v, 0)
  return Number((sum / vals.length).toFixed(1))
}

const finalFailureAverage = computed<number | null>(() => {
  const avgs = tabReprobRows.value
    .map((r) => calcRowReprobAvg(r.units))
    .filter((v): v is number => v !== null)
  if (avgs.length === 0) return null
  const sum = avgs.reduce((acc, v) => acc + v, 0)
  return Number((sum / avgs.length).toFixed(1))
})

const tab19Totals = computed(() => {
  let group = 0
  let individual = 0
  let referred = 0
  for (const r of tab19Rows.value) {
    group += parseNonNegativeInt(r.groupCount)
    individual += parseNonNegativeInt(r.individualCount)
    referred += parseNonNegativeInt(r.referredCount)
  }
  return { group, individual, referred }
})

const informeStats = computed(() => {
  const total = parseNonNegativeInt(tabInforme.value.totalStudents)
  const approved = parseNonNegativeInt(tabInforme.value.approvedCount)
  const failed = parseNonNegativeInt(tabInforme.value.failedCount)
  const dropped = parseNonNegativeInt(tabInforme.value.droppedOutCount)
  const approvalPct = total > 0 ? Number(((approved * 100) / total).toFixed(1)) : 0
  const failurePct = total > 0 ? Number(((failed * 100) / total).toFixed(1)) : 0
  const dropoutPct = total > 0 ? Number(((dropped * 100) / total).toFixed(1)) : 0
  return { total, approved, failed, dropped, approvalPct, failurePct, dropoutPct }
})

function markDirty(): void {
  isTabDirty.value = true
}

function updateStringField<T extends Record<string, unknown>>(obj: T, key: keyof T, event: Event): void {
  obj[key] = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value as T[keyof T]
  markDirty()
}

function updateUnitValue(row: { units: string[] }, idx: number, event: Event): void {
  row.units[idx] = (event.target as HTMLInputElement).value
  markDirty()
}

function addTab19Row(): void {
  if (isReadOnly.value) return
  tab19Rows.value.push({
    listNumber: tab19Rows.value.length + 1,
    studentName: '',
    groupCount: '',
    individualCount: '',
    referredCount: '',
    referredArea: '',
  })
  markDirty()
}

function addFailureCauseRow(): void {
  if (isReadOnly.value) return
  tabInformeFailureCauses.value.push({
    subjectName: '',
    teacherName: '',
    students: '',
    failureCause: '',
  })
  markDirty()
}

function addReprobRow(): void {
  if (isReadOnly.value) return
  tabReprobRows.value.push({
    subjectName: '',
    teacherName: '',
    units: ['', '', '', '', '', '', '', ''],
  })
  markDirty()
}

function getTabPayload(tabKey: SeguimientoFinalTabKey): Record<string, unknown> {
  const common = {
    sheetKey: tabKey,
    excelSheetName: TABS.find((t) => t.tabKey === tabKey)?.excelSheetName ?? tabKey,
    header: { ...header.value },
    signature: {
      tutorName: header.value.tutorName,
      confirmed: tutorSignatureConfirmed.value,
      signedAt: tutorSignedAt.value,
      mode: signatureMode.value,
      dataUrl: signatureDataUrl.value,
      coordinatorName: toText(coordinatorName.value),
      departmentHeadName: toText(departmentHeadName.value),
      deliveryDate: deliveryDate.value,
    },
  }

  switch (tabKey) {
    case 'anexo_19_reporte_semestral':
      return {
        ...common,
        rows: tab19Rows.value.map((r) => ({
          ...r,
          studentName: toText(r.studentName),
          groupCount: toText(r.groupCount),
          individualCount: toText(r.individualCount),
          referredCount: toText(r.referredCount),
          referredArea: toText(r.referredArea),
        })),
        totals: tab19Totals.value,
        observations: toText(tab19Observations.value),
      }
    case 'informe_final_tutores':
      return {
        ...common,
        ...tabInforme.value,
        failureCausesBySubject: tabInformeFailureCauses.value.map((r) => ({
          subjectName: toText(r.subjectName),
          teacherName: toText(r.teacherName),
          students: toText(r.students),
          failureCause: toText(r.failureCause),
        })),
      }
    case 'resultados_indice_reprob':
      return {
        ...common,
        rows: tabReprobRows.value.map((r) => ({
          subjectName: toText(r.subjectName),
          teacherName: toText(r.teacherName),
          units: r.units.map((u) => toText(u)),
          averageFailurePercent: calcRowReprobAvg(r.units),
        })),
        finalFailureAverage: finalFailureAverage.value,
        comments: toText(tabReprobComments.value),
      }
    case 'caracteristicas_gpo':
      return {
        ...common,
        groupDescription: toText(tabCaracteristicas.value.groupDescription),
        strengths: toText(tabCaracteristicas.value.strengths),
        opportunityAreas: toText(tabCaracteristicas.value.opportunityAreas),
        recommendations: toText(tabCaracteristicas.value.recommendations),
      }
  }
}

function hydrateTabFromTask(loadedTask: DeliverableTask, tabKey: SeguimientoFinalTabKey): void {
  const tabsMap = (loadedTask.formPayload?.tabs as Record<string, Record<string, unknown>> | undefined) ?? {}
  const saved = tabsMap[tabKey] ?? {}

  if (saved.header && typeof saved.header === 'object') {
    header.value = { ...header.value, ...(saved.header as typeof header.value) }
  }
  if (saved.signature && typeof saved.signature === 'object') {
    const sig = saved.signature as Record<string, unknown>
    tutorSignatureConfirmed.value = Boolean(sig.confirmed ?? tutorSignatureConfirmed.value)
    tutorSignedAt.value = (sig.signedAt as string | undefined) ?? tutorSignedAt.value
    signatureMode.value = (sig.mode as PlanTrabajoSignatureMode) ?? signatureMode.value
    signatureDataUrl.value = (sig.dataUrl as string | undefined) ?? signatureDataUrl.value
    if (sig.coordinatorName !== undefined) coordinatorName.value = String(sig.coordinatorName)
    if (sig.departmentHeadName !== undefined) departmentHeadName.value = String(sig.departmentHeadName)
    if (sig.deliveryDate) deliveryDate.value = String(sig.deliveryDate)
  }

  if (tabKey === 'anexo_19_reporte_semestral') {
    if (Array.isArray(saved.rows) && saved.rows.length > 0) {
      tab19Rows.value = (saved.rows as typeof tab19Rows.value).map((r, idx) => ({
        listNumber: idx + 1,
        studentName: toText(r.studentName),
        groupCount: toText(r.groupCount),
        individualCount: toText(r.individualCount),
        referredCount: toText(r.referredCount),
        referredArea: toText(r.referredArea),
      }))
    }
    if (saved.observations !== undefined) tab19Observations.value = toText(saved.observations as string)
  } else if (tabKey === 'informe_final_tutores') {
    if (saved.activitiesPerformed !== undefined) tabInforme.value.activitiesPerformed = String(saved.activitiesPerformed)
    if (saved.droppedOutCount !== undefined) tabInforme.value.droppedOutCount = String(saved.droppedOutCount)
    if (saved.dropoutReasons !== undefined) tabInforme.value.dropoutReasons = String(saved.dropoutReasons)
    if (saved.totalStudents !== undefined) tabInforme.value.totalStudents = String(saved.totalStudents)
    if (saved.approvedCount !== undefined) tabInforme.value.approvedCount = String(saved.approvedCount)
    if (saved.failedCount !== undefined) tabInforme.value.failedCount = String(saved.failedCount)
    if (saved.goalsMetSummary !== undefined) tabInforme.value.goalsMetSummary = String(saved.goalsMetSummary)
    if (saved.tutorialFeedback !== undefined) tabInforme.value.tutorialFeedback = String(saved.tutorialFeedback)
    if (Array.isArray(saved.failureCausesBySubject) && saved.failureCausesBySubject.length > 0) {
      tabInformeFailureCauses.value = saved.failureCausesBySubject as typeof tabInformeFailureCauses.value
    }
  } else if (tabKey === 'resultados_indice_reprob') {
    if (Array.isArray(saved.rows) && saved.rows.length > 0) {
      tabReprobRows.value = (saved.rows as typeof tabReprobRows.value).map((r) => ({
        subjectName: toText(r.subjectName),
        teacherName: toText(r.teacherName),
        units: Array.from({ length: 8 }, (_, i) => toText(r.units?.[i])),
      }))
    }
    if (saved.comments !== undefined) tabReprobComments.value = String(saved.comments)
  } else if (tabKey === 'caracteristicas_gpo') {
    if (saved.groupDescription !== undefined) tabCaracteristicas.value.groupDescription = String(saved.groupDescription)
    if (saved.strengths !== undefined) tabCaracteristicas.value.strengths = String(saved.strengths)
    if (saved.opportunityAreas !== undefined) tabCaracteristicas.value.opportunityAreas = String(saved.opportunityAreas)
    if (saved.recommendations !== undefined) tabCaracteristicas.value.recommendations = String(saved.recommendations)
  }

  isTabDirty.value = false
}

function hydrateCompletedTabs(loadedTask: DeliverableTask): void {
  const tabsMap = (loadedTask.formPayload?.tabs as Record<string, Record<string, unknown>> | undefined) ?? {}
  const done = new Set<SeguimientoFinalTabKey>()
  for (const t of TABS) {
    if (tabsMap[t.tabKey] && Object.keys(tabsMap[t.tabKey]).length > 2) {
      done.add(t.tabKey)
    }
  }
  completedTabs.value = done
}

async function loadWorkbook(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    currentUser.value = await me()
    const deliverableId = String(route.params.deliverableId ?? '')
    const loaded = await complianceApi.getDeliverableForm(deliverableId, activeTabKey.value)
    task.value = loaded

    const pre = loaded.prefilledData ?? {}
    header.value = {
      instituteName: String(pre.plantel ?? 'Instituto Tecnológico Superior de Monclova'),
      tutorName: String(pre.docente_nombre ?? currentUser.value?.name ?? 'Docente Tutor'),
      periodLabel: getPeriodLabel(loaded.periodoId),
      reportDate: new Date().toISOString().slice(0, 10),
      educationalProgram: String(pre.carrera ?? 'Ingeniería en Sistemas Computacionales'),
      semester: String(pre.semestre ?? '1°'),
      groupName: String(pre.grupo ?? '1°A'),
      shift: String(pre.turno ?? 'Matutino'),
      scheduleHour: '09:00 - 10:00',
    }

    hydrateCompletedTabs(loaded)
    hydrateTabFromTask(loaded, activeTabKey.value)
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isLoading.value = false
  }
}

function switchTab(nextKey: SeguimientoFinalTabKey): void {
  if (nextKey === activeTabKey.value || isSaving.value || !task.value) return
  if (isTabDirty.value) {
    const proceed = window.confirm(
      'Hay cambios sin guardar en la pestaña actual. ¿Deseas descartarlos y cambiar de pestaña?',
    )
    if (!proceed) return
  }
  activeTabKey.value = nextKey
  errorMessage.value = ''
  successMessage.value = ''
  hydrateTabFromTask(task.value, nextKey)
}

function validateNonNegCountField(raw: string, label: string): string | null {
  const clean = toText(raw)
  if (!clean) return null
  const n = Number(clean)
  if (!Number.isInteger(n) || n < 0) {
    return `${label} debe ser un número entero mayor o igual a 0.`
  }
  return null
}

function validateActiveTab(strictSubmit: boolean): string | null {
  if (activeTabKey.value === 'anexo_19_reporte_semestral') {
    for (const row of tab19Rows.value) {
      const checks = [
        validateNonNegCountField(row.groupCount, `Fila ${row.listNumber} (Tutoría Grupal)`),
        validateNonNegCountField(row.individualCount, `Fila ${row.listNumber} (Tutoría Individual)`),
        validateNonNegCountField(row.referredCount, `Fila ${row.listNumber} (Canalizados)`),
      ]
      const failed = checks.find(Boolean)
      if (failed) return failed
    }
  }

  if (activeTabKey.value === 'informe_final_tutores') {
    const checks = [
      validateNonNegCountField(tabInforme.value.totalStudents, 'Total de alumnos'),
      validateNonNegCountField(tabInforme.value.droppedOutCount, 'Alumnos que desertaron'),
      validateNonNegCountField(tabInforme.value.approvedCount, 'Alumnos aprobados'),
      validateNonNegCountField(tabInforme.value.failedCount, 'Alumnos reprobados'),
    ]
    const failed = checks.find(Boolean)
    if (failed) return failed

    const { total, approved, failed: failedCount, dropped } = informeStats.value
    if (total > 0 && dropped > total) {
      return 'Los alumnos que desertaron no pueden superar el total del grupo.'
    }
    if (total > 0 && approved + failedCount > total) {
      return 'La suma de aprobados y reprobados no puede superar el total de alumnos.'
    }
  }

  if (activeTabKey.value === 'resultados_indice_reprob') {
    for (let rIdx = 0; rIdx < tabReprobRows.value.length; rIdx++) {
      const row = tabReprobRows.value[rIdx]
      for (let uIdx = 0; uIdx < row.units.length; uIdx++) {
        const clean = toText(row.units[uIdx])
        if (clean) {
          const n = Number(clean)
          if (!Number.isFinite(n) || n < 0 || n > 100) {
            return `RESULTADOS DE INDICE DE REPROB. (${row.subjectName || `Fila ${rIdx + 1}`}, Unidad ${UNIT_HEADERS[uIdx]}): el porcentaje debe estar entre 0 y 100%.`
          }
        }
      }
    }
  }

  if (strictSubmit && !tutorSignatureConfirmed.value) {
    return 'Confirma la firma del tutor antes de entregar el libro de Seguimiento Final.'
  }
  return null
}

async function handleSaveTab(submit: boolean): Promise<void> {
  if (!task.value || isSaving.value || isReadOnly.value) return

  const err = validateActiveTab(submit)
  if (err) {
    errorMessage.value = err
    return
  }

  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const updated = await complianceApi.saveDeliverableForm(task.value.id, {
      tabKey: activeTabKey.value,
      formPayload: getTabPayload(activeTabKey.value),
      photoEvidenceFiles: pendingPhotos.value.length > 0 ? pendingPhotos.value : undefined,
      submit,
    })
    task.value = updated
    pendingPhotos.value = []
    photoError.value = ''
    completedTabs.value.add(activeTabKey.value)
    isTabDirty.value = false
    successMessage.value = submit
      ? 'Libro de Seguimiento Final entregado correctamente.'
      : `Pestaña "${activeTabMeta.value.label}" guardada.`
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isSaving.value = false
  }
}

function handlePhotoUpload(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  photoError.value = ''
  if (files.length === 0) return

  const existingCount = (task.value?.photoEvidenceUrls?.length ?? 0) + pendingPhotos.value.length
  if (existingCount + files.length > MAX_PHOTO_COUNT) {
    photoError.value = `Máximo ${MAX_PHOTO_COUNT} fotografías por entrega.`
    input.value = ''
    return
  }

  for (const file of files) {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      photoError.value = `Formato no permitido (${file.name}). Usa JPG, PNG o WEBP (415).`
      input.value = ''
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      photoError.value = `La imagen "${file.name}" supera 5 MB (413).`
      input.value = ''
      return
    }
  }

  pendingPhotos.value = [...pendingPhotos.value, ...files]
  markDirty()
  input.value = ''
}

function removePendingPhoto(idx: number): void {
  pendingPhotos.value.splice(idx, 1)
  markDirty()
}

function formatEvidenceLabel(url: string, idx: number): string {
  const cleaned = url.replace(/^local-evidence:\/\//, '')
  try {
    const decoded = decodeURIComponent(cleaned.split('/').pop() ?? '')
    return decoded || `Evidencia ${idx + 1}`
  } catch {
    return `Evidencia ${idx + 1}`
  }
}

function onSignatureToggle(): void {
  tutorSignedAt.value = tutorSignatureConfirmed.value ? new Date().toLocaleString('es-MX') : undefined
  markDirty()
}

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
  signatureCanvas.value?.getContext('2d')?.clearRect(0, 0, 340, 110)
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
      activeTabKey.value,
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
  isExporting.value = true
  errorMessage.value = ''
  previewError.value = ''

  try {
    const blob = await complianceApi.exportDeliverableTemplate(task.value.id, activeTabKey.value)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Seguimiento_Final_${task.value.docenteClave}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = 'Libro final exportado desde plantilla oficial (.xlsx).'
  } catch (error) {
    const normalized = normalizeApiError(error)
    const msg =
      normalized.status === 404 || normalized.status === 0
        ? 'El servicio de exportación .xlsx en backend aún no está activo.'
        : normalized.message
    if (isPreviewOpen.value) previewError.value = msg
    else errorMessage.value = msg
  } finally {
    isExporting.value = false
  }
}

function goBack(): void {
  void router.push({ name: 'compliance-dashboard' })
}

useUnsavedChangesGuard(isTabDirty)

onMounted(() => {
  void loadWorkbook()
})
</script>

<template>
  <UiBasePage
    fluid
    title="Seguimiento Final del Tutor (4 Pestañas)"
    description="Plantilla oficial: Anexos Seguimiento de Tutorías-FINAL- FJ-26.xlsx · Persistencia independiente por hoja conservando estilos y fórmulas."
  >
    <template #actions>
      <div class="top-actions">
        <UiButton variant="secondary" @click="goBack">← Volver a Cumplimiento</UiButton>
        <UiButton variant="secondary" :disabled="isLoading || isPreviewing" @click="openPreview">
          Vista previa
        </UiButton>
        <UiButton variant="secondary" :loading="isExporting" :disabled="isLoading" @click="handleExport">
          Exportar .xlsx
        </UiButton>
        <UiButton v-if="!isReadOnly" variant="secondary" :loading="isSaving" :disabled="isLoading" @click="handleSaveTab(false)">
          Guardar pestaña
        </UiButton>
        <UiButton v-if="!isReadOnly" variant="primary" :loading="isSaving" :disabled="isLoading" @click="handleSaveTab(true)">
          {{ task?.status === 'Pending' ? 'Entregar libro final' : 'Actualizar entrega' }}
        </UiButton>
      </div>
    </template>

    <UiAlert v-if="successMessage" tone="success" title="Operación exitosa" dismissible @dismiss="successMessage = ''">
      <UiText>{{ successMessage }}</UiText>
    </UiAlert>
    <UiAlert v-if="errorMessage" tone="danger" title="Validación">
      <UiText>{{ errorMessage }}</UiText>
    </UiAlert>
    <UiAlert v-if="isLoading" tone="info" title="Cargando libro de Seguimiento Final..." />

    <template v-else-if="task">
      <!-- Encabezado compartido -->
      <div class="wb-block">
        <UiCard title="Datos Institucionales y del Grupo" description="Pre-rellenados desde PostgreSQL para las 4 hojas del libro final.">
          <div class="status-strip">
            <div class="status-meta">
              <DeliverableStatusBadge :status="task.status" />
              <UiBadge tone="info">Pestañas guardadas: {{ completedTabs.size }} / 4</UiBadge>
              <code class="meta-code">Hoja activa: {{ activeTabMeta.excelSheetName }}</code>
            </div>
            <UiBadge v-if="isTabDirty" tone="warning">Cambios sin guardar en esta pestaña</UiBadge>
          </div>
          <div class="header-grid">
            <UiField v-model="header.instituteName" label="Instituto Tecnológico" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.tutorName" label="Nombre del Tutor" :disabled="true" />
            <UiField v-model="header.periodLabel" label="Periodo" :disabled="true" />
            <UiField v-model="header.reportDate" label="Fecha" type="date" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.educationalProgram" label="Programa educativo / Carrera" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.semester" label="Semestre" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.groupName" label="Grupo" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.shift" label="Turno" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.scheduleHour" label="Hora" :disabled="isReadOnly" @update:model-value="markDirty" />
          </div>
        </UiCard>
      </div>

      <!-- Barra de 4 pestañas -->
      <div class="wb-block">
        <UiCard :title="activeTabMeta.label" :description="`Clave de hoja: ${activeTabMeta.tabKey} → Excel: '${activeTabMeta.excelSheetName}'`">
          <div class="sheet-tabs" role="tablist" aria-label="Hojas del libro final">
            <button
              v-for="tab in TABS"
              :key="tab.tabKey"
              type="button"
              role="tab"
              class="sheet-tab-btn"
              :class="{ active: tab.tabKey === activeTabKey }"
              :aria-selected="tab.tabKey === activeTabKey"
              @click="switchTab(tab.tabKey)"
            >
              <span>{{ tab.label }}</span>
              <span v-if="tab.tabKey === activeTabKey && isTabDirty" class="tab-dirty-dot" aria-label="Cambios sin guardar">●</span>
              <span v-else-if="completedTabs.has(tab.tabKey)" aria-label="Guardada">✓</span>
            </button>
          </div>

          <!-- Pestaña 1: Anexo 19 Reporte Semestral -->
          <div v-if="activeTabKey === 'anexo_19_reporte_semestral'" class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th rowspan="2" class="col-num">No.</th>
                    <th rowspan="2">Lista de estudiantes</th>
                    <th colspan="2" class="text-center">Estudiantes atendidos en el semestre</th>
                    <th rowspan="2" class="col-num-cell">Estudiantes canalizados</th>
                    <th rowspan="2">Área canalizada</th>
                  </tr>
                  <tr>
                    <th class="col-num-cell">Tutoría Grupal</th>
                    <th class="col-num-cell">Tutoría Individual</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in tab19Rows" :key="row.listNumber">
                    <td class="col-num">{{ row.listNumber }}</td>
                    <td>
                      <input
                        :value="row.studentName"
                        type="text"
                        class="cell-input"
                        placeholder="Nombre completo del estudiante"
                        :disabled="isReadOnly"
                        @input="updateStringField(row, 'studentName', $event)"
                      />
                    </td>
                    <td class="col-num-cell">
                      <input
                        :value="row.groupCount"
                        type="number"
                        min="0"
                        class="num-input"
                        placeholder="0"
                        :disabled="isReadOnly"
                        @input="updateStringField(row, 'groupCount', $event)"
                      />
                    </td>
                    <td class="col-num-cell">
                      <input
                        :value="row.individualCount"
                        type="number"
                        min="0"
                        class="num-input"
                        placeholder="0"
                        :disabled="isReadOnly"
                        @input="updateStringField(row, 'individualCount', $event)"
                      />
                    </td>
                    <td class="col-num-cell">
                      <input
                        :value="row.referredCount"
                        type="number"
                        min="0"
                        class="num-input"
                        placeholder="0"
                        :disabled="isReadOnly"
                        @input="updateStringField(row, 'referredCount', $event)"
                      />
                    </td>
                    <td>
                      <select
                        :value="row.referredArea"
                        class="cell-input"
                        :disabled="isReadOnly"
                        @change="updateStringField(row, 'referredArea', $event)"
                      >
                        <option v-for="area in REFERRED_AREAS" :key="area" :value="area">
                          {{ area || 'Ninguna' }}
                        </option>
                      </select>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="totals-row">
                    <td colspan="2"><strong>Totales del semestre</strong></td>
                    <td class="col-num-cell"><strong>{{ tab19Totals.group }}</strong></td>
                    <td class="col-num-cell"><strong>{{ tab19Totals.individual }}</strong></td>
                    <td class="col-num-cell"><strong>{{ tab19Totals.referred }}</strong></td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <UiButton v-if="!isReadOnly" variant="secondary" class="btn-sm" @click="addTab19Row">
              + Agregar estudiante
            </UiButton>

            <div class="info-box">
              <strong>Instructivo de llenado (Anexo 19):</strong>
              <ul>
                <li>Anote las 10 actividades adicionales más importantes realizadas en el semestre.</li>
                <li>Anote las acciones de mayor impacto para alcanzar la competencia de la asignatura.</li>
                <li>Este reporte deberá ser llenado por el Tutor y entregado al Coordinador de Tutoría del Departamento Académico con copia para el Tutor.</li>
                <li><strong>NOTA:</strong> Se anexan evidencias de las sesiones así como la lista de asistencia de los estudiantes.</li>
              </ul>
            </div>

            <div class="textarea-group">
              <label class="field-label">Observaciones (actividades adicionales y acciones de mayor impacto)</label>
              <textarea
                :value="tab19Observations"
                rows="4"
                class="textarea-input"
                placeholder="Describe las actividades adicionales y acciones de impacto realizadas durante el semestre..."
                :disabled="isReadOnly"
                @input="tab19Observations = ($event.target as HTMLTextAreaElement).value; markDirty()"
              />
            </div>

            <div class="header-grid">
              <UiField v-model="deliveryDate" label="Fecha de entrega del reporte" type="date" :disabled="isReadOnly" @update:model-value="markDirty" />
              <UiField v-model="coordinatorName" label="Coordinador de Tutoría del Depto. Académico" :disabled="isReadOnly" @update:model-value="markDirty" />
              <UiField v-model="departmentHeadName" label="Jefe de Departamento Académico" :disabled="isReadOnly" @update:model-value="markDirty" />
            </div>
          </div>

          <!-- Pestaña 2: informe final de tutores -->
          <div v-else-if="activeTabKey === 'informe_final_tutores'" class="tab-panel">
            <div class="textarea-group">
              <label class="field-label">1. ¿Qué actividades realizó con su grupo durante el semestre?</label>
              <textarea
                :value="tabInforme.activitiesPerformed"
                rows="3"
                class="textarea-input"
                :disabled="isReadOnly"
                @input="updateStringField(tabInforme, 'activitiesPerformed', $event)"
              />
            </div>

            <div class="question-block">
              <label class="field-label">2. ¿Cuántos alumnos desertaron? Describa los motivos de cada uno.</label>
              <div class="inline-metrics">
                <div class="metric-input-wrap">
                  <span class="sub-label">Desertaron (>= 0)</span>
                  <input
                    :value="tabInforme.droppedOutCount"
                    type="number"
                    min="0"
                    class="num-input"
                    :disabled="isReadOnly"
                    @input="updateStringField(tabInforme, 'droppedOutCount', $event)"
                  />
                </div>
                <UiBadge tone="info">Deserción: {{ informeStats.dropoutPct }}%</UiBadge>
              </div>
              <textarea
                :value="tabInforme.dropoutReasons"
                rows="3"
                class="textarea-input"
                placeholder="Motivos de deserción por alumno..."
                :disabled="isReadOnly"
                @input="updateStringField(tabInforme, 'dropoutReasons', $event)"
              />
            </div>

            <div class="question-block">
              <label class="field-label">3. Del total de alumnos especifique cuántos aprobaron y cuántos reprobaron</label>
              <div class="inline-metrics">
                <div class="metric-input-wrap">
                  <span class="sub-label">Total alumnos</span>
                  <input
                    :value="tabInforme.totalStudents"
                    type="number"
                    min="0"
                    class="num-input"
                    :disabled="isReadOnly"
                    @input="updateStringField(tabInforme, 'totalStudents', $event)"
                  />
                </div>
                <div class="metric-input-wrap">
                  <span class="sub-label">Aprobados</span>
                  <input
                    :value="tabInforme.approvedCount"
                    type="number"
                    min="0"
                    class="num-input"
                    :disabled="isReadOnly"
                    @input="updateStringField(tabInforme, 'approvedCount', $event)"
                  />
                </div>
                <div class="metric-input-wrap">
                  <span class="sub-label">Reprobados</span>
                  <input
                    :value="tabInforme.failedCount"
                    type="number"
                    min="0"
                    class="num-input"
                    :disabled="isReadOnly"
                    @input="updateStringField(tabInforme, 'failedCount', $event)"
                  />
                </div>
                <UiBadge tone="success">Aprobación: {{ informeStats.approvalPct }}%</UiBadge>
                <UiBadge :tone="informeStats.failurePct > 30 ? 'danger' : 'warning'">
                  Reprobación: {{ informeStats.failurePct }}%
                </UiBadge>
              </div>
            </div>

            <div class="question-block">
              <label class="field-label">4. ¿Cuáles fueron las causas de reprobación en sus alumnos tutorados? (Describir por materia)</label>
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Asignatura del semestre</th>
                      <th>Docente</th>
                      <th>Alumno(s)</th>
                      <th>Causa de reprobación</th>
                      <th v-if="!isReadOnly" class="col-action" aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, idx) in tabInformeFailureCauses" :key="idx">
                      <td><input :value="row.subjectName" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'subjectName', $event)" /></td>
                      <td><input :value="row.teacherName" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'teacherName', $event)" /></td>
                      <td><input :value="row.students" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'students', $event)" /></td>
                      <td><input :value="row.failureCause" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'failureCause', $event)" /></td>
                      <td v-if="!isReadOnly" class="col-action">
                        <button
                          type="button"
                          class="remove-row-btn"
                          :disabled="tabInformeFailureCauses.length <= 1"
                          aria-label="Eliminar asignatura"
                          title="Eliminar asignatura"
                          @click="tabInformeFailureCauses.splice(idx, 1); markDirty()"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <UiButton v-if="!isReadOnly" variant="secondary" class="btn-sm" @click="addFailureCauseRow">
                + Agregar asignatura
              </UiButton>
            </div>

            <div class="textarea-group">
              <label class="field-label">5. ¿Cumplió las metas propuestas en su plan de trabajo? ¿Cuáles?</label>
              <textarea
                :value="tabInforme.goalsMetSummary"
                rows="3"
                class="textarea-input"
                :disabled="isReadOnly"
                @input="updateStringField(tabInforme, 'goalsMetSummary', $event)"
              />
            </div>

            <div class="textarea-group">
              <label class="field-label">6. Retroalimentación a su Trabajo Tutorial</label>
              <textarea
                :value="tabInforme.tutorialFeedback"
                rows="3"
                class="textarea-input"
                :disabled="isReadOnly"
                @input="updateStringField(tabInforme, 'tutorialFeedback', $event)"
              />
            </div>
          </div>

          <!-- Pestaña 3: RESULTADOS DE INDICE DE REPROB. -->
          <div v-else-if="activeTabKey === 'resultados_indice_reprob'" class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th rowspan="2">Materia</th>
                    <th rowspan="2">Docente</th>
                    <th colspan="8" class="text-center">Unidades (% de reprobación, 0–100%)</th>
                    <th rowspan="2" class="col-num-cell">Resultado % Reprob.</th>
                    <th v-if="!isReadOnly" rowspan="2" class="col-action" aria-label="Acciones" />
                  </tr>
                  <tr>
                    <th v-for="u in UNIT_HEADERS" :key="u" class="col-num-cell">{{ u }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rIdx) in tabReprobRows" :key="rIdx">
                    <td>
                      <input
                        :value="row.subjectName"
                        type="text"
                        class="cell-input"
                        placeholder="Nombre de materia"
                        :disabled="isReadOnly"
                        @input="updateStringField(row, 'subjectName', $event)"
                      />
                    </td>
                    <td>
                      <input
                        :value="row.teacherName"
                        type="text"
                        class="cell-input"
                        placeholder="Docente titular"
                        :disabled="isReadOnly"
                        @input="updateStringField(row, 'teacherName', $event)"
                      />
                    </td>
                    <td v-for="(u, uIdx) in UNIT_HEADERS" :key="`${rIdx}-${u}`" class="col-num-cell">
                      <input
                        :value="row.units[uIdx]"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        class="num-input"
                        :class="{ failing: isHighFailurePercent(row.units[uIdx]) }"
                        placeholder="—"
                        :disabled="isReadOnly"
                        @input="updateUnitValue(row, uIdx, $event)"
                      />
                    </td>
                    <td class="col-num-cell">
                      <strong :class="{ 'text-danger': (calcRowReprobAvg(row.units) ?? 0) > 30 }">
                        {{ calcRowReprobAvg(row.units) !== null ? `${calcRowReprobAvg(row.units)}%` : '—' }}
                      </strong>
                    </td>
                    <td v-if="!isReadOnly" class="col-action">
                      <button
                        type="button"
                        class="remove-row-btn"
                        :disabled="tabReprobRows.length <= 1"
                        aria-label="Eliminar materia"
                        title="Eliminar materia"
                        @click="tabReprobRows.splice(rIdx, 1); markDirty()"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="totals-row">
                    <td colspan="10" class="text-right"><strong>PROMEDIO FINAL DE REPROB. =</strong></td>
                    <td class="col-num-cell">
                      <strong :class="{ 'text-danger': (finalFailureAverage ?? 0) > 30 }">
                        {{ finalFailureAverage !== null ? `${finalFailureAverage}%` : '—' }}
                      </strong>
                    </td>
                    <td v-if="!isReadOnly" />
                  </tr>
                </tfoot>
              </table>
            </div>

            <UiButton v-if="!isReadOnly" variant="secondary" class="btn-sm" @click="addReprobRow">
              + Agregar materia
            </UiButton>

            <div class="textarea-group">
              <label class="field-label">Comentarios (Reporte Final)</label>
              <textarea
                :value="tabReprobComments"
                rows="3"
                class="textarea-input"
                placeholder="Comentarios sobre el índice de reprobación en examen final..."
                :disabled="isReadOnly"
                @input="tabReprobComments = ($event.target as HTMLTextAreaElement).value; markDirty()"
              />
            </div>
          </div>

          <!-- Pestaña 4: CARACTERISTICAS DEL GPO. -->
          <div v-else-if="activeTabKey === 'caracteristicas_gpo'" class="tab-panel">
            <div class="textarea-group">
              <label class="field-label">Anote las características que describan a su grupo tutorado</label>
              <textarea
                :value="tabCaracteristicas.groupDescription"
                rows="5"
                class="textarea-input"
                placeholder="Describe el comportamiento académico, participación, dinámica grupal y evolución durante el semestre..."
                :disabled="isReadOnly"
                @input="updateStringField(tabCaracteristicas, 'groupDescription', $event)"
              />
            </div>

            <div class="header-grid">
              <div class="textarea-group">
                <label class="field-label">Fortalezas del grupo</label>
                <textarea
                  :value="tabCaracteristicas.strengths"
                  rows="3"
                  class="textarea-input"
                  :disabled="isReadOnly"
                  @input="updateStringField(tabCaracteristicas, 'strengths', $event)"
                />
              </div>
              <div class="textarea-group">
                <label class="field-label">Áreas de oportunidad</label>
                <textarea
                  :value="tabCaracteristicas.opportunityAreas"
                  rows="3"
                  class="textarea-input"
                  :disabled="isReadOnly"
                  @input="updateStringField(tabCaracteristicas, 'opportunityAreas', $event)"
                />
              </div>
            </div>

            <div class="textarea-group">
              <label class="field-label">Recomendaciones para el siguiente semestre</label>
              <textarea
                :value="tabCaracteristicas.recommendations"
                rows="3"
                class="textarea-input"
                :disabled="isReadOnly"
                @input="updateStringField(tabCaracteristicas, 'recommendations', $event)"
              />
            </div>
          </div>
        </UiCard>
      </div>

      <!-- Evidencia fotográfica (Anexo 19) -->
      <div class="wb-block">
        <UiCard
          title="Evidencia Fotográfica de Sesiones"
          description="Anexo 19: adjunta evidencias fotográficas de las sesiones y lista de asistencia (JPG, PNG o WEBP · máx. 5 MB c/u · hasta 10 fotos)."
        >
          <div class="evidence-body">
            <UiAlert v-if="photoError" tone="danger" title="Archivo inválido" dismissible @dismiss="photoError = ''">
              <UiText>{{ photoError }}</UiText>
            </UiAlert>

            <div v-if="!isReadOnly" class="evidence-picker">
              <label for="final-photo-input" class="evidence-upload-label">
                Seleccionar fotografías (.jpg, .png, .webp)
              </label>
              <input
                id="final-photo-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                class="sr-only"
                :disabled="isSaving"
                @change="handlePhotoUpload"
              />
            </div>

            <div v-if="pendingPhotos.length > 0" class="evidence-list">
              <span class="sub-label">Por guardar ({{ pendingPhotos.length }}):</span>
              <div class="evidence-chips">
                <span v-for="(file, idx) in pendingPhotos" :key="`${file.name}-${idx}`" class="evidence-chip pending">
                  <span>{{ file.name }} ({{ (file.size / 1024).toFixed(0) }} KB)</span>
                  <button
                    type="button"
                    class="chip-remove"
                    aria-label="Quitar fotografía"
                    @click="removePendingPhoto(idx)"
                  >
                    ×
                  </button>
                </span>
              </div>
            </div>

            <div v-if="task.photoEvidenceUrls && task.photoEvidenceUrls.length > 0" class="evidence-list">
              <span class="sub-label">Evidencias registradas ({{ task.photoEvidenceUrls.length }}):</span>
              <div class="evidence-chips">
                <span
                  v-for="(url, idx) in task.photoEvidenceUrls"
                  :key="`${url}-${idx}`"
                  class="evidence-chip saved"
                >
                  {{ formatEvidenceLabel(url, idx) }}
                </span>
              </div>
            </div>

            <UiText v-else-if="pendingPhotos.length === 0" class="sub-label">
              Aún no se han adjuntado fotografías de evidencia.
            </UiText>
          </div>
        </UiCard>
      </div>

      <!-- Firma del tutor -->
      <div class="wb-block">
        <UiCard title="Validación y Firma del Tutor">
          <div class="sign-row">
            <UiField
              :model-value="signatureMode"
              label="Modalidad de firma"
              as="select"
              :options="SIGNATURE_MODE_OPTIONS"
              :disabled="isReadOnly"
              @update:model-value="(val) => { signatureMode = val as PlanTrabajoSignatureMode; markDirty() }"
            />
          </div>
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
            <UiButton variant="secondary" class="btn-sm" @click="clearCanvas">Limpiar firma</UiButton>
          </div>
          <div v-if="signatureMode === 'image' && !isReadOnly">
            <input type="file" accept="image/png,image/jpeg,image/webp" @change="handleSignatureImageUpload" />
          </div>
          <img v-if="signatureDataUrl" :src="signatureDataUrl" alt="Firma del tutor" class="signature-img" />
          <label class="confirm-checkbox">
            <input v-model="tutorSignatureConfirmed" type="checkbox" :disabled="isReadOnly" @change="onSignatureToggle" />
            <span>
              Confirmo y firmo como Tutor: <strong>{{ header.tutorName }}</strong>
              <template v-if="tutorSignedAt"> ({{ tutorSignedAt }})</template>
            </span>
          </label>
        </UiCard>
      </div>
    </template>

    <!-- Diálogo de Vista Previa (PDF / XLSX) -->
    <UiDialog v-model="isPreviewOpen" :title="`Vista previa: ${activeTabMeta.label}`" class="preview-dialog">
      <div class="dialog-body">
        <div class="preview-toolbar">
          <div class="format-switch">
            <UiButton :variant="previewFormat === 'pdf' ? 'primary' : 'secondary'" class="btn-sm" @click="switchPreviewFormat('pdf')">Vista PDF</UiButton>
            <UiButton :variant="previewFormat === 'xlsx' ? 'primary' : 'secondary'" class="btn-sm" @click="switchPreviewFormat('xlsx')">Vista XLSX</UiButton>
          </div>
          <UiButton variant="primary" class="btn-sm" :loading="isExporting" @click="handleExport">Exportar .xlsx</UiButton>
        </div>
        <UiAlert v-if="previewError" tone="danger" title="Aviso"><UiText>{{ previewError }}</UiText></UiAlert>
        <UiAlert v-if="isPreviewing" tone="info" title="Generando vista previa..." />
        <iframe
          v-else-if="sanitizePreviewUrl(previewResult?.previewUrlOrContent)"
          :src="sanitizePreviewUrl(previewResult?.previewUrlOrContent)"
          sandbox="allow-same-origin"
          class="preview-frame"
          title="Vista previa final"
        />
        <pre v-else class="payload-preview">{{ JSON.stringify(getTabPayload(activeTabKey), null, 2) }}</pre>
        <div class="dialog-actions">
          <UiButton variant="secondary" @click="isPreviewOpen = false">Cerrar</UiButton>
        </div>
      </div>
    </UiDialog>
  </UiBasePage>
</template>

<style scoped>
.wb-block { margin-bottom: 1.25rem; }
.wb-block:last-child { margin-bottom: 0; }
.top-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.status-strip { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
.status-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.meta-code { font-family: monospace; font-size: 0.78rem; padding: 0.15rem 0.45rem; background-color: var(--color-gray-100, #f1f5f9); border-radius: 4px; }
.header-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.875rem; }
.sheet-tabs { display: flex; flex-wrap: wrap; gap: 0.375rem; padding-bottom: 0.75rem; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border, #e2e8f0); }
.sheet-tab-btn { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 500; border: 1px solid var(--color-border, #e2e8f0); border-radius: 6px; background-color: var(--color-gray-100, #f1f5f9); color: var(--color-text-secondary, #475569); cursor: pointer; }
.sheet-tab-btn.active { background-color: var(--color-primary, #1b396a); border-color: var(--color-primary, #1b396a); color: #ffffff; }
.tab-panel { display: flex; flex-direction: column; gap: 1rem; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.data-table th, .data-table td { border: 1px solid var(--color-border, #e2e8f0); padding: 0.4rem; vertical-align: middle; }
.data-table th { background-color: var(--color-bg-light, #f8fafc); color: var(--color-primary, #1b396a); }
.totals-row td { background-color: var(--color-bg-light, #f8fafc); }
.text-center { text-align: center; }
.text-right { text-align: right; }
.col-num { width: 42px; text-align: center; font-weight: 600; }
.col-num-cell { min-width: 84px; width: 84px; text-align: center; }
.cell-input, .num-input, .textarea-input { width: 100%; padding: 0.4rem 0.5rem; font-size: 0.82rem; border: 1px solid var(--input-border, #cbd5e1); border-radius: 4px; background-color: var(--input-bg, #ffffff); color: var(--color-text-primary, #0f172a); font-family: inherit; }
.num-input { min-width: 68px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; appearance: textfield; -moz-appearance: textfield; }
.num-input::-webkit-inner-spin-button, .num-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.num-input.failing { color: var(--color-danger-strong, #dc2626); background-color: var(--color-danger-bg, #fef2f2); border-color: var(--color-danger, #ef4444); }
.text-danger { color: var(--color-danger-strong, #dc2626); }
.textarea-group, .question-block { display: flex; flex-direction: column; gap: 0.45rem; }
.field-label { font-size: 0.85rem; font-weight: 600; color: var(--color-text-primary, #0f172a); }
.sub-label { font-size: 0.75rem; color: var(--color-text-secondary, #475569); }
.inline-metrics { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.75rem; }
.metric-input-wrap { display: flex; flex-direction: column; gap: 0.25rem; width: 120px; }
.info-box { padding: 0.75rem 1rem; border-radius: 6px; background-color: var(--color-bg-light, #f8fafc); border: 1px solid var(--color-border, #e2e8f0); font-size: 0.8rem; color: var(--color-text-secondary, #475569); }
.info-box ul { margin: 0.4rem 0 0; padding-left: 1.25rem; }
.sign-row { max-width: 340px; margin-bottom: 0.75rem; }
.canvas-wrap { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; }
.signature-canvas { border: 1px dashed var(--color-border-medium, #94a3b8); border-radius: 6px; background: #ffffff; touch-action: none; max-width: 100%; }
.signature-img { max-height: 70px; max-width: 220px; border: 1px solid var(--color-border, #e2e8f0); border-radius: 4px; background: #ffffff; padding: 0.25rem; margin-bottom: 0.5rem; display: block; }
.confirm-checkbox { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer; }
.preview-dialog { max-width: 860px; }
.dialog-body { display: flex; flex-direction: column; gap: 1rem; }
.preview-toolbar, .format-switch, .dialog-actions { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.dialog-actions { justify-content: flex-end; }
.preview-frame { width: 100%; height: 460px; border: 1px solid var(--color-border, #e2e8f0); border-radius: 6px; }
.payload-preview { margin: 0; padding: 0.75rem; max-height: 360px; overflow: auto; font-size: 0.76rem; background: var(--color-bg-light, #f8fafc); border: 1px solid var(--color-border, #e2e8f0); border-radius: 6px; }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.8125rem; width: fit-content; }
.tab-dirty-dot { color: #f59e0b; font-size: 0.7rem; }
.col-action { width: 40px; text-align: center; }
.remove-row-btn { width: 28px; height: 28px; padding: 0; border: 1px solid var(--color-border, #e2e8f0); border-radius: 4px; background: transparent; color: var(--color-text-secondary, #64748b); font-size: 1rem; line-height: 1; cursor: pointer; }
.remove-row-btn:hover:not(:disabled) { color: var(--color-danger-strong, #dc2626); border-color: var(--color-danger, #ef4444); background: var(--color-danger-bg, #fef2f2); }
.remove-row-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.evidence-body { display: flex; flex-direction: column; gap: 0.75rem; }
.evidence-picker { display: flex; align-items: center; gap: 0.5rem; }
.evidence-upload-label { display: inline-flex; align-items: center; padding: 0.45rem 0.9rem; font-size: 0.82rem; font-weight: 600; color: var(--color-primary, #1b396a); background-color: var(--color-bg-light, #f8fafc); border: 1px dashed var(--color-primary, #1b396a); border-radius: 6px; cursor: pointer; }
.evidence-list { display: flex; flex-direction: column; gap: 0.4rem; }
.evidence-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.evidence-chip { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.6rem; font-size: 0.78rem; border-radius: 999px; border: 1px solid var(--color-border, #e2e8f0); background-color: var(--color-gray-100, #f1f5f9); color: var(--color-text-primary, #0f172a); }
.evidence-chip.saved { border-color: var(--color-success, #10b981); background-color: var(--color-success-bg, #ecfdf5); }
.chip-remove { border: none; background: transparent; color: var(--color-text-secondary, #64748b); font-size: 0.95rem; line-height: 1; cursor: pointer; padding: 0 0.1rem; }
.chip-remove:hover { color: var(--color-danger-strong, #dc2626); }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
@media (max-width: 640px) { .top-actions { width: 100%; } .top-actions :deep(button) { flex: 1 1 auto; } }
</style>
