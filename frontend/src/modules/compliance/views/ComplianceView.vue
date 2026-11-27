<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  UiAlert,
  UiBadge,
  UiBasePage,
  UiButton,
  UiCard,
  UiDialog,
  UiField,
  UiTable,
  UiText,
} from '../../../shared/components'
import { normalizeApiError } from '../../../shared/api/apiErrors'
import { sanitizePreviewUrl } from '../../../shared/utils/safePreviewUrl'
import { getCurrentAcademicPeriod, getMonthName } from '../../../shared/utils/academicPeriod'
import { me } from '../../auth/api/authApi'
import type { UserResponse } from '../../auth/types/auth'
import { complianceApi, resolveDocenteClave } from '../api/complianceApi'
import {
  ComplianceFiltersBar,
  ComplianceKpiCards,
  DeliverableStatusBadge,
  FormatDocumentPreview,
} from '../components'
import type {
  ComplianceFilters,
  DeliverableTask,
  DocenteComplianceSummary,
  FormatComplianceOverview,
  FormatTutorEntry,
  PreviewFormat,
  TemplatePreviewResult,
} from '../types/compliance'
import { buildOfficialDownloadFileName } from '../utils/templateCatalog'

interface DeliverableRow extends DeliverableTask {
  actions?: string
}

interface SummaryRow extends DocenteComplianceSummary {
  id: string
  actions?: string
}

interface FormatOverviewRow extends FormatComplianceOverview {
  id: string
  actions?: string
}

interface FormatTutorRow extends FormatTutorEntry {
  id: string
  actions?: string
}

interface StructuredTabDraft {
  enrolledCount: string
  attendedCount: string
  attendanceRate: string
  incidenceSummary: string
  checklistConfirmed: boolean
  observations: string
}

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_PHOTO_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const router = useRouter()
const currentUser = ref<UserResponse | null>(null)
const isAdmin = computed(() => currentUser.value?.role === 'Admin')

const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')

// Filtros y paginación
const filters = ref<ComplianceFilters>({
  periodoId: getCurrentAcademicPeriod().id,
  month: undefined,
  formatKey: undefined,
  status: undefined,
  search: undefined,
})

const page = ref(1)
const limit = ref(10)
const totalItems = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / limit.value)))

// Datos paginados
const tasks = ref<DeliverableTask[]>([])
const docenteSummaries = ref<DocenteComplianceSummary[]>([])

// Modal de formulario estructurado (Tutor)
const isFormModalOpen = ref(false)
const activeTask = ref<DeliverableTask | null>(null)
const activeTabKey = ref<string | undefined>(undefined)
const isLoadingForm = ref(false)
const isSavingForm = ref(false)
const isTabDirty = ref(false)
const formError = ref('')
const pendingPhotos = ref<File[]>([])
const photoError = ref('')

const draft = ref<StructuredTabDraft>({
  enrolledCount: '0',
  attendedCount: '0',
  attendanceRate: '100',
  incidenceSummary: '',
  checklistConfirmed: false,
  observations: '',
})

// Modal de detalle por docente (Admin)
const isDocenteDetailModalOpen = ref(false)
const selectedDocenteSummary = ref<DocenteComplianceSummary | null>(null)
const docenteModalTasks = ref<DeliverableTask[]>([])
const isLoadingDocenteModal = ref(false)

// Modal de vista previa y exportación desde plantilla
const isPreviewModalOpen = ref(false)
const previewTask = ref<DeliverableTask | null>(null)
const previewTabKey = ref<string | undefined>(undefined)
const previewFormat = ref<PreviewFormat>('pdf')
const previewResult = ref<TemplatePreviewResult | null>(null)
const isPreviewing = ref(false)
const isExporting = ref(false)
const previewError = ref('')
const exportWarning = ref('')

const docenteColumns: { key: keyof DeliverableRow & string; label: string }[] = [
  { key: 'title', label: 'Formato / Tarea' },
  { key: 'reportingMonth', label: 'Mes' },
  { key: 'status', label: 'Estado' },
  { key: 'delayDays', label: 'Días de retraso' },
  { key: 'actions', label: 'Acciones' },
]

const adminColumns: { key: keyof SummaryRow & string; label: string }[] = [
  { key: 'docenteClave', label: 'Clave' },
  { key: 'docenteName', label: 'Docente Tutor' },
  { key: 'totalDeliverables', label: 'Total' },
  { key: 'onTime', label: 'En Tiempo' },
  { key: 'late', label: 'Con Retraso' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'totalDelayDays', label: 'Días de retraso' },
  { key: 'actions', label: 'Acciones' },
]

const monthNames: Record<number, string> = {
  2: 'Febrero',
  3: 'Marzo',
  4: 'Abril',
  5: 'Mayo',
  6: 'Junio',
  9: 'Septiembre',
  10: 'Octubre',
  11: 'Noviembre',
  12: 'Diciembre',
}

const prefilledLabels: Record<string, string> = {
  docente_clave: 'Clave docente',
  docente_nombre: 'Docente tutor',
  periodo_id: 'Periodo',
  plantel: 'Plantel',
  carrera: 'Carrera',
  semestre: 'Semestre',
  grupo: 'Grupo',
  turno: 'Turno',
}

const tableTaskRows = computed<DeliverableRow[]>(() =>
  tasks.value.map((t) => ({ ...t, actions: '' })),
)

const tableSummaryRows = computed<SummaryRow[]>(() =>
  docenteSummaries.value.map((s) => ({
    ...s,
    id: s.docenteClave,
    actions: '',
  })),
)

const docenteKpis = computed(() => {
  const onTime = tasks.value.filter((d) => d.status === 'OnTime').length
  const late = tasks.value.filter((d) => d.status === 'Late').length
  const pending = tasks.value.filter((d) => d.status === 'Pending').length
  const delayDays = tasks.value.reduce((acc, curr) => acc + (curr.delayDays || 0), 0)
  return { onTime, late, pending, delayDays }
})

