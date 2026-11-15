<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  UiAlert,
  UiBadge,
  UiBasePage,
  UiButton,
  UiCard,
  UiField,
  UiLayout,
  UiMetric,
  UiTable,
  UiText,
} from '../../../shared/components'
import { complianceApi } from '../api/complianceApi'
import type { Deliverable } from '../types/compliance'

interface DeliverableRow extends Deliverable {
  actions?: string
}

const deliverables = ref<Deliverable[]>([])
const isLoading = ref(true)
const errorMessage = ref('')
const selectedPeriodo = ref<number>(1)
const docenteClave = ref<string>('DOC-DEMO')

const tableRows = computed<DeliverableRow[]>(() => deliverables.value)

const columns: { key: keyof DeliverableRow & string; label: string }[] = [
  { key: 'reportType', label: 'Tipo de Formato' },
  { key: 'reportingMonth', label: 'Mes' },
  { key: 'status', label: 'Estado' },
  { key: 'delayDays', label: 'Días de Mora' },
  { key: 'actions', label: 'Acción' },
]

const pendingCount = computed(() =>
  deliverables.value.filter((d) => d.status === 'Pending').length,
)
const onTimeCount = computed(() =>
  deliverables.value.filter((d) => d.status === 'OnTime').length,
)
const lateCount = computed(() =>
  deliverables.value.filter((d) => d.status === 'Late').length,
)

function getStatusTone(status: Deliverable['status']) {
  if (status === 'OnTime') return 'success'
  if (status === 'Late') return 'danger'
  return 'warning'
}

function getStatusLabel(status: Deliverable['status']) {
  if (status === 'OnTime') return 'En tiempo'
  if (status === 'Late') return 'Con retraso'
  return 'Pendiente'
}

async function loadDeliverables(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''

  try {
    deliverables.value = await complianceApi.getDeliverablesByDocente(
      docenteClave.value,
      selectedPeriodo.value,
    )
  } catch (error) {
    errorMessage.value =
      'No fue posible cargar los entregables de tutoría. Intenta nuevamente.'
  } finally {
    isLoading.value = false
  }
}

async function handleFileUpload(deliverableId: string, event: Event) {
  const target = event.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const file = target.files[0]

  try {
    await complianceApi.uploadDeliverable(deliverableId, file)
    await loadDeliverables()
  } catch (error) {
    errorMessage.value = 'Error al subir el archivo de cumplimiento.'
  } finally {
    target.value = ''
  }
}

onMounted(loadDeliverables)
</script>

<template>
  <UiBasePage
    fluid
    title="Cumplimiento de Tutorías"
    description="Seguimiento de entrega de los 7 anexos y formatos obligatorios."
  >
    <UiLayout kind="grid">
      <UiCard title="Entregados en Tiempo" metric>
        <UiMetric label="En Tiempo" :value="String(onTimeCount)" />
      </UiCard>
      <UiCard title="Con Retraso" metric>
        <UiMetric label="Con Retraso" :value="String(lateCount)" />
      </UiCard>
      <UiCard title="Pendientes" metric>
        <UiMetric label="Pendientes" :value="String(pendingCount)" />
      </UiCard>
    </UiLayout>

    <UiCard title="Filtros y Periodo" class="ui-space">
      <UiLayout kind="row">
        <UiField
          v-model="docenteClave"
          label="Clave Docente"
          placeholder="Ej. DOC-1234"
        />
        <UiButton variant="primary" @click="loadDeliverables">
          Consultar
        </UiButton>
      </UiLayout>
    </UiCard>

    <UiAlert v-if="errorMessage" tone="danger" title="Aviso">
      <UiText>{{ errorMessage }}</UiText>
    </UiAlert>

    <UiCard
      title="Listado de Entregables"
      description="Formatos y anexos normativos del semestre"
      :aria-busy="isLoading"
    >
      <UiAlert v-if="isLoading" tone="info" title="Cargando entregables..." />
      <UiTable
        v-else
        label="Tabla de entregables de tutoría"
        :columns="columns"
        :rows="tableRows"
      >
        <template #cell-status="{ row }">
          <UiBadge :tone="getStatusTone(row.status)">
            {{ getStatusLabel(row.status) }}
          </UiBadge>
        </template>

        <template #cell-actions="{ row }">
          <div v-if="row.status === 'Pending'" class="upload-action">
            <label class="upload-label">
              <input
                type="file"
                accept=".pdf,.doc,.docx"
                class="sr-only"
                @change="handleFileUpload(row.id, $event)"
              />
              <span class="upload-btn">Subir Archivo</span>
            </label>
          </div>
          <span v-else class="text-muted">Entregado</span>
        </template>
      </UiTable>
    </UiCard>
  </UiBasePage>
</template>

<style scoped>
.upload-action {
  display: inline-flex;
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
.upload-btn {
  display: inline-block;
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-white, #ffffff);
  background-color: var(--color-primary, #1b396a);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s ease-in-out;
}
.upload-btn:hover {
  background-color: var(--color-primary-hover, #244b88);
}
.text-muted {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #64748b);
}
</style>
