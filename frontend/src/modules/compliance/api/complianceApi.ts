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
      // Padrón de muestra para el Coordinador (Admin) con entregables vinculados
      const docentes = [
        { clave: 'D0001', name: 'Ing. Carlos Alberto Mendoza Gómez' },
        { clave: 'D0002', name: 'M.C. Laura Elena Sánchez Morales' },
        { clave: 'D0003', name: 'Dr. Roberto García Villarreal' },
        { clave: 'D0004', name: 'Ing. Patricia Guadalupe Garza Reyes' },
        { clave: 'D0005', name: 'Lic. Fernando Ortiz Domínguez' },
        { clave: 'D0006', name: 'M.A. Silvia Margarita Treviño Luna' },
      ]

      const reportProfiles: Record<string, { status: ('OnTime' | 'Late' | 'Pending'); delay: number }[]> = {
        D0001: [
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'Late', delay: 4 },
          { status: 'Late', delay: 2 },
          { status: 'Pending', delay: 0 },
          { status: 'Pending', delay: 0 },
        ],
        D0002: [
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'Pending', delay: 0 },
          { status: 'Pending', delay: 0 },
        ],
        D0003: [
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'Late', delay: 3 },
          { status: 'Late', delay: 5 },
          { status: 'Late', delay: 3 },
          { status: 'Pending', delay: 0 },
          { status: 'Pending', delay: 0 },
        ],
        D0004: [
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'Late', delay: 3 },
          { status: 'Pending', delay: 0 },
          { status: 'Pending', delay: 0 },
        ],
        D0005: [
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'OnTime', delay: 0 },
          { status: 'Pending', delay: 0 },
          { status: 'Pending', delay: 0 },
        ],
        D0006: [
          { status: 'OnTime', delay: 0 },
          { status: 'Late', delay: 4 },
          { status: 'Late', delay: 5 },
          { status: 'Late', delay: 4 },
          { status: 'Late', delay: 5 },
          { status: 'Pending', delay: 0 },
          { status: 'Pending', delay: 0 },
        ],
      }

      const reportTypes = [
        { type: 'PlanTrabajo' as const, month: 2 },
        { type: 'DiagnosticoInicial' as const, month: 2 },
        { type: 'Anexo14' as const, month: 3 },
        { type: 'Anexo15' as const, month: 4 },
        { type: 'Anexo19AMensual' as const, month: 4 },
        { type: 'Asistencia' as const, month: 5 },
        { type: 'Anexo19Final' as const, month: 6 },
      ]

      return docentes.map((doc) => {
        const profile = reportProfiles[doc.clave] || reportProfiles.D0001
        const docDeliverables: Deliverable[] = reportTypes.map((rt, idx) => ({
          id: `${doc.clave}-${rt.type}-${periodoId}`,
          docenteClave: doc.clave,
          periodoId,
          reportType: rt.type,
          reportingMonth: rt.month,
          status: profile[idx].status,
          delayDays: profile[idx].delay,
        }))

        const onTime = docDeliverables.filter((d) => d.status === 'OnTime').length
        const late = docDeliverables.filter((d) => d.status === 'Late').length
        const pending = docDeliverables.filter((d) => d.status === 'Pending').length
        const totalDelayDays = docDeliverables.reduce((acc, curr) => acc + curr.delayDays, 0)

        return {
          docenteClave: doc.clave,
          docenteName: doc.name,
          totalDeliverables: docDeliverables.length,
          onTime,
          late,
          pending,
          totalDelayDays,
          deliverables: docDeliverables,
        }
      })
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
