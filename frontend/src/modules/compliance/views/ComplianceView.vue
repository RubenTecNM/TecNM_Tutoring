<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  UiAlert,
  UiBasePage,
  UiButton,
  UiCard,
  UiDialog,
  UiField,
  UiLayout,
  UiTable,
  UiText,
} from '../../../shared/components'
import { me } from '../../auth/api/authApi'
import type { UserResponse } from '../../auth/types/auth'
import { complianceApi } from '../api/complianceApi'
import {
  ComplianceFiltersBar,
  ComplianceKpiCards,
  DeliverableStatusBadge,
} from '../components'
import type {
  ComplianceFilters,
  Deliverable,
  DocenteComplianceSummary,
} from '../types/compliance'

interface DeliverableRow extends Deliverable {
  actions?: string
}

interface SummaryRow extends DocenteComplianceSummary {
  id: string
  actions?: string
}

const currentUser = ref<UserResponse | null>(null)
const isAdmin = computed(() => currentUser.value?.role === 'Admin')

const isLoading = ref(true)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Filtros compartidos
const filters = ref<ComplianceFilters>({
  periodoId: 1,
  month: undefined,
  status: undefined,
  reportType: undefined,
})

// Estado de datos
const deliverables = ref<Deliverable[]>([])
const docenteSummaries = ref<DocenteComplianceSummary[]>([])

// Modal de subida (Docente)
const isUploadModalOpen = ref(false)
const selectedDeliverable = ref<Deliverable | null>(null)
const selectedFile = ref<File | null>(null)
const fileError = ref('')

// Modal de detalle por docente (Admin)
const isDocenteDetailModalOpen = ref(false)
const selectedDocenteSummary = ref<DocenteComplianceSummary | null>(null)
const docenteModalDeliverables = ref<Deliverable[]>([])
const isLoadingDocenteModal = ref(false)

// Configuración de columnas de tablas
const docenteColumns: { key: keyof DeliverableRow & string; label: string }[] = [
  { key: 'reportType', label: 'Tipo de Formato' },
  { key: 'reportingMonth', label: 'Mes' },
  { key: 'status', label: 'Estado' },
  { key: 'delayDays', label: 'Días de Mora' },
  { key: 'actions', label: 'Acción' },
]

const adminColumns: { key: keyof SummaryRow & string; label: string }[] = [
  { key: 'docenteClave', label: 'Clave' },
  { key: 'docenteName', label: 'Docente Tutor' },
  { key: 'totalDeliverables', label: 'Total' },
  { key: 'onTime', label: 'En Tiempo' },
  { key: 'late', label: 'Con Retraso' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'totalDelayDays', label: 'Días Mora' },
  { key: 'actions', label: 'Acciones' },
]

// Mapeos y formatos legibles
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

const reportTypeLabels: Record<string, string> = {
  PlanTrabajo: 'Plan de Trabajo Tutorial',
  DiagnosticoInicial: 'Diagnóstico Inicial de Grupo',
  Anexo14: 'Anexo 14 (Primer Seguimiento)',
  Anexo15: 'Anexo 15 (Segundo Seguimiento)',
  Anexo19AMensual: 'Anexo 19-A (Reporte Mensual)',
  Asistencia: 'Lista de Asistencia Grupal',
  Anexo19Final: 'Anexo 19 (Reporte Final Semestral)',
}

// Filtros y KPIs reactivos
const filteredDeliverables = computed<DeliverableRow[]>(() => {
  return deliverables.value
    .filter((d) => {
      if (filters.value.month && d.reportingMonth !== filters.value.month) {
        return false
      }
      if (filters.value.status && d.status !== filters.value.status) {
        return false
      }
      if (filters.value.reportType && d.reportType !== filters.value.reportType) {
        return false
      }
      return true
    })
    .map((d) => ({ ...d, actions: '' }))
})

const filteredSummaries = computed<SummaryRow[]>(() => {
  return docenteSummaries.value
    .filter((s) => {
      if (filters.value.status === 'OnTime' && s.late > 0) return false
      if (filters.value.status === 'Late' && s.late === 0) return false
      if (filters.value.status === 'Pending' && s.pending === 0) return false
      return true
    })
    .map((s) => ({
      ...s,
      id: s.docenteClave,
      actions: '',
    }))
})

