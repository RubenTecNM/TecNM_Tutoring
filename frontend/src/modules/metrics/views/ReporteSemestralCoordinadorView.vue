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
import type { PreviewFormat } from '../../compliance/types/compliance'
import { metricsApi } from '../api/metricsApi'
import { ReadinessThresholdBanner } from '../components'
import type {
  CoordinatorSheetKey,
  CoordinatorWorkbook,
  FinalReportReadiness,
  WorkbookPreviewResult,
} from '../types/metrics'

type ReporteTabKey = 'hoja1' | 'hoja2'
type SupportModality = 'Estancia Externa' | 'Estancia Interna' | 'Otras' | 'Ninguno'

interface TabMeta {
  tabKey: ReporteTabKey
  label: string
  excelSheetName: string
}

interface SupportRow {
  code: string
  name: string
  modality: SupportModality
}

interface Hoja1ProgramRow {
  programName: string
  semester: string
  tutorsCount: string
  trainedTutorsCount: string
  groupAttended: string
  individualAttended: string
  virtualAttended: string
  peerAttended: string
  plenaryAttended: string
  businessAttended: string
  definitiveDropout: string
  temporaryDropout: string
  workshopsCount: string
  failureRate: string
  lagRate: string
  dropoutRate: string
  terminalEfficiency: string
  referredCount: string
  sp: string
  ss: string
  ad: string
  bm: string
  bt: string
  ba: string
  aa: string
  apaa: string
  asCount: string
}

interface Hoja2StudentRow {
  studentName: string
  controlNumber: string
  groupAttended: string
  individualAttended: string
  definitiveDropout: string
  temporaryDropout: string
  failureRate: string
  dropoutRate: string
  terminalEfficiency: string
  referredCount: string
  sp: string
  ss: string
  ad: string
  bm: string
  bt: string
  ba: string
  aa: string
  apaa: string
}

const TABS: TabMeta[] = [
  { tabKey: 'hoja1', label: 'hoja1 — Concentrado por Programa', excelSheetName: 'Hoja1' },
  { tabKey: 'hoja2', label: 'hoja2 — Seguimiento Nominal', excelSheetName: 'Hoja2' },
]

const SUPPORT_MODALITIES: SupportModality[] = [
  'Estancia Interna',
  'Estancia Externa',
  'Otras',
  'Ninguno',
]

const route = useRoute()
const router = useRouter()

const currentUser = ref<UserResponse | null>(null)
const workbook = ref<CoordinatorWorkbook | null>(null)
const readiness = ref<FinalReportReadiness | null>(null)
const activeTabKey = ref<ReporteTabKey>('hoja1')
const markTabCompleted = ref(false)

const isLoading = ref(true)
const isSaving = ref(false)
const isFinalizing = ref(false)
const isPreviewing = ref(false)
const isExporting = ref(false)
const isTabDirty = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Vista previa
const isPreviewOpen = ref(false)
const previewFormat = ref<PreviewFormat>('pdf')
const previewResult = ref<WorkbookPreviewResult | null>(null)
const previewError = ref('')

const periodoId = computed(() => {
  const raw = Number(route.params.periodoId ?? route.query.periodoId ?? 1)
  return raw === 2 ? 2 : 1
})

// Encabezado compartido
const header = ref({
  instituteName: 'Instituto Tecnológico Superior de Monclova',
  coordinatorName: '',
  reportDate: new Date().toISOString().slice(0, 10),
  currentEnrollment: '1850',
  hasInstitutionalProgram: 'SI' as 'SI' | 'NO',
})

// Apoyos institucionales (Hoja1)
const institutionalSupports = ref<SupportRow[]>([
  { code: 'SP', name: 'Servicios Psicológicos', modality: 'Estancia Interna' },
  { code: 'SS', name: 'Servicios de Salud', modality: 'Estancia Interna' },
  { code: 'AD', name: 'Adicciones', modality: 'Estancia Externa' },
  { code: 'BM', name: 'Beca de Manutención', modality: 'Estancia Interna' },
  { code: 'BT', name: 'Beca de Transporte', modality: 'Otras' },
  { code: 'BA', name: 'Beca de Alimentación', modality: 'Estancia Interna' },
  { code: 'AA', name: 'Asesoría Académica', modality: 'Estancia Interna' },
  { code: 'APAA', name: 'Asesoría de Procesos Académico-Administrativos', modality: 'Estancia Interna' },
  { code: 'AS', name: 'Aptitudes Sobresalientes', modality: 'Estancia Interna' },
])

