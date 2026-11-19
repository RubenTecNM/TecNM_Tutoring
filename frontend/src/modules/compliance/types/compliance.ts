export type ReportType =
  | 'PlanTrabajo'
  | 'DiagnosticoInicial'
  | 'Anexo14'
  | 'Anexo15'
  | 'Anexo19AMensual'
  | 'Asistencia'
  | 'Anexo19Final'

export type DeliverableStatus = 'Pending' | 'OnTime' | 'Late'

export interface Deliverable {
  id: string
  docenteClave: string
  periodoId: number
  reportType: ReportType
  reportingMonth: number
  status: DeliverableStatus
  delayDays: number
  fileId?: number
}

export interface DocenteComplianceSummary {
  docenteClave: string
  docenteName: string
  totalDeliverables: number
  pending: number
  onTime: number
  late: number
  totalDelayDays: number
  deliverables?: Deliverable[]
}

export interface ComplianceFilters {
  periodoId: number
  month?: number
  reportType?: ReportType
  status?: DeliverableStatus
}