const adminKpis = computed(() => {
  const onTime = docenteSummaries.value.reduce((acc, s) => acc + s.onTime, 0)
  const late = docenteSummaries.value.reduce((acc, s) => acc + s.late, 0)
  const pending = docenteSummaries.value.reduce((acc, s) => acc + s.pending, 0)
  const delayDays = docenteSummaries.value.reduce((acc, s) => acc + s.totalDelayDays, 0)
  const total = docenteSummaries.value.reduce((acc, s) => acc + s.totalDeliverables, 0)
  return { onTime, late, pending, delayDays, total }
})

const activeTabMeta = computed(() => {
  if (!activeTask.value?.hasTabs || !activeTask.value.tabs) return undefined
  return activeTask.value.tabs.find((t) => t.tabKey === activeTabKey.value)
})

const requiresPhotoForActiveView = computed(() => {
  if (!activeTask.value) return false
  if (activeTabMeta.value?.requiresPhotoEvidence !== undefined) {
    return activeTabMeta.value.requiresPhotoEvidence
  }
  return activeTask.value.requiresPhotoEvidence
})

const prefilledEntries = computed(() => {
  const source = activeTask.value?.prefilledData ?? {}
  return Object.entries(source).map(([key, value]) => ({
    key,
    label: prefilledLabels[key] ?? key,
    value: value === null || value === undefined ? '—' : String(value),
  }))
})

function readSectionPayload(task: DeliverableTask, tabKey?: string): Record<string, unknown> {
  if (task.hasTabs && tabKey) {
    const tabsMap = (task.formPayload.tabs as Record<string, Record<string, unknown>> | undefined) ?? {}
    return tabsMap[tabKey] ?? {}
  }
  return task.formPayload ?? {}
}

function hydrateDraftFromTask(task: DeliverableTask, tabKey?: string): void {
  const section = readSectionPayload(task, tabKey)
  draft.value = {
    enrolledCount: String(section.enrolledCount ?? 0),
    attendedCount: String(section.attendedCount ?? 0),
    attendanceRate: String(section.attendanceRate ?? 100),
    incidenceSummary: String(section.incidenceSummary ?? ''),
    checklistConfirmed: Boolean(section.checklistConfirmed ?? false),
    observations: String(section.observations ?? ''),
  }
  pendingPhotos.value = []
  photoError.value = ''
  formError.value = ''
  isTabDirty.value = false
}

function markDirty(): void {
  isTabDirty.value = true
}

function validateDraft(): string | null {
  const enrolled = Number(draft.value.enrolledCount)
  const attended = Number(draft.value.attendedCount)
  const rate = Number(draft.value.attendanceRate)

  if (!Number.isInteger(enrolled) || enrolled < 0) {
    return 'El total de alumnos debe ser un número entero mayor o igual a 0.'
  }
  if (!Number.isInteger(attended) || attended < 0) {
    return 'Los alumnos atendidos deben ser un número entero mayor o igual a 0.'
  }
  if (enrolled > 0 && attended > enrolled) {
    return 'Los alumnos atendidos no pueden superar el total inscrito.'
  }
  if (Number.isNaN(rate) || rate < 0 || rate > 100) {
    return 'El porcentaje / índice debe encontrarse entre 0 y 100.'
  }
  return null
}

function getMissingFieldsWarning(task: DeliverableTask, tabKey?: string): string {
  const section = readSectionPayload(task, tabKey)
  const obs = String(section.observations ?? '').trim()
  const confirmed = Boolean(section.checklistConfirmed)
  if (!obs && !confirmed && task.status === 'Pending') {
    return 'Advertencia: la tarea aún tiene campos pendientes de captura antes de su entrega oficial.'
  }
  return ''
}

async function loadData(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    if (!currentUser.value) {
      currentUser.value = await me()
    }

    if (isAdmin.value) {
      const [res, formatsRes] = await Promise.all([
        complianceApi.getDocenteSummaries(filters.value, page.value, limit.value),
        complianceApi.getFormatsOverview(filters.value.periodoId),
      ])
      docenteSummaries.value = res.data
      totalItems.value = res.total
      formatsOverview.value = formatsRes
    } else {
      const clave = resolveDocenteClave(currentUser.value?.username)
      const res = await complianceApi.getDeliverables(
        clave,
        filters.value.periodoId,
        page.value,
        limit.value,
        {
          month: filters.value.month,
          formatKey: filters.value.formatKey,
          status: filters.value.status,
        },
      )
      tasks.value = res.data
      totalItems.value = res.total
    }
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isLoading.value = false
  }
}

watch(
  filters,
  () => {
    page.value = 1
    void loadData()
  },
  { deep: true },
)

function goToPage(nextPage: number): void {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  page.value = nextPage
  void loadData()
}

// Apertura y guardado de formulario estructurado (Tutor)
async function openTaskForm(task: DeliverableTask): Promise<void> {
  if (task.formatKey === 'PlanTrabajo') {
    await router.push({
      name: 'compliance-plan-trabajo',
      params: { deliverableId: task.id },
    })
    return
  }
  if (task.formatKey === 'DiagnosticoInicial') {
    await router.push({
      name: 'compliance-diagnostico-inicial',
      params: { deliverableId: task.id },
    })
    return
  }
  if (task.formatKey === 'Anexo14') {
    await router.push({
      name: 'compliance-anexo-14',
      params: { deliverableId: task.id },
    })
    return
  }
  if (task.formatKey === 'Anexo15') {
    await router.push({
      name: 'compliance-anexo-15',
      params: { deliverableId: task.id },
    })
    return
  }
  if (task.formatKey === 'Anexo19AMensual') {
    await router.push({
      name: 'compliance-anexo-19a',
      params: { deliverableId: task.id },
    })
    return
  }
  if (task.formatKey === 'SeguimientoMensual') {
    await router.push({
      name: 'compliance-seguimiento-mensual',
      params: { deliverableId: task.id },
    })
    return
  }
  if (task.formatKey === 'SeguimientoFinal') {
    await router.push({
      name: 'compliance-seguimiento-final',
      params: { deliverableId: task.id },
    })
    return
  }

  isFormModalOpen.value = true
  isLoadingForm.value = true
  formError.value = ''

  try {
    const initialTab = task.hasTabs ? (task.activeTabKey ?? task.tabs?.[0]?.tabKey) : undefined
    const loaded = await complianceApi.getDeliverableForm(task.id, initialTab)
    activeTask.value = loaded
    activeTabKey.value = loaded.hasTabs
      ? (loaded.activeTabKey ?? loaded.tabs?.[0]?.tabKey)
      : undefined
    hydrateDraftFromTask(loaded, activeTabKey.value)
  } catch (error) {
    formError.value = normalizeApiError(error).message
  } finally {
    isLoadingForm.value = false
  }
}

