<script setup lang="ts">
import { computed } from 'vue'
import { getPeriodLabel } from '../../../shared/utils/academicPeriod'
import type { DeliverableTask } from '../types/compliance'
import { getOfficialTemplateMeta } from '../utils/templateCatalog'

const props = defineProps<{
  task: DeliverableTask
  tabKey?: string
}>()

const meta = computed(() => getOfficialTemplateMeta(props.task.formatKey))

const sectionPayload = computed<Record<string, unknown>>(() => {
  if (props.task.hasTabs && props.tabKey) {
    const tabsMap = (props.task.formPayload?.tabs as Record<string, Record<string, unknown>> | undefined) ?? {}
    return tabsMap[props.tabKey] ?? {}
  }
  return props.task.formPayload ?? {}
})

const tutorName = computed(() =>
  String(
    (sectionPayload.value.header as Record<string, unknown> | undefined)?.tutorName ??
      sectionPayload.value.tutorName ??
      props.task.prefilledData?.docente_nombre ??
      props.task.docenteClave,
  ),
)

const periodLabel = computed(() => getPeriodLabel(props.task.periodoId))

const formattedUpdatedAt = computed(() => {
  if (!props.task.updatedAt) return 'Sin modificaciones guardadas aún'
  try {
    return new Date(props.task.updatedAt).toLocaleString('es-MX')
  } catch {
    return props.task.updatedAt
  }
})

const planSessions = computed(() => {
  const list = sectionPayload.value.sessions
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : []
})

const genericRows = computed(() => {
  const list = sectionPayload.value.rows ?? sectionPayload.value.students ?? sectionPayload.value.subjects
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : []
})

const visibleEntries = computed(() => {
  const skip = new Set([
    'sessions',
    'rows',
    'students',
    'subjects',
    'tabs',
    'checklist',
    'header',
    'signature',
    'signatureDataUrl',
  ])
  return Object.entries(sectionPayload.value)
    .filter(([k, v]) => !skip.has(k) && v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => ({
      key: k,
      value: typeof v === 'object' ? JSON.stringify(v) : String(v),
    }))
})
</script>

