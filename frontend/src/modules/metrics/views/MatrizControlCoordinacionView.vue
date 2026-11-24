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
import type {
  CoordinatorSheetKey,
  CoordinatorWorkbook,
  WorkbookPreviewResult,
} from '../types/metrics'

type MatrizTabKey = 'actividades' | 'asesores' | 'primero_y_tercero' | 'quinto_y_septimo'
type DeliveryMark = '' | '√' | 'x'

interface TabMeta {
  tabKey: MatrizTabKey
  label: string
  excelSheetName: string
}

interface ActividadRow {
  no: number
  tutorName: string
  career: string
  semester: string
  totalStudents: string
  anforas: boolean
  encuestaSocioemocional: boolean
  colectaPanales: boolean
  concluyoCurso: boolean
  donacionJuguetes: boolean
  studentsCompleted: string
  muralesTapitas: boolean
}

interface AsesorRow {
  no: number
  teacherName: string
  subjects: string
  career: string
  hours: string
  planTrabajo: boolean
  feb: boolean
  mar: boolean
  abr: boolean
  may: boolean
  jun: boolean
}

interface SemestreControlRow {
  no: number
  tutorName: string
  career: string
  semester: string
  shift: 'Matutino' | 'Nocturno'
  totalStudents: string
  planTrabajo: DeliveryMark
  infDiagnostico: DeliveryMark
  infFeb: DeliveryMark
  infMar: DeliveryMark
  infAbr: DeliveryMark
  infMay: DeliveryMark
  infFinal: DeliveryMark
  evalTutor: DeliveryMark
  failurePercent: string
  r1: boolean
  r2: boolean
  r3: boolean
  r4: boolean
}

const TABS: TabMeta[] = [
  { tabKey: 'actividades', label: 'actividades', excelSheetName: 'actividades ' },
  { tabKey: 'asesores', label: 'asesores', excelSheetName: 'asesores' },
  { tabKey: 'primero_y_tercero', label: '1º y 3º', excelSheetName: '1°Y 3°' },
  { tabKey: 'quinto_y_septimo', label: '5º y 7º', excelSheetName: '5° Y 7°' },
]

const DELIVERY_MARKS: { value: DeliveryMark; label: string }[] = [
  { value: '', label: '—' },
  { value: '√', label: '√' },
  { value: 'x', label: 'x' },
]

const route = useRoute()
const router = useRouter()

const currentUser = ref<UserResponse | null>(null)
const workbook = ref<CoordinatorWorkbook | null>(null)
const activeTabKey = ref<MatrizTabKey>('actividades')
const markTabCompleted = ref(false)

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
const previewResult = ref<WorkbookPreviewResult | null>(null)
const previewError = ref('')

const periodoId = computed(() => {
  const raw = Number(route.params.periodoId ?? route.query.periodoId ?? 1)
  return raw === 2 ? 2 : 1
})

// Encabezado compartido
const header = ref({
  campus: 'TecNM Campus Monclova',
  coordinatorName: '',
  periodLabel: 'Enero - Junio 2026',
  reviewMonth: 'Mayo 2026',
})

// Datos iniciales por pestaña (basados en tutores a-d 2026.xlsx)
const actividadesRows = ref<ActividadRow[]>([
  {
    no: 1,
    tutorName: 'ARANDA ALARCON GRACIELA',
    career: 'INDUSTRIAL',
    semester: '1',
    totalStudents: '32',
    anforas: false,
    encuestaSocioemocional: true,
    colectaPanales: false,
    concluyoCurso: false,
    donacionJuguetes: false,
    studentsCompleted: '0',
    muralesTapitas: false,
  },
  {
    no: 2,
    tutorName: 'BALTIERRA COSTEIRA GABRIELA',
    career: 'ING. RENOVABLES',
    semester: '1',
    totalStudents: '28',
    anforas: false,
    encuestaSocioemocional: true,
    colectaPanales: false,
    concluyoCurso: false,
    donacionJuguetes: false,
    studentsCompleted: '0',
    muralesTapitas: false,
  },
  {
    no: 3,
    tutorName: 'BOTELLO REYES MARIO ALAN',
    career: 'ING. INFORMATICA',
    semester: '1',
    totalStudents: '35',
    anforas: false,
    encuestaSocioemocional: true,
    colectaPanales: false,
    concluyoCurso: false,
    donacionJuguetes: false,
    studentsCompleted: '0',
    muralesTapitas: false,
  },
  {
    no: 4,
    tutorName: 'GARCIA PLATA MARIA ANTONIETA',
    career: 'MECANICA',
    semester: '3',
    totalStudents: '30',
    anforas: false,
    encuestaSocioemocional: true,
    colectaPanales: false,
    concluyoCurso: false,
    donacionJuguetes: false,
    studentsCompleted: '0',
    muralesTapitas: true,
  },
])

