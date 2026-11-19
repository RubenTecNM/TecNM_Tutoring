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
import type { UserResponse } from '../../auth/types/auth'
import { referralsApi } from '../api/referralsApi'
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
  ReferralStatus,
} from '../types/referrals'

interface ReferralRow extends Referral {
  actions?: string
}

const currentUser = ref<UserResponse | null>(null)
const isAdmin = computed(() => currentUser.value?.role === 'Admin')

const { syncUnreadCountFromList } = useReferralNotifications()

const isLoading = ref(true)
const isUpdatingStatus = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isCreateModalOpen = ref(false)
const isDetailModalOpen = ref(false)
const selectedReferral = ref<Referral | null>(null)
const editStatus = ref<ReferralStatus>('Received')
const editCoordinatorNotes = ref('')

const filters = ref<ReferralFilters>({
  periodoId: 1,
  supportArea: undefined,
  referralReason: undefined,
  status: undefined,
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

const columns: { key: keyof ReferralRow & string; label: string }[] = [
  { key: 'matricula', label: 'Alumno / Carrera' },
  { key: 'supportArea', label: 'Área' },
  { key: 'referralReason', label: 'Motivo' },
  { key: 'detectionSource', label: 'Detectado por' },
  { key: 'status', label: 'Estatus' },
  { key: 'createdAt', label: 'Fecha de Envío' },
  { key: 'actions', label: 'Acciones' },
]

// Base de registros según rol (Tutor ve solo sus envíos; Coordinadora ve todos)
const roleScopedReferrals = computed<Referral[]>(() => {
  if (isAdmin.value) {
    return allReferrals.value
  }
  const username = currentUser.value?.username
  if (!username) return []
  return allReferrals.value.filter(
    (r) => r.tutorClave === username || (username === 'usuario' && r.tutorClave === 'D0001'),
  )
})

// Filtros reactivos + ordenamiento obligatorio de fecha más reciente a más antigua
const filteredReferrals = computed<ReferralRow[]>(() => {
  return roleScopedReferrals.value
    .filter((item) => {
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
        const query = filters.value.search.toLowerCase()
        const matchMatricula = item.matricula.toLowerCase().includes(query)
        const matchName = item.studentName?.toLowerCase().includes(query) ?? false
        const matchCareer = item.studentCareer.toLowerCase().includes(query)
        if (!matchMatricula && !matchName && !matchCareer) return false
      }
      return true
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((item) => ({ ...item, actions: '' }))
})

// Métricas KPI reactivas
const kpis = computed(() => {
  const list = filteredReferrals.value
  const total = list.length
  const unread = list.filter((r) => r.status === 'Unread' || r.status === 'Sent').length
  const attended = list.filter((r) => r.status === 'Attended').length
  const pending = list.filter(
    (r) => r.status === 'Received' || r.status === 'Read' || r.status === 'Unattended',
  ).length
  return { total, unread, pending, attended }
})

async function loadReferrals(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    if (!currentUser.value) {
      currentUser.value = await me()
    }
    allReferrals.value = await referralsApi.getReferrals({
      periodoId: filters.value.periodoId,
    })
    if (isAdmin.value) {
      syncUnreadCountFromList(allReferrals.value)
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

async function handleCreateReferral(payload: CreateReferralRequest): Promise<void> {
  try {
    const newReferral = await referralsApi.createReferral(
      payload,
      currentUser.value
        ? { username: currentUser.value.username, name: currentUser.value.name }
        : undefined,
    )
    allReferrals.value.unshift(newReferral)
    if (isAdmin.value) {
      syncUnreadCountFromList(allReferrals.value)
    }
    successMessage.value = `Canalización enviada a coordinación para la matrícula ${payload.matricula}.`
  } catch {
    errorMessage.value = 'Error al registrar la canalización.'
  }
}

function openDetailModal(referral: Referral): void {
  selectedReferral.value = referral
  editStatus.value = referral.status
  editCoordinatorNotes.value = referral.coordinatorNotes ?? ''
  isDetailModalOpen.value = true
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

    syncUnreadCountFromList(allReferrals.value)
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
      <UiButton v-if="!isAdmin" variant="primary" @click="isCreateModalOpen = true">
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
      <ReferralFiltersBar v-model="filters" />
    </div>

    <!-- Bloque 2: Tarjetas de Resumen KPI -->
    <div class="referrals-block">
      <ReferralKpiCards
        :total-count="kpis.total"
        :unread-count="kpis.unread"
        :pending-count="kpis.pending"
        :attended-count="kpis.attended"
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
                <span class="student-name">{{ row.studentName || `Matrícula ${row.matricula}` }}</span>
                <span v-if="isAdmin && isNewReferral(row)" class="new-pill">Nuevo</span>
              </div>
              <div class="student-meta">
                <code class="student-id">{{ row.matricula }}</code>
                <span class="student-career">{{ row.studentCareer }}</span>
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

          <template #cell-status="{ row }">
            <ReferralStatusBadge :status="row.status" />
          </template>

          <template #cell-createdAt="{ row }">
            <span class="date-text">{{ formatDate(row.createdAt) }}</span>
          </template>

          <template #cell-actions="{ row }">
            <UiButton
              :variant="isAdmin ? 'primary' : 'secondary'"
              class="btn-sm"
              @click="openDetailModal(row)"
            >
              {{ isAdmin ? 'Atender / Editar' : 'Ver estatus' }}
            </UiButton>
          </template>
        </UiTable>
      </UiCard>
    </div>

    <!-- Modal de Creación (Tutor) -->
    <CreateReferralModal
      v-model="isCreateModalOpen"
      :periodo-id="filters.periodoId"
      @created="handleCreateReferral"
    />

    <!-- Modal de Detalle / Gestión de Canalización -->
    <UiDialog
      v-model="isDetailModalOpen"
      :title="selectedReferral ? `Canalización: ${selectedReferral.matricula}` : 'Detalle de Canalización'"
      class="detail-modal"
    >
      <div v-if="selectedReferral" class="case-detail-body">
        <div class="case-header-grid">
          <div>
            <span class="meta-label">Matrícula del alumno:</span>
            <strong>{{ selectedReferral.matricula }}</strong>
          </div>
          <div>
            <span class="meta-label">Carrera:</span>
            <span>{{ selectedReferral.studentCareer }}</span>
          </div>
          <div>
            <span class="meta-label">Área a canalizar:</span>
            <ReferralSupportAreaBadge :area="selectedReferral.supportArea" />
          </div>
          <div>
            <span class="meta-label">Estatus actual:</span>
            <ReferralStatusBadge :status="selectedReferral.status" />
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
  gap: 0.125rem;
}

.student-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.student-name {
  font-weight: 500;
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

.student-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.student-id {
  font-family: monospace;
  font-size: 0.75rem;
  background-color: #f1f5f9;
  padding: 0.0625rem 0.25rem;
  border-radius: 4px;
}

.student-career {
  font-size: 0.75rem;
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

.btn-sm {
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
}

/* Diálogo de Caso */
.detail-modal {
  max-width: 640px;
}

.case-detail-body {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.case-header-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  background-color: var(--color-bg-light, #f8fafc);
  padding: 0.875rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
}

.meta-label {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
  margin-bottom: 0.125rem;
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
