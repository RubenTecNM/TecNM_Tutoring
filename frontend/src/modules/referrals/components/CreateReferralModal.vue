<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UiAlert, UiButton, UiDialog, UiField, UiText } from '../../../shared/components'
import { isValidTecNmMatricula, referralsApi } from '../api/referralsApi'
import type {
  CreateReferralRequest,
  DetectionSource,
  Referral,
  ReferralReason,
  StudentPreview,
  SupportArea,
  TeacherDirectoryItem,
  UpdateReferralRequest,
} from '../types/referrals'

const props = withDefaults(
  defineProps<{
    periodoId: number
    submitting?: boolean
    existingReferrals?: Referral[]
    editingReferral?: Referral | null
  }>(),
  {
    submitting: false,
    existingReferrals: () => [],
    editingReferral: null,
  },
)

const emit = defineEmits<{
  created: [payload: CreateReferralRequest]
  updated: [referralId: string, payload: UpdateReferralRequest]
}>()

const isOpen = defineModel<boolean>({ default: false })

const isEditMode = computed(() => Boolean(props.editingReferral))

const matricula = ref('')
const studentPreview = ref<StudentPreview | null>(null)
const isLookingUpStudent = ref(false)
let skipNextLookup = false
let lookupSeq = 0

const studentCareer = ref('Ingeniería en Sistemas Computacionales')
const detectionSource = ref<DetectionSource>('Tutor')
const detectedByTeacherName = ref('')
const teacherSuggestions = ref<TeacherDirectoryItem[]>([])
const showTeacherDropdown = ref(false)
const activeTeacherIndex = ref(-1)
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

async function lookupStudent(rawMatricula: string) {
  const clean = rawMatricula.trim().toUpperCase()
  const seq = ++lookupSeq

  if (!isValidTecNmMatricula(clean)) {
    studentPreview.value = null
    isLookingUpStudent.value = false
    return
  }

  isLookingUpStudent.value = true
  try {
    const info = await referralsApi.lookupStudentByMatricula(clean)
    if (seq !== lookupSeq) return
    studentPreview.value = info
    if (info?.career && careerOptions.some((c) => c.value === info.career)) {
      studentCareer.value = info.career
    }
  } finally {
    if (seq === lookupSeq) {
      isLookingUpStudent.value = false
    }
  }
}

watch(matricula, (val) => {
  const upper = val.toUpperCase().replace(/\s+/g, '')
  if (upper !== val) {
    matricula.value = upper
    return
  }
  if (skipNextLookup) {
    skipNextLookup = false
    return
  }
  void lookupStudent(upper)
})

watch(detectionSource, async (newSource) => {
  if (newSource === 'Tutor') {
    detectedByTeacherName.value = ''
    teacherSuggestions.value = []
    showTeacherDropdown.value = false
    activeTeacherIndex.value = -1
  } else {
    teacherSuggestions.value = await referralsApi.searchTeachers(detectedByTeacherName.value)
    activeTeacherIndex.value = -1
  }
})

watch(detectedByTeacherName, async (val) => {
  if (detectionSource.value !== 'Docente') return
  teacherSuggestions.value = await referralsApi.searchTeachers(val)
  activeTeacherIndex.value = -1
})

function selectTeacher(teacher: TeacherDirectoryItem) {
  detectedByTeacherName.value = teacher.fullName
  showTeacherDropdown.value = false
  activeTeacherIndex.value = -1
}

function handleTeacherFocus() {
  showTeacherDropdown.value = true
  activeTeacherIndex.value = -1
  void referralsApi.searchTeachers(detectedByTeacherName.value).then((res) => {
    teacherSuggestions.value = res
  })
}

function handleTeacherBlur() {
  // Pequeño retardo para permitir el clic sobre una opción de la lista
  setTimeout(() => {
    showTeacherDropdown.value = false
    activeTeacherIndex.value = -1
  }, 160)
}

function handleTeacherKeydown(event: KeyboardEvent) {
  if (!showTeacherDropdown.value || teacherSuggestions.value.length === 0) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeTeacherIndex.value = (activeTeacherIndex.value + 1) % teacherSuggestions.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeTeacherIndex.value =
      activeTeacherIndex.value <= 0
        ? teacherSuggestions.value.length - 1
        : activeTeacherIndex.value - 1
  } else if (event.key === 'Enter' && activeTeacherIndex.value >= 0) {
    event.preventDefault()
    selectTeacher(teacherSuggestions.value[activeTeacherIndex.value])
  } else if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    showTeacherDropdown.value = false
    activeTeacherIndex.value = -1
  }
}