const asesoresRows = ref<AsesorRow[]>([
  {
    no: 1,
    teacherName: 'ARANDA ALARCON GRACIELA',
    subjects: 'Cálculo Diferencial',
    career: 'ENERGIAS',
    hours: '5',
    planTrabajo: true,
    feb: true,
    mar: true,
    abr: false,
    may: false,
    jun: false,
  },
  {
    no: 2,
    teacherName: 'ASIS CIPRIANO KARIME',
    subjects: 'Gestión Empresarial',
    career: 'GESTION',
    hours: '5',
    planTrabajo: true,
    feb: true,
    mar: false,
    abr: false,
    may: false,
    jun: false,
  },
  {
    no: 3,
    teacherName: 'CORONADO RIOS REYES',
    subjects: 'Álgebra Lineal',
    career: 'BASICAS',
    hours: '3',
    planTrabajo: true,
    feb: true,
    mar: true,
    abr: false,
    may: false,
    jun: false,
  },
])

const primeroTerceroRows = ref<SemestreControlRow[]>([
  {
    no: 1,
    tutorName: 'ARANDA ALARCON GRACIELA',
    career: 'INDUSTRIAL',
    semester: '1',
    shift: 'Matutino',
    totalStudents: '32',
    planTrabajo: '√',
    infDiagnostico: '√',
    infFeb: '√',
    infMar: '',
    infAbr: '',
    infMay: '',
    infFinal: '',
    evalTutor: '',
    failurePercent: '12.5',
    r1: true,
    r2: false,
    r3: false,
    r4: false,
  },
  {
    no: 2,
    tutorName: 'BALTIERRA COSTEIRA GABRIELA',
    career: 'ING. RENOVABLES',
    semester: '1',
    shift: 'Matutino',
    totalStudents: '28',
    planTrabajo: 'x',
    infDiagnostico: '',
    infFeb: '',
    infMar: '',
    infAbr: '',
    infMay: '',
    infFinal: '',
    evalTutor: '',
    failurePercent: '25',
    r1: false,
    r2: false,
    r3: false,
    r4: false,
  },
  {
    no: 3,
    tutorName: 'HERRERA VALDEZ ERNESTO',
    career: 'ING. INFORMATICA',
    semester: '1',
    shift: 'Nocturno',
    totalStudents: '24',
    planTrabajo: '√',
    infDiagnostico: '√',
    infFeb: '',
    infMar: '',
    infAbr: '',
    infMay: '',
    infFinal: '',
    evalTutor: '',
    failurePercent: '18',
    r1: true,
    r2: false,
    r3: false,
    r4: false,
  },
])

