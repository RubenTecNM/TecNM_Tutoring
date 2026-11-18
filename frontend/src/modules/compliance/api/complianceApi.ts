import { http } from '../../../shared/api/http'
import type { Deliverable, DocenteComplianceSummary } from '../types/compliance'

export const complianceApi = {
  async getDeliverablesByDocente(docenteClave: string, periodoId: number): Promise<Deliverable[]> {
    try {
      const { data } = await http.get<Deliverable[]>(`/compliance/${docenteClave}/${periodoId}`)
      return data
    } catch {
      // Fallback local con los 7 formatos obligatorios institucionales
      return [
        {
          id: '1',
          docenteClave,
          periodoId,
          reportType: 'PlanTrabajo',
          reportingMonth: 2,
          status: 'OnTime',
          delayDays: 0,
        },
        {
          id: '2',
          docenteClave,
          periodoId,
          reportType: 'DiagnosticoInicial',
          reportingMonth: 2,
          status: 'OnTime',
          delayDays: 0,
        },
        {
          id: '3',
          docenteClave,
          periodoId,
          reportType: 'Anexo14',
          reportingMonth: 3,
          status: 'OnTime',
          delayDays: 0,
        },
        {
          id: '4',
          docenteClave,
          periodoId,
          reportType: 'Anexo15',
          reportingMonth: 4,
          status: 'Late',
          delayDays: 4,
        },
        {
          id: '5',
          docenteClave,
          periodoId,
          reportType: 'Anexo19AMensual',
          reportingMonth: 4,
          status: 'Late',
          delayDays: 2,
        },
        {
          id: '6',
          docenteClave,
          periodoId,
          reportType: 'Asistencia',
          reportingMonth: 5,
          status: 'Pending',
          delayDays: 0,
        },
        {
          id: '7',
          docenteClave,
          periodoId,
          reportType: 'Anexo19Final',
          reportingMonth: 6,
          status: 'Pending',
          delayDays: 0,
        },
      ]
    }
  },

  async getDocenteSummaries(periodoId: number): Promise<DocenteComplianceSummary[]> {
    try {
      const { data } = await http.get<DocenteComplianceSummary[]>(`/compliance/summary?periodoId=${periodoId}`)
      return data
    } catch {
      // Padrón de muestra para el Coordinador (Admin)
      return [
        {
          docenteClave: 'D0001',
          docenteName: 'Ing. Carlos Alberto Mendoza Gómez',
          totalDeliverables: 7,
          onTime: 3,
          late: 2,
          pending: 2,
          totalDelayDays: 6,
        },
        {
          docenteClave: 'D0002',
          docenteName: 'M.C. Laura Elena Sánchez Morales',
          totalDeliverables: 7,
          onTime: 5,
          late: 0,
          pending: 2,
          totalDelayDays: 0,
        },
        {
          docenteClave: 'D0003',
          docenteName: 'Dr. Roberto García Villarreal',
          totalDeliverables: 7,
          onTime: 2,
          late: 3,
          pending: 2,
          totalDelayDays: 11,
        },
        {
          docenteClave: 'D0004',
          docenteName: 'Ing. Patricia Guadalupe Garza Reyes',
          totalDeliverables: 7,
          onTime: 4,
          late: 1,
          pending: 2,
          totalDelayDays: 3,
        },
        {
          docenteClave: 'D0005',
          docenteName: 'Lic. Fernando Ortiz Domínguez',
          totalDeliverables: 7,
          onTime: 5,
          late: 0,
          pending: 2,
          totalDelayDays: 0,
        },
        {
          docenteClave: 'D0006',
          docenteName: 'M.A. Silvia Margarita Treviño Luna',
          totalDeliverables: 7,
          onTime: 1,
          late: 4,
          pending: 2,
          totalDelayDays: 18,
        },
      ]
    }
  },

  async uploadDeliverable(deliverableId: string, file: File): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)
    try {
      await http.post(`/compliance/${deliverableId}/upload`, formData)
    } catch {
      // Simulación exitosa mientras no haya endpoint mutativo
      await new Promise((resolve) => setTimeout(resolve, 800))
    }
  },
}