function populateFromEditing(referral: Referral) {
  skipNextLookup = true
  matricula.value = referral.matricula
  studentCareer.value = referral.studentCareer
  detectionSource.value = referral.detectionSource
  detectedByTeacherName.value = referral.detectedByTeacherName ?? ''
  supportArea.value = referral.supportArea
  referralReason.value = referral.referralReason
  observations.value = referral.observations ?? ''
  errorMessage.value = ''
  studentPreview.value = {
    matricula: referral.matricula,
    fullName: referral.studentName,
    career: referral.studentCareer,
    semester: referral.studentSemester,
  }
}

function resetForm() {
  matricula.value = ''
  studentPreview.value = null
  studentCareer.value = 'Ingeniería en Sistemas Computacionales'
  detectionSource.value = 'Tutor'
  detectedByTeacherName.value = ''
  teacherSuggestions.value = []
  showTeacherDropdown.value = false
  supportArea.value = 'Psychology'
  referralReason.value = 'Emotional'
  observations.value = ''
  errorMessage.value = ''
}

watch(isOpen, (open) => {
  if (open && props.editingReferral) {
    populateFromEditing(props.editingReferral)
  } else if (!open) {
    resetForm()
  }
})

function handleClose() {
  if (props.submitting) return
  isOpen.value = false
}

function handleSubmit() {
  if (props.submitting) return

  const cleanMatricula = matricula.value.trim().toUpperCase()
  if (!cleanMatricula) {
    errorMessage.value = 'Ingresa la matrícula del alumno.'
    return
  }

  if (!isValidTecNmMatricula(cleanMatricula)) {
    errorMessage.value =
      'Formato de matrícula inválido. Debe ser 1 letra seguida de 8 dígitos (ejemplo: I12345678).'
    return
  }

  if (!studentCareer.value) {
    errorMessage.value = 'Selecciona la carrera del alumno.'
    return
  }

  const cleanTeacherName = detectedByTeacherName.value.trim()
  if (detectionSource.value === 'Docente' && !cleanTeacherName) {
    errorMessage.value = 'Busca y selecciona o ingresa el nombre del docente que reporta.'
    return
  }

  // Prevención de canalización duplicada activa (misma matrícula y misma área en el periodo)
  const duplicate = props.existingReferrals.find(
    (r) =>
      r.id !== props.editingReferral?.id &&
      !r.isDeleted &&
      r.periodoId === props.periodoId &&
      r.matricula.toUpperCase() === cleanMatricula &&
      r.supportArea === supportArea.value &&
      r.status !== 'Attended',
  )

  if (duplicate) {
    errorMessage.value =
      'Ya existe una canalización activa para este alumno en la misma área durante el periodo actual.'
    return
  }

  errorMessage.value = ''

  const commonPayload = {
    matricula: cleanMatricula,
    studentName: studentPreview.value?.fullName,
    studentCareer: studentCareer.value,
    studentSemester: studentPreview.value?.semester,
    detectionSource: detectionSource.value,
    detectedByTeacherName: detectionSource.value === 'Docente' ? cleanTeacherName : undefined,
    supportArea: supportArea.value,
    referralReason: referralReason.value,
    observations: observations.value.trim() || undefined,
  }

  if (props.editingReferral) {
    emit('updated', props.editingReferral.id, commonPayload)
  } else {
    emit('created', {
      periodoId: props.periodoId,
      ...commonPayload,
    })
  }
}
</script>