const quintoSeptimoRows = ref<SemestreControlRow[]>([
  {
    no: 1,
    tutorName: 'JASSO IBARRA SANDRA LILIA',
    career: 'ING.GEST. EMPRE',
    semester: '5',
    shift: 'Matutino',
    totalStudents: '30',
    planTrabajo: '√',
    infDiagnostico: '√',
    infFeb: '√',
    infMar: '',
    infAbr: '',
    infMay: '',
    infFinal: '',
    evalTutor: '',
    failurePercent: '10',
    r1: true,
    r2: false,
    r3: false,
    r4: false,
  },
  {
    no: 2,
    tutorName: 'AGUILAR COVARRUBIAS NORMA ARACELI',
    career: 'INDUSTRIAL',
    semester: '7',
    shift: 'Matutino',
    totalStudents: '26',
    planTrabajo: '√',
    infDiagnostico: '√',
    infFeb: '',
    infMar: '',
    infAbr: '',
    infMay: '',
    infFinal: '',
    evalTutor: '',
    failurePercent: '8.5',
    r1: true,
    r2: false,
    r3: false,
    r4: false,
  },
  {
    no: 3,
    tutorName: 'ASIS CIPRIANO KARIME',
    career: 'ING.GEST. EMPRE',
    semester: '7',
    shift: 'Nocturno',
    totalStudents: '22',
    planTrabajo: 'x',
    infDiagnostico: '',
    infFeb: '',
    infMar: '',
    infAbr: '',
    infMay: '',
    infFinal: '',
    evalTutor: '',
    failurePercent: '34',
    r1: false,
    r2: false,
    r3: false,
    r4: false,
  },
])

const tabNotes = ref('')

const isReadOnly = computed(() => workbook.value?.status === 'Finalized')
const activeTabMeta = computed(() => TABS.find((t) => t.tabKey === activeTabKey.value) ?? TABS[0])
const activeWorkbookTab = computed(() =>
  workbook.value?.tabs.find((t) => t.tabKey === activeTabKey.value),
)
const completedCount = computed(
  () => workbook.value?.tabs.filter((t) => t.isCompleted).length ?? 0,
)

const activeSemestreRows = computed(() =>
  activeTabKey.value === 'primero_y_tercero' ? primeroTerceroRows.value : quintoSeptimoRows.value,
)

function toText(raw: string | number | null | undefined): string {
  return raw === null || raw === undefined ? '' : String(raw).trim()
}

function isHighPercent(raw: string | number | null | undefined): boolean {
  const clean = toText(raw)
  if (!clean) return false
  const n = Number(clean)
  return Number.isFinite(n) && n > 30 && n <= 100
}

function markDirty(): void {
  isTabDirty.value = true
}

