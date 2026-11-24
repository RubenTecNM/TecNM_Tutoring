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
  DeliverableTask,
  PlanTrabajoSignatureMode,
  PreviewFormat,
  SeguimientoMensualTabKey,
  TemplatePreviewResult,
} from '../types/compliance'

interface TabMeta {
  tabKey: SeguimientoMensualTabKey
  label: string
  excelSheetName: string
}

const TABS: TabMeta[] = [
  {
    tabKey: 'anexo_14_trayectoria_academica',
    label: 'ANEXO 14 Trayectoria Academica',
    excelSheetName: 'ANEXO 14 Trayectoria Academica',
  },
  {
    tabKey: 'anexo_15_desempeno_acad',
    label: 'ANEXO 15 desempeño acad',
    excelSheetName: 'ANEXO 15 desempeño acad ',
  },
  {
    tabKey: 'seguimiento_ind_reprob',
    label: 'SEGUIMIENTO IND. REPROB.',
    excelSheetName: 'SEGUIMIENTO IND. REPROB.',
  },
  {
    tabKey: 'anexo_19a_mensual_tutor',
    label: 'Anexo 19A Mensual del tutor',
    excelSheetName: 'Anexo 19A Mensual del tutor',
  },
  {
    tabKey: 'seguimiento_individual',
    label: 'SEGUIMIENTO INDIVIDUAL',
    excelSheetName: 'SEGUIMIENTO INDIVIDUAL',
  },
  {
    tabKey: 'lista_asistencia',
    label: 'LISTA DE ASISTENCIA',
    excelSheetName: 'LISTA DE ASISTENCIA',
  },
]

const TOPIC_HEADERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const
const INCIDENCE_CODES: Anexo14IncidenceCode[] = [1, 2, 3, 4, 5, 6, 7]
const PASSING_GRADE = 70

const REFERRED_AREAS = ['', 'Psicología', 'Trabajo Social', 'Enfermería', 'Tutorías', 'Académico', 'Desempeño']

const SIGNATURE_MODE_OPTIONS: { value: PlanTrabajoSignatureMode; label: string }[] = [
  { value: 'name_confirmation', label: 'Confirmación con nombre del tutor' },
  { value: 'canvas', label: 'Firma dibujada en pantalla (canvas)' },
  { value: 'image', label: 'Cargar imagen de firma (PNG/JPG)' },
]

const BASE_ROSTER = [
  { matricula: 'I21050012', name: 'Ana Sofía Rodríguez Fuentes' },
  { matricula: 'I22050411', name: 'Luis Fernando Torres Aguilar' },
  { matricula: 'I21050330', name: 'Jorge Eduardo Morales Dávila' },
  { matricula: 'I20050844', name: 'Mateo Alejandro Garza Silva' },
  { matricula: 'I22050189', name: 'Mariana Lizeth Cantú Ortiz' },
]

const route = useRoute()
const router = useRouter()

const currentUser = ref<UserResponse | null>(null)
const task = ref<DeliverableTask | null>(null)
const activeTabKey = ref<SeguimientoMensualTabKey>('anexo_14_trayectoria_academica')
const completedTabs = ref<Set<SeguimientoMensualTabKey>>(new Set())

const isLoading = ref(true)
const isSaving = ref(false)
const isPreviewing = ref(false)
const isExporting = ref(false)
const isTabDirty = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Vista previa
const isPreviewOpen = ref(false)
const previewFormat = ref<PreviewFormat>('pdf')
const previewResult = ref<TemplatePreviewResult | null>(null)
const previewError = ref('')

// Encabezado compartido del libro
const header = ref({
  tutorName: '',
  periodLabel: 'Enero - Junio 2026',
  monthLabel: 'Mayo',
  groupName: '1°A',
  career: 'Ingeniería en Sistemas Computacionales',
  shift: 'Matutino',
})

// Firma del tutor
const tutorSignatureConfirmed = ref(false)
const tutorSignedAt = ref<string | undefined>(undefined)
const signatureMode = ref<PlanTrabajoSignatureMode>('name_confirmation')
const signatureDataUrl = ref<string | undefined>(undefined)
const signatureCanvas = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)

// Estado por pestaña
const tab14Rows = ref(
  BASE_ROSTER.map((s, idx) => ({
    listNumber: idx + 1,
    matricula: s.matricula,
    studentName: s.name,
    incidences: [] as Anexo14IncidenceCode[],
    notes: '',
  })),
)
const tab14Observations = ref('')

