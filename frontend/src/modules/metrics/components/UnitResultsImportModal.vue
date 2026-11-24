<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiAlert, UiButton, UiDialog, UiText } from '../../../shared/components'
import { normalizeApiError } from '../../../shared/api/apiErrors'
import { metricsApi } from '../api/metricsApi'
import type { UnitResultsImportResponse } from '../types/metrics'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const VALID_EXTS = ['.xls', '.xlsx']

const props = defineProps<{
  periodoId: number
}>()

const emit = defineEmits<{
  imported: [result: UnitResultsImportResponse]
}>()

const isOpen = defineModel<boolean>({ default: false })
const selectedFile = ref<File | null>(null)
const errorMessage = ref('')
const isUploading = ref(false)

watch(isOpen, (open) => {
  if (!open) {
    selectedFile.value = null
    errorMessage.value = ''
  }
})

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const dotIdx = file.name.lastIndexOf('.')
  const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : ''
  if (!VALID_EXTS.includes(ext)) {
    errorMessage.value = 'Formato no permitido. Solo se admite .xls o .xlsx (415).'
    selectedFile.value = null
    input.value = ''
    return
  }

  if (file.size === 0) {
    errorMessage.value = 'El archivo está vacío. Selecciona un archivo válido (422).'
    selectedFile.value = null
    input.value = ''
    return
  }

  if (file.size > MAX_FILE_BYTES) {
    errorMessage.value = 'El archivo supera el tamaño máximo de 10 MB (413).'
    selectedFile.value = null
    input.value = ''
    return
  }

  errorMessage.value = ''
  selectedFile.value = file
  input.value = ''
}

async function handleImport() {
  if (!selectedFile.value || isUploading.value) return
  isUploading.value = true
  errorMessage.value = ''

  try {
    const result = await metricsApi.importUnitResults(props.periodoId, selectedFile.value)
    emit('imported', result)
    isOpen.value = false
  } catch (error) {
    errorMessage.value = normalizeApiError(error).message
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <UiDialog
    v-model="isOpen"
    title="Cargar Insumo: Resultados por Unidad Final (.xls)"
    class="import-dialog"
  >
    <div class="dialog-body">
      <UiText>
        Carga el archivo oficial <code>Resultados-por-unidad FINAL.xls</code> para contrastar índices
        de reprobación por materia y grupo.
      </UiText>

      <UiAlert v-if="errorMessage" tone="danger" title="Error al importar">
        <UiText>{{ errorMessage }}</UiText>
      </UiAlert>

      <div class="drop-area">
        <input
          id="unit-results-input"
          type="file"
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          class="sr-only"
          :disabled="isUploading"
          @change="handleFileSelect"
        />
        <label for="unit-results-input" class="drop-label">
          <span class="drop-title">Seleccionar archivo .xls / .xlsx</span>
          <span class="drop-hint">Tamaño máximo: 10 MB</span>
        </label>
      </div>

      <div v-if="selectedFile" class="file-chip">
        <strong>{{ selectedFile.name }}</strong>
        <span>({{ (selectedFile.size / 1024).toFixed(1) }} KB)</span>
      </div>

      <div class="dialog-actions">
        <UiButton variant="secondary" :disabled="isUploading" @click="isOpen = false">
          Cancelar
        </UiButton>
        <UiButton
          variant="primary"
          :disabled="!selectedFile || isUploading"
          :loading="isUploading"
          @click="handleImport"
        >
          Procesar insumo
        </UiButton>
      </div>
    </div>
  </UiDialog>
</template>

<style scoped>
.import-dialog {
  max-width: 540px;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.drop-area {
  border: 2px dashed var(--color-border-medium, #cbd5e1);
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  background-color: var(--color-bg-light, #f8fafc);
}

.drop-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  cursor: pointer;
}

.drop-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-primary, #1b396a);
}

.drop-hint {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
}

.file-chip {
  display: flex;
  justify-content: space-between;
  padding: 0.625rem 0.875rem;
  background-color: var(--color-gray-100, #f1f5f9);
  border-radius: 6px;
  font-size: 0.8125rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
</style>
