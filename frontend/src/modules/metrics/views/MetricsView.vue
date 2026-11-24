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
  UiMetric,
  UiTable,
  UiText,
} from '../../../shared/components'
import { normalizeApiError } from '../../../shared/api/apiErrors'
import { me } from '../../auth/api/authApi'
import type { UserResponse } from '../../auth/types/auth'
import type { PreviewFormat } from '../../compliance/types/compliance'
import { metricsApi } from '../api/metricsApi'
import {
  FailureRiskBadge,
  MetricsFiltersBar,
  ReadinessThresholdBanner,
  UnitFailureTrackingPanel,
} from '../components'
import type {
  CoordinatorFormatKey,
  CoordinatorSheetKey,
  CoordinatorWorkbook,
  FailureReportItem,
  FinalReportReadiness,
  MetricsFilters,
  UnitResultsImportResponse,
  WorkbookPreviewResult,
} from '../types/metrics'

const currentUser = ref<UserResponse | null>(null)
const isAdmin = computed(() => currentUser.value?.role === 'Admin')

const isLoading = ref(true)
const errorMessage = ref('')
const successMessage = ref('')

// Filtros y paginación de reportes de reprobación
const filters = ref<MetricsFilters>({
  periodoId: 1,
  month: undefined,
  riskLevel: undefined,
  search: undefined,
})

const page = ref(1)
const limit = ref(10)
const totalItems = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / limit.value)))

const failureReports = ref<FailureReportItem[]>([])
const readiness = ref<FinalReportReadiness>({
  periodoId: 1,
  totalTutors: 0,
  completedDeliveries: 0,
  totalExpectedDeliveries: 0,
  compliancePercentage: 0,
  requiredThresholdPercentage: 90,
  canGenerateFinalReport: false,
})

// Libros de coordinación (Admin)
const activeWorkbookKey = ref<CoordinatorFormatKey>('ReporteSemestralCoordinador')
const activeWorkbook = ref<CoordinatorWorkbook | null>(null)
const isLoadingWorkbook = ref(false)
const isFinalizing = ref(false)

// Modal de importación de Resultados-por-unidad FINAL.xls (Admin)
const isImportModalOpen = ref(false)
const latestImport = ref<UnitResultsImportResponse | null>(null)

// Modal de captura de reprobación (Tutor)
const isCreateFailureOpen = ref(false)
const isCreatingFailure = ref(false)
const failureFormError = ref('')
const newFailure = ref({
  claveMateria: '',
  subjectName: '',
  grupo: '',
  reportingMonth: '3',
  totalStudents: '30',
  failedStudents: '0',
  failedUnits: '',
  preventiveActions: '',
})

// Modal de vista previa de libro de coordinación (PDF / XLSX)
const isPreviewOpen = ref(false)
const previewWorkbookTarget = ref<CoordinatorWorkbook | null>(null)
const previewTabKey = ref<CoordinatorSheetKey | undefined>(undefined)
const previewFormat = ref<PreviewFormat>('pdf')
const previewResult = ref<WorkbookPreviewResult | null>(null)
const isPreviewing = ref(false)
const isExporting = ref(false)
const previewError = ref('')

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

const failureColumns: { key: keyof FailureReportItem & string; label: string }[] = [
  { key: 'claveMateria', label: 'Materia / Grupo' },
  { key: 'docenteName', label: 'Docente' },
  { key: 'reportingMonth', label: 'Mes' },
  { key: 'failedStudents', label: 'Reprobados' },
  { key: 'failurePercentage', label: '% Reprobación' },
  { key: 'riskLevel', label: 'Riesgo' },
]

const kpis = computed(() => {
  const list = failureReports.value
  const total = totalItems.value
  const interventionCount = list.filter((r) => r.requiresIntervention).length
  const criticalCount = list.filter((r) => r.riskLevel === 'Critical').length
  const avgFailure =
    list.length > 0
      ? Number((list.reduce((acc, r) => acc + r.failurePercentage, 0) / list.length).toFixed(1))
      : 0
  return { total, interventionCount, criticalCount, avgFailure }
})

const isFinalReportFinalized = computed(
  () =>
    activeWorkbook.value?.formatKey === 'ReporteSemestralCoordinador' &&
    activeWorkbook.value.status === 'Finalized',
)

async function loadWorkbook(): Promise<void> {
  if (!isAdmin.value) return
  isLoadingWorkbook.value = true
  try {
    activeWorkbook.value = await metricsApi.getCoordinatorWorkbook(
      activeWorkbookKey.value,
      filters.value.periodoId,
    )
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isLoadingWorkbook.value = false
  }
}