function handleSwitchTab(nextTabKey: string): void {
  if (!activeTask.value || nextTabKey === activeTabKey.value || isSavingForm.value) return
  if (isTabDirty.value) {
    const proceed = window.confirm(
      'Hay cambios sin guardar en la pestaña actual. ¿Deseas descartarlos y cambiar de pestaña?',
    )
    if (!proceed) return
  }
  activeTabKey.value = nextTabKey
  hydrateDraftFromTask(activeTask.value, nextTabKey)
}

function handleCloseFormModal(): void {
  if (isSavingForm.value) return
  if (isTabDirty.value) {
    const proceed = window.confirm('Hay cambios sin guardar. ¿Deseas cerrar sin guardar?')
    if (!proceed) return
  }
  isFormModalOpen.value = false
  activeTask.value = null
  activeTabKey.value = undefined
  isTabDirty.value = false
  pendingPhotos.value = []
}

function handlePhotoSelection(event: Event): void {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return

  const validFiles: File[] = []
  photoError.value = ''

  for (const file of Array.from(input.files)) {
    if (!ALLOWED_PHOTO_MIMES.has(file.type)) {
      photoError.value = 'Formato de evidencia no permitido. Usa únicamente JPG, PNG o WEBP (415).'
      continue
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      photoError.value = `La imagen "${file.name}" supera el máximo de 5 MB (413).`
      continue
    }
    validFiles.push(file)
  }

  if (validFiles.length > 0) {
    pendingPhotos.value = [...pendingPhotos.value, ...validFiles].slice(0, 5)
    isTabDirty.value = true
  }
  input.value = ''
}

function removePendingPhoto(index: number): void {
  pendingPhotos.value.splice(index, 1)
  isTabDirty.value = true
}

async function handleSaveForm(submit: boolean): Promise<void> {
  if (!activeTask.value || isSavingForm.value) return

  const validationError = validateDraft()
  if (validationError) {
    formError.value = validationError
    return
  }

  if (submit && !draft.value.checklistConfirmed) {
    formError.value = 'Confirma la verificación de datos antes de enviar la entrega.'
    return
  }

  isSavingForm.value = true
  formError.value = ''

  try {
    const payloadData: Record<string, unknown> = {
      enrolledCount: Number(draft.value.enrolledCount),
      attendedCount: Number(draft.value.attendedCount),
      attendanceRate: Number(draft.value.attendanceRate),
      incidenceSummary: draft.value.incidenceSummary.trim(),
      checklistConfirmed: draft.value.checklistConfirmed,
      observations: draft.value.observations.trim(),
    }

    const updated = await complianceApi.saveDeliverableForm(activeTask.value.id, {
      tabKey: activeTask.value.hasTabs ? activeTabKey.value : undefined,
      formPayload: payloadData,
      photoEvidenceFiles: requiresPhotoForActiveView.value ? pendingPhotos.value : undefined,
      submit,
    })

    activeTask.value = updated
    pendingPhotos.value = []
    isTabDirty.value = false
    successMessage.value = submit
      ? `Entrega registrada correctamente para "${updated.title}".`
      : `Avance guardado en "${activeTabMeta.value?.label ?? updated.title}".`

    await loadData()
    if (submit) {
      isFormModalOpen.value = false
    }
  } catch (error) {
    formError.value = normalizeApiError(error).message
  } finally {
    isSavingForm.value = false
  }
}

// Vista previa en navegador y exportación desde plantilla
async function openPreviewModal(task: DeliverableTask, tabKey?: string): Promise<void> {
  if (isPreviewing.value) return

  previewTask.value = task
  previewTabKey.value = tabKey ?? (task.hasTabs ? (task.activeTabKey ?? task.tabs?.[0]?.tabKey) : undefined)
  previewResult.value = null
  previewError.value = ''
  exportWarning.value = getMissingFieldsWarning(task, previewTabKey.value)
  isPreviewModalOpen.value = true

  await fetchPreview()
}