function updateStringField<T extends object, K extends keyof T>(obj: T, key: K, event: Event): void {
  obj[key] = (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value as T[K]
  markDirty()
}

function addActividadRow(): void {
  if (isReadOnly.value) return
  actividadesRows.value.push({
    no: actividadesRows.value.length + 1,
    tutorName: '',
    career: '',
    semester: '1',
    totalStudents: '0',
    anforas: false,
    encuestaSocioemocional: false,
    colectaPanales: false,
    concluyoCurso: false,
    donacionJuguetes: false,
    studentsCompleted: '0',
    muralesTapitas: false,
  })
  markDirty()
}

function addAsesorRow(): void {
  if (isReadOnly.value) return
  asesoresRows.value.push({
    no: asesoresRows.value.length + 1,
    teacherName: '',
    subjects: '',
    career: '',
    hours: '0',
    planTrabajo: false,
    feb: false,
    mar: false,
    abr: false,
    may: false,
    jun: false,
  })
  markDirty()
}

function addSemestreRow(): void {
  if (isReadOnly.value) return
  const target =
    activeTabKey.value === 'primero_y_tercero' ? primeroTerceroRows.value : quintoSeptimoRows.value
  target.push({
    no: target.length + 1,
    tutorName: '',
    career: '',
    semester: activeTabKey.value === 'primero_y_tercero' ? '1' : '5',
    shift: 'Matutino',
    totalStudents: '0',
    planTrabajo: '',
    infDiagnostico: '',
    infFeb: '',
    infMar: '',
    infAbr: '',
    infMay: '',
    infFinal: '',
    evalTutor: '',
    failurePercent: '',
    r1: false,
    r2: false,
    r3: false,
    r4: false,
  })
  markDirty()
}

function getTabPayload(tabKey: MatrizTabKey): Record<string, unknown> {
  const base = {
    sheetKey: tabKey,
    excelSheetName: TABS.find((t) => t.tabKey === tabKey)?.excelSheetName ?? tabKey,
    header: { ...header.value },
    summaryNotes: toText(tabNotes.value),
  }

  switch (tabKey) {
    case 'actividades':
      return { ...base, rows: actividadesRows.value }
    case 'asesores':
      return { ...base, rows: asesoresRows.value }
    case 'primero_y_tercero':
      return { ...base, rows: primeroTerceroRows.value }
    case 'quinto_y_septimo':
      return { ...base, rows: quintoSeptimoRows.value }
  }
}

function hydrateTab(wb: CoordinatorWorkbook, tabKey: MatrizTabKey): void {
  const tab = wb.tabs.find((t) => t.tabKey === tabKey)
  const saved = (tab?.tabPayload ?? {}) as Record<string, unknown>

  if (saved.header && typeof saved.header === 'object') {
    header.value = { ...header.value, ...(saved.header as typeof header.value) }
  }
  tabNotes.value = toText(saved.summaryNotes as string)
  markTabCompleted.value = Boolean(tab?.isCompleted)

  if (Array.isArray(saved.rows) && saved.rows.length > 0) {
    if (tabKey === 'actividades') actividadesRows.value = saved.rows as ActividadRow[]
    else if (tabKey === 'asesores') asesoresRows.value = saved.rows as AsesorRow[]
    else if (tabKey === 'primero_y_tercero') primeroTerceroRows.value = saved.rows as SemestreControlRow[]
    else if (tabKey === 'quinto_y_septimo') quintoSeptimoRows.value = saved.rows as SemestreControlRow[]
  }

  isTabDirty.value = false
}

async function loadWorkbook(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    currentUser.value = await me()
    const loaded = await metricsApi.getCoordinatorWorkbook(
      'MatrizControlCoordinacion',
      periodoId.value,
    )
    workbook.value = loaded
    const pre = (loaded.tabs[0]?.prefilledData ?? {}) as Record<string, unknown>
    header.value = {
      campus: String(pre.plantel ?? 'TecNM Campus Monclova'),
      coordinatorName: String(pre.coordinador ?? currentUser.value?.name ?? 'Coordinación de Tutorías'),
      periodLabel: String(
        pre.periodo ?? (periodoId.value === 2 ? 'Agosto - Diciembre 2026' : 'Enero - Junio 2026'),
      ),
      reviewMonth: String(
        pre.mes_revision ?? (periodoId.value === 2 ? 'Noviembre 2026' : 'Mayo 2026'),
      ),
    }
    hydrateTab(loaded, activeTabKey.value)
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isLoading.value = false
  }
}