// Métricas agregadas
const docenteKpis = computed(() => {
  const onTime = deliverables.value.filter((d) => d.status === 'OnTime').length
  const late = deliverables.value.filter((d) => d.status === 'Late').length
  const pending = deliverables.value.filter((d) => d.status === 'Pending').length
  const delayDays = deliverables.value.reduce((acc, curr) => acc + (curr.delayDays || 0), 0)
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

// Métodos de carga
async function loadData(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    if (!currentUser.value) {
      currentUser.value = await me()
    }

    if (isAdmin.value) {
      docenteSummaries.value = await complianceApi.getDocenteSummaries(filters.value.periodoId)
    } else {
      const clave = currentUser.value?.username || 'D0001'
      deliverables.value = await complianceApi.getDeliverablesByDocente(clave, filters.value.periodoId)
    }
  } catch (error) {
    errorMessage.value = 'No fue posible sincronizar los datos de cumplimiento.'
  } finally {
    isLoading.value = false
  }
}

watch(
  () => filters.value.periodoId,
  () => {
    void loadData()
  },
)

// Manejo de Modal de Subida (Docente)
function openUploadModal(deliverable: Deliverable): void {
  selectedDeliverable.value = deliverable
  selectedFile.value = null
  fileError.value = ''
  isUploadModalOpen.value = true
}

function closeUploadModal(): void {
  isUploadModalOpen.value = false
  selectedDeliverable.value = null
  selectedFile.value = null
  fileError.value = ''
}

function handleFileSelection(event: Event): void {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return

  const file = target.files[0]
  const validExtensions = ['.pdf', '.doc', '.docx']
  const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

  if (!validExtensions.includes(fileExt)) {
    fileError.value = 'Formato no válido. Solo se admiten archivos PDF (.pdf) y Word (.doc, .docx).'
    selectedFile.value = null
    return
  }

  // Límite institucional: 15MB
  if (file.size > 15 * 1024 * 1024) {
    fileError.value = 'El archivo supera el tamaño máximo permitido de 15 MB.'
    selectedFile.value = null
    return
  }

  fileError.value = ''
  selectedFile.value = file
}

async function submitFileUpload(): Promise<void> {
  if (!selectedDeliverable.value || !selectedFile.value || isSubmitting.value) return

  isSubmitting.value = true
  errorMessage.value = ''
  fileError.value = ''

  try {
    await complianceApi.uploadDeliverable(selectedDeliverable.value.id, selectedFile.value)
    successMessage.value = `El formato "${reportTypeLabels[selectedDeliverable.value.reportType] || selectedDeliverable.value.reportType}" ha sido entregado correctamente.`
    closeUploadModal()
    await loadData()
  } catch (error) {
    fileError.value = 'Ocurrió un error al cargar el archivo. Intenta nuevamente.'
  } finally {
    isSubmitting.value = false
  }
}

// Manejo de Modal de Detalle por Docente (Admin)
async function openDocenteDetail(summary: DocenteComplianceSummary): Promise<void> {
  selectedDocenteSummary.value = summary
  isDocenteDetailModalOpen.value = true
  isLoadingDocenteModal.value = true

  try {
    docenteModalDeliverables.value = await complianceApi.getDeliverablesByDocente(
      summary.docenteClave,
      filters.value.periodoId,
    )
  } catch {
    docenteModalDeliverables.value = []
  } finally {
    isLoadingDocenteModal.value = false
  }
}

function closeDocenteDetail(): void {
  isDocenteDetailModalOpen.value = false
  selectedDocenteSummary.value = null
  docenteModalDeliverables.value = []
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <UiBasePage
    fluid
    :title="isAdmin ? 'Supervisión de Cumplimiento Institucional' : 'Mis Entregables de Tutoría'"
    :description="
      isAdmin
        ? 'Padrón institucional de los 54 docentes tutores y auditoría de mora de formatos.'
        : 'Entrega obligatoria de los 7 anexos y formatos del periodo tutorial activo.'
    "
  >
    <!-- Alertas globales -->
    <UiAlert v-if="successMessage" tone="success" title="Operación exitosa" dismissible @dismiss="successMessage = ''">
      <UiText>{{ successMessage }}</UiText>
    </UiAlert>

    <UiAlert v-if="errorMessage" tone="danger" title="Aviso">
      <UiText>{{ errorMessage }}</UiText>
    </UiAlert>

    <!-- Barra de Filtros -->
    <ComplianceFiltersBar v-model="filters" />

    <!-- Tarjetas de Métricas Institucionales -->
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

    <!-- ========================================== -->
    <!-- VISTA DOCENTE / TUTOR                      -->
    <!-- ========================================== -->
    <UiCard
      v-if="!isAdmin"
      title="Formatos y Anexos Requeridos"
      description="Listado normativo de los 7 entregables semestrales para el periodo seleccionado"
      :aria-busy="isLoading"
    >
      <UiAlert v-if="isLoading" tone="info" title="Sincronizando formatos..." />
      <UiTable
        v-else
        label="Tabla de entregables del docente"
        :columns="docenteColumns"
        :rows="filteredDeliverables"
      >
        <template #cell-reportType="{ row }">
          <div class="format-cell">
            <span class="format-title">{{ reportTypeLabels[row.reportType] || row.reportType }}</span>
            <span class="format-code">{{ row.reportType }}</span>
          </div>
        </template>

        <template #cell-reportingMonth="{ row }">
          <span>{{ monthNames[row.reportingMonth] || `Mes ${row.reportingMonth}` }}</span>
        </template>

        <template #cell-status="{ row }">
          <DeliverableStatusBadge :status="row.status" />
        </template>

        <template #cell-delayDays="{ row }">
          <span :class="{ 'mora-badge': row.delayDays > 0 }">
            {{ row.delayDays > 0 ? `${row.delayDays} días` : '0 días' }}
          </span>
        </template>

        <template #cell-actions="{ row }">
          <UiButton
            v-if="row.status === 'Pending'"
            variant="primary"
            class="btn-sm"
            @click="openUploadModal(row)"
          >
            Subir archivo
          </UiButton>
          <span v-else class="text-delivered">Entregado</span>
        </template>
      </UiTable>
    </UiCard>

    <!-- ========================================== -->
    <!-- VISTA COORDINADOR / ADMIN                  -->
    <!-- ========================================== -->
    <UiCard
      v-else
      title="Padrón General de Docentes Tutores"
      description="Auditoría semestral consolidada de 54 docentes: mora acumulada y estatus de entrega"
      :aria-busy="isLoading"
    >
      <UiAlert v-if="isLoading" tone="info" title="Cargando padrón docente..." />
      <UiTable
        v-else
        label="Padrón consolidado de tutores"
        :columns="adminColumns"
        :rows="filteredSummaries"
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
          <span :class="['mora-counter', { 'mora-alert': row.totalDelayDays > 0 }]">
            {{ row.totalDelayDays > 0 ? `${row.totalDelayDays} días` : 'Sin mora' }}
          </span>
        </template>

        <template #cell-actions="{ row }">
          <UiButton variant="secondary" class="btn-sm" @click="openDocenteDetail(row)">
            Ver detalle
          </UiButton>
        </template>
      </UiTable>
    </UiCard>

    <!-- ========================================== -->
    <!-- DIÁLOGO: SUBIR FORMATO (DOCENTE)           -->
    <!-- ========================================== -->
    <UiDialog
      v-model="isUploadModalOpen"
      title="Subir Formato de Tutoría"
      class="upload-dialog"
    >
      <div v-if="selectedDeliverable" class="dialog-body">
        <div class="dialog-field-info">
          <span class="field-label">Formato requerido:</span>
          <strong>{{ reportTypeLabels[selectedDeliverable.reportType] || selectedDeliverable.reportType }}</strong>
        </div>

        <div class="dialog-field-info">
          <span class="field-label">Mes lectivo correspondiente:</span>
          <span>{{ monthNames[selectedDeliverable.reportingMonth] || `Mes ${selectedDeliverable.reportingMonth}` }}</span>
        </div>

        <UiAlert v-if="fileError" tone="danger" title="Error en archivo">
          <UiText>{{ fileError }}</UiText>
        </UiAlert>

        <div class="drop-area">
          <input
            id="file-upload-input"
            type="file"
            accept=".pdf,.doc,.docx"
            class="sr-only"
            @change="handleFileSelection"
          >
          <label for="file-upload-input" class="drop-zone-label">
            <svg class="upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span class="upload-text">Haz clic para seleccionar o arrastra el archivo aquí</span>
            <span class="upload-hint">Formatos válidos: PDF, DOC o DOCX (Máx. 15 MB)</span>
          </label>
        </div>

        <div v-if="selectedFile" class="selected-file-card">
          <span class="file-name">{{ selectedFile.name }}</span>
          <span class="file-size">({{ (selectedFile.size / 1024).toFixed(1) }} KB)</span>
        </div>

        <div class="dialog-actions">
          <UiButton variant="secondary" :disabled="isSubmitting" @click="closeUploadModal">
            Cancelar
          </UiButton>
          <UiButton
            variant="primary"
            :disabled="!selectedFile || isSubmitting"
            @click="submitFileUpload"
          >
            {{ isSubmitting ? 'Enviando archivo...' : 'Confirmar y Entregar' }}
          </UiButton>
        </div>
      </div>
    </UiDialog>

    <!-- ========================================== -->
    <!-- DIÁLOGO: DETALLE POR DOCENTE (ADMIN)       -->
    <!-- ========================================== -->
    <UiDialog
      v-model="isDocenteDetailModalOpen"
      :title="selectedDocenteSummary ? `Detalle: ${selectedDocenteSummary.docenteName}` : 'Detalle del Docente'"
      class="detail-dialog"
    >
      <div v-if="selectedDocenteSummary" class="dialog-body">
        <div class="dialog-summary-bar">
          <div><strong>Clave:</strong> {{ selectedDocenteSummary.docenteClave }}</div>
          <div><strong>Mora acumulada:</strong> {{ selectedDocenteSummary.totalDelayDays }} días</div>
        </div>

        <UiAlert v-if="isLoadingDocenteModal" tone="info" title="Consultando entregables del docente..." />
        <UiTable
          v-else
          label="Detalle de entregables del docente"
          :columns="[
            { key: 'reportType', label: 'Formato' },
            { key: 'reportingMonth', label: 'Mes' },
            { key: 'status', label: 'Estado' },
            { key: 'delayDays', label: 'Días Mora' },
          ]"
          :rows="docenteModalDeliverables"
        >
          <template #cell-reportType="{ row }">
            <span>{{ reportTypeLabels[row.reportType] || row.reportType }}</span>
          </template>
          <template #cell-reportingMonth="{ row }">
            <span>{{ monthNames[row.reportingMonth] || `Mes ${row.reportingMonth}` }}</span>
          </template>
          <template #cell-status="{ row }">
            <DeliverableStatusBadge :status="row.status" />
          </template>
          <template #cell-delayDays="{ row }">
            <span :class="{ 'mora-badge': row.delayDays > 0 }">
              {{ row.delayDays > 0 ? `${row.delayDays} días` : '0 días' }}
            </span>
          </template>
        </UiTable>

        <div class="dialog-actions">
          <UiButton variant="primary" @click="closeDocenteDetail">
            Cerrar
          </UiButton>
        </div>
      </div>
    </UiDialog>
  </UiBasePage>
</template>

<style scoped>
.format-cell {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.format-title {
  font-weight: 500;
  color: var(--color-text-primary, #0f172a);
}

.format-code {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
}

.docente-clave {
  font-family: monospace;
  font-weight: 600;
  background-color: #f1f5f9;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.docente-name {
  font-weight: 500;
  color: var(--color-text-primary, #0f172a);
}

.text-ontime {
  color: var(--color-success, #15803d);
  font-weight: 600;
}

.text-late {
  color: var(--color-danger, #b91c1c);
  font-weight: 600;
}

.text-pending {
  color: var(--color-warning, #b45309);
  font-weight: 600;
}

.mora-badge {
  color: var(--color-danger, #b91c1c);
  font-weight: 600;
}

.mora-counter {
  font-weight: 500;
  color: var(--color-text-secondary, #64748b);
}

.mora-alert {
  color: var(--color-danger, #b91c1c);
  font-weight: 600;
}

.text-delivered {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-success, #15803d);
}

.btn-sm {
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
}

/* Estilos de Diálogos */
.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 320px;
  max-width: 580px;
}

.dialog-field-info {
  display: flex;
  justify-content: space-between;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  font-size: 0.875rem;
}

.field-label {
  color: var(--color-text-secondary, #64748b);
}

.dialog-summary-bar {
  display: flex;
  justify-content: space-between;
  background-color: #f8fafc;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
}

.drop-area {
  border: 2px dashed var(--color-border, #cbd5e1);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  background-color: #f8fafc;
  transition: border-color 0.15s ease-in-out;
}

.drop-area:hover {
  border-color: var(--color-primary, #1b396a);
}

.drop-zone-label {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.upload-icon {
  width: 2.25rem;
  height: 2.25rem;
  color: var(--color-primary, #1b396a);
}

.upload-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-primary, #1b396a);
}

.upload-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
}

.selected-file-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background-color: #f1f5f9;
  border-radius: 6px;
  font-size: 0.875rem;
}

.file-name {
  font-weight: 500;
  color: var(--color-text-primary, #0f172a);
}

.file-size {
  color: var(--color-text-secondary, #64748b);
  font-size: 0.75rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
