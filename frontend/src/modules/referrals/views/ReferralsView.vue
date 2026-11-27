<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  UiAlert,
  UiBasePage,
  UiButton,
  UiCard,
  UiDialog,
  UiField,
  UiTable,
  UiText,
} from '../../../shared/components'
import { me } from '../../auth/api/authApi'
import { getCurrentAcademicPeriod } from '../../../shared/utils/academicPeriod'
import type { UserResponse } from '../../auth/types/auth'
import { referralsApi, resolveTutorClave } from '../api/referralsApi'
import {
  CreateReferralModal,
  ReferralFiltersBar,
  ReferralKpiCards,
  ReferralStatusBadge,
  ReferralSupportAreaBadge,
} from '../components'
import { isNewReferral, useReferralNotifications } from '../composables/useReferralNotifications'
import type {
  CreateReferralRequest,
  Referral,
  ReferralFilters,
  ReferralKpiBucket,
  ReferralStatus,
  UpdateReferralRequest,
} from '../types/referrals'

interface ReferralRow extends Referral {
  actions?: string
}

const currentUser = ref<UserResponse | null>(null)
const isAdmin = computed(() => currentUser.value?.role === 'Admin')

const { refreshUnreadCount } = useReferralNotifications()

const isLoading = ref(true)
const isSavingReferral = ref(false)
const isUpdatingStatus = ref(false)
const isCancelling = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Modal de creación / edición (Tutor)
const isCreateModalOpen = ref(false)
const editingReferral = ref<Referral | null>(null)

// Modal de confirmación de cancelación (Tutor)
const isCancelModalOpen = ref(false)
const referralToCancel = ref<Referral | null>(null)

// Modal de detalle / gestión (Coordinación y Tutor)
const isDetailModalOpen = ref(false)
const selectedReferral = ref<Referral | null>(null)
const editStatus = ref<ReferralStatus>('Read')
const editCoordinatorNotes = ref('')

const filters = ref<ReferralFilters>({
  periodoId: getCurrentAcademicPeriod().id,
  supportArea: undefined,
  referralReason: undefined,
  status: undefined,
  kpiBucket: 'all',
  search: undefined,
})

const allReferrals = ref<Referral[]>([])

const reasonLabels: Record<string, string> = {
  Academic: 'Académico',
  Emotional: 'Emocional',
  Personal: 'Personal',
  Discipline: 'Indisciplina',
  Health: 'Salud',
  Socioeconomic: 'Socioeconómico',
}

const statusEditOptions: { value: ReferralStatus; label: string }[] = [
  { value: 'Sent', label: 'Enviado' },
  { value: 'Received', label: 'Recibido' },
  { value: 'Read', label: 'Leído' },
  { value: 'Unread', label: 'Sin leer' },
  { value: 'Unattended', label: 'Sin atender' },
  { value: 'Attended', label: 'Atendido' },
]

const columns = computed<{ key: keyof ReferralRow & string; label: string }[]>(() => {
  const base: { key: keyof ReferralRow & string; label: string }[] = [
    { key: 'matricula', label: 'Alumno / Carrera' },
    { key: 'supportArea', label: 'Área' },
    { key: 'referralReason', label: 'Motivo' },
    { key: 'detectionSource', label: 'Detectado por' },
  ]
  if (isAdmin.value) {
    base.push({ key: 'tutorName', label: 'Enviado por Tutor' })
  }
  base.push(
    { key: 'status', label: 'Estatus' },
    { key: 'createdAt', label: 'Fecha de Envío' },
    { key: 'actions', label: 'Acciones' },
  )
  return base
})

// Base de registros según rol (Tutor ve estrictamente solo sus envíos; Coordinadora ve todos)
const roleScopedReferrals = computed<Referral[]>(() => {
  if (isAdmin.value) {
    return allReferrals.value
  }
  const myClave = resolveTutorClave(currentUser.value?.username)
  if (!myClave) return []
  return allReferrals.value.filter((r) => resolveTutorClave(r.tutorClave) === myClave)
})