// Filas Hoja1
const hoja1Rows = ref<Hoja1ProgramRow[]>([
  {
    programName: 'Ingeniería en Sistemas Computacionales',
    semester: '1° - 7°',
    tutorsCount: '12',
    trainedTutorsCount: '10',
    groupAttended: '240',
    individualAttended: '45',
    virtualAttended: '15',
    peerAttended: '10',
    plenaryAttended: '180',
    businessAttended: '0',
    definitiveDropout: '4',
    temporaryDropout: '6',
    workshopsCount: '8',
    failureRate: '18.5',
    lagRate: '12.0',
    dropoutRate: '4.2',
    terminalEfficiency: '82.0',
    referredCount: '18',
    sp: '6',
    ss: '2',
    ad: '0',
    bm: '3',
    bt: '1',
    ba: '2',
    aa: '3',
    apaa: '1',
    asCount: '0',
  },
  {
    programName: 'Ingeniería Industrial',
    semester: '1° - 7°',
    tutorsCount: '14',
    trainedTutorsCount: '12',
    groupAttended: '310',
    individualAttended: '52',
    virtualAttended: '20',
    peerAttended: '14',
    plenaryAttended: '210',
    businessAttended: '5',
    definitiveDropout: '5',
    temporaryDropout: '7',
    workshopsCount: '9',
    failureRate: '15.2',
    lagRate: '10.5',
    dropoutRate: '3.8',
    terminalEfficiency: '85.4',
    referredCount: '14',
    sp: '4',
    ss: '3',
    ad: '0',
    bm: '2',
    bt: '1',
    ba: '1',
    aa: '2',
    apaa: '1',
    asCount: '0',
  },
])

// Filas Hoja2
const hoja2Rows = ref<Hoja2StudentRow[]>([
  {
    studentName: 'Ana Sofía Rodríguez Fuentes',
    controlNumber: 'I21050012',
    groupAttended: '4',
    individualAttended: '2',
    definitiveDropout: '0',
    temporaryDropout: '0',
    failureRate: '14.3',
    dropoutRate: '0',
    terminalEfficiency: '90',
    referredCount: '1',
    sp: '1',
    ss: '0',
    ad: '0',
    bm: '0',
    bt: '0',
    ba: '0',
    aa: '0',
    apaa: '0',
  },
  {
    studentName: 'Luis Fernando Torres Aguilar',
    controlNumber: 'I22050411',
    groupAttended: '4',
    individualAttended: '3',
    definitiveDropout: '0',
    temporaryDropout: '0',
    failureRate: '28.6',
    dropoutRate: '0',
    terminalEfficiency: '75',
    referredCount: '2',
    sp: '0',
    ss: '0',
    ad: '0',
    bm: '1',
    bt: '0',
    ba: '0',
    aa: '1',
    apaa: '0',
  },
])

const tabNotes = ref('')

const isAdmin = computed(() => currentUser.value?.role === 'Admin')
const isFinalized = computed(() => workbook.value?.status === 'Finalized')
const isReadOnly = computed(() => isFinalized.value || !isAdmin.value)
const activeTabMeta = computed(() => TABS.find((t) => t.tabKey === activeTabKey.value) ?? TABS[0])
const activeWorkbookTab = computed(() =>
  workbook.value?.tabs.find((t) => t.tabKey === activeTabKey.value),
)
const completedCount = computed(
  () => workbook.value?.tabs.filter((t) => t.isCompleted).length ?? 0,
)

function toText(raw: string | number | null | undefined): string {
  return raw === null || raw === undefined ? '' : String(raw).trim()
}

function parseIntSafe(raw: string | number | null | undefined): number {
  const clean = toText(raw)
  if (!clean) return 0
  const n = Number(clean)
  return Number.isInteger(n) && n >= 0 ? n : 0
}

function isHighRate(raw: string | number | null | undefined): boolean {
  const clean = toText(raw)
  if (!clean) return false
  const n = Number(clean)
  return Number.isFinite(n) && n > 30 && n <= 100
}

const hoja1Totals = computed(() => {
  return hoja1Rows.value.reduce(
    (acc, r) => ({
      tutors: acc.tutors + parseIntSafe(r.tutorsCount),
      trained: acc.trained + parseIntSafe(r.trainedTutorsCount),
      group: acc.group + parseIntSafe(r.groupAttended),
      individual: acc.individual + parseIntSafe(r.individualAttended),
      definitive: acc.definitive + parseIntSafe(r.definitiveDropout),
      temporary: acc.temporary + parseIntSafe(r.temporaryDropout),
      referred: acc.referred + parseIntSafe(r.referredCount),
    }),
    { tutors: 0, trained: 0, group: 0, individual: 0, definitive: 0, temporary: 0, referred: 0 },
  )
})

const hoja2Totals = computed(() => {
  return hoja2Rows.value.reduce(
    (acc, r) => ({
      group: acc.group + parseIntSafe(r.groupAttended),
      individual: acc.individual + parseIntSafe(r.individualAttended),
      definitive: acc.definitive + parseIntSafe(r.definitiveDropout),
      temporary: acc.temporary + parseIntSafe(r.temporaryDropout),
      referred: acc.referred + parseIntSafe(r.referredCount),
    }),
    { group: 0, individual: 0, definitive: 0, temporary: 0, referred: 0 },
  )
})

function markDirty(): void {
  isTabDirty.value = true
}

function updateField<T extends object, K extends keyof T>(obj: T, key: K, event: Event): void {
  obj[key] = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value as T[K]
  markDirty()
}