function switchTab(nextKey: MatrizTabKey): void {
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
  if (activeTabKey.value === 'actividades') {
    for (const row of actividadesRows.value) {
      const e1 = validateNonNegInt(row.totalStudents, `Fila ${row.no} (Total alumnos)`)
      if (e1) return e1
      const e2 = validateNonNegInt(row.studentsCompleted, `Fila ${row.no} (Alumnos concluyeron)`)
      if (e2) return e2
      const total = Number(toText(row.totalStudents) || '0')
      const completed = Number(toText(row.studentsCompleted) || '0')
      if (total > 0 && completed > total) {
        return `Fila ${row.no} (${row.tutorName || 'Tutor'}): los alumnos que concluyeron no pueden superar el total.`
      }
    }
  } else if (activeTabKey.value === 'asesores') {
    for (const row of asesoresRows.value) {
      const err = validateNonNegInt(row.hours, `Fila ${row.no} (Horas)`)
      if (err) return err
    }
  } else {
    const rows = activeSemestreRows.value
    for (const row of rows) {
      const e1 = validateNonNegInt(row.totalStudents, `Fila ${row.no} (Total alumnos)`)
      if (e1) return e1
      const e2 = validatePercent(row.failurePercent, `Fila ${row.no} (% R)`)
      if (e2) return e2
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
    link.download = workbook.value.templateFileName || 'tutores a-d 2026.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = 'Libro exportado desde plantilla oficial (tutores a-d 2026.xlsx).'
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
    title="Matriz de Control de Coordinación (4 Hojas)"
    description="Plantilla oficial: tutores a-d 2026.xlsx · Persistencia independiente por hoja conservando celdas combinadas, estilos y fórmulas."
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
    <UiAlert v-if="isLoading" tone="info" title="Cargando Matriz de Control de Coordinación..." />

    <template v-else-if="workbook">
      <!-- Encabezado compartido -->
      <div class="wb-block">
        <UiCard title="Datos Generales de Coordinación" description="Pre-rellenados desde el sistema para las 4 hojas del libro.">
          <div class="status-strip">
            <div class="status-meta">
              <UiBadge :tone="workbook.status === 'Finalized' ? 'success' : 'info'">
                {{ workbook.status === 'Finalized' ? 'Finalizado' : 'Borrador editable' }}
              </UiBadge>
              <UiBadge tone="info">Pestañas completas: {{ completedCount }} / 4</UiBadge>
              <code class="meta-code">Hoja activa: {{ activeTabMeta.excelSheetName.trim() }}</code>
            </div>
            <UiBadge v-if="isTabDirty" tone="warning">Cambios sin guardar en esta pestaña</UiBadge>
          </div>
          <div class="header-grid">
            <UiField v-model="header.campus" label="Plantel" :disabled="true" />
            <UiField v-model="header.coordinatorName" label="Coordinador" :disabled="true" />
            <UiField v-model="header.periodLabel" label="Período" :disabled="isReadOnly" @update:model-value="markDirty" />
            <UiField v-model="header.reviewMonth" label="Mes de revisión" :disabled="isReadOnly" @update:model-value="markDirty" />
          </div>
        </UiCard>
      </div>

      <!-- Barra de 4 pestañas -->
      <div class="wb-block">
        <UiCard
          :title="`Hoja: ${activeTabMeta.label}`"
          :description="`Clave de hoja: ${activeTabMeta.tabKey} → Excel: '${activeTabMeta.excelSheetName}'`"
        >
          <div class="sheet-tabs" role="tablist" aria-label="Hojas de tutores a-d 2026.xlsx">
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

          <!-- Pestaña 1: actividades -->
          <div v-if="activeTabKey === 'actividades'" class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="col-num">No.</th>
                    <th>Docente Tutor</th>
                    <th>Carrera</th>
                    <th class="col-sm">Sem.</th>
                    <th class="col-num-cell">Total Alumnos</th>
                    <th class="col-check">Ánforas</th>
                    <th class="col-check">Enc. Socioem.</th>
                    <th class="col-check">Pañales</th>
                    <th class="col-check">Concluyó Curso</th>
                    <th class="col-check">Juguetes</th>
                    <th class="col-num-cell">Alumnos Concl.</th>
                    <th class="col-check">Murales / Tapitas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in actividadesRows" :key="row.no">
                    <td class="col-num">{{ row.no }}</td>
                    <td><input :value="row.tutorName" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'tutorName', $event)" /></td>
                    <td><input :value="row.career" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'career', $event)" /></td>
                    <td class="col-sm"><input :value="row.semester" type="text" class="num-input" :disabled="isReadOnly" @input="updateStringField(row, 'semester', $event)" /></td>
                    <td class="col-num-cell"><input :value="row.totalStudents" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateStringField(row, 'totalStudents', $event)" /></td>
                    <td class="col-check"><input v-model="row.anforas" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.encuestaSocioemocional" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.colectaPanales" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.concluyoCurso" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.donacionJuguetes" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-num-cell"><input :value="row.studentsCompleted" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateStringField(row, 'studentsCompleted', $event)" /></td>
                    <td class="col-check"><input v-model="row.muralesTapitas" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <UiButton v-if="!isReadOnly" variant="secondary" class="btn-sm" @click="addActividadRow">
              + Agregar tutor
            </UiButton>
          </div>

          <!-- Pestaña 2: asesores -->
          <div v-else-if="activeTabKey === 'asesores'" class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="col-num">No.</th>
                    <th>Docente</th>
                    <th>Materias</th>
                    <th>Carrera</th>
                    <th class="col-num-cell">Horas</th>
                    <th class="col-check">Plan Trab.</th>
                    <th class="col-check">Feb</th>
                    <th class="col-check">Mar</th>
                    <th class="col-check">Abr</th>
                    <th class="col-check">May</th>
                    <th class="col-check">Jun</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in asesoresRows" :key="row.no">
                    <td class="col-num">{{ row.no }}</td>
                    <td><input :value="row.teacherName" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'teacherName', $event)" /></td>
                    <td><input :value="row.subjects" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'subjects', $event)" /></td>
                    <td><input :value="row.career" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'career', $event)" /></td>
                    <td class="col-num-cell"><input :value="row.hours" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateStringField(row, 'hours', $event)" /></td>
                    <td class="col-check"><input v-model="row.planTrabajo" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.feb" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.mar" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.abr" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.may" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.jun" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <UiButton v-if="!isReadOnly" variant="secondary" class="btn-sm" @click="addAsesorRow">
              + Agregar asesor
            </UiButton>
          </div>

          <!-- Pestañas 3 y 4: 1º y 3º / 5º y 7º -->
          <div v-else class="tab-panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="col-num">No.</th>
                    <th>Docente Tutor</th>
                    <th>Carrera</th>
                    <th class="col-sm">Sem.</th>
                    <th>Turno</th>
                    <th class="col-num-cell">Alumnos</th>
                    <th class="col-mark">Plan</th>
                    <th class="col-mark">Diag.</th>
                    <th class="col-mark">Feb</th>
                    <th class="col-mark">Mar</th>
                    <th class="col-mark">Abr</th>
                    <th class="col-mark">May</th>
                    <th class="col-mark">Final</th>
                    <th class="col-mark">Eval.</th>
                    <th class="col-num-cell">% R</th>
                    <th class="col-check">1R</th>
                    <th class="col-check">2R</th>
                    <th class="col-check">3R</th>
                    <th class="col-check">4R</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in activeSemestreRows" :key="row.no">
                    <td class="col-num">{{ row.no }}</td>
                    <td><input :value="row.tutorName" type="text" class="cell-input min-name" :disabled="isReadOnly" @input="updateStringField(row, 'tutorName', $event)" /></td>
                    <td><input :value="row.career" type="text" class="cell-input" :disabled="isReadOnly" @input="updateStringField(row, 'career', $event)" /></td>
                    <td class="col-sm"><input :value="row.semester" type="text" class="num-input" :disabled="isReadOnly" @input="updateStringField(row, 'semester', $event)" /></td>
                    <td>
                      <select :value="row.shift" class="cell-input" :disabled="isReadOnly" @change="updateStringField(row, 'shift', $event)">
                        <option value="Matutino">Matutino</option>
                        <option value="Nocturno">Nocturno</option>
                      </select>
                    </td>
                    <td class="col-num-cell"><input :value="row.totalStudents" type="number" min="0" class="num-input" :disabled="isReadOnly" @input="updateStringField(row, 'totalStudents', $event)" /></td>
                    <td class="col-mark"><select :value="row.planTrabajo" class="mark-select" :disabled="isReadOnly" @change="updateStringField(row, 'planTrabajo', $event)"><option v-for="m in DELIVERY_MARKS" :key="m.value" :value="m.value">{{ m.label }}</option></select></td>
                    <td class="col-mark"><select :value="row.infDiagnostico" class="mark-select" :disabled="isReadOnly" @change="updateStringField(row, 'infDiagnostico', $event)"><option v-for="m in DELIVERY_MARKS" :key="m.value" :value="m.value">{{ m.label }}</option></select></td>
                    <td class="col-mark"><select :value="row.infFeb" class="mark-select" :disabled="isReadOnly" @change="updateStringField(row, 'infFeb', $event)"><option v-for="m in DELIVERY_MARKS" :key="m.value" :value="m.value">{{ m.label }}</option></select></td>
                    <td class="col-mark"><select :value="row.infMar" class="mark-select" :disabled="isReadOnly" @change="updateStringField(row, 'infMar', $event)"><option v-for="m in DELIVERY_MARKS" :key="m.value" :value="m.value">{{ m.label }}</option></select></td>
                    <td class="col-mark"><select :value="row.infAbr" class="mark-select" :disabled="isReadOnly" @change="updateStringField(row, 'infAbr', $event)"><option v-for="m in DELIVERY_MARKS" :key="m.value" :value="m.value">{{ m.label }}</option></select></td>
                    <td class="col-mark"><select :value="row.infMay" class="mark-select" :disabled="isReadOnly" @change="updateStringField(row, 'infMay', $event)"><option v-for="m in DELIVERY_MARKS" :key="m.value" :value="m.value">{{ m.label }}</option></select></td>
                    <td class="col-mark"><select :value="row.infFinal" class="mark-select" :disabled="isReadOnly" @change="updateStringField(row, 'infFinal', $event)"><option v-for="m in DELIVERY_MARKS" :key="m.value" :value="m.value">{{ m.label }}</option></select></td>
                    <td class="col-mark"><select :value="row.evalTutor" class="mark-select" :disabled="isReadOnly" @change="updateStringField(row, 'evalTutor', $event)"><option v-for="m in DELIVERY_MARKS" :key="m.value" :value="m.value">{{ m.label }}</option></select></td>
                    <td class="col-num-cell">
                      <input
                        :value="row.failurePercent"
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        class="num-input"
                        :class="{ failing: isHighPercent(row.failurePercent) }"
                        placeholder="0"
                        :disabled="isReadOnly"
                        @input="updateStringField(row, 'failurePercent', $event)"
                      />
                    </td>
                    <td class="col-check"><input v-model="row.r1" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.r2" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.r3" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                    <td class="col-check"><input v-model="row.r4" type="checkbox" :disabled="isReadOnly" @change="markDirty" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <UiButton v-if="!isReadOnly" variant="secondary" class="btn-sm" @click="addSemestreRow">
              + Agregar docente tutor
            </UiButton>
          </div>

          <div class="tab-footer">
            <div class="notes-wrap">
              <label class="field-label">Observaciones de la hoja</label>
              <textarea
                :value="tabNotes"
                rows="2"
                class="textarea-input"
                placeholder="Notas de control y seguimiento de esta hoja..."
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
        <iframe v-else-if="previewResult?.previewUrlOrContent" :src="previewResult.previewUrlOrContent" class="preview-frame" title="Vista previa coordinación" />
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
.tab-panel { display: flex; flex-direction: column; gap: 0.875rem; }
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.data-table th, .data-table td { border: 1px solid var(--color-border, #e2e8f0); padding: 0.35rem; vertical-align: middle; }
.data-table th { background-color: var(--color-bg-light, #f8fafc); color: var(--color-primary, #1b396a); white-space: nowrap; }
.col-num { width: 38px; text-align: center; font-weight: 600; }
.col-sm { width: 64px; min-width: 64px; text-align: center; }
.col-num-cell { width: 84px; min-width: 84px; text-align: center; }
.col-check { width: 52px; text-align: center; }
.col-mark { width: 58px; text-align: center; }
.min-name { min-width: 190px; }
.cell-input, .num-input, .mark-select, .textarea-input { width: 100%; padding: 0.3rem 0.45rem; font-size: 0.78rem; border: 1px solid var(--input-border, #cbd5e1); border-radius: 4px; background-color: var(--input-bg, #ffffff); color: var(--color-text-primary, #0f172a); font-family: inherit; }
.num-input { min-width: 64px; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; appearance: textfield; -moz-appearance: textfield; }
.num-input::-webkit-inner-spin-button, .num-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.num-input.failing { color: var(--color-danger-strong, #dc2626); background-color: var(--color-danger-bg, #fef2f2); border-color: var(--color-danger, #ef4444); }
.mark-select { min-width: 48px; text-align: center; font-weight: 700; }
.tab-footer { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; padding-top: 0.875rem; border-top: 1px solid var(--color-border, #e2e8f0); }
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
