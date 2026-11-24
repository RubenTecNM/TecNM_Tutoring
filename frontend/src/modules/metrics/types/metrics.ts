import type { PaginatedResponse, PreviewFormat } from '../../compliance/types/compliance'

export type CoordinatorFormatKey =
  | 'ReporteSemestralCoordinador'
  | 'MatrizControlCoordinacion'

export type CoordinatorSheetKey =
  | 'hoja1'
  | 'hoja2'
  | 'actividades'
  | 'asesores'
  | 'primero_y_tercero'
  | 'quinto_y_septimo'

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical'

export type WorkbookStatus = 'Draft' | 'Ready' | 'Finalized'

export interface FinalReportReadiness {
  periodoId: number
  totalTutors: number
  completedDeliveries: number
  totalExpectedDeliveries: number
  compliancePercentage: number
  requiredThresholdPercentage: number
  canGenerateFinalReport: boolean
}

export interface CoordinatorWorkbookTab {
  tabKey: CoordinatorSheetKey
  label: string
  excelSheetName: string
  isCompleted: boolean
  prefilledData: Record<string, unknown>
  tabPayload: Record<string, unknown>
  rowVersion: number
}

export interface CoordinatorWorkbook {
  id: string
  periodoId: number
  formatKey: CoordinatorFormatKey
  title: string
  templateFileName: string
  status: WorkbookStatus
  compliancePercentage: number
  tabs: CoordinatorWorkbookTab[]
  rowVersion: number
  finalizedAt?: string
  updatedAt?: string
}

export interface SaveCoordinatorTabPayload {
  tabKey: CoordinatorSheetKey
  tabPayload: Record<string, unknown>
  rowVersion: number
  markCompleted?: boolean
}

export interface FailureReportItem {
  id: string
  periodoId: number
  docenteClave: string
  docenteName?: string
  claveMateria: string
  subjectName?: string
  grupo: string
  reportingMonth: number
  totalStudents: number
  failedStudents: number
  failurePercentage: number
  failedUnits?: string
  riskLevel: RiskLevel
  preventiveActions?: string
  requiresIntervention: boolean
  createdAt?: string
}

export interface CreateFailureReportRequest {
  periodoId: number
  claveMateria: string
  subjectName?: string
  grupo: string
  reportingMonth: number
  totalStudents: number
  failedStudents: number
  failedUnits?: string
  preventiveActions?: string
}

export interface MetricsFilters {
  periodoId: number
  month?: number
  riskLevel?: RiskLevel
  search?: string
}

export interface UnitResultsImportResponse {
  importId: string
  periodoId: number
  fileName: string
  importedRows: number
  highRiskSubjects: number
  importedAt: string
}

export interface WorkbookPreviewResult {
  workbookId: string
  tabKey?: CoordinatorSheetKey
  previewFormat: PreviewFormat
  previewUrlOrContent: string
  fileName: string
}

export interface UnitFailureRow {
  id: string
  subjectName: string
  teacherName: string
  /** Porcentajes de reprobación por unidad I..VIII (0..100, cadena vacía si no evaluada) */
  units: string[]
}

export interface UnitFailureTrackingPayload {
  periodoId: number
  rows: UnitFailureRow[]
  comments: string
  updatedAt?: string
}

export type PaginatedFailureReports = PaginatedResponse<FailureReportItem>