function addHoja1Row(): void {
  if (isReadOnly.value) return
  hoja1Rows.value.push({
    programName: '',
    semester: '',
    tutorsCount: '0',
    trainedTutorsCount: '0',
    groupAttended: '0',
    individualAttended: '0',
    virtualAttended: '0',
    peerAttended: '0',
    plenaryAttended: '0',
    businessAttended: '0',
    definitiveDropout: '0',
    temporaryDropout: '0',
    workshopsCount: '0',
    failureRate: '0',
    lagRate: '0',
    dropoutRate: '0',
    terminalEfficiency: '0',
    referredCount: '0',
    sp: '0',
    ss: '0',
    ad: '0',
    bm: '0',
    bt: '0',
    ba: '0',
    aa: '0',
    apaa: '0',
    asCount: '0',
  })
  markDirty()
}

function addHoja2Row(): void {
  if (isReadOnly.value) return
  hoja2Rows.value.push({
    studentName: '',
    controlNumber: '',
    groupAttended: '0',
    individualAttended: '0',
    definitiveDropout: '0',
    temporaryDropout: '0',
    failureRate: '0',
    dropoutRate: '0',
    terminalEfficiency: '0',
    referredCount: '0',
    sp: '0',
    ss: '0',
    ad: '0',
    bm: '0',
    bt: '0',
    ba: '0',
    aa: '0',
    apaa: '0',
  })
  markDirty()
}

function getTabPayload(tabKey: ReporteTabKey): Record<string, unknown> {
  const common = {
    sheetKey: tabKey,
    excelSheetName: TABS.find((t) => t.tabKey === tabKey)?.excelSheetName ?? tabKey,
    header: { ...header.value },
    summaryNotes: toText(tabNotes.value),
  }

  if (tabKey === 'hoja1') {
    return {
      ...common,
      institutionalSupports: institutionalSupports.value,
      rows: hoja1Rows.value,
      totals: hoja1Totals.value,
    }
  }
  return {
    ...common,
    rows: hoja2Rows.value,
    totals: hoja2Totals.value,
  }
}

function hydrateTab(wb: CoordinatorWorkbook, tabKey: ReporteTabKey): void {
  const tab = wb.tabs.find((t) => t.tabKey === tabKey)
  const saved = (tab?.tabPayload ?? {}) as Record<string, unknown>

  if (saved.header && typeof saved.header === 'object') {
    header.value = { ...header.value, ...(saved.header as typeof header.value) }
  }
  tabNotes.value = toText(saved.summaryNotes as string)
  markTabCompleted.value = Boolean(tab?.isCompleted)

  if (tabKey === 'hoja1') {
    if (Array.isArray(saved.institutionalSupports) && saved.institutionalSupports.length > 0) {
      institutionalSupports.value = saved.institutionalSupports as SupportRow[]
    }
    if (Array.isArray(saved.rows) && saved.rows.length > 0) {
      hoja1Rows.value = saved.rows as Hoja1ProgramRow[]
    }
  } else if (tabKey === 'hoja2') {
    if (Array.isArray(saved.rows) && saved.rows.length > 0) {
      hoja2Rows.value = saved.rows as Hoja2StudentRow[]
    }
  }

  isTabDirty.value = false
}

async function loadWorkbook(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const [user, wb, readinessRes] = await Promise.all([
      me(),
      metricsApi.getCoordinatorWorkbook('ReporteSemestralCoordinador', periodoId.value),
      metricsApi.getReadiness(periodoId.value),
    ])
    currentUser.value = user
    workbook.value = wb
    readiness.value = readinessRes

    header.value = {
      ...header.value,
      coordinatorName: user.name ?? 'Coordinador Institucional de Tutoría',
    }
    hydrateTab(wb, activeTabKey.value)
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isLoading.value = false
  }
}

function switchTab(nextKey: ReporteTabKey): void {
  if (nextKey === activeTabKey.value || isSaving.value || !workbook.value) return
  if (isTabDirty.value) {
    const proceed = window.confirm(
      'Hay cambios sin guardar en la pestaña actual. ¿Deseas descartarlos y cambiar de pestaña?',
    )
    if (!proceed) return
  }
  activeTabKey.value = nextKey
  errorMessage.value = ''
  successMessage.value = ''
  hydrateTab(workbook.value, nextKey)
}

function validateNonNegInt(raw: string, label: string): string | null {
  const clean = toText(raw)
  if (!clean) return null
  const n = Number(clean)
  if (!Number.isInteger(n) || n < 0) {
    return `${label} debe ser un número entero mayor o igual a 0.`
  }
  return null
}

function validatePercent(raw: string, label: string): string | null {
  const clean = toText(raw)
  if (!clean) return null
  const n = Number(clean)
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return `${label} debe estar entre 0 y 100%.`
  }
  return null
}

