<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UiAlert, UiBadge, UiButton, UiCard, UiField, UiText } from '../../../shared/components'
import { normalizeApiError } from '../../../shared/api/apiErrors'
import { metricsApi } from '../api/metricsApi'
import type { CoordinatorSheetKey, CoordinatorWorkbook } from '../types/metrics'

const props = defineProps<{
  workbook: CoordinatorWorkbook
}>()

const emit = defineEmits<{
  updated: [workbook: CoordinatorWorkbook]
  preview: [workbook: CoordinatorWorkbook, tabKey: CoordinatorSheetKey]
  export: [workbook: CoordinatorWorkbook, tabKey?: CoordinatorSheetKey]
}>()

const activeTabKey = ref<CoordinatorSheetKey>(props.workbook.tabs[0]?.tabKey ?? 'hoja1')
const isDirty = ref(false)
const isSaving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const primaryMetric = ref('0')
const secondaryMetric = ref('0')
const summaryNotes = ref('')
const markCompleted = ref(false)

const activeTab = computed(() =>
  props.workbook.tabs.find((t) => t.tabKey === activeTabKey.value) ?? props.workbook.tabs[0],
)

function hydrateTab() {
  const tab = activeTab.value
  if (!tab) return
  const payload = tab.tabPayload ?? {}
  primaryMetric.value = String(
    payload.totalAttendedStudents ??
      payload.highRiskSubjectsCount ??
      payload.completedActivities ??
      payload.activeAdvisors ??
      payload.groupsMonitored ??
      0,
  )
  secondaryMetric.value = String(payload.totalReferrals ?? 0)
  summaryNotes.value = String(payload.summaryNotes ?? payload.interventionActions ?? '')
  markCompleted.value = tab.isCompleted
  isDirty.value = false
  errorMessage.value = ''
}

watch(
  () => props.workbook.id,
  () => {
    activeTabKey.value = props.workbook.tabs[0]?.tabKey ?? 'hoja1'
    hydrateTab()
  },
  { immediate: true },
)

function switchTab(nextKey: CoordinatorSheetKey) {
  if (nextKey === activeTabKey.value || isSaving.value) return
  if (isDirty.value) {
    const ok = window.confirm(
      'Hay cambios sin guardar en la pestaña actual. ¿Deseas descartarlos y cambiar de pestaña?',
    )
    if (!ok) return
  }
  activeTabKey.value = nextKey
  successMessage.value = ''
  hydrateTab()
}