async function loadData(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    if (!currentUser.value) {
      currentUser.value = await me()
    }

    const [failuresRes, readinessRes] = await Promise.all([
      metricsApi.getFailureReports(filters.value, page.value, limit.value),
      metricsApi.getReadiness(filters.value.periodoId),
    ])

    failureReports.value = failuresRes.data
    totalItems.value = failuresRes.total
    readiness.value = readinessRes
    latestImport.value = metricsApi.getLatestUnitImport(filters.value.periodoId)

    if (isAdmin.value) {
      await loadWorkbook()
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

watch(activeWorkbookKey, () => {
  void loadWorkbook()
})

function goToPage(nextPage: number): void {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) return
  page.value = nextPage
  void loadData()
}

function handleUnitImportSuccess(result: UnitResultsImportResponse): void {
  latestImport.value = result
  page.value = 1
  successMessage.value = `Insumo "${result.fileName}" procesado: ${result.importedRows} registros integrados (${result.highRiskSubjects} materias en riesgo alto).`
  void loadData()
}

async function handleFinalizeFinalReport(): Promise<void> {
  if (!isAdmin.value || isFinalizing.value) return
  isFinalizing.value = true
  errorMessage.value = ''

  try {
    const finalized = await metricsApi.finalizeFinalReport(filters.value.periodoId)
    if (activeWorkbookKey.value === 'ReporteSemestralCoordinador') {
      activeWorkbook.value = finalized
    }
    successMessage.value = 'Reporte Semestral Final cerrado oficialmente.'
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isFinalizing.value = false
  }
}

async function handleCreateFailure(): Promise<void> {
  if (isCreatingFailure.value) return

  const total = Number(newFailure.value.totalStudents)
  const failed = Number(newFailure.value.failedStudents)
  const monthNum = Number(newFailure.value.reportingMonth)

  if (!newFailure.value.claveMateria.trim() || !newFailure.value.grupo.trim()) {
    failureFormError.value = 'Captura la clave de materia y el grupo.'
    return
  }
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    failureFormError.value = 'El mes evaluado debe ser un entero entre 1 y 12.'
    return
  }
  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(failed) || failed < 0 || failed > total) {
    failureFormError.value = 'Verifica los conteos: reprobados debe estar entre 0 y el total inscritos.'
    return
  }

  isCreatingFailure.value = true
  failureFormError.value = ''

  try {
    await metricsApi.createFailureReport(
      {
        periodoId: filters.value.periodoId,
        claveMateria: newFailure.value.claveMateria,
        subjectName: newFailure.value.subjectName,
        grupo: newFailure.value.grupo,
        reportingMonth: Number(newFailure.value.reportingMonth) || 3,
        totalStudents: total,
        failedStudents: failed,
        failedUnits: newFailure.value.failedUnits,
        preventiveActions: newFailure.value.preventiveActions,
      },
      currentUser.value
        ? { username: currentUser.value.username, name: currentUser.value.name }
        : undefined,
    )
    isCreateFailureOpen.value = false
    newFailure.value = {
      claveMateria: '',
      subjectName: '',
      grupo: '',
      reportingMonth: filters.value.periodoId === 2 ? '9' : '3',
      totalStudents: '30',
      failedStudents: '0',
      failedUnits: '',
      preventiveActions: '',
    }
    successMessage.value = 'Reporte mensual de reprobación registrado correctamente.'
    await loadData()
  } catch (error) {
    failureFormError.value = normalizeApiError(error).message
  } finally {
    isCreatingFailure.value = false
  }
}

async function handlePreviewWorkbook(
  workbook: CoordinatorWorkbook,
  tabKey: CoordinatorSheetKey,
): Promise<void> {
  if (isPreviewing.value) return
  previewWorkbookTarget.value = workbook
  previewTabKey.value = tabKey
  previewResult.value = null
  previewError.value = ''
  isPreviewOpen.value = true
  await fetchWorkbookPreview()
}