const tab15Rows = ref(
  ['Cálculo Diferencial', 'Fundamentos de Programación', 'Taller de Ética', 'Matemáticas Discretas', 'Taller de Administración', 'Fundamentos de Investigación', ''].map(
    (subjectName, idx) => ({
      rowNumber: idx + 1,
      subjectName,
      topics: ['', '', '', '', '', '', '', ''],
      observations: '',
    }),
  ),
)

const tabReprobRows = ref([
  {
    claveMateria: 'ACF-0901',
    subjectName: 'Cálculo Diferencial',
    enrolled: '35',
    failed: '0',
    failedUnits: '',
    preventiveAction: '',
  },
  {
    claveMateria: 'AED-1026',
    subjectName: 'Fundamentos de Programación',
    enrolled: '35',
    failed: '0',
    failedUnits: '',
    preventiveAction: '',
  },
])

const tab19ARows = ref(
  BASE_ROSTER.map((s, idx) => ({
    listNumber: idx + 1,
    studentName: s.name,
    groupCount: '',
    individualCount: '',
    referredCount: '',
    referredArea: '',
  })),
)
const tab19AObservations = ref('')

const tabIndividualRows = ref([
  {
    matricula: BASE_ROSTER[0].matricula,
    studentName: BASE_ROSTER[0].name,
    sessionDate: new Date().toISOString().slice(0, 10),
    reason: '',
    agreements: '',
    referred: false,
  },
])

const tabAttendanceRows = ref(
  BASE_ROSTER.map((s, idx) => ({
    listNumber: idx + 1,
    matricula: s.matricula,
    studentName: s.name,
    s1: true,
    s2: true,
    s3: false,
    s4: false,
  })),
)

const isReadOnly = computed(() => currentUser.value?.role === 'Admin')
const activeTabMeta = computed(() => TABS.find((t) => t.tabKey === activeTabKey.value) ?? TABS[0])

function toText(raw: string | number | null | undefined): string {
  return raw === null || raw === undefined ? '' : String(raw).trim()
}

function parseIntSafe(raw: string | number | null | undefined): number {
  const clean = toText(raw)
  if (!clean) return 0
  const n = Number(clean)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

function isFailingGrade(raw: string | number | null | undefined): boolean {
  const clean = toText(raw)
  if (!clean) return false
  const n = Number(clean)
  return Number.isFinite(n) && n >= 0 && n < PASSING_GRADE
}

function isRow15Alert(topics: string[]): boolean {
  return topics.filter((t) => isFailingGrade(t)).length > 1
}

function calcFailurePercent(enrolled: string, failed: string): number {
  const e = parseIntSafe(enrolled)
  const f = parseIntSafe(failed)
  if (e <= 0) return 0
  return Number(((Math.min(f, e) * 100) / e).toFixed(1))
}

function calcAttendancePercent(row: { s1: boolean; s2: boolean; s3: boolean; s4: boolean }): number {
  const present = [row.s1, row.s2, row.s3, row.s4].filter(Boolean).length
  return Math.round((present / 4) * 100)
}

function markDirty(): void {
  isTabDirty.value = true
}

function toggleTab14Incidence(row: { incidences: Anexo14IncidenceCode[] }, code: Anexo14IncidenceCode): void {
  if (isReadOnly.value) return
  if (row.incidences.includes(code)) {
    row.incidences = row.incidences.filter((c) => c !== code)
  } else {
    row.incidences = [...row.incidences, code].sort((a, b) => a - b)
  }
  markDirty()
}

function updateTopic(row: { topics: string[] }, idx: number, event: Event): void {
  row.topics[idx] = (event.target as HTMLInputElement).value
  markDirty()
}

function updateStringField<T extends Record<string, unknown>>(obj: T, key: keyof T, event: Event): void {
  obj[key] = (event.target as HTMLInputElement | HTMLSelectElement).value as T[keyof T]
  markDirty()
}

function getTabPayload(tabKey: SeguimientoMensualTabKey): Record<string, unknown> {
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
    },
  }

  switch (tabKey) {
    case 'anexo_14_trayectoria_academica':
      return { ...common, rows: tab14Rows.value, observations: toText(tab14Observations.value) }
    case 'anexo_15_desempeno_acad':
      return {
        ...common,
        rows: tab15Rows.value.map((r) => ({
          ...r,
          subjectName: toText(r.subjectName),
          topics: r.topics.map((t) => toText(t)),
          observations: toText(r.observations),
        })),
      }
    case 'seguimiento_ind_reprob':
      return { ...common, rows: tabReprobRows.value }
    case 'anexo_19a_mensual_tutor':
      return { ...common, rows: tab19ARows.value, observations: toText(tab19AObservations.value) }
    case 'seguimiento_individual':
      return { ...common, rows: tabIndividualRows.value }
    case 'lista_asistencia':
      return { ...common, rows: tabAttendanceRows.value }
  }
}