function validateActiveTab(): string | null {
  const enrollErr = validateNonNegInt(header.value.currentEnrollment, 'Matrícula actual')
  if (enrollErr) return enrollErr

  if (activeTabKey.value === 'hoja1') {
    for (let i = 0; i < hoja1Rows.value.length; i++) {
      const r = hoja1Rows.value[i]
      const prefix = r.programName || `Programa #${i + 1}`
      const intFields: [string, string][] = [
        [r.tutorsCount, `${prefix} (No. Tutores)`],
        [r.trainedTutorsCount, `${prefix} (Tutores capacitados)`],
        [r.groupAttended, `${prefix} (Tutoría Grupal)`],
        [r.individualAttended, `${prefix} (Tutoría Individual)`],
        [r.virtualAttended, `${prefix} (Tutoría Virtual)`],
        [r.peerAttended, `${prefix} (Tutoría de Pares)`],
        [r.plenaryAttended, `${prefix} (Tutoría Plenaria)`],
        [r.businessAttended, `${prefix} (Tutoría Empresarial)`],
        [r.definitiveDropout, `${prefix} (Baja Definitiva)`],
        [r.temporaryDropout, `${prefix} (Baja Temporal)`],
        [r.workshopsCount, `${prefix} (Talleres)`],
        [r.referredCount, `${prefix} (Canalizados)`],
        [r.sp, `${prefix} (SP)`],
        [r.ss, `${prefix} (SS)`],
        [r.ad, `${prefix} (AD)`],
        [r.bm, `${prefix} (BM)`],
        [r.bt, `${prefix} (BT)`],
        [r.ba, `${prefix} (BA)`],
        [r.aa, `${prefix} (AA)`],
        [r.apaa, `${prefix} (APAA)`],
        [r.asCount, `${prefix} (AS)`],
      ]
      for (const [val, lbl] of intFields) {
        const err = validateNonNegInt(val, lbl)
        if (err) return err
      }
      const pctFields: [string, string][] = [
        [r.failureRate, `${prefix} (% Reprobación)`],
        [r.lagRate, `${prefix} (% Rezago)`],
        [r.dropoutRate, `${prefix} (% Deserción)`],
        [r.terminalEfficiency, `${prefix} (% Eficiencia Terminal)`],
      ]
      for (const [val, lbl] of pctFields) {
        const err = validatePercent(val, lbl)
        if (err) return err
      }
    }
  } else {
    for (let i = 0; i < hoja2Rows.value.length; i++) {
      const r = hoja2Rows.value[i]
      const prefix = r.studentName || `Alumno #${i + 1}`
      const intFields: [string, string][] = [
        [r.groupAttended, `${prefix} (Grupal)`],
        [r.individualAttended, `${prefix} (Individual)`],
        [r.definitiveDropout, `${prefix} (Baja Def.)`],
        [r.temporaryDropout, `${prefix} (Baja Temp.)`],
        [r.referredCount, `${prefix} (Canalizados)`],
        [r.sp, `${prefix} (SP)`],
        [r.ss, `${prefix} (SS)`],
        [r.ad, `${prefix} (AD)`],
        [r.bm, `${prefix} (BM)`],
        [r.bt, `${prefix} (BT)`],
        [r.ba, `${prefix} (BA)`],
        [r.aa, `${prefix} (AA)`],
        [r.apaa, `${prefix} (APAA)`],
      ]
      for (const [val, lbl] of intFields) {
        const err = validateNonNegInt(val, lbl)
        if (err) return err
      }
      const pctFields: [string, string][] = [
        [r.failureRate, `${prefix} (% Reprobación)`],
        [r.dropoutRate, `${prefix} (% Deserción)`],
        [r.terminalEfficiency, `${prefix} (% Eficiencia Terminal)`],
      ]
      for (const [val, lbl] of pctFields) {
        const err = validatePercent(val, lbl)
        if (err) return err
      }
    }
  }

  return null
}

async function handleSaveTab(): Promise<void> {
  if (!workbook.value || !activeWorkbookTab.value || isSaving.value || isReadOnly.value) return

  const err = validateActiveTab()
  if (err) {
    errorMessage.value = err
    return
  }

  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const updated = await metricsApi.saveCoordinatorTab(workbook.value.id, {
      tabKey: activeTabKey.value as CoordinatorSheetKey,
      rowVersion: activeWorkbookTab.value.rowVersion,
      markCompleted: markTabCompleted.value,
      tabPayload: getTabPayload(activeTabKey.value),
    })
    workbook.value = updated
    isTabDirty.value = false
    successMessage.value = `Pestaña "${activeTabMeta.value.label}" guardada correctamente.`
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isSaving.value = false
  }
}

async function handleFinalizeReport(): Promise<void> {
  if (!isAdmin.value || isFinalizing.value || isFinalized.value) return
  if (!readiness.value?.canGenerateFinalReport) {
    errorMessage.value =
      'No se puede cerrar el Reporte Semestral Final: se requiere al menos 90% (9 de 10 entregas).'
    return
  }
  if (isTabDirty.value) {
    errorMessage.value = 'Guarda primero los cambios pendientes de la pestaña activa antes de cerrar el reporte.'
    return
  }

  isFinalizing.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    workbook.value = await metricsApi.finalizeFinalReport(periodoId.value)
    successMessage.value = 'Reporte Semestral del Coordinador cerrado oficialmente (cumplimiento >= 90%).'
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isFinalizing.value = false
  }
}

async function openPreview(): Promise<void> {
  if (!workbook.value || isPreviewing.value) return
  isPreviewOpen.value = true
  await fetchPreview()
}

