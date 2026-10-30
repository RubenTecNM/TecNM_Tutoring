export interface Deliverable {
  id: string;
  docenteClave: string;
  periodoId: number;
  reportType: 'PlanTrabajo' | 'DiagnosticoInicial' | 'Anexo14' | 'Anexo15' | 'Anexo19AMensual' | 'Asistencia' | 'Anexo19Final';
  reportingMonth: number;
  status: 'Pending' | 'OnTime' | 'Late';
  delayDays: number;
  fileId?: number;
}