function hydrateTabFromTask(loadedTask: DeliverableTask, tabKey: SeguimientoMensualTabKey): void {
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
  }

  if (tabKey === 'anexo_14_trayectoria_academica') {
    if (Array.isArray(saved.rows)) tab14Rows.value = saved.rows as typeof tab14Rows.value
    tab14Observations.value = toText(saved.observations as string)
  } else if (tabKey === 'anexo_15_desempeno_acad') {
    if (Array.isArray(saved.rows)) {
      tab15Rows.value = (saved.rows as typeof tab15Rows.value).map((r, idx) => ({
        rowNumber: idx + 1,
        subjectName: toText(r.subjectName),
        topics: Array.from({ length: 8 }, (_, i) => toText(r.topics?.[i])),
        observations: toText(r.observations),
      }))
    }
  } else if (tabKey === 'seguimiento_ind_reprob') {
    if (Array.isArray(saved.rows)) tabReprobRows.value = saved.rows as typeof tabReprobRows.value
  } else if (tabKey === 'anexo_19a_mensual_tutor') {
    if (Array.isArray(saved.rows)) tab19ARows.value = saved.rows as typeof tab19ARows.value
    tab19AObservations.value = toText(saved.observations as string)
  } else if (tabKey === 'seguimiento_individual') {
    if (Array.isArray(saved.rows)) tabIndividualRows.value = saved.rows as typeof tabIndividualRows.value
  } else if (tabKey === 'lista_asistencia') {
    if (Array.isArray(saved.rows)) tabAttendanceRows.value = saved.rows as typeof tabAttendanceRows.value
  }

  isTabDirty.value = false
}

function hydrateCompletedTabs(loadedTask: DeliverableTask): void {
  const tabsMap = (loadedTask.formPayload?.tabs as Record<string, Record<string, unknown>> | undefined) ?? {}
  const done = new Set<SeguimientoMensualTabKey>()
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
      tutorName: String(pre.docente_nombre ?? currentUser.value?.name ?? 'Docente Tutor'),
      periodLabel: loaded.periodoId === 2 ? 'Agosto - Diciembre 2026' : 'Enero - Junio 2026',
      monthLabel: loaded.periodoId === 2 ? 'Noviembre' : 'Mayo',
      groupName: String(pre.grupo ?? '1°A'),
      career: String(pre.carrera ?? 'Ingeniería en Sistemas Computacionales'),
      shift: String(pre.turno ?? 'Matutino'),
    }

    hydrateCompletedTabs(loaded)
    hydrateTabFromTask(loaded, activeTabKey.value)
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isLoading.value = false
  }
}