function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// Base filtrada por criterios de barra (antes de aplicar KPI bucket, para mantener contadores estables)
const baseFilteredReferrals = computed<Referral[]>(() => {
  return roleScopedReferrals.value.filter((item) => {
    if (filters.value.supportArea && item.supportArea !== filters.value.supportArea) {
      return false
    }
    if (filters.value.referralReason && item.referralReason !== filters.value.referralReason) {
      return false
    }
    if (filters.value.status && item.status !== filters.value.status) {
      return false
    }
    if (filters.value.search) {
      const query = normalizeSearch(filters.value.search)
      if (!query) return true
      const matchMatricula = normalizeSearch(item.matricula).includes(query)
      const matchName = normalizeSearch(item.studentName).includes(query)
      const matchCareer = normalizeSearch(item.studentCareer).includes(query)
      const matchTutorName =
        isAdmin.value && normalizeSearch(item.tutorName ?? '').includes(query)
      const matchTutorClave = isAdmin.value && normalizeSearch(item.tutorClave).includes(query)
      if (!matchMatricula && !matchName && !matchCareer && !matchTutorName && !matchTutorClave) {
        return false
      }
    }
    return true
  })
})

// Filtros reactivos + KPI bucket + ordenamiento de fecha más reciente a más antigua
const filteredReferrals = computed<ReferralRow[]>(() => {
  const bucket = filters.value.kpiBucket ?? 'all'
  return baseFilteredReferrals.value
    .filter((item) => {
      if (bucket === 'unread') return isNewReferral(item)
      if (bucket === 'pending') {
        return item.status === 'Received' || item.status === 'Read' || item.status === 'Unattended'
      }
      if (bucket === 'attended') return item.status === 'Attended'
      return true
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((item) => ({ ...item, actions: '' }))
})

// Métricas KPI reactivas (sobre los filtros base)
const kpis = computed(() => {
  const list = baseFilteredReferrals.value
  const total = list.length
  const unread = list.filter(isNewReferral).length
  const attended = list.filter((r) => r.status === 'Attended').length
  const pending = list.filter(
    (r) => r.status === 'Received' || r.status === 'Read' || r.status === 'Unattended',
  ).length
  return { total, unread, pending, attended }
})

function handleKpiSelect(bucket: ReferralKpiBucket): void {
  filters.value = {
    ...filters.value,
    status: undefined,
    kpiBucket: bucket,
  }
}

function canTutorModify(referral: Referral): boolean {
  return !isAdmin.value && isNewReferral(referral)
}

async function loadReferrals(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    if (!currentUser.value) {
      currentUser.value = await me()
    }
    const tutorClave = isAdmin.value
      ? undefined
      : resolveTutorClave(currentUser.value?.username)

    allReferrals.value = await referralsApi.getReferrals({
      periodoId: filters.value.periodoId,
      tutorClave,
    })
    if (isAdmin.value) {
      await refreshUnreadCount()
    }
  } catch {
    errorMessage.value = 'No fue posible sincronizar el listado de canalizaciones.'
  } finally {
    isLoading.value = false
  }
}

watch(
  () => filters.value.periodoId,
  () => {
    void loadReferrals()
  },
)

function openNewReferralModal(): void {
  editingReferral.value = null
  isCreateModalOpen.value = true
}

function openEditReferralModal(referral: Referral): void {
  editingReferral.value = referral
  isCreateModalOpen.value = true
}

async function handleCreateReferral(payload: CreateReferralRequest): Promise<void> {
  if (isSavingReferral.value) return

  isSavingReferral.value = true
  errorMessage.value = ''

  try {
    const newReferral = await referralsApi.createReferral(
      payload,
      currentUser.value
        ? { username: currentUser.value.username, name: currentUser.value.name }
        : undefined,
    )
    allReferrals.value.unshift(newReferral)
    if (isAdmin.value) {
      await refreshUnreadCount()
    }
    isCreateModalOpen.value = false
    successMessage.value = `Canalización enviada a coordinación para ${newReferral.studentName} (${newReferral.matricula}).`
  } catch {
    errorMessage.value = 'Error al registrar la canalización.'
  } finally {
    isSavingReferral.value = false
  }
}

async function handleUpdateReferral(
  referralId: string,
  payload: UpdateReferralRequest,
): Promise<void> {
  if (isSavingReferral.value) return

  isSavingReferral.value = true
  errorMessage.value = ''

  try {
    const updated = await referralsApi.updateReferral(referralId, payload)
    if (updated) {
      const idx = allReferrals.value.findIndex((r) => r.id === referralId)
      if (idx !== -1) {
        allReferrals.value[idx] = updated
      }
    }
    isCreateModalOpen.value = false
    editingReferral.value = null
    successMessage.value = 'La canalización fue actualizada correctamente.'
  } catch {
    errorMessage.value = 'No fue posible actualizar la canalización.'
  } finally {
    isSavingReferral.value = false
  }
}

function openCancelConfirm(referral: Referral): void {
  referralToCancel.value = referral
  isCancelModalOpen.value = true
}

async function confirmCancelReferral(): Promise<void> {
  if (!referralToCancel.value || isCancelling.value) return

  isCancelling.value = true
  errorMessage.value = ''

  try {
    const idToCancel = referralToCancel.value.id
    await referralsApi.cancelReferral(idToCancel)
    allReferrals.value = allReferrals.value.filter((r) => r.id !== idToCancel)
    isCancelModalOpen.value = false
    referralToCancel.value = null
    successMessage.value = 'La canalización fue cancelada correctamente.'
  } catch {
    errorMessage.value = 'No fue posible cancelar la canalización.'
  } finally {
    isCancelling.value = false
  }
}

async function openDetailModal(referral: Referral): Promise<void> {
  selectedReferral.value = referral
  editStatus.value = referral.status
  editCoordinatorNotes.value = referral.coordinatorNotes ?? ''
  isDetailModalOpen.value = true

  // Lectura automática al abrir un reporte nuevo en Coordinación
  if (isAdmin.value && isNewReferral(referral)) {
    try {
      await referralsApi.updateReferralStatus(referral.id, {
        status: 'Read',
        coordinatorNotes: referral.coordinatorNotes,
      })
      const target = allReferrals.value.find((r) => r.id === referral.id)
      if (target) {
        target.status = 'Read'
        target.updatedAt = new Date().toISOString()
      }
      if (selectedReferral.value?.id === referral.id) {
        selectedReferral.value = {
          ...selectedReferral.value,
          status: 'Read',
          updatedAt: target?.updatedAt,
        }
        editStatus.value = 'Read'
      }
      await refreshUnreadCount()
    } catch {
      // Si falla el marcado silencioso, se permite actualizar manualmente
    }
  }
}

function closeDetailModal(): void {
  isDetailModalOpen.value = false
  selectedReferral.value = null
  editCoordinatorNotes.value = ''
}

async function handleUpdateStatus(): Promise<void> {
  if (!selectedReferral.value || isUpdatingStatus.value || !isAdmin.value) return

  isUpdatingStatus.value = true
  errorMessage.value = ''

  try {
    const updatedNotes = editCoordinatorNotes.value.trim() || undefined
    await referralsApi.updateReferralStatus(selectedReferral.value.id, {
      status: editStatus.value,
      coordinatorNotes: updatedNotes,
    })

    const target = allReferrals.value.find((r) => r.id === selectedReferral.value?.id)
    if (target) {
      target.status = editStatus.value
      target.coordinatorNotes = updatedNotes
      target.updatedAt = new Date().toISOString()
    }

    await refreshUnreadCount()
    successMessage.value = 'El estatus de la canalización se actualizó correctamente.'
    closeDetailModal()
  } catch {
    errorMessage.value = 'No fue posible actualizar el estatus de la canalización.'
  } finally {
    isUpdatingStatus.value = false
  }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

onMounted(() => {
  void loadReferrals()
})
</script>

<template>
  <UiBasePage
    fluid
    :title="isAdmin ? 'Gestión de Canalizaciones' : 'Mis Canalizaciones Enviadas'"
    :description="
      isAdmin
        ? 'Bandeja priorizada de canalizaciones enviadas por tutores, ordenadas de la más reciente a la más antigua.'
        : 'Envía reportes de canalización a coordinación y consulta en tiempo real el estatus de atención.'
    "
  >
    <template #actions>
      <UiButton v-if="!isAdmin" variant="primary" @click="openNewReferralModal">
        + Nueva Canalización
      </UiButton>
    </template>

    <!-- Alertas globales -->
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

    <!-- Bloque 1: Filtros de Búsqueda -->
    <div class="referrals-block">
      <ReferralFiltersBar v-model="filters" :is-admin="isAdmin" />
    </div>

    <!-- Bloque 2: Tarjetas de Resumen KPI Interactivas -->
    <div class="referrals-block">
      <ReferralKpiCards
        :total-count="kpis.total"
        :unread-count="kpis.unread"
        :pending-count="kpis.pending"
        :attended-count="kpis.attended"
        :active-bucket="filters.kpiBucket ?? 'all'"
        @select="handleKpiSelect"
      />
    </div>

    <!-- Bloque 3: Tabla de Canalizaciones -->
    <div class="referrals-block">
      <UiCard
        :title="isAdmin ? 'Listado de Canalizaciones Recibidas' : 'Historial de Canalizaciones Enviadas'"
        :description="
          isAdmin
            ? 'Ordenadas de la fecha más reciente a la más antigua para atención prioritaria'
            : 'Reportes enviados a coordinación y seguimiento de su estatus'
        "
        :aria-busy="isLoading"
      >
        <UiAlert v-if="isLoading" tone="info" title="Sincronizando canalizaciones..." />
        <UiAlert
          v-else-if="filteredReferrals.length === 0"
          tone="info"
          title="Sin canalizaciones"
        >
          <UiText>No se encontraron canalizaciones con los filtros seleccionados.</UiText>
        </UiAlert>
        <UiTable
          v-else
          label="Tabla de canalizaciones de estudiantes"
          :columns="columns"
          :rows="filteredReferrals"
        >
          <template #cell-matricula="{ row }">
            <div class="student-cell">
              <div class="student-title-row">
                <span class="student-name">{{ row.studentName }}</span>
                <span v-if="isAdmin && isNewReferral(row)" class="new-pill">Nuevo</span>
                <span v-if="!isAdmin && row.coordinatorNotes" class="response-pill">Con respuesta</span>
              </div>
              <div class="student-meta">
                <span class="student-career">{{ row.studentCareer }}</span>
                <span class="meta-dot" aria-hidden="true">·</span>
                <code class="student-id">{{ row.matricula }}</code>
              </div>
            </div>
          </template>

          <template #cell-supportArea="{ row }">
            <ReferralSupportAreaBadge :area="row.supportArea" />
          </template>

          <template #cell-referralReason="{ row }">
            <span class="reason-tag">{{ reasonLabels[row.referralReason] || row.referralReason }}</span>
          </template>

          <template #cell-detectionSource="{ row }">
            <div class="detector-cell">
              <span class="source-tag">{{ row.detectionSource }}</span>
              <span v-if="row.detectionSource === 'Docente' && row.detectedByTeacherName" class="detector-name">
                {{ row.detectedByTeacherName }}
              </span>
            </div>
          </template>

          <template #cell-tutorName="{ row }">
            <div class="detector-cell">
              <span class="source-tag">{{ row.tutorName || row.tutorClave }}</span>
              <code class="student-id">{{ row.tutorClave }}</code>
            </div>
          </template>

          <template #cell-status="{ row }">
            <ReferralStatusBadge :status="row.status" />
          </template>

          <template #cell-createdAt="{ row }">
            <span class="date-text">{{ formatDate(row.createdAt) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <div class="row-actions">
              <UiButton
                :variant="isAdmin ? 'primary' : 'secondary'"
                class="btn-sm"
                @click="openDetailModal(row)"
              >
                {{ isAdmin ? 'Atender / Editar' : 'Ver estatus' }}
              </UiButton>
              <UiButton
                v-if="canTutorModify(row)"
                variant="secondary"
                class="btn-sm"
                @click="openEditReferralModal(row)"
              >
                Editar
              </UiButton>
              <UiButton
                v-if="canTutorModify(row)"
                variant="danger"
                class="btn-sm"
                @click="openCancelConfirm(row)"
              >
                Cancelar
              </UiButton>
            </div>
          </template>
        </UiTable>
      </UiCard>
    </div>

    <!-- Modal de Creación / Edición (Tutor) -->
    <CreateReferralModal
      v-model="isCreateModalOpen"
      :periodo-id="filters.periodoId"
      :submitting="isSavingReferral"
      :existing-referrals="roleScopedReferrals"
      :editing-referral="editingReferral"
      @created="handleCreateReferral"
      @updated="handleUpdateReferral"
    />

    <!-- Modal de Confirmación de Cancelación (Tutor) -->
    <UiDialog
      v-model="isCancelModalOpen"
      title="Cancelar Canalización"
      class="confirm-modal"
    >
      <div v-if="referralToCancel" class="case-detail-body">
        <UiText>
          ¿Deseas cancelar la canalización enviada para
          <strong>{{ referralToCancel.studentName }}</strong>
          (<code>{{ referralToCancel.matricula }}</code>)?
        </UiText>
        <div class="dialog-actions">
          <UiButton variant="secondary" :disabled="isCancelling" @click="isCancelModalOpen = false">
            Conservar
          </UiButton>
          <UiButton variant="danger" :loading="isCancelling" @click="confirmCancelReferral">
            Sí, cancelar envío
          </UiButton>
        </div>
      </div>
    </UiDialog>

    <!-- Modal de Detalle / Gestión de Canalización -->
    <UiDialog
      v-model="isDetailModalOpen"
      :title="selectedReferral ? `Expediente de Canalización · ${selectedReferral.matricula}` : 'Detalle de Canalización'"
      class="detail-modal"
    >
      <div v-if="selectedReferral" class="case-detail-body">
        <!-- Plantilla completa de datos del alumno -->
        <div class="student-dossier-card">
          <div class="dossier-top">
            <div>
              <span class="meta-label">Nombre completo del alumno</span>
              <div class="dossier-name">{{ selectedReferral.studentName }}</div>
            </div>
            <ReferralStatusBadge :status="selectedReferral.status" />
          </div>
          <div class="dossier-grid">
            <div>
              <span class="meta-label">Matrícula</span>
              <code class="dossier-matricula">{{ selectedReferral.matricula }}</code>
            </div>
            <div>
              <span class="meta-label">Semestre</span>
              <strong>{{ selectedReferral.studentSemester }}° Semestre</strong>
            </div>
            <div class="dossier-career">
              <span class="meta-label">Carrera</span>
              <strong>{{ selectedReferral.studentCareer }}</strong>
            </div>
            <div>
              <span class="meta-label">Área a canalizar</span>
              <ReferralSupportAreaBadge :area="selectedReferral.supportArea" />
            </div>
          </div>
        </div>

        <div class="case-info-section">
          <span class="section-title">Origen y motivo:</span>
          <p class="section-content">
            <strong>Motivo:</strong> {{ reasonLabels[selectedReferral.referralReason] || selectedReferral.referralReason }}
            ·
            <strong>Detectado por:</strong>
            <template v-if="selectedReferral.detectionSource === 'Docente'">
              Docente ({{ selectedReferral.detectedByTeacherName || 'Sin nombre registrado' }})
            </template>
            <template v-else>
              Tutor ({{ selectedReferral.tutorName || selectedReferral.tutorClave }})
            </template>
          </p>
        </div>

        <div class="case-info-section">
          <span class="section-title">Observaciones o situación detectada:</span>
          <div class="observations-box">
            {{ selectedReferral.observations || 'Sin observaciones adicionales registradas.' }}
          </div>
        </div>

        <!-- Panel de gestión exclusivo de Coordinadora (Admin) -->
        <div v-if="isAdmin" class="coordinator-panel">
          <span class="section-title">Gestión de Coordinación</span>
          <UiField
            v-model="editStatus"
            label="Actualizar estatus de la canalización"
            as="select"
            :options="statusEditOptions"
          />
          <div class="form-field-textarea">
            <label for="coordinator-notes" class="textarea-label">Acciones tomadas / notas de seguimiento</label>
            <textarea
              id="coordinator-notes"
              v-model="editCoordinatorNotes"
              rows="3"
              class="custom-textarea"
              placeholder="Registra las acciones realizadas o indicaciones de seguimiento..."
            />
          </div>
        </div>

        <!-- Vista de notas de coordinación para el Tutor (solo lectura) -->
        <div v-else-if="selectedReferral.coordinatorNotes" class="case-info-section">
          <span class="section-title">Seguimiento de Coordinación:</span>
          <div class="observations-box coordinator-note-box">
            {{ selectedReferral.coordinatorNotes }}
          </div>
        </div>

        <div class="case-footer-meta">
          <span><strong>Enviado:</strong> {{ formatDate(selectedReferral.createdAt) }}</span>
          <span v-if="selectedReferral.updatedAt">
            <strong>Actualizado:</strong> {{ formatDate(selectedReferral.updatedAt) }}
          </span>
        </div>

        <div class="dialog-actions">
          <UiButton variant="secondary" :disabled="isUpdatingStatus" @click="closeDetailModal">
            Cerrar
          </UiButton>
          <UiButton
            v-if="isAdmin"
            variant="primary"
            :loading="isUpdatingStatus"
            @click="handleUpdateStatus"
          >
            Guardar cambios
          </UiButton>
        </div>
      </div>
    </UiDialog>
  </UiBasePage>
</template>

<style scoped>
.referrals-block {
  margin-bottom: 1.25rem;
}

.referrals-block:last-child {
  margin-bottom: 0;
}

.student-cell {
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;
}

.student-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.student-name {
  font-weight: 600;
  color: var(--color-text-primary, #0f172a);
}

.new-pill {
  display: inline-block;
  padding: 0.0625rem 0.45rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  background-color: var(--color-danger-badge, #fee2e2);
  color: var(--color-danger-text, #991b1b);
  border: 1px solid var(--color-danger-border, #fecaca);
}

.response-pill {
  display: inline-block;
  padding: 0.0625rem 0.45rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  background-color: var(--color-info-badge, #e0f2fe);
  color: var(--color-info-text, #075985);
  border: 1px solid var(--color-info-border, #bfdbfe);
}

.student-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.meta-dot {
  color: var(--color-text-muted, #94a3b8);
}

.student-id {
  font-family: monospace;
  font-size: 0.75rem;
  font-weight: 600;
  background-color: var(--color-gray-100, #f1f5f9);
  padding: 0.0625rem 0.3rem;
  border-radius: 4px;
}

.student-career {
  font-size: 0.78rem;
  color: var(--color-text-secondary, #64748b);
}

.reason-tag {
  font-weight: 500;
  color: var(--color-text-primary, #0f172a);
  font-size: 0.875rem;
}

.detector-cell {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.source-tag {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-primary, #0f172a);
}

.detector-name {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
}

.date-text {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #64748b);
  white-space: nowrap;
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

/* Diálogos */
.confirm-modal {
  max-width: 460px;
}

.detail-modal {
  max-width: 660px;
}

.case-detail-body {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.student-dossier-card {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  background-color: var(--color-bg-light, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-left: 4px solid var(--color-primary, #1b396a);
  border-radius: 8px;
  padding: 1rem;
}

.dossier-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.dossier-name {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-primary, #0f172a);
}

.dossier-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
  font-size: 0.875rem;
}

.dossier-matricula {
  font-family: monospace;
  font-size: 0.85rem;
  font-weight: 700;
  background-color: var(--color-surface-white, #ffffff);
  padding: 0.125rem 0.45rem;
  border-radius: 4px;
  border: 1px solid var(--color-border, #e2e8f0);
}

.meta-label {
  display: block;
  font-size: 0.73rem;
  color: var(--color-text-secondary, #64748b);
  margin-bottom: 0.15rem;
}

.case-info-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary, #0f172a);
}

.section-content {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #334155);
  margin: 0;
}

.observations-box {
  background-color: var(--color-bg-light, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 6px;
  padding: 0.75rem;
  font-size: 0.875rem;
  color: var(--color-text-primary, #1e293b);
  line-height: 1.5;
}

.coordinator-note-box {
  border-left: 3px solid var(--color-primary, #1b396a);
}

.coordinator-panel {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  padding: 1rem;
  background-color: var(--color-primary-subtle, #ebf3ff);
  border: 1px solid var(--color-border-medium, #cbd5e1);
  border-radius: 8px;
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
  padding: 0.625rem 0.875rem;
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-text-primary, #0f172a);
  background-color: var(--input-bg, #ffffff);
  border: 1px solid var(--input-border, #cbd5e1);
  border-radius: 6px;
  resize: vertical;
}

.custom-textarea:focus {
  outline: none;
  border-color: var(--color-primary, #1b396a);
  box-shadow: 0 0 0 1px var(--color-primary, #1b396a);
}

.case-footer-meta {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #64748b);
  border-top: 1px solid var(--color-border, #e2e8f0);
  padding-top: 0.75rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.25rem;
}
</style>