async function fetchPreview(): Promise<void> {
  if (!workbook.value || isPreviewing.value) return
  isPreviewing.value = true
  previewError.value = ''
  try {
    previewResult.value = await metricsApi.previewWorkbook(
      workbook.value.id,
      activeTabKey.value as CoordinatorSheetKey,
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
  if (!workbook.value || isExporting.value) return
  isExporting.value = true
  errorMessage.value = ''
  previewError.value = ''

  try {
    const blob = await metricsApi.exportWorkbook(
      workbook.value.id,
      activeTabKey.value as CoordinatorSheetKey,
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = workbook.value.templateFileName || 'REPORTE SEMESTRAL DEL COORNADOR  EDITABLE.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = 'Reporte Semestral exportado desde plantilla oficial (.xlsx).'
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
  void router.push({ name: 'metrics-dashboard' })
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
    title="Reporte Semestral del Coordinador Institucional de Tutoría"
    description="Plantilla oficial: REPORTE SEMESTRAL DEL COORNADOR  EDITABLE.xlsx · Regla 90% (9 de 10 entregas) y persistencia independiente por hoja."
  >
    <template #actions>
      <div class="top-actions">
        <UiButton variant="secondary" @click="goBack">← Volver a Métricas</UiButton>
        <UiButton variant="secondary" :disabled="isLoading || isPreviewing" @click="openPreview">
          Vista previa
        </UiButton>
        <UiButton variant="secondary" :loading="isExporting" :disabled="isLoading" @click="handleExport">
          Exportar .xlsx
        </UiButton>
        <UiButton
          v-if="!isReadOnly"
          variant="primary"
          :loading="isSaving"
          :disabled="isLoading"
          @click="handleSaveTab"
        >
          Guardar pestaña
        </UiButton>
      </div>
    </template>

    <UiAlert v-if="successMessage" tone="success" title="Operación exitosa" dismissible @dismiss="successMessage = ''">
      <UiText>{{ successMessage }}</UiText>
    </UiAlert>
    <UiAlert v-if="errorMessage" tone="danger" title="Validación">
      <UiText>{{ errorMessage }}</UiText>
    </UiAlert>
    <UiAlert v-if="isLoading" tone="info" title="Cargando Reporte Semestral del Coordinador..." />

    <template v-else-if="workbook">
      <!-- Regla del 90% (9 de 10 entregas) -->
      <div v-if="readiness" class="wb-block">
        <ReadinessThresholdBanner
          :readiness="readiness"
          :is-admin="isAdmin"
          :is-finalizing="isFinalizing"
          :is-already-finalized="isFinalized"
          @finalize="handleFinalizeReport"
        />
      </div>

      <!-- Datos Generales -->
      <div class="wb-block">
        <UiCard title="Datos Generales del Reporte Semestral" description="Pre-rellenados desde el sistema para ambas hojas (hoja1 y hoja2).">
          <div class="status-strip">
            <div class="status-meta">
              <UiBadge :tone="isFinalized ? 'success' : 'info'">
                {{ isFinalized ? 'Cerrado oficialmente' : 'Borrador editable' }}
              </UiBadge>
              <UiBadge tone="info">Pestañas completas: {{ completedCount }} / 2</UiBadge>
              <code class="meta-code">Hoja activa: {{ activeTabMeta.excelSheetName }}</code>
            </div>
            <UiBadge v-if="isTabDirty" tone="warning">Cambios sin guardar en esta pestaña</UiBadge>
          </div>
          <div class="header-grid">
            <UiField v-model="header.instituteName" label="Instituto" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.coordinatorName" label="Nombre del Coordinador(a)" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.reportDate" label="Fecha" type="date" :disabled="isReadOnly" @update:model-value="markDirty" />
            <div class="inline-field">
              <label class="field-label">Matrícula actual (>= 0)</label>
              <input
                :value="header.currentEnrollment"
                type="number"
                min="0"
                class="num-input"
                :disabled="isReadOnly"
                @input="updateField(header, 'currentEnrollment', $event)"
              />
            </div>
            <div class="inline-field">
              <label class="field-label">¿Cuenta con Programa Institucional de Tutoría?</label>
              <select
                :value="header.hasInstitutionalProgram"
                class="cell-input"
                :disabled="isReadOnly"
                @change="updateField(header, 'hasInstitutionalProgram', $event)"
              >
                <option value="SI">SI</option>
                <option value="NO">NO</option>
              </select>
            </div>
          </div>
        </UiCard>
      </div>

      <!-- Barra de 2 pestañas -->
      <div class="wb-block">
        <UiCard
          :title="activeTabMeta.label"
          :description="`Clave de hoja: ${activeTabMeta.tabKey} → Excel: '${activeTabMeta.excelSheetName}'`"
        >
          <div class="sheet-tabs" role="tablist" aria-label="Hojas del Reporte Semestral">
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
              <span
                v-if="workbook.tabs.find((t) => t.tabKey === tab.tabKey)?.isCompleted"
                aria-label="Completada"
              >✓</span>
            </button>
          </div>

          <!-- Pestaña 1: hoja1 -->
          <div v-if="activeTabKey === 'hoja1'" class="tab-panel">
            <div class="sub-section">
              <span class="field-label">Apoyos con los que cuenta el Tecnológico para canalizar</span>
              <div class="supports-grid">
                <div v-for="sup in institutionalSupports" :key="sup.code" class="support-item">
                  <span class="support-label"><strong>{{ sup.code }}</strong> — {{ sup.name }}</span>
                  <select
                    :value="sup.modality"
                    class="cell-input"
                    :disabled="isReadOnly"
                    @change="updateField(sup, 'modality', $event)"
                  >
                    <option v-for="m in SUPPORT_MODALITIES" :key="m" :value="m">{{ m }}</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th rowspan="2">Programa Educativo</th>
                    <th rowspan="2" class="col-sm">Sem.</th>
                    <th rowspan="2" class="col-num-cell">Tutores</th>
                    <th rowspan="2" class="col-num-cell">Capac.</th>
                    <th colspan="6" class="text-center">Estudiantes atendidos</th>
                    <th colspan="2" class="text-center">Bajas</th>
                    <th rowspan="2" class="col-num-cell">Talleres</th>
                    <th colspan="4" class="text-center">Índices (0–100%)</th>
                    <th rowspan="2" class="col-num-cell">Canaliz.</th>
                    <th colspan="9" class="text-center">Área canalizada</th>
                  </tr>
                  <tr>
                    <th class="col-num-cell">Grup.</th>
                    <th class="col-num-cell">Indiv.</th>
                    <th class="col-num-cell">Virt.</th>
                    <th class="col-num-cell">Pares</th>
                    <th class="col-num-cell">Plen.</th>
                    <th class="col-num-cell">Empr.</th>
                    <th class="col-num-cell">Def.</th>
                    <th class="col-num-cell">Temp.</th>
                    <th class="col-num-cell">Repr.%</th>
                    <th class="col-num-cell">Rez.%</th>
                    <th class="col-num-cell">Des.%</th>
                    <th class="col-num-cell">Ef.T.%</th>
                    <th class="col-sm">SP</th>
                    <th class="col-sm">SS</th>
                    <th class="col-sm">AD</th>
                    <th class="col-sm">BM</th>
                    <th class="col-sm">BT</th>
                    <th class="col-sm">BA</th>
                    <th class="col-sm">AA</th>
                    <th class="col-sm">APAA</th>
                    <th class="col-sm">AS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in hoja1Rows" :key="idx">
                    <td><input :value="row.programName" type="text" class="cell-input min-name" :disabled="isReadOnly" @input="updateField(row, 'programName', $event)" /></td>
                    <td><input :value="row.semester" type="text" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'semester', $event)" /></td>
                    <td><input :value="row.tutorsCount" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'tutorsCount', $event)" /></td>
                    <td><input :value="row.trainedTutorsCount" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'trainedTutorsCount', $event)" /></td>
                    <td><input :value="row.groupAttended" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'groupAttended', $event)" /></td>
                    <td><input :value="row.individualAttended" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'individualAttended', $event)" /></td>
                    <td><input :value="row.virtualAttended" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'virtualAttended', $event)" /></td>
                    <td><input :value="row.peerAttended" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'peerAttended', $event)" /></td>
                    <td><input :value="row.plenaryAttended" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'plenaryAttended', $event)" /></td>
                    <td><input :value="row.businessAttended" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'businessAttended', $event)" /></td>
                    <td><input :value="row.definitiveDropout" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'definitiveDropout', $event)" /></td>
                    <td><input :value="row.temporaryDropout" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'temporaryDropout', $event)" /></td>
                    <td><input :value="row.workshopsCount" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'workshopsCount', $event)" /></td>
                    <td><input :value="row.failureRate" type="number" min="0" max="100" step="0.1" class="num-input" :class="{ failing: isHighRate(row.failureRate) }" :disabled="isReadOnly" @input="updateField(row, 'failureRate', $event)" /></td>
                    <td><input :value="row.lagRate" type="number" min="0" max="100" step="0.1" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'lagRate', $event)" /></td>
                    <td><input :value="row.dropoutRate" type="number" min="0" max="100" step="0.1" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'dropoutRate', $event)" /></td>
                    <td><input :value="row.terminalEfficiency" type="number" min="0" max="100" step="0.1" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'terminalEfficiency', $event)" /></td>
                    <td><input :value="row.referredCount" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'referredCount', $event)" /></td>
                    <td><input :value="row.sp" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'sp', $event)" /></td>
                    <td><input :value="row.ss" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'ss', $event)" /></td>
                    <td><input :value="row.ad" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'ad', $event)" /></td>
                    <td><input :value="row.bm" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'bm', $event)" /></td>
                    <td><input :value="row.bt" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'bt', $event)" /></td>
                    <td><input :value="row.ba" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'ba', $event)" /></td>
                    <td><input :value="row.aa" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'aa', $event)" /></td>
                    <td><input :value="row.apaa" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'apaa', $event)" /></td>
                    <td><input :value="row.asCount" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'asCount', $event)" /></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="totals-row">
                    <td colspan="2"><strong>Totales</strong></td>
                    <td class="text-center"><strong>{{ hoja1Totals.tutors }}</strong></td>
                    <td class="text-center"><strong>{{ hoja1Totals.trained }}</strong></td>
                    <td class="text-center"><strong>{{ hoja1Totals.group }}</strong></td>
                    <td class="text-center"><strong>{{ hoja1Totals.individual }}</strong></td>
                    <td colspan="4" />
                    <td class="text-center"><strong>{{ hoja1Totals.definitive }}</strong></td>
                    <td class="text-center"><strong>{{ hoja1Totals.temporary }}</strong></td>
                    <td colspan="5" />
                    <td class="text-center"><strong>{{ hoja1Totals.referred }}</strong></td>
                    <td colspan="9" />
                  </tr>
                </tfoot>
              </table>
            </div>
            <UiButton v-if="!isReadOnly" variant="secondary" class="btn-sm" @click="addHoja1Row">
              + Agregar programa educativo
            </UiButton>
          </div>

          <!-- Pestaña 2: hoja2 -->
          <div v-else class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th rowspan="2">Nombre del Alumno</th>
                    <th rowspan="2">No. Control</th>
                    <th colspan="2" class="text-center">Atendidos</th>
                    <th colspan="2" class="text-center">Bajas</th>
                    <th colspan="3" class="text-center">Índices (0–100%)</th>
                    <th rowspan="2" class="col-num-cell">Canaliz.</th>
                    <th colspan="8" class="text-center">Área canalizada</th>
                  </tr>
                  <tr>
                    <th class="col-num-cell">Grupal</th>
                    <th class="col-num-cell">Indiv.</th>
                    <th class="col-num-cell">Def.</th>
                    <th class="col-num-cell">Temp.</th>
                    <th class="col-num-cell">Repr.%</th>
                    <th class="col-num-cell">Des.%</th>
                    <th class="col-num-cell">Ef.T.%</th>
                    <th class="col-sm">SP</th>
                    <th class="col-sm">SS</th>
                    <th class="col-sm">AD</th>
                    <th class="col-sm">BM</th>
                    <th class="col-sm">BT</th>
                    <th class="col-sm">BA</th>
                    <th class="col-sm">AA</th>
                    <th class="col-sm">APAA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in hoja2Rows" :key="idx">
                    <td><input :value="row.studentName" type="text" class="cell-input min-name" :disabled="isReadOnly" @input="updateField(row, 'studentName', $event)" /></td>
                    <td><input :value="row.controlNumber" type="text" class="cell-input" :disabled="isReadOnly" @input="updateField(row, 'controlNumber', $event)" /></td>
                    <td><input :value="row.groupAttended" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'groupAttended', $event)" /></td>
                    <td><input :value="row.individualAttended" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'individualAttended', $event)" /></td>
                    <td><input :value="row.definitiveDropout" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'definitiveDropout', $event)" /></td>
                    <td><input :value="row.temporaryDropout" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'temporaryDropout', $event)" /></td>
                    <td><input :value="row.failureRate" type="number" min="0" max="100" step="0.1" class="num-input" :class="{ failing: isHighRate(row.failureRate) }" :disabled="isReadOnly" @input="updateField(row, 'failureRate', $event)" /></td>
                    <td><input :value="row.dropoutRate" type="number" min="0" max="100" step="0.1" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'dropoutRate', $event)" /></td>
                    <td><input :value="row.terminalEfficiency" type="number" min="0" max="100" step="0.1" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'terminalEfficiency', $event)" /></td>
                    <td><input :value="row.referredCount" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateField(row, 'referredCount', $event)" /></td>
                    <td><input :value="row.sp" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'sp', $event)" /></td>
                    <td><input :value="row.ss" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'ss', $event)" /></td>
                    <td><input :value="row.ad" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'ad', $event)" /></td>
                    <td><input :value="row.bm" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'bm', $event)" /></td>
                    <td><input :value="row.bt" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'bt', $event)" /></td>
                    <td><input :value="row.ba" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'ba', $event)" /></td>
                    <td><input :value="row.aa" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'aa', $event)" /></td>
                    <td><input :value="row.apaa" type="number" min="0" class="num-input sm-num" :disabled="isReadOnly" @input="updateField(row, 'apaa', $event)" /></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="totals-row">
                    <td colspan="2"><strong>TOTAL</strong></td>
                    <td class="text-center"><strong>{{ hoja2Totals.group }}</strong></td>
                    <td class="text-center"><strong>{{ hoja2Totals.individual }}</strong></td>
                    <td class="text-center"><strong>{{ hoja2Totals.definitive }}</strong></td>
                    <td class="text-center"><strong>{{ hoja2Totals.temporary }}</strong></td>
                    <td colspan="3" />
                    <td class="text-center"><strong>{{ hoja2Totals.referred }}</strong></td>
                    <td colspan="8" />
                  </tr>
                </tfoot>
              </table>
            </div>

            <UiButton v-if="!isReadOnly" variant="secondary" class="btn-sm" @click="addHoja2Row">
              + Agregar alumno
            </UiButton>

            <div class="info-box">
              <strong>Nomenclatura oficial de áreas canalizadas:</strong>
              SP (Servicio Psicológico) · SS (Servicio de Salud / Enfermería) · AD (Asesorías Docentes / Adicciones) ·
              BM (Beca Manutención / Movimientos) · BT (Beca Transporte / Baja Temporal) · BA (Beca Alimentación / Baja Académica) ·
              AA (Asesoría Académica / Apoyo Aprendizaje) · APAA (Procesos Académico-Administrativos).
            </div>
          </div>

          <div class="tab-footer">
            <div class="notes-wrap">
              <label class="field-label">Observaciones y resumen de la hoja</label>
              <textarea
                :value="tabNotes"
                rows="2"
                class="textarea-input"
                placeholder="Observaciones ejecutivas de coordinación para esta hoja..."
                :disabled="isReadOnly"
                @input="tabNotes = ($event.target as HTMLTextAreaElement).value; markDirty()"
              />
            </div>

            <div class="footer-actions">
              <label class="confirm-checkbox">
                <input v-model="markTabCompleted" type="checkbox" :disabled="isReadOnly" @change="markDirty" />
                <span>Marcar pestaña como completa</span>
              </label>
              <UiButton v-if="!isReadOnly" variant="primary" class="btn-sm" :loading="isSaving" @click="handleSaveTab">
                Guardar pestaña
              </UiButton>
            </div>
          </div>
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
        <iframe v-else-if="previewResult?.previewUrlOrContent" :src="previewResult.previewUrlOrContent" class="preview-frame" title="Vista previa reporte semestral" />
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
.header-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.875rem; align-items: end; }
.inline-field { display: flex; flex-direction: column; gap: 0.35rem; }
.sheet-tabs { display: flex; flex-wrap: wrap; gap: 0.375rem; padding-bottom: 0.75rem; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border, #e2e8f0); }
.sheet-tab-btn { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 500; border: 1px solid var(--color-border, #e2e8f0); border-radius: 6px; background-color: var(--color-gray-100, #f1f5f9); color: var(--color-text-secondary, #475569); cursor: pointer; }
.sheet-tab-btn.active { background-color: var(--color-primary, #1b396a); border-color: var(--color-primary, #1b396a); color: #ffffff; }
.tab-panel { display: flex; flex-direction: column; gap: 1rem; }
.sub-section { display: flex; flex-direction: column; gap: 0.5rem; }
.supports-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.625rem; }
.support-item { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.5rem; border: 1px solid var(--color-border, #e2e8f0); border-radius: 6px; background: var(--color-bg-light, #f8fafc); }
.support-label { font-size: 0.76rem; color: var(--color-text-secondary, #475569); }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.data-table th, .data-table td { border: 1px solid var(--color-border, #e2e8f0); padding: 0.32rem; vertical-align: middle; }
.data-table th { background-color: var(--color-bg-light, #f8fafc); color: var(--color-primary, #1b396a); white-space: nowrap; }
.totals-row td { background-color: var(--color-bg-light, #f8fafc); }
.text-center { text-align: center; }
.col-sm { width: 60px; min-width: 60px; text-align: center; }
.col-num-cell { width: 76px; min-width: 76px; text-align: center; }
.min-name { min-width: 190px; }
.cell-input, .num-input, .textarea-input { width: 100%; padding: 0.32rem 0.45rem; font-size: 0.78rem; border: 1px solid var(--input-border, #cbd5e1); border-radius: 4px; background-color: var(--input-bg, #ffffff); color: var(--color-text-primary, #0f172a); font-family: inherit; }
.num-input { min-width: 64px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; appearance: textfield; -moz-appearance: textfield; }
.num-input.sm-num { min-width: 48px; }
.num-input::-webkit-inner-spin-button, .num-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.num-input.failing { color: var(--color-danger-strong, #dc2626); background-color: var(--color-danger-bg, #fef2f2); border-color: var(--color-danger, #ef4444); }
.info-box { padding: 0.75rem 1rem; border-radius: 6px; background-color: var(--color-bg-light, #f8fafc); border: 1px solid var(--color-border, #e2e8f0); font-size: 0.78rem; color: var(--color-text-secondary, #475569); }
.tab-footer { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem; padding-top: 0.875rem; border-top: 1px solid var(--color-border, #e2e8f0); }
.notes-wrap { display: flex; flex-direction: column; gap: 0.35rem; }
.field-label { font-size: 0.82rem; font-weight: 600; color: var(--color-text-primary, #0f172a); }
.footer-actions { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; }
.confirm-checkbox { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer; }
.preview-dialog { max-width: 860px; }
.dialog-body { display: flex; flex-direction: column; gap: 1rem; }
.preview-toolbar, .format-switch, .dialog-actions { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.dialog-actions { justify-content: flex-end; }
.preview-frame { width: 100%; height: 460px; border: 1px solid var(--color-border, #e2e8f0); border-radius: 6px; }
.payload-preview { margin: 0; padding: 0.75rem; max-height: 360px; overflow: auto; font-size: 0.76rem; background: var(--color-bg-light, #f8fafc); border: 1px solid var(--color-border, #e2e8f0); border-radius: 6px; }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.8125rem; width: fit-content; }
</style>
