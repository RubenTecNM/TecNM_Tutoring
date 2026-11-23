export type FormatKey =
  | 'PlanTrabajo'
  | 'DiagnosticoInicial'
  | 'Anexo14'
  | 'Anexo15'
  | 'Anexo19AMensual'
  | 'SeguimientoMensual'
  | 'SeguimientoFinal'

/**
 * Unión de claves de formato/anexo (incluye alias históricos para no romper vistas previas).
 */
export type ReportType =
  | FormatKey
  | 'Asistencia'
  | 'Anexo19Final'

export type DeliverableStatus = 'Pending' | 'OnTime' | 'Late'

export type PreviewFormat = 'pdf' | 'xlsx'

export interface FormatTabDefinition {
  tabKey: string
  label: string
  requiresPhotoEvidence?: boolean
}

export interface PrefilledFieldValue {
  key: string
  label: string
  value: string | number | boolean | null
}

export interface DeliverableTask {
  id: string
  docenteClave: string
  periodoId: number
  formatKey: FormatKey
  reportType?: ReportType
  title: string
  hasTabs: boolean
  tabs?: FormatTabDefinition[]
  activeTabKey?: string
  reportingMonth?: number
  status: DeliverableStatus
  delayDays: number
  requiresPhotoEvidence: boolean
  photoEvidenceUrls?: string[]
  prefilledData: Record<string, unknown>
  formPayload: Record<string, unknown>
  updatedAt?: string
  // Campos legados opcionales por compatibilidad temporal
  fileId?: number
  fileName?: string
  uploadedAt?: string
}

/** Alias de compatibilidad para código existente */
export type Deliverable = DeliverableTask

export interface DocenteComplianceSummary {
  docenteClave: string
  docenteName: string
  totalDeliverables: number
  pending: number
  onTime: number
  late: number
  totalDelayDays: number
  deliverables?: DeliverableTask[]
}

export interface ComplianceFilters {
  periodoId: number
  month?: number
  formatKey?: FormatKey
  reportType?: ReportType
  status?: DeliverableStatus
  search?: string
}

export interface TemplatePreviewResult {
  deliverableId: string
  tabKey?: string
  previewFormat: PreviewFormat
  previewUrlOrContent: string
  fileName: string
}

export interface PaginatedResponse<T> {
  data: T[]
  page: number
  limit: number
  total: number
}

export type PlanTrabajoSignatureMode = 'name_confirmation' | 'canvas' | 'image'

export interface PlanTrabajoSession {
  sessionNumber: number
  dateRange: string
  title: string
  objective: string
  strategicActivities: string
}

export interface PlanTrabajoPayload {
  semesterLabel: string
  groupSemester: string
  career: string
  shift: 'Matutino' | 'Vespertino'
  generalObjective: string
  sessions: PlanTrabajoSession[]
  monthlyActivitiesConfirmed: boolean
  monthlyActivitiesNotes: string
  tutorName: string
  tutorSignatureConfirmed: boolean
  signatureMode: PlanTrabajoSignatureMode
  signatureDataUrl?: string
}

export interface DiagnosticoInicialPayload {
  sheetKey: 'informe_del_diagnostico'
  excelSheetName: string
  tutorName: string
  reportDate: string
  groupName: string
  shift: 'Matutino' | 'Vespertino'
  periodLabel: string
  totalReceivedStudents: number
  droppedOutCount: number
  dropoutReasons: string
  approvedCount: number
  failedCount: number
  groupCharacteristics: string
}

export type Anexo14IncidenceCode = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface Anexo14StudentRow {
  listNumber: number
  controlNumber: string
  studentName: string
  /** Mapa índice de asignatura (0..5) -> lista de códigos de incidencia marcados (1..7) */
  incidencesBySubject: Record<number, Anexo14IncidenceCode[]>
}

export interface Anexo14Payload {
  instituteName: string
  career: string
  semester: string
  monthLabel: string
  tutorName: string
  groupName: string
  classroom: string
  partialEvaluation: string
  subjects: string[]
  students: Anexo14StudentRow[]
  individualSessions: number
  groupSessions: number
  observations: string
  reportDate: string
  tutorSignatureConfirmed: boolean
  signatureMode: PlanTrabajoSignatureMode
  signatureDataUrl?: string
  coordinatorName: string
}

export interface Anexo15SubjectRow {
  rowNumber: number
  subjectName: string
  /** Calificaciones de temas I..VIII (índices 0..7); cadena vacía si no evaluado, 0..100 si evaluado */
  topics: string[]
  observations: string
}

export interface Anexo15Payload {
  semester: string
  studentControlNumber?: string
  studentName: string
  passingGrade: number
  subjects: Anexo15SubjectRow[]
}