function switchTab(nextKey: SeguimientoMensualTabKey): void {
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

function validateActiveTab(strictSubmit: boolean): string | null {
  if (activeTabKey.value === 'anexo_15_desempeno_acad') {
    for (const row of tab15Rows.value) {
      for (const grade of row.topics) {
        const clean = toText(grade)
        if (clean) {
          const n = Number(clean)
          if (!Number.isFinite(n) || n < 0 || n > 100) {
            return `ANEXO 15 fila ${row.rowNumber}: las calificaciones deben estar entre 0 y 100.`
          }
        }
      }
    }
  }
  if (activeTabKey.value === 'seguimiento_ind_reprob') {
    for (const row of tabReprobRows.value) {
      const e = parseIntSafe(row.enrolled)
      const f = parseIntSafe(row.failed)
      if (f > e) {
        return `SEGUIMIENTO IND. REPROB. (${row.subjectName}): los reprobados no pueden superar el total inscrito.`
      }
    }
  }
  if (strictSubmit && !tutorSignatureConfirmed.value) {
    return 'Confirma la firma del tutor antes de entregar el libro mensual.'
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
      submit,
    })
    task.value = updated
    completedTabs.value.add(activeTabKey.value)
    isTabDirty.value = false
    successMessage.value = submit
      ? 'Libro de Seguimiento Mensual entregado correctamente.'
      : `Pestaña "${activeTabMeta.value.label}" guardada.`
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isSaving.value = false
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
    link.download = `Seguimiento_Mensual_${task.value.docenteClave}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = 'Libro mensual exportado desde plantilla oficial (.xlsx).'
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

onBeforeRouteLeave(() => {
  if (!isTabDirty.value) return true
  return window.confirm('Hay cambios sin guardar en la pestaña actual. ¿Deseas salir?')
})

onMounted(() => {
  void loadWorkbook()
})
</script>

<template>
  <UiBasePage
    fluid
    title="Seguimiento Mensual del Tutor (6 Pestañas)"
    description="Plantilla oficial: Anexos Seguimiento de Tutorías-MENSUAL-FJ-26.xlsx · Persistencia independiente por hoja conservando fórmulas."
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
          Entregar libro mensual
        </UiButton>
      </div>
    </template>

    <UiAlert v-if="successMessage" tone="success" title="Operación exitosa" dismissible @dismiss="successMessage = ''">
      <UiText>{{ successMessage }}</UiText>
    </UiAlert>
    <UiAlert v-if="errorMessage" tone="danger" title="Validación">
      <UiText>{{ errorMessage }}</UiText>
    </UiAlert>
    <UiAlert v-if="isLoading" tone="info" title="Cargando libro de Seguimiento Mensual..." />

    <template v-else-if="task">
      <!-- Encabezado compartido -->
      <div class="wb-block">
        <UiCard title="Datos Generales del Libro Mensual" description="Pre-rellenado desde PostgreSQL para las 6 hojas del libro.">
          <div class="status-strip">
            <div class="status-meta">
              <DeliverableStatusBadge :status="task.status" />
              <UiBadge tone="info">Pestañas guardadas: {{ completedTabs.size }} / 6</UiBadge>
              <code class="meta-code">Hoja activa: {{ activeTabMeta.excelSheetName.trim() }}</code>
            </div>
            <UiBadge v-if="isTabDirty" tone="warning">Cambios sin guardar en esta pestaña</UiBadge>
          </div>
          <div class="header-grid">
            <UiField v-model="header.tutorName" label="Tutor" :disabled="true" />
            <UiField v-model="header.periodLabel" label="Periodo" :disabled="true" />
            <UiField v-model="header.monthLabel" label="Mes" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.groupName" label="Grupo" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.career" label="Carrera" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.shift" label="Turno" :disabled="isReadOnly" @update:model-value="markDirty" />
          </div>
        </UiCard>
      </div>

      <!-- Barra de 6 pestañas -->
      <div class="wb-block">
        <UiCard :title="activeTabMeta.label" :description="`Clave de hoja: ${activeTabMeta.tabKey} → Excel: '${activeTabMeta.excelSheetName}'`">
          <div class="sheet-tabs" role="tablist" aria-label="Hojas del libro mensual">
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
              <span v-if="completedTabs.has(tab.tabKey)" aria-label="Guardada">✓</span>
            </button>
          </div>

          <!-- Pestaña 1: ANEXO 14 Trayectoria Academica -->
          <div v-if="activeTabKey === 'anexo_14_trayectoria_academica'" class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Matrícula</th>
                    <th>Estudiante</th>
                    <th>Incidencias (1–7)</th>
                    <th>Notas de trayectoria</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in tab14Rows" :key="row.listNumber">
                    <td class="col-num">{{ row.listNumber }}</td>
                    <td><code>{{ row.matricula }}</code></td>
                    <td>{{ row.studentName }}</td>
                    <td>
                      <div class="inc-pills">
                        <button
                          v-for="code in INCIDENCE_CODES"
                          :key="code"
                          type="button"
                          class="inc-btn"
                          :class="{ active: row.incidences.includes(code) }"
                          :disabled="isReadOnly"
                          @click="toggleTab14Incidence(row, code)"
                        >
                          {{ code }}
                        </button>
                      </div>
                    </td>
                    <td>
                      <input :value="row.notes" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'notes', $event)" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <UiField v-model="tab14Observations" label="Observaciones de Trayectoria Académica" :disabled="isReadOnly" @update:model-value="markDirty" />
          </div>

          <!-- Pestaña 2: ANEXO 15 desempeño acad -->
          <div v-else-if="activeTabKey === 'anexo_15_desempeno_acad'" class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Asignatura</th>
                    <th v-for="t in TOPIC_HEADERS" :key="t" class="col-num-cell">{{ t }}</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in tab15Rows" :key="row.rowNumber" :class="{ 'row-alert': isRow15Alert(row.topics) }">
                    <td class="col-num">{{ row.rowNumber }}</td>
                    <td>
                      <input :value="row.subjectName" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'subjectName', $event)" />
                      <span v-if="isRow15Alert(row.topics)" class="alert-pill">Foco de alerta</span>
                    </td>
                    <td v-for="(t, idx) in TOPIC_HEADERS" :key="`${row.rowNumber}-${t}`" class="col-num-cell">
                      <input
                        :value="row.topics[idx]"
                        type="number"
                        min="0"
                        max="100"
                        class="num-input"
                        :class="{ failing: isFailingGrade(row.topics[idx]) }"
                        placeholder="—"
                        :disabled="isReadOnly"
                        @input="updateTopic(row, idx, $event)"
                      />
                    </td>
                    <td>
                      <input :value="row.observations" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'observations', $event)" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pestaña 3: SEGUIMIENTO IND. REPROB. -->
          <div v-else-if="activeTabKey === 'seguimiento_ind_reprob'" class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Clave</th>
                    <th>Materia</th>
                    <th class="col-num-cell">Inscritos</th>
                    <th class="col-num-cell">Reprobados</th>
                    <th class="col-num-cell">% Reprob.</th>
                    <th>Unidades</th>
                    <th>Acción preventiva</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in tabReprobRows" :key="idx">
                    <td><input :value="row.claveMateria" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'claveMateria', $event)" /></td>
                    <td><input :value="row.subjectName" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'subjectName', $event)" /></td>
                    <td class="col-num-cell"><input :value="row.enrolled" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateStringField(row, 'enrolled', $event)" /></td>
                    <td class="col-num-cell"><input :value="row.failed" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateStringField(row, 'failed', $event)" /></td>
                    <td class="col-num-cell">
                      <strong :class="{ 'text-danger': calcFailurePercent(row.enrolled, row.failed) > 30 }">
                        {{ calcFailurePercent(row.enrolled, row.failed) }}%
                      </strong>
                    </td>
                    <td><input :value="row.failedUnits" type="text" class="cell-input" placeholder="I, II" :disabled="isReadOnly" @input="updateStringField(row, 'failedUnits', $event)" /></td>
                    <td><input :value="row.preventiveAction" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'preventiveAction', $event)" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <UiButton
              v-if="!isReadOnly"
              variant="secondary"
              class="btn-sm"
              @click="tabReprobRows.push({ claveMateria: '', subjectName: '', enrolled: '30', failed: '0', failedUnits: '', preventiveAction: '' }); markDirty()"
            >
              + Agregar materia
            </UiButton>
          </div>

          <!-- Pestaña 4: Anexo 19A Mensual del tutor -->
          <div v-else-if="activeTabKey === 'anexo_19a_mensual_tutor'" class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Estudiante</th>
                    <th class="col-num-cell">Grupal</th>
                    <th class="col-num-cell">Individual</th>
                    <th class="col-num-cell">Canalizados</th>
                    <th>Área canalizada</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in tab19ARows" :key="row.listNumber">
                    <td class="col-num">{{ row.listNumber }}</td>
                    <td>{{ row.studentName }}</td>
                    <td class="col-num-cell"><input :value="row.groupCount" type="number" min="0" class="num-input" placeholder="0" :disabled="isReadOnly" @input="updateStringField(row, 'groupCount', $event)" /></td>
                    <td class="col-num-cell"><input :value="row.individualCount" type="number" min="0" class="num-input" placeholder="0" :disabled="isReadOnly" @input="updateStringField(row, 'individualCount', $event)" /></td>
                    <td class="col-num-cell"><input :value="row.referredCount" type="number" min="0" class="num-input" placeholder="0" :disabled="isReadOnly" @input="updateStringField(row, 'referredCount', $event)" /></td>
                    <td>
                      <select :value="row.referredArea" class="cell-input" :disabled="isReadOnly" @change="updateStringField(row, 'referredArea', $event)">
                        <option v-for="area in REFERRED_AREAS" :key="area" :value="area">{{ area || 'Ninguna' }}</option>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <UiField v-model="tab19AObservations" label="Observaciones mensuales del tutor" :disabled="isReadOnly" @update:model-value="markDirty" />
          </div>

          <!-- Pestaña 5: SEGUIMIENTO INDIVIDUAL -->
          <div v-else-if="activeTabKey === 'seguimiento_individual'" class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Matrícula</th>
                    <th>Estudiante</th>
                    <th>Fecha</th>
                    <th>Motivo / Problemática</th>
                    <th>Acuerdos / Seguimiento</th>
                    <th>Canalizado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in tabIndividualRows" :key="idx">
                    <td><input :value="row.matricula" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'matricula', $event)" /></td>
                    <td><input :value="row.studentName" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'studentName', $event)" /></td>
                    <td><input :value="row.sessionDate" type="date" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'sessionDate', $event)" /></td>
                    <td><input :value="row.reason" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'reason', $event)" /></td>
                    <td><input :value="row.agreements" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'agreements', $event)" /></td>
                    <td class="col-num"><input v-model="row.referred" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <UiButton
              v-if="!isReadOnly"
              variant="secondary"
              class="btn-sm"
              @click="tabIndividualRows.push({ matricula: '', studentName: '', sessionDate: new Date().toISOString().slice(0, 10), reason: '', agreements: '', referred: false }); markDirty()"
            >
              + Agregar sesión individual
            </UiButton>
          </div>

          <!-- Pestaña 6: LISTA DE ASISTENCIA -->
          <div v-else-if="activeTabKey === 'lista_asistencia'" class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Matrícula</th>
                    <th>Estudiante</th>
                    <th class="col-num">S1</th>
                    <th class="col-num">S2</th>
                    <th class="col-num">S3</th>
                    <th class="col-num">S4</th>
                    <th class="col-num-cell">% Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in tabAttendanceRows" :key="row.listNumber">
                    <td class="col-num">{{ row.listNumber }}</td>
                    <td><code>{{ row.matricula }}</code></td>
                    <td>{{ row.studentName }}</td>
                    <td class="col-num"><input v-model="row.s1" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-num"><input v-model="row.s2" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-num"><input v-model="row.s3" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-num"><input v-model="row.s4" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-num-cell"><strong>{{ calcAttendancePercent(row) }}%</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
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
        <iframe v-else-if="previewResult?.previewUrlOrContent" :src="previewResult.previewUrlOrContent" class="preview-frame" title="Vista previa mensual" />
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
.header-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.875rem; }
.sheet-tabs { display: flex; flex-wrap: wrap; gap: 0.375rem; padding-bottom: 0.75rem; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border, #e2e8f0); }
.sheet-tab-btn { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 500; border: 1px solid var(--color-border, #e2e8f0); border-radius: 6px; background-color: var(--color-gray-100, #f1f5f9); color: var(--color-text-secondary, #475569); cursor: pointer; }
.sheet-tab-btn.active { background-color: var(--color-primary, #1b396a); border-color: var(--color-primary, #1b396a); color: #ffffff; }
.tab-panel { display: flex; flex-direction: column; gap: 0.875rem; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.data-table th, .data-table td { border: 1px solid var(--color-border, #e2e8f0); padding: 0.4rem; vertical-align: middle; }
.data-table th { background-color: var(--color-bg-light, #f8fafc); color: var(--color-primary, #1b396a); }
.data-table tr.row-alert { background-color: var(--color-danger-bg, #fef2f2); }
.col-num { width: 42px; text-align: center; font-weight: 600; }
.col-num-cell { min-width: 84px; width: 84px; text-align: center; }
.cell-input, .num-input { width: 100%; padding: 0.35rem 0.45rem; font-size: 0.8rem; border: 1px solid var(--input-border, #cbd5e1); border-radius: 4px; background-color: var(--input-bg, #ffffff); color: var(--color-text-primary, #0f172a); }
.num-input { min-width: 68px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; appearance: textfield; -moz-appearance: textfield; }
.num-input::-webkit-inner-spin-button, .num-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.num-input.failing { color: var(--color-danger-strong, #dc2626); background-color: var(--color-danger-bg, #fef2f2); border-color: var(--color-danger, #ef4444); }
.text-danger { color: var(--color-danger-strong, #dc2626); }
.alert-pill { display: inline-block; margin-top: 0.2rem; font-size: 0.68rem; font-weight: 700; padding: 0.06rem 0.4rem; border-radius: 999px; background-color: var(--color-danger-badge, #fee2e2); color: var(--color-danger-text, #991b1b); }
.inc-pills { display: flex; flex-wrap: wrap; gap: 0.2rem; }
.inc-btn { width: 24px; height: 24px; padding: 0; border-radius: 4px; border: 1px solid var(--color-border-medium, #cbd5e1); background: var(--color-surface-white, #ffffff); font-size: 0.72rem; font-weight: 700; cursor: pointer; }
.inc-btn.active { background-color: var(--color-primary, #1b396a); border-color: var(--color-primary, #1b396a); color: #ffffff; }
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
</style>