<template>
  <div class="doc-sheet">
    <div class="doc-header">
      <p class="doc-inst">TECNOLÓGICO NACIONAL DE MÉXICO · CAMPUS MONCLOVA</p>
      <h3 class="doc-title">{{ meta.title }}</h3>
      <div class="doc-meta-row">
        <span><strong>Plantilla oficial:</strong> <code>{{ meta.templateFileName }}</code></span>
        <span><strong>Formato:</strong> .{{ meta.extension.toUpperCase() }}</span>
      </div>
      <div class="doc-meta-row">
        <span><strong>Tutor:</strong> {{ tutorName }} ({{ task.docenteClave }})</span>
        <span><strong>Periodo:</strong> {{ periodLabel }}</span>
        <span><strong>Última actualización:</strong> {{ formattedUpdatedAt }}</span>
      </div>
    </div>

    <!-- PlanTrabajo: tabla de sesiones -->
    <template v-if="task.formatKey === 'PlanTrabajo'">
      <p v-if="sectionPayload.generalObjective" class="doc-paragraph">
        <strong>Objetivo general:</strong> {{ String(sectionPayload.generalObjective) }}
      </p>
      <table v-if="planSessions.length > 0" class="doc-table">
        <thead>
          <tr>
            <th>Sesión</th>
            <th>Fechas</th>
            <th>Título</th>
            <th>Objetivo</th>
            <th>Actividades estratégicas</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, idx) in planSessions" :key="idx">
            <td>{{ s.sessionNumber ?? idx + 1 }}</td>
            <td>{{ s.dateRange || '—' }}</td>
            <td>{{ s.title || '—' }}</td>
            <td>{{ s.objective || '—' }}</td>
            <td>{{ s.strategicActivities || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else class="doc-empty">El tutor aún no ha capturado sesiones en el Plan de Trabajo.</p>
    </template>

    <!-- DiagnosticoInicial: 4 preguntas -->
    <template v-else-if="task.formatKey === 'DiagnosticoInicial'">
      <table class="doc-table">
        <tbody>
          <tr>
            <th>1. Total alumnos recibidos</th>
            <td>{{ sectionPayload.totalReceivedStudents ?? '—' }}</td>
          </tr>
          <tr>
            <th>2. Desertores y motivos</th>
            <td>
              <strong>{{ sectionPayload.droppedOutCount ?? 0 }}</strong>
              <template v-if="sectionPayload.dropoutReasons"> — {{ String(sectionPayload.dropoutReasons) }}</template>
            </td>
          </tr>
          <tr>
            <th>3. Aprobados / Reprobados</th>
            <td>Aprobados: {{ sectionPayload.approvedCount ?? '—' }} · Reprobados: {{ sectionPayload.failedCount ?? '—' }}</td>
          </tr>
          <tr>
            <th>4. Características del grupo</th>
            <td>{{ sectionPayload.groupCharacteristics || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Otros anexos y hojas multi-pestaña -->
    <template v-else>
      <p v-if="tabKey" class="doc-paragraph">
        <strong>Hoja seleccionada:</strong> <code>{{ tabKey }}</code>
        <template v-if="sectionPayload.excelSheetName">
          (Excel: <code>{{ String(sectionPayload.excelSheetName) }}</code>)
        </template>
      </p>

      <div v-if="visibleEntries.length > 0" class="doc-kv-grid">
        <div v-for="entry in visibleEntries" :key="entry.key" class="doc-kv-item">
          <span class="doc-kv-label">{{ entry.key }}</span>
          <strong>{{ entry.value }}</strong>
        </div>
      </div>

      <table v-if="genericRows.length > 0" class="doc-table">
        <thead>
          <tr>
            <th v-for="col in Object.keys(genericRows[0]).slice(0, 7)" :key="col">{{ col }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, idx) in genericRows.slice(0, 25)" :key="idx">
            <td v-for="col in Object.keys(genericRows[0]).slice(0, 7)" :key="col">
              {{ Array.isArray(r[col]) ? (r[col] as unknown[]).join(', ') : (r[col] ?? '—') }}
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="visibleEntries.length === 0 && genericRows.length === 0" class="doc-empty">
        Documento sin modificaciones capturadas por el tutor en esta sección. Al descargar se entregará la plantilla oficial correspondiente ({{ meta.templateFileName }}).
      </p>
    </template>

    <div v-if="task.photoEvidenceUrls && task.photoEvidenceUrls.length > 0" class="doc-footer-note">
      <strong>Evidencias fotográficas anexadas:</strong> {{ task.photoEvidenceUrls.length }} archivo(s).
    </div>
  </div>
</template>

<style scoped>
.doc-sheet {
  padding: 1.125rem;
  background-color: #ffffff;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  max-height: 460px;
  overflow: auto;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.doc-header {
  border-bottom: 2px solid #1b396a;
  padding-bottom: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.doc-inst {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  color: #1b396a;
  letter-spacing: 0.03em;
}

.doc-title {
  margin: 0;
  font-size: 1rem;
  color: #0f172a;
}

.doc-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  font-size: 0.76rem;
  color: #334155;
}

.doc-meta-row code,
.doc-paragraph code {
  font-family: monospace;
  background-color: #f1f5f9;
  color: #0f172a;
  padding: 0.08rem 0.35rem;
  border-radius: 4px;
}

.doc-paragraph {
  margin: 0;
  font-size: 0.8rem;
}

.doc-kv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.5rem;
}

.doc-kv-item {
  padding: 0.4rem 0.55rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.doc-kv-label {
  font-size: 0.7rem;
  color: #64748b;
}

.doc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.74rem;
}

.doc-table th,
.doc-table td {
  border: 1px solid #cbd5e1;
  padding: 0.35rem 0.45rem;
  text-align: left;
  vertical-align: top;
}

.doc-table th {
  background-color: #f1f5f9;
  color: #1b396a;
}

.doc-empty {
  margin: 0;
  padding: 0.75rem;
  background-color: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  color: #475569;
}

.doc-footer-note {
  padding-top: 0.5rem;
  border-top: 1px solid #e2e8f0;
  font-size: 0.76rem;
  color: #334155;
}
</style>