<template>
  <UiDialog
    v-model="isOpen"
    :title="isEditMode ? 'Editar Canalización Enviada' : 'Nueva Canalización de Alumno'"
    class="referral-modal"
  >
    <form class="dialog-form" @submit.prevent="handleSubmit">
      <UiAlert v-if="errorMessage" tone="danger" title="Validación de datos">
        <UiText>{{ errorMessage }}</UiText>
      </UiAlert>

      <div class="form-row">
        <UiField
          v-model="matricula"
          label="Matrícula del alumno *"
          placeholder="Ej. I12345678"
          maxlength="9"
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

      <!-- Plantilla previa automática del alumno al ingresar matrícula válida -->
      <div v-if="isLookingUpStudent" class="student-preview-loading">
        Buscando expediente escolar de la matrícula...
      </div>
      <div v-else-if="studentPreview" class="student-preview-card" aria-label="Vista previa del alumno">
        <div class="preview-header">
          <span class="preview-badge">Vista previa del alumno</span>
          <code class="preview-matricula">{{ studentPreview.matricula }}</code>
        </div>
        <div class="preview-name">{{ studentPreview.fullName }}</div>
        <div class="preview-meta">
          <span><strong>Carrera:</strong> {{ studentCareer }}</span>
          <span><strong>Semestre:</strong> {{ studentPreview.semester }}° Semestre</span>
        </div>
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

      <!-- Buscador con autocompletado de docentes -->
      <div v-if="detectionSource === 'Docente'" class="teacher-autocomplete">
        <UiField
          v-model="detectedByTeacherName"
          label="Buscar docente por nombre *"
          placeholder="Escribe el nombre (ej. J para José, Juan...)"
          autocomplete="off"
          required
          @focus="handleTeacherFocus"
          @blur="handleTeacherBlur"
          @keydown="handleTeacherKeydown"
        />
        <ul
          v-if="showTeacherDropdown && teacherSuggestions.length > 0"
          class="teacher-dropdown"
          role="listbox"
          aria-label="Resultados de docentes"
        >
          <li
            v-for="(teacher, idx) in teacherSuggestions"
            :key="teacher.clave"
            class="teacher-option"
            :class="{ highlighted: idx === activeTeacherIndex }"
            role="option"
            :aria-selected="idx === activeTeacherIndex"
            @mousedown.prevent="selectTeacher(teacher)"
          >
            <span class="teacher-option-name">{{ teacher.fullName }}</span>
            <span v-if="teacher.department" class="teacher-option-dept">
              {{ teacher.department }} · {{ teacher.clave }}
            </span>
          </li>
        </ul>
        <div
          v-else-if="showTeacherDropdown && detectedByTeacherName.trim().length > 0 && teacherSuggestions.length === 0"
          class="teacher-empty-hint"
        >
          No se encontró en el catálogo; se guardará el nombre escrito manualmente.
        </div>
      </div>

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
          {{ isEditMode ? 'Guardar cambios' : 'Enviar Canalización' }}
        </UiButton>
      </div>
    </form>
  </UiDialog>
</template>

<style scoped>
.referral-modal {
  max-width: 620px;
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 1.05rem;
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

.student-preview-loading {
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #64748b);
  padding: 0.5rem 0.75rem;
  background-color: var(--color-bg-light, #f8fafc);
  border-radius: 6px;
}

.student-preview-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.875rem 1rem;
  background-color: var(--color-primary-subtle, #ebf3ff);
  border: 1px solid var(--color-border-medium, #cbd5e1);
  border-left: 4px solid var(--color-primary, #1b396a);
  border-radius: 8px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.preview-badge {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-primary, #1b396a);
}

.preview-matricula {
  font-family: monospace;
  font-size: 0.78rem;
  font-weight: 700;
  background-color: var(--color-surface-white, #ffffff);
  color: var(--color-text-primary, #0f172a);
  padding: 0.125rem 0.45rem;
  border-radius: 4px;
  border: 1px solid var(--color-border, #e2e8f0);
}

.preview-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text-primary, #0f172a);
}

.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #475569);
}

.teacher-autocomplete {
  position: relative;
}

.teacher-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 220px;
  overflow-y: auto;
  margin: 0;
  padding: 0.375rem;
  list-style: none;
  background-color: var(--floating-bg, #ffffff);
  border: 1px solid var(--floating-border, #cbd5e1);
  border-radius: 8px;
  box-shadow: var(--floating-shadow);
  z-index: 20;
}

.teacher-option {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.5rem 0.625rem;
  border-radius: 6px;
  cursor: pointer;
}

.teacher-option:hover,
.teacher-option.highlighted {
  background-color: var(--color-primary-subtle, #ebf3ff);
}

.teacher-option-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary, #0f172a);
}

.teacher-option-dept {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
}

.teacher-empty-hint {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
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