async function fetchPreview(): Promise<void> {
  if (!previewTask.value || isPreviewing.value) return

  isPreviewing.value = true
  previewError.value = ''
  try {
    previewResult.value = await complianceApi.previewDeliverableTemplate(
      previewTask.value.id,
      previewTabKey.value,
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

async function handleExportTemplate(task: DeliverableTask, tabKey?: string): Promise<void> {
  if (isExporting.value) return

  const warning = getMissingFieldsWarning(task, tabKey)
  if (warning && !window.confirm(`${warning}\n\n¿Deseas continuar con la exportación desde plantilla?`)) {
    return
  }

  isExporting.value = true
  errorMessage.value = ''
  previewError.value = ''

  try {
    const blob = await complianceApi.exportDeliverableTemplate(
      task.id,
      tabKey,
      task.formatKey,
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildOfficialDownloadFileName(task.formatKey, task.docenteClave, tabKey)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = `Documento descargado en formato oficial (${link.download}).`
  } catch (error) {
    const normalized = normalizeApiError(error)
    const msg =
      normalized.status === 404 || normalized.status === 0
        ? 'El servicio de exportación de plantillas en backend aún no está activo.'
        : normalized.message
    if (isPreviewModalOpen.value) {
      previewError.value = msg
    } else {
      errorMessage.value = msg
    }
  } finally {
    isExporting.value = false
  }
}

// Modal de detalle por docente (Admin)
async function openDocenteDetail(summary: DocenteComplianceSummary): Promise<void> {
  selectedDocenteSummary.value = summary
  isDocenteDetailModalOpen.value = true
  isLoadingDocenteModal.value = true

  try {
    const res = await complianceApi.getDeliverables(
      summary.docenteClave,
      filters.value.periodoId,
      1,
      20,
    )
    docenteModalTasks.value = res.data
  } catch {
    docenteModalTasks.value = []
  } finally {
    isLoadingDocenteModal.value = false
  }
}

// Lista de archivos/anexos y panel de tutores activos (Admin)
const formatsOverview = ref<FormatComplianceOverview[]>([])
const isFormatDetailModalOpen = ref(false)
const isLoadingFormatModal = ref(false)
const selectedFormatOverview = ref<FormatComplianceOverview | null>(null)
const formatTutorEntries = ref<FormatTutorEntry[]>([])
const formatTutorFilter = ref<'all' | 'updated' | 'unchanged'>('all')
const formatTutorSearch = ref('')

const formatOverviewColumns: { key: keyof FormatOverviewRow & string; label: string }[] = [
  { key: 'title', label: 'Formato / Anexo' },
  { key: 'templateFileName', label: 'Plantilla oficial' },
  { key: 'updatedCount', label: 'Con actualizaciones' },
  { key: 'deliveredCount', label: 'Entregados' },
  { key: 'pendingCount', label: 'Pendientes' },
  { key: 'actions', label: 'Acciones' },
]

const formatTutorColumns: { key: keyof FormatTutorRow & string; label: string }[] = [
  { key: 'docenteClave', label: 'Clave' },
  { key: 'docenteName', label: 'Docente Tutor' },
  { key: 'updatedSummary', label: 'Actualización' },
  { key: 'actions', label: 'Acciones' },
]

const tableFormatOverviewRows = computed<FormatOverviewRow[]>(() => {
  const list = filters.value.formatKey
    ? formatsOverview.value.filter((f) => f.formatKey === filters.value.formatKey)
    : formatsOverview.value
  return list.map((f) => ({ ...f, id: f.formatKey, actions: '' }))
})

const filteredFormatTutorRows = computed<FormatTutorRow[]>(() => {
  const q = formatTutorSearch.value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  return formatTutorEntries.value
    .filter((entry) => {
      if (formatTutorFilter.value === 'updated' && !entry.hasUpdates) return false
      if (formatTutorFilter.value === 'unchanged' && entry.hasUpdates) return false
      if (!q) return true
      const normName = entry.docenteName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
      return normName.includes(q) || entry.docenteClave.toLowerCase().includes(q)
    })
    .map((entry) => ({ ...entry, id: entry.task.id, actions: '' }))
})

function formatDateTime(iso?: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-MX')
  } catch {
    return iso
  }
}

async function openFormatDetail(overview: FormatComplianceOverview): Promise<void> {
  selectedFormatOverview.value = overview
  formatTutorFilter.value = 'all'
  formatTutorSearch.value = ''
  isFormatDetailModalOpen.value = true
  isLoadingFormatModal.value = true

  try {
    formatTutorEntries.value = await complianceApi.getFormatTutorEntries(
      overview.formatKey,
      filters.value.periodoId,
    )
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
    formatTutorEntries.value = []
  } finally {
    isLoadingFormatModal.value = false
  }
}

function closeFormatDetail(): void {
  isFormatDetailModalOpen.value = false
  selectedFormatOverview.value = null
  formatTutorEntries.value = []
}

async function inspectTutorModifications(task: DeliverableTask): Promise<void> {
  isFormatDetailModalOpen.value = false
  isDocenteDetailModalOpen.value = false
  await openTaskForm(task)
}

function closeDocenteDetail(): void {
  isDocenteDetailModalOpen.value = false
  selectedDocenteSummary.value = null
  docenteModalTasks.value = []
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <UiBasePage
    fluid
    :title="isAdmin ? 'Supervisión de Cumplimiento Institucional' : 'Mis Tareas y Formatos de Tutoría'"
    :description="
      isAdmin
        ? 'Lista general de los 54 docentes tutores, revisión de tareas estructuradas y seguimiento de entregas.'
        : 'Captura estructurada de los 7 formatos institucionales pre-rellenados desde BD, con vista previa y exportación.'
    "
  >
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

    <!-- Bloque 1: Filtros -->
    <div class="compliance-block">
      <ComplianceFiltersBar v-model="filters" :show-teacher-search="isAdmin" />
    </div>

    <!-- Bloque 2: Tarjetas KPI -->
    <div class="compliance-block">
      <ComplianceKpiCards
        v-if="isAdmin"
        :on-time-count="adminKpis.onTime"
        :late-count="adminKpis.late"
        :pending-count="adminKpis.pending"
        :total-count="adminKpis.total"
        :total-delay-days="adminKpis.delayDays"
      />
      <ComplianceKpiCards
        v-else
        :on-time-count="docenteKpis.onTime"
        :late-count="docenteKpis.late"
        :pending-count="docenteKpis.pending"
        :total-delay-days="docenteKpis.delayDays"
      />
    </div>

    <!-- Bloque 3A: Vista Tutor -->
    <div v-if="!isAdmin" class="compliance-block">
      <UiCard
        title="Formatos y Anexos del Periodo"
        description="Completa los campos requeridos por formato o pestaña. Los datos maestros del sistema vienen pre-rellenados."
        :aria-busy="isLoading"
      >
        <UiAlert v-if="isLoading" tone="info" title="Sincronizando tareas..." />
        <UiTable
          v-else
          label="Tabla de tareas de cumplimiento del docente"
          :columns="docenteColumns"
          :rows="tableTaskRows"
        >
          <template #cell-title="{ row }">
            <div class="format-cell">
              <div class="format-title-row">
                <span class="format-title">{{ row.title }}</span>
                <UiBadge v-if="row.hasTabs && row.tabs" tone="info">
                  {{ row.tabs.length }} pestañas
                </UiBadge>
                <UiBadge v-if="row.requiresPhotoEvidence" tone="purple">
                  Con evidencia fotográfica
                </UiBadge>
              </div>
              <span class="format-code">{{ row.formatKey }}</span>
            </div>
          </template>

          <template #cell-reportingMonth="{ row }">
            <span>{{ row.reportingMonth ? getMonthName(row.reportingMonth) : 'Semestral' }}</span>
          </template>

          <template #cell-status="{ row }">
            <DeliverableStatusBadge :status="row.status" />
          </template>

          <template #cell-delayDays="{ row }">
            <span :class="{ 'retraso-badge': row.delayDays > 0 }">
              {{ row.delayDays > 0 ? `${row.delayDays} días` : '0 días' }}
            </span>
          </template>

          <template #cell-actions="{ row }">
            <div class="row-actions">
              <UiButton variant="primary" class="btn-sm" @click="openTaskForm(row)">
                {{ row.status === 'Pending' ? 'Capturar' : 'Editar' }}
              </UiButton>
              <UiButton
                variant="secondary"
                class="btn-sm"
                :disabled="isPreviewing"
                @click="openPreviewModal(row)"
              >
                Vista previa
              </UiButton>
              <UiButton
                variant="secondary"
                class="btn-sm"
                :disabled="isExporting"
                @click="handleExportTemplate(row)"
              >
                Exportar
              </UiButton>
            </div>
          </template>
        </UiTable>

        <div v-if="!isLoading && totalItems > 0" class="pagination-bar">
          <span class="pagination-info">
            Página {{ page }} de {{ totalPages }} ({{ totalItems }} registros)
          </span>
          <div class="pagination-actions">
            <UiButton variant="secondary" class="btn-sm" :disabled="page <= 1" @click="goToPage(page - 1)">
              Anterior
            </UiButton>
            <UiButton variant="secondary" class="btn-sm" :disabled="page >= totalPages" @click="goToPage(page + 1)">
              Siguiente
            </UiButton>
          </div>
        </div>
      </UiCard>
    </div>

    <!-- Bloque 3B: Vista Coordinador / Admin -->
    <template v-else>
      <!-- Lista de archivos / anexos oficiales -->
      <div class="compliance-block">
        <UiCard
          title="Archivos y Anexos Oficiales de Tutoría"
          description="Selecciona un formato para consultar todos los tutores activos, detectar actualizaciones, previsualizar y descargar con su plantilla oficial."
          :aria-busy="isLoading"
        >
          <UiAlert v-if="isLoading" tone="info" title="Cargando catálogo de formatos y anexos..." />
          <UiTable
            v-else
            label="Lista de archivos y anexos de tutoría"
            :columns="formatOverviewColumns"
            :rows="tableFormatOverviewRows"
          >
            <template #cell-title="{ row }">
              <div class="format-cell">
                <div class="format-title-row">
                  <span class="format-title">{{ row.title }}</span>
                  <UiBadge tone="info">.{{ row.extension.toUpperCase() }}</UiBadge>
                  <UiBadge v-if="row.hasTabs" tone="purple">{{ row.tabsCount }} hojas</UiBadge>
                </div>
                <span class="format-desc">{{ row.description }}</span>
              </div>
            </template>

            <template #cell-templateFileName="{ row }">
              <code class="template-name">{{ row.templateFileName }}</code>
            </template>

            <template #cell-updatedCount="{ row }">
              <UiBadge :tone="row.updatedCount > 0 ? 'success' : 'warning'">
                {{ row.updatedCount }} / {{ row.totalTutors }} tutores
              </UiBadge>
            </template>

            <template #cell-deliveredCount="{ row }">
              <span class="text-ontime">{{ row.deliveredCount }}</span>
            </template>

            <template #cell-pendingCount="{ row }">
              <span :class="{ 'text-pending': row.pendingCount > 0 }">{{ row.pendingCount }}</span>
            </template>

            <template #cell-actions="{ row }">
              <UiButton variant="primary" class="btn-sm" @click="openFormatDetail(row)">
                Ver detalles
              </UiButton>
            </template>
          </UiTable>
        </UiCard>
      </div>

      <!-- Lista consolidada por docente tutor -->
      <div class="compliance-block">
        <UiCard
          title="Lista de Docentes Tutores"
          description="Seguimiento consolidado de entregas estructuradas y días de retraso"
          :aria-busy="isLoading"
        >
        <UiAlert v-if="isLoading" tone="info" title="Cargando lista de docentes..." />
        <UiTable
          v-else
          label="Lista consolidada de tutores"
          :columns="adminColumns"
          :rows="tableSummaryRows"
        >
          <template #cell-docenteClave="{ row }">
            <code class="docente-clave">{{ row.docenteClave }}</code>
          </template>

          <template #cell-docenteName="{ row }">
            <span class="docente-name">{{ row.docenteName }}</span>
          </template>

          <template #cell-onTime="{ row }">
            <span class="text-ontime">{{ row.onTime }}</span>
          </template>

          <template #cell-late="{ row }">
            <span :class="{ 'text-late': row.late > 0 }">{{ row.late }}</span>
          </template>

          <template #cell-pending="{ row }">
            <span :class="{ 'text-pending': row.pending > 0 }">{{ row.pending }}</span>
          </template>

          <template #cell-totalDelayDays="{ row }">
            <span :class="['retraso-counter', { 'retraso-alert': row.totalDelayDays > 0 }]">
              {{ row.totalDelayDays > 0 ? `${row.totalDelayDays} días` : 'Sin retraso' }}
            </span>
          </template>

          <template #cell-actions="{ row }">
            <UiButton variant="secondary" class="btn-sm" @click="openDocenteDetail(row)">
              Ver detalle
            </UiButton>
          </template>
        </UiTable>

        <div v-if="!isLoading && totalItems > 0" class="pagination-bar">
          <span class="pagination-info">
            Página {{ page }} de {{ totalPages }} ({{ totalItems }} docentes)
          </span>
          <div class="pagination-actions">
            <UiButton variant="secondary" class="btn-sm" :disabled="page <= 1" @click="goToPage(page - 1)">
              Anterior
            </UiButton>
            <UiButton variant="secondary" class="btn-sm" :disabled="page >= totalPages" @click="goToPage(page + 1)">
              Siguiente
            </UiButton>
          </div>
        </div>
      </UiCard>
    </div>
    </template>

    <!-- DIÁLOGO: FORMULARIO ESTRUCTURADO (VENTANA ÚNICA O PESTAÑAS) -->
    <UiDialog
      v-model="isFormModalOpen"
      :title="activeTask ? activeTask.title : 'Captura de Formato'"
      class="task-form-dialog"
    >
      <div class="dialog-body">
        <UiAlert v-if="isLoadingForm" tone="info" title="Cargando datos pre-rellenados..." />

        <template v-else-if="activeTask">
          <UiAlert v-if="formError" tone="danger" title="Error de validación">
            <UiText>{{ formError }}</UiText>
          </UiAlert>

          <!-- Datos maestros pre-rellenados desde BD (solo lectura) -->
          <div class="prefilled-panel">
            <span class="panel-heading">Datos maestros pre-rellenados (PostgreSQL)</span>
            <div class="prefilled-grid">
              <div v-for="entry in prefilledEntries" :key="entry.key" class="prefilled-item">
                <span class="field-label">{{ entry.label }}</span>
                <strong>{{ entry.value }}</strong>
              </div>
            </div>
          </div>

          <!-- Pestañas independientes para libros multi-hoja (.xlsx) -->
          <div
            v-if="activeTask.hasTabs && activeTask.tabs?.length"
            class="sheet-tabs"
            role="tablist"
            aria-label="Pestañas del libro oficial"
          >
            <button
              v-for="tab in activeTask.tabs"
              :key="tab.tabKey"
              type="button"
              role="tab"
              class="sheet-tab-btn"
              :class="{ active: tab.tabKey === activeTabKey }"
              :aria-selected="tab.tabKey === activeTabKey"
              @click="handleSwitchTab(tab.tabKey)"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- Campos estructurados de captura -->
          <div class="structured-fields">
            <div class="numeric-grid">
              <UiField
                v-model="draft.enrolledCount"
                label="Alumnos inscritos (entero >= 0)"
                type="number"
                min="0"
                @update:model-value="markDirty"
              />
              <UiField
                v-model="draft.attendedCount"
                label="Alumnos atendidos (entero >= 0)"
                type="number"
                min="0"
                @update:model-value="markDirty"
              />
              <UiField
                v-model="draft.attendanceRate"
                label="Índice / porcentaje (0 - 100%)"
                type="number"
                min="0"
                max="100"
                @update:model-value="markDirty"
              />
            </div>

            <UiField
              v-model="draft.incidenceSummary"
              label="Incidencias / seguimiento académico"
              placeholder="Ej. Canalizaciones, materias en riesgo o sesiones realizadas"
              @update:model-value="markDirty"
            />

            <div class="form-field-textarea">
              <label for="task-observations" class="textarea-label">Observaciones del tutor</label>
              <textarea
                id="task-observations"
                v-model="draft.observations"
                rows="3"
                class="custom-textarea"
                placeholder="Registra observaciones y acuerdos de la sesión o pestaña activa..."
                @input="markDirty"
              />
            </div>

            <label class="checklist-row">
              <input
                v-model="draft.checklistConfirmed"
                type="checkbox"
                @change="markDirty"
              />
              <span>Confirmo que los datos capturados en esta sección corresponden a mi grupo asignado.</span>
            </label>
          </div>

          <!-- Evidencia fotográfica condicional -->
          <div v-if="requiresPhotoForActiveView" class="photo-evidence-section">
            <span class="panel-heading">Evidencias fotográficas (requeridas para este formato)</span>
            <UiAlert v-if="photoError" tone="danger" title="Error en imagen">
              <UiText>{{ photoError }}</UiText>
            </UiAlert>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              @change="handlePhotoSelection"
            />
            <span class="upload-hint">JPG, PNG o WEBP · Máx. 5 MB por archivo (hasta 5 imágenes).</span>

            <div v-if="pendingPhotos.length > 0" class="photo-list">
              <div v-for="(file, idx) in pendingPhotos" :key="`${file.name}-${idx}`" class="photo-pill">
                <span>{{ file.name }} ({{ (file.size / 1024).toFixed(0) }} KB)</span>
                <button type="button" class="remove-photo-btn" @click="removePendingPhoto(idx)">
                  Quitar
                </button>
              </div>
            </div>

            <div v-if="activeTask.photoEvidenceUrls?.length" class="photo-thumbs">
              <img
                v-for="(url, idx) in activeTask.photoEvidenceUrls"
                :key="`${url}-${idx}`"
                :src="url"
                alt="Evidencia fotográfica adjunta"
                class="photo-thumb"
              />
            </div>
          </div>

          <div class="dialog-actions">
            <UiButton variant="secondary" :disabled="isSavingForm" @click="handleCloseFormModal">
              Cerrar
            </UiButton>
            <UiButton
              variant="secondary"
              :disabled="isSavingForm || isPreviewing"
              @click="openPreviewModal(activeTask, activeTabKey)"
            >
              Vista previa
            </UiButton>
            <UiButton
              variant="secondary"
              :loading="isSavingForm"
              @click="handleSaveForm(false)"
            >
              Guardar borrador
            </UiButton>
            <UiButton
              variant="primary"
              :loading="isSavingForm"
              @click="handleSaveForm(true)"
            >
              Guardar y entregar
            </UiButton>
          </div>
        </template>
      </div>
    </UiDialog>

    <!-- DIÁLOGO: VISTA PREVIA DE PLANTILLA (PDF / XLSX) -->
    <UiDialog
      v-model="isPreviewModalOpen"
      :title="previewTask ? `Vista previa: ${previewTask.title}` : 'Vista previa de plantilla'"
      class="preview-dialog"
    >
      <div v-if="previewTask" class="dialog-body">
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
          <UiButton
            variant="primary"
            class="btn-sm"
            :loading="isExporting"
            @click="handleExportTemplate(previewTask, previewTabKey)"
          >
            Exportar archivo
          </UiButton>
        </div>

        <UiAlert v-if="exportWarning" tone="warning" title="Campos pendientes">
          <UiText>{{ exportWarning }}</UiText>
        </UiAlert>

        <UiAlert v-if="previewError" tone="danger" title="Aviso de vista previa">
          <UiText>{{ previewError }}</UiText>
        </UiAlert>

        <UiAlert v-if="isPreviewing" tone="info" title="Generando vista previa..." />

        <div v-if="previewTask.hasTabs && previewTask.tabs?.length" class="sheet-tabs" role="tablist" aria-label="Hojas del documento en vista previa">
          <button
            v-for="tab in previewTask.tabs"
            :key="tab.tabKey"
            type="button"
            role="tab"
            class="sheet-tab-btn"
            :class="{ active: tab.tabKey === previewTabKey }"
            :aria-selected="tab.tabKey === previewTabKey"
            @click="previewTabKey = tab.tabKey; void fetchPreview()"
          >
            {{ tab.label }}
          </button>
        </div>

        <iframe
          v-if="sanitizePreviewUrl(previewResult?.previewUrlOrContent)"
          :src="sanitizePreviewUrl(previewResult?.previewUrlOrContent)"
          sandbox="allow-same-origin"
          class="preview-frame"
          title="Vista previa oficial del formato"
        />

        <FormatDocumentPreview
          v-else
          :task="previewTask"
          :tab-key="previewTabKey"
        />

        <div class="dialog-actions">
          <UiButton variant="secondary" @click="isPreviewModalOpen = false">
            Cerrar
          </UiButton>
        </div>
      </div>
    </UiDialog>

    <!-- DIÁLOGO: DETALLE POR DOCENTE (ADMIN) -->
    <UiDialog
      v-model="isDocenteDetailModalOpen"
      :title="selectedDocenteSummary ? `Detalle: ${selectedDocenteSummary.docenteName}` : 'Detalle del Docente'"
      class="detail-dialog"
    >
      <div v-if="selectedDocenteSummary" class="dialog-body">
        <div class="dialog-summary-bar">
          <div><strong>Clave:</strong> {{ selectedDocenteSummary.docenteClave }}</div>
          <div><strong>Días de retraso acumulados:</strong> {{ selectedDocenteSummary.totalDelayDays }} días</div>
        </div>

        <UiAlert v-if="isLoadingDocenteModal" tone="info" title="Consultando tareas del docente..." />
        <UiTable
          v-else
          label="Detalle de tareas de cumplimiento del docente"
          :columns="[
            { key: 'title', label: 'Formato' },
            { key: 'reportingMonth', label: 'Mes' },
            { key: 'status', label: 'Estado' },
            { key: 'delayDays', label: 'Días de retraso' },
            { key: 'actions', label: 'Plantilla' },
          ]"
          :rows="docenteModalTasks.map((t) => ({ ...t, actions: '' }))"
        >
          <template #cell-reportingMonth="{ row }">
            <span>{{ row.reportingMonth ? getMonthName(row.reportingMonth) : 'Semestral' }}</span>
          </template>
          <template #cell-status="{ row }">
            <DeliverableStatusBadge :status="row.status" />
          </template>
          <template #cell-delayDays="{ row }">
            <span :class="{ 'retraso-badge': row.delayDays > 0 }">
              {{ row.delayDays > 0 ? `${row.delayDays} días` : '0 días' }}
            </span>
          </template>
          <template #cell-actions="{ row }">
            <div class="row-actions">
              <UiButton variant="primary" class="btn-sm" @click="inspectTutorModifications(row)">
                Ver modificaciones
              </UiButton>
              <UiButton variant="secondary" class="btn-sm" @click="openPreviewModal(row)">
                Vista previa
              </UiButton>
              <UiButton
                variant="secondary"
                class="btn-sm"
                :disabled="isExporting"
                @click="handleExportTemplate(row)"
              >
                Descargar
              </UiButton>
            </div>
          </template>
        </UiTable>

        <div class="dialog-actions">
          <UiButton variant="primary" @click="closeDocenteDetail">
            Cerrar
          </UiButton>
        </div>
      </div>
    </UiDialog>

    <!-- DIÁLOGO: DETALLE DE FORMATO / ANEXO CON TUTORES ACTIVOS (ADMIN) -->
    <UiDialog
      v-model="isFormatDetailModalOpen"
      :title="selectedFormatOverview ? `Tutores activos · ${selectedFormatOverview.title}` : 'Detalle del formato'"
      class="format-detail-dialog"
    >
      <div v-if="selectedFormatOverview" class="dialog-body">
        <div class="dialog-summary-bar">
          <div>
            <strong>Plantilla oficial:</strong>
            <code class="template-name">{{ selectedFormatOverview.templateFileName }}</code>
          </div>
          <div>
            <strong>Con actualizaciones:</strong>
            {{ selectedFormatOverview.updatedCount }} / {{ selectedFormatOverview.totalTutors }} tutores
          </div>
        </div>

        <div class="format-filter-bar">
          <div class="filter-pills">
            <UiButton
              :variant="formatTutorFilter === 'all' ? 'primary' : 'secondary'"
              class="btn-sm"
              @click="formatTutorFilter = 'all'"
            >
              Todos ({{ formatTutorEntries.length }})
            </UiButton>
            <UiButton
              :variant="formatTutorFilter === 'updated' ? 'primary' : 'secondary'"
              class="btn-sm"
              @click="formatTutorFilter = 'updated'"
            >
              Con actualizaciones ({{ formatTutorEntries.filter((e) => e.hasUpdates).length }})
            </UiButton>
            <UiButton
              :variant="formatTutorFilter === 'unchanged' ? 'primary' : 'secondary'"
              class="btn-sm"
              @click="formatTutorFilter = 'unchanged'"
            >
              Sin cambios ({{ formatTutorEntries.filter((e) => !e.hasUpdates).length }})
            </UiButton>
          </div>
          <UiField
            v-model="formatTutorSearch"
            label="Buscar tutor"
            placeholder="Clave o nombre del tutor..."
            class="tutor-search-field"
          />
        </div>

        <UiAlert v-if="isLoadingFormatModal" tone="info" title="Cargando tutores activos..." />
        <UiAlert
          v-else-if="filteredFormatTutorRows.length === 0"
          tone="info"
          title="Sin tutores en este filtro"
        >
          <UiText>Ningún tutor coincide con el criterio seleccionado.</UiText>
        </UiAlert>
        <UiTable
          v-else
          label="Tutores activos por formato"
          :columns="formatTutorColumns"
          :rows="filteredFormatTutorRows"
        >
          <template #cell-docenteClave="{ row }">
            <code class="docente-clave">{{ row.docenteClave }}</code>
          </template>

          <template #cell-docenteName="{ row }">
            <div class="tutor-cell">
              <span class="docente-name">{{ row.docenteName }}</span>
              <DeliverableStatusBadge :status="row.task.status" />
            </div>
          </template>

          <template #cell-updatedSummary="{ row }">
            <div class="update-cell">
              <UiBadge :tone="row.hasUpdates ? 'success' : 'warning'">
                {{ row.hasUpdates ? 'Actualizado' : 'Sin cambios' }}
              </UiBadge>
              <span class="update-meta">{{ row.updatedSummary }}</span>
              <span v-if="row.updatedAt" class="update-date">{{ formatDateTime(row.updatedAt) }}</span>
            </div>
          </template>

          <template #cell-actions="{ row }">
            <div class="row-actions">
              <UiButton
                variant="primary"
                class="btn-sm"
                @click="inspectTutorModifications(row.task)"
              >
                Ver modificaciones
              </UiButton>
              <UiButton
                variant="secondary"
                class="btn-sm"
                :disabled="isPreviewing"
                @click="openPreviewModal(row.task)"
              >
                Vista previa
              </UiButton>
              <UiButton
                variant="secondary"
                class="btn-sm"
                :disabled="isExporting"
                @click="handleExportTemplate(row.task)"
              >
                Descargar
              </UiButton>
            </div>
          </template>
        </UiTable>

        <div class="dialog-actions">
          <UiButton variant="secondary" @click="closeFormatDetail">Cerrar</UiButton>
        </div>
      </div>
    </UiDialog>
  </UiBasePage>
</template>

<style scoped>
.compliance-block {
  margin-bottom: 1.25rem;
}

.compliance-block:last-child {
  margin-bottom: 0;
}

.format-cell {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.format-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.format-title {
  font-weight: 500;
  color: var(--color-text-primary, #0f172a);
}

.format-desc {
  font-size: 0.76rem;
  color: var(--color-text-secondary, #64748b);
}

.template-name {
  font-family: monospace;
  font-size: 0.75rem;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background-color: var(--color-gray-100, #f1f5f9);
  color: var(--color-text-primary, #0f172a);
  word-break: break-word;
}

:global(dialog.format-detail-dialog) {
  width: min(1080px, calc(100vw - 32px));
  max-width: 1080px;
  max-height: 90vh;
  overflow-y: auto;
}

.format-filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tutor-search-field {
  min-width: 240px;
}

.tutor-cell,
.update-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}

.update-meta,
.update-date {
  font-size: 0.74rem;
  color: var(--color-text-secondary, #64748b);
}

.format-code {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
}

.docente-clave {
  font-family: monospace;
  font-weight: 600;
  background-color: var(--color-gray-100, #f1f5f9);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.docente-name {
  font-weight: 500;
  color: var(--color-text-primary, #0f172a);
}

.text-ontime {
  color: var(--color-success-strong, #15803d);
  font-weight: 600;
}

.text-late,
.retraso-badge,
.retraso-alert {
  color: var(--color-danger-hover, #b91c1c);
  font-weight: 600;
}

.text-pending {
  color: var(--color-warning-strong, #d97706);
  font-weight: 600;
}

.retraso-counter {
  font-weight: 500;
  color: var(--color-text-secondary, #64748b);
}

.row-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.btn-sm {
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border, #e2e8f0);
}

.pagination-info {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #64748b);
}

.pagination-actions {
  display: flex;
  gap: 0.5rem;
}

:global(dialog.task-form-dialog),
:global(dialog.preview-dialog),
:global(dialog.detail-dialog) {
  width: min(920px, calc(100vw - 32px));
  max-width: 920px;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.prefilled-panel {
  padding: 0.875rem 1rem;
  background-color: var(--color-bg-light, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
}

.panel-heading {
  display: block;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-primary, #1b396a);
  margin-bottom: 0.5rem;
}

.prefilled-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.625rem 1rem;
}

.prefilled-item {
  display: flex;
  flex-direction: column;
  font-size: 0.8125rem;
}

.field-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
}

.sheet-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  padding-bottom: 0.625rem;
}

.sheet-tab-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary, #475569);
  background-color: var(--color-gray-100, #f1f5f9);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
}

.sheet-tab-btn.active {
  color: var(--color-white, #ffffff);
  background-color: var(--color-primary, #1b396a);
  border-color: var(--color-primary, #1b396a);
}

.structured-fields {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.numeric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
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

.checklist-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text-primary, #0f172a);
  cursor: pointer;
}

.photo-evidence-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem;
  background-color: var(--color-purple-bg, #ede9fe);
  border: 1px solid var(--color-purple-border, #ddd6fe);
  border-radius: 8px;
}

.upload-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
}

.photo-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.photo-pill {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.375rem 0.625rem;
  background-color: var(--color-surface-white, #ffffff);
  border-radius: 6px;
  font-size: 0.8125rem;
}

.remove-photo-btn {
  border: 0;
  background: transparent;
  color: var(--color-danger-strong, #dc2626);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.photo-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.photo-thumb {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--color-border, #e2e8f0);
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.format-switch {
  display: flex;
  gap: 0.5rem;
}

.preview-frame {
  width: 100%;
  height: 440px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
}

.preview-fallback-sheet {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background-color: var(--color-bg-light, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
}

.preview-sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.payload-preview {
  margin: 0;
  padding: 0.75rem;
  max-height: 240px;
  overflow: auto;
  font-size: 0.78rem;
  background-color: var(--color-surface-white, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
}

.dialog-summary-bar {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  background-color: var(--color-bg-light, #f8fafc);
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.625rem;
  margin-top: 0.25rem;
}
</style>