async function handleSaveTab() {
  if (!activeTab.value || isSaving.value) return

  const num1 = Number(primaryMetric.value)
  const num2 = Number(secondaryMetric.value)
  if (!Number.isInteger(num1) || num1 < 0 || !Number.isInteger(num2) || num2 < 0) {
    errorMessage.value = 'Los conteos numéricos deben ser enteros mayores o iguales a 0.'
    return
  }

  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const updated = await metricsApi.saveCoordinatorTab(props.workbook.id, {
      tabKey: activeTab.value.tabKey,
      rowVersion: activeTab.value.rowVersion,
      markCompleted: markCompleted.value,
      tabPayload: {
        primaryMetric: num1,
        secondaryMetric: num2,
        summaryNotes: summaryNotes.value.trim(),
      },
    })
    isDirty.value = false
    successMessage.value = `Pestaña "${activeTab.value.excelSheetName}" guardada.`
    emit('updated', updated)
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UiCard :title="workbook.title" :description="`Plantilla oficial: ${workbook.templateFileName}`">
    <div class="workbook-body">
      <div class="workbook-header-bar">
        <div class="sheet-tabs" role="tablist" aria-label="Pestañas del libro de coordinación">
          <button
            v-for="tab in workbook.tabs"
            :key="tab.tabKey"
            type="button"
            role="tab"
            class="sheet-tab-btn"
            :class="{ active: tab.tabKey === activeTabKey }"
            :aria-selected="tab.tabKey === activeTabKey"
            @click="switchTab(tab.tabKey)"
          >
            <span>{{ tab.label }}</span>
            <span v-if="tab.isCompleted" class="tab-check" aria-label="Completada">✓</span>
          </button>
        </div>

        <div class="workbook-actions">
          <UiBadge :tone="workbook.status === 'Finalized' ? 'success' : 'info'">
            {{ workbook.status === 'Finalized' ? 'Finalizado' : 'Borrador editable' }}
          </UiBadge>
          <UiButton
            variant="secondary"
            class="btn-sm"
            @click="emit('preview', workbook, activeTabKey)"
          >
            Vista previa
          </UiButton>
          <UiButton
            variant="secondary"
            class="btn-sm"
            @click="emit('export', workbook, activeTabKey)"
          >
            Exportar .xlsx
          </UiButton>
        </div>
      </div>

      <UiAlert v-if="successMessage" tone="success" title="Guardado" dismissible @dismiss="successMessage = ''">
        <UiText>{{ successMessage }}</UiText>
      </UiAlert>

      <UiAlert v-if="errorMessage" tone="danger" title="Error">
        <UiText>{{ errorMessage }}</UiText>
      </UiAlert>

      <template v-if="activeTab">
        <div class="prefilled-panel">
          <span class="panel-heading">Datos maestros pre-rellenados (hoja: {{ activeTab.excelSheetName }})</span>
          <div class="prefilled-grid">
            <div v-for="(val, key) in activeTab.prefilledData" :key="key" class="prefilled-item">
              <span class="field-label">{{ key }}</span>
              <strong>{{ String(val ?? '—') }}</strong>
            </div>
          </div>
        </div>

        <div class="numeric-grid">
          <UiField
            v-model="primaryMetric"
            label="Conteo principal de la hoja (entero >= 0)"
            type="number"
            min="0"
            @update:model-value="isDirty = true"
          />
          <UiField
            v-model="secondaryMetric"
            label="Conteo complementario / canalizaciones"
            type="number"
            min="0"
            @update:model-value="isDirty = true"
          />
        </div>

        <div class="form-field-textarea">
          <label :for="`notes-${workbook.id}`" class="textarea-label">Observaciones / consolidado de la hoja</label>
          <textarea
            :id="`notes-${workbook.id}`"
            v-model="summaryNotes"
            rows="3"
            class="custom-textarea"
            placeholder="Captura observaciones y resumen para inyectar en la plantilla oficial..."
            @input="isDirty = true"
          />
        </div>

        <div class="tab-footer">
          <label class="checklist-row">
            <input v-model="markCompleted" type="checkbox" @change="isDirty = true" />
            <span>Marcar pestaña como completa</span>
          </label>

          <UiButton
            variant="primary"
            class="btn-sm"
            :loading="isSaving"
            :disabled="workbook.status === 'Finalized'"
            @click="handleSaveTab"
          >
            Guardar pestaña
          </UiButton>
        </div>
      </template>
    </div>
  </UiCard>
</template>

<style scoped>
.workbook-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.workbook-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  border-bottom: 1px solid var(--color-border, #e2e8f0);
  padding-bottom: 0.75rem;
}

.sheet-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.sheet-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
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

.tab-check {
  font-weight: 700;
}

.workbook-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.prefilled-panel {
  padding: 0.875rem 1rem;
  background-color: var(--color-bg-light, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
}

.panel-heading {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
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
  font-size: 0.72rem;
  color: var(--color-text-secondary, #64748b);
}

.numeric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
}

.custom-textarea {
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-family: inherit;
  font-size: 0.875rem;
  background-color: var(--input-bg, #ffffff);
  color: var(--color-text-primary, #0f172a);
  border: 1px solid var(--input-border, #cbd5e1);
  border-radius: 6px;
  resize: vertical;
}

.tab-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.checklist-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-sm {
  padding: 0.3rem 0.7rem;
  font-size: 0.8125rem;
}
</style>
