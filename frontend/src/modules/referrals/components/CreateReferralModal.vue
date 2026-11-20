<script setup lang="ts">
import { ref, watch } from 'vue'
import { UiAlert, UiButton, UiDialog, UiField, UiText } from '../../../shared/components'
import type {
  CreateReferralRequest,
  DetectionSource,
  ReferralReason,
  SupportArea,
} from '../types/referrals'

const props = withDefaults(
  defineProps<{
    periodoId: number
    submitting?: boolean
  }>(),
  {
    submitting: false,
  },
)

const emit = defineEmits<{
  created: [payload: CreateReferralRequest]
}>()

const isOpen = defineModel<boolean>({ default: false })

const matricula = ref('')
const studentCareer = ref('Ingeniería en Sistemas Computacionales')
const detectionSource = ref<DetectionSource>('Tutor')
const detectedByTeacherName = ref('')
const supportArea = ref<SupportArea>('Psychology')
const referralReason = ref<ReferralReason>('Emotional')
const observations = ref('')
const errorMessage = ref('')

const careerOptions = [
  { value: 'Ingeniería en Sistemas Computacionales', label: 'Ingeniería en Sistemas Computacionales' },
  { value: 'Ingeniería Industrial', label: 'Ingeniería Industrial' },
  { value: 'Ingeniería Mecánica', label: 'Ingeniería Mecánica' },
  { value: 'Ingeniería Electrónica', label: 'Ingeniería Electrónica' },
  { value: 'Ingeniería en Gestión Empresarial', label: 'Ingeniería en Gestión Empresarial' },
  { value: 'Ingeniería en Energías Renovables', label: 'Ingeniería en Energías Renovables' },
  { value: 'Ingeniería Informática', label: 'Ingeniería Informática' },
]

const sourceOptions = [
  { value: 'Tutor', label: 'Tutor (quien envía el reporte)' },
  { value: 'Docente', label: 'Docente' },
]

const areaOptions = [
  { value: 'Psychology', label: 'Psicología' },
  { value: 'Nursing', label: 'Enfermería' },
  { value: 'Performance', label: 'Desempeño' },
  { value: 'Tutoring', label: 'Tutorías' },
  { value: 'SocialWork', label: 'Trabajo Social' },
  { value: 'Academic', label: 'Académico' },
]

const reasonOptions = [
  { value: 'Emotional', label: 'Emocional' },
  { value: 'Academic', label: 'Académico' },
  { value: 'Personal', label: 'Personal' },
  { value: 'Discipline', label: 'Indisciplina' },
  { value: 'Health', label: 'Salud' },
  { value: 'Socioeconomic', label: 'Socioeconómico' },
]

watch(detectionSource, (newSource) => {
  if (newSource === 'Tutor') {
    detectedByTeacherName.value = ''
  }
})

watch(isOpen, (open) => {
  if (!open) {
    resetForm()
  }
})

function resetForm() {
  matricula.value = ''
  studentCareer.value = 'Ingeniería en Sistemas Computacionales'
  detectionSource.value = 'Tutor'
  detectedByTeacherName.value = ''
  supportArea.value = 'Psychology'
  referralReason.value = 'Emotional'
  observations.value = ''
  errorMessage.value = ''
}

function handleClose() {
  if (props.submitting) return
  isOpen.value = false
}

function handleSubmit() {
  if (props.submitting) return

  const cleanMatricula = matricula.value.trim()
  if (!cleanMatricula) {
    errorMessage.value = 'Ingresa la matrícula del alumno.'
    return
  }

  if (cleanMatricula.length < 8) {
    errorMessage.value = 'La matrícula debe contar con al menos 8 caracteres.'
    return
  }

  if (!studentCareer.value) {
    errorMessage.value = 'Selecciona la carrera del alumno.'
    return
  }

  const cleanTeacherName = detectedByTeacherName.value.trim()
  if (detectionSource.value === 'Docente' && !cleanTeacherName) {
    errorMessage.value = 'Ingresa el nombre del docente que reporta la canalización.'
    return
  }

  errorMessage.value = ''

  emit('created', {
    periodoId: props.periodoId,
    matricula: cleanMatricula,
    studentCareer: studentCareer.value,
    detectionSource: detectionSource.value,
    detectedByTeacherName: detectionSource.value === 'Docente' ? cleanTeacherName : undefined,
    supportArea: supportArea.value,
    referralReason: referralReason.value,
    observations: observations.value.trim() || undefined,
  })
}
</script>

<template>
  <UiDialog v-model="isOpen" title="Nueva Canalización de Alumno" class="referral-modal">
    <form class="dialog-form" @submit.prevent="handleSubmit">
      <UiAlert v-if="errorMessage" tone="danger" title="Datos incompletos">
        <UiText>{{ errorMessage }}</UiText>
      </UiAlert>

      <div class="form-row">
        <UiField
          v-model="matricula"
          label="Matrícula del alumno *"
          placeholder="Ej. 21050012"
          required
        />
        <UiField
          v-model="studentCareer"
          label="Carrera *"
          as="select"
          :options="careerOptions"
          required
        />
      </div>

      <div class="form-row">
        <UiField
          v-model="detectionSource"
          label="Detectado por *"
          as="select"
          :options="sourceOptions"
          required
        />
        <UiField
          v-model="supportArea"
          label="Área a canalizar *"
          as="select"
          :options="areaOptions"
          required
        />
      </div>

      <UiField
        v-if="detectionSource === 'Docente'"
        v-model="detectedByTeacherName"
        label="Nombre del docente que envía el reporte *"
        placeholder="Ej. M.C. Raúl Hernández Vela"
        required
      />

      <UiField
        v-model="referralReason"
        label="Motivo de canalización *"
        as="select"
        :options="reasonOptions"
        required
      />

      <div class="form-field-textarea">
        <label for="observations-input" class="textarea-label">Observaciones o situación detectada</label>
        <textarea
          id="observations-input"
          v-model="observations"
          rows="4"
          class="custom-textarea"
          placeholder="Describe la situación detectada en el alumno que requiere atención..."
        />
      </div>

      <div class="dialog-actions">
        <UiButton variant="secondary" :disabled="submitting" @click="handleClose">
          Cancelar
        </UiButton>
        <UiButton variant="primary" type="submit" :loading="submitting">
          Enviar Canalización
        </UiButton>
      </div>
    </form>
  </UiDialog>
</template>

<style scoped>
.referral-modal {
  max-width: 600px;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

@media (max-width: 560px) {
  .form-row {
    grid-template-columns: 1fr;
  }
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
  transition: border-color 0.15s ease-in-out;
}

.custom-textarea:focus {
  outline: none;
  border-color: var(--color-primary, #1b396a);
  box-shadow: 0 0 0 1px var(--color-primary, #1b396a);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
</style>