async function fetchWorkbookPreview(): Promise<void> {
  if (!previewWorkbookTarget.value || isPreviewing.value) return
  isPreviewing.value = true
  previewError.value = ''

  try {
    previewResult.value = await metricsApi.previewWorkbook(
      previewWorkbookTarget.value.id,
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
  await fetchWorkbookPreview()
}

async function handleExportWorkbook(
  workbook: CoordinatorWorkbook,
  tabKey?: CoordinatorSheetKey,
): Promise<void> {
  if (isExporting.value) return
  isExporting.value = true
  errorMessage.value = ''
  previewError.value = ''

  try {
    const blob = await metricsApi.exportWorkbook(workbook.id, tabKey)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = workbook.templateFileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    successMessage.value = `Libro exportado desde plantilla oficial (${workbook.templateFileName}).`
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

const router = useRouter()

function openMatrizControlView(): void {
  void router.push({
    name: 'metrics-matriz-control',
    params: { periodoId: String(filters.value.periodoId) },
  })
}

function openReporteSemestralView(): void {
  void router.push({
    name: 'metrics-reporte-semestral',
    params: { periodoId: String(filters.value.periodoId) },
  })
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <UiBasePage
    fluid
    :title="isAdmin ? 'Métricas, Alertas y Reporte Semestral Final' : 'Métricas e Índices de Reprobación'"
    :description="
      isAdmin
        ? 'Consolidación de coordinación, seguimiento de índices de reprobación por unidad (I–VIII) y cierre al alcanzar el 90% (9 de 10).'
        : 'Captura de índices de reprobación por unidad/materia y seguimiento de alertas tempranas directamente en el sistema.'
    "
  >
    <template #actions>
      <div class="header-actions">
        <UiButton v-if="!isAdmin" variant="primary" @click="isCreateFailureOpen = true">
          + Capturar Reprobación
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

    <!-- Bloque 1: Umbral del 90% (9 de 10 entregas) -->
    <div class="metrics-block">
      <ReadinessThresholdBanner
        :readiness="readiness"
        :is-admin="isAdmin"
        :is-finalizing="isFinalizing"
        :is-already-finalized="isFinalReportFinalized"
        @finalize="handleFinalizeFinalReport"
      />
    </div>

    <!-- Bloque 2: Libros de Coordinación (solo Admin) -->
    <div v-if="isAdmin" class="metrics-block">
      <UiCard
        title="Libros Oficiales de Coordinación"
        description="Abre las vistas dedicadas por formato (mapeo exacto de hojas .xlsx, vista previa y exportación)."
      >
        <div class="workbook-switcher">
          <UiButton variant="primary" class="btn-sm" @click="openReporteSemestralView">
            Reporte Semestral del Coordinador (2 hojas) →
          </UiButton>
          <UiButton variant="secondary" class="btn-sm" @click="openMatrizControlView">
            Matriz de Control de Coordinación (4 hojas) →
          </UiButton>
        </div>
      </UiCard>
    </div>

    <!-- Bloque 3: Seguimiento de índices de reprobación por unidad (I a VIII, sin subir archivos) -->
    <div class="metrics-block">
      <UnitFailureTrackingPanel :periodo-id="filters.periodoId" />
    </div>

    <!-- Bloque 4: Filtros de Reprobación -->
    <div class="metrics-block">
      <MetricsFiltersBar v-model="filters" />
    </div>

    <!-- Bloque 4: Tarjetas KPI -->
    <div class="metrics-block">
      <div class="kpi-grid">
        <UiCard metric class="kpi-card primary">
          <UiMetric label="Reportes registrados" :value="kpis.total" description="Grupos evaluados en el periodo" />
        </UiCard>
        <UiCard metric class="kpi-card warning">
          <UiMetric label="Intervención urgente (>30%)" :value="kpis.interventionCount" description="Alertas tempranas activas" />
        </UiCard>
        <UiCard metric class="kpi-card danger">
          <UiMetric label="Riesgo crítico (>=45%)" :value="kpis.criticalCount" description="Materias prioritarias" />
        </UiCard>
        <UiCard metric class="kpi-card info">
          <UiMetric label="Promedio reprobación" :value="`${kpis.avgFailure}%`" description="Índice medio de la página actual" />
        </UiCard>
      </div>
    </div>

    <!-- Bloque 5: Tabla Paginada de Reprobación -->
    <div class="metrics-block">
      <UiCard
        title="Alertas de Reprobación por Materia y Grupo"
        :description="
          latestImport
            ? `Último insumo integrado: ${latestImport.fileName} (${latestImport.importedRows} registros · ${latestImport.highRiskSubjects} en riesgo alto)`
            : 'Seguimiento mensual de índices de reprobación y acciones preventivas'
        "
        :aria-busy="isLoading"
      >
        <UiAlert v-if="isLoading" tone="info" title="Cargando métricas de reprobación..." />
        <UiAlert v-else-if="failureReports.length === 0" tone="info" title="Sin registros">
          <UiText>No hay reportes de reprobación con los filtros seleccionados.</UiText>
        </UiAlert>
        <UiTable
          v-else
          label="Tabla de alertas de reprobación"
          :columns="failureColumns"
          :rows="failureReports"
        >
          <template #cell-claveMateria="{ row }">
            <div class="subject-cell">
              <strong>{{ row.subjectName || row.claveMateria }}</strong>
              <span class="sub-meta">{{ row.claveMateria }} · Grupo {{ row.grupo }}</span>
            </div>
          </template>

          <template #cell-docenteName="{ row }">
            <span>{{ row.docenteName || row.docenteClave }}</span>
          </template>

          <template #cell-reportingMonth="{ row }">
            <span>{{ monthNames[row.reportingMonth] || `Mes ${row.reportingMonth}` }}</span>
          </template>

          <template #cell-failedStudents="{ row }">
            <span>{{ row.failedStudents }} / {{ row.totalStudents }}</span>
          </template>

          <template #cell-failurePercentage="{ row }">
            <div class="pct-cell">
              <strong>{{ row.failurePercentage }}%</strong>
              <UiBadge v-if="row.requiresIntervention" tone="danger">Intervención</UiBadge>
            </div>
          </template>

          <template #cell-riskLevel="{ row }">
            <FailureRiskBadge :risk-level="row.riskLevel" />
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

    <!-- Modal: Captura Mensual de Reprobación (Tutor) -->
    <UiDialog v-model="isCreateFailureOpen" title="Capturar Reporte de Reprobación" class="capture-dialog">
      <form class="dialog-body" @submit.prevent="handleCreateFailure">
        <UiAlert v-if="failureFormError" tone="danger" title="Validación">
          <UiText>{{ failureFormError }}</UiText>
        </UiAlert>

        <div class="form-row">
          <UiField v-model="newFailure.claveMateria" label="Clave de materia *" placeholder="Ej. ACF-0901" required />
          <UiField v-model="newFailure.subjectName" label="Nombre de materia" placeholder="Ej. Cálculo Diferencial" />
        </div>

        <div class="form-row">
          <UiField v-model="newFailure.grupo" label="Grupo *" placeholder="Ej. 1A" required />
          <UiField v-model="newFailure.reportingMonth" label="Mes evaluado (1-12) *" type="number" min="1" max="12" required />
        </div>

        <div class="form-row">
          <UiField v-model="newFailure.totalStudents" label="Total inscritos *" type="number" min="1" required />
          <UiField v-model="newFailure.failedStudents" label="Total reprobados *" type="number" min="0" required />
        </div>

        <UiField v-model="newFailure.failedUnits" label="Unidades reprobadas" placeholder="Ej. I, II, III" />
        <UiField v-model="newFailure.preventiveActions" label="Acciones preventivas" placeholder="Asesorías, canalización a tutorías..." />

        <div class="dialog-actions">
          <UiButton variant="secondary" :disabled="isCreatingFailure" @click="isCreateFailureOpen = false">
            Cancelar
          </UiButton>
          <UiButton variant="primary" type="submit" :loading="isCreatingFailure">
            Guardar reporte
          </UiButton>
        </div>
      </form>
    </UiDialog>

    <!-- Modal: Vista Previa de Libro de Coordinación -->
    <UiDialog
      v-model="isPreviewOpen"
      :title="previewWorkbookTarget ? `Vista previa: ${previewWorkbookTarget.title}` : 'Vista previa'"
      class="preview-dialog"
    >
      <div v-if="previewWorkbookTarget" class="dialog-body">
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
            @click="handleExportWorkbook(previewWorkbookTarget, previewTabKey)"
          >
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
          title="Vista previa del libro de coordinación"
        />
        <pre v-else class="payload-preview">{{ JSON.stringify(previewWorkbookTarget.tabs.find((t) => t.tabKey === previewTabKey) ?? previewWorkbookTarget, null, 2) }}</pre>

        <div class="dialog-actions">
          <UiButton variant="secondary" @click="isPreviewOpen = false">Cerrar</UiButton>
        </div>
      </div>
    </UiDialog>
  </UiBasePage>
</template>

<style scoped>
.metrics-block {
  margin-bottom: 1.25rem;
}

.metrics-block:last-child {
  margin-bottom: 0;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
}

.workbook-switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 1.25rem;
}

.kpi-card {
  border-top: 4px solid var(--color-border);
}

.kpi-card.primary { border-top-color: var(--color-primary, #1b396a); }
.kpi-card.warning { border-top-color: var(--color-warning, #f59e0b); }
.kpi-card.danger { border-top-color: var(--color-danger, #ef4444); }
.kpi-card.info { border-top-color: var(--color-info, #3b82f6); }

.subject-cell {
  display: flex;
  flex-direction: column;
}

.sub-meta {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
}

.pct-cell {
  display: flex;
  align-items: center;
  gap: 0.4rem;
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

.pagination-actions,
.format-switch,
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.capture-dialog { max-width: 580px; }
.preview-dialog { max-width: 760px; }

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.875rem;
}

.capture-dialog :deep(input[type='number']) {
  appearance: textfield;
  -moz-appearance: textfield;
  font-variant-numeric: tabular-nums;
}

.capture-dialog :deep(input[type='number']::-webkit-inner-spin-button),
.capture-dialog :deep(input[type='number']::-webkit-outer-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

.preview-frame {
  width: 100%;
  height: 440px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
}

.payload-preview {
  margin: 0;
  padding: 0.75rem;
  max-height: 300px;
  overflow: auto;
  font-size: 0.78rem;
  background-color: var(--color-bg-light, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
}

.btn-sm {
  padding: 0.3rem 0.7rem;
  font-size: 0.8125rem;
}
</style>
