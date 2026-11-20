import { http } from '../../../shared/api/http'
import type { Deliverable, DocenteComplianceSummary, DeliverableStatus, ReportType } from '../types/compliance'

const MOCK_COMPLIANCE_KEY = 'tecnm_compliance_mock_v2'

const DOCENTES_CATALOG = [
  { clave: 'D0001', name: 'Ing. Carlos Alberto Mendoza Gómez' },
  { clave: 'D0002', name: 'M.C. Laura Elena Sánchez Morales' },
  { clave: 'D0003', name: 'Dr. Roberto García Villarreal' },
  { clave: 'D0004', name: 'Ing. Patricia Guadalupe Garza Reyes' },
  { clave: 'D0005', name: 'Lic. Fernando Ortiz Domínguez' },
  { clave: 'D0006', name: 'M.A. Silvia Margarita Treviño Luna' },
]

const REPORT_TYPES: { type: ReportType; monthP1: number; monthP2: number }[] = [
  { type: 'PlanTrabajo', monthP1: 2, monthP2: 9 },
  { type: 'DiagnosticoInicial', monthP1: 2, monthP2: 9 },
  { type: 'Anexo14', monthP1: 3, monthP2: 10 },
  { type: 'Anexo15', monthP1: 4, monthP2: 11 },
  { type: 'Anexo19AMensual', monthP1: 4, monthP2: 11 },
  { type: 'Asistencia', monthP1: 5, monthP2: 12 },
  { type: 'Anexo19Final', monthP1: 6, monthP2: 12 },
]

// D0001 (usuario) y D0002 (usuario2) inician limpios (todos Pendientes, sin archivos demo)
const INITIAL_PROFILES: Record<string, { status: DeliverableStatus; delay: number; fileName?: string }[]> = {
  D0001: [
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
  ],
  D0002: [
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
  ],
  D0003: [
    { status: 'OnTime', delay: 0, fileName: 'PlanTrabajo_D0003.pdf' },
    { status: 'OnTime', delay: 0, fileName: 'Diagnostico_D0003.pdf' },
    { status: 'Late', delay: 3, fileName: 'Anexo14_D0003.pdf' },
    { status: 'Late', delay: 5, fileName: 'Anexo15_D0003.pdf' },
    { status: 'Late', delay: 3, fileName: 'Anexo19A_D0003.pdf' },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
  ],
  D0004: [
    { status: 'OnTime', delay: 0, fileName: 'PlanTrabajo_D0004.pdf' },
    { status: 'OnTime', delay: 0, fileName: 'Diagnostico_D0004.pdf' },
    { status: 'OnTime', delay: 0, fileName: 'Anexo14_D0004.pdf' },
    { status: 'OnTime', delay: 0, fileName: 'Anexo15_D0004.pdf' },
    { status: 'Late', delay: 3, fileName: 'Anexo19A_D0004.pdf' },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
  ],
  D0005: [
    { status: 'OnTime', delay: 0, fileName: 'PlanTrabajo_D0005.pdf' },
    { status: 'OnTime', delay: 0, fileName: 'Diagnostico_D0005.pdf' },
    { status: 'OnTime', delay: 0, fileName: 'Anexo14_D0005.pdf' },
    { status: 'OnTime', delay: 0, fileName: 'Anexo15_D0005.pdf' },
    { status: 'OnTime', delay: 0, fileName: 'Anexo19A_D0005.pdf' },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
  ],
  D0006: [
    { status: 'OnTime', delay: 0, fileName: 'PlanTrabajo_D0006.pdf' },
    { status: 'Late', delay: 4, fileName: 'Diagnostico_D0006.pdf' },
    { status: 'Late', delay: 5, fileName: 'Anexo14_D0006.pdf' },
    { status: 'Late', delay: 4, fileName: 'Anexo15_D0006.pdf' },
    { status: 'Late', delay: 5, fileName: 'Anexo19A_D0006.pdf' },
    { status: 'Pending', delay: 0 },
    { status: 'Pending', delay: 0 },
  ],
}

export function resolveDocenteClave(username?: string): string {
  if (!username) return 'D0001'
  if (username === 'usuario') return 'D0001'
  if (username === 'usuario2') return 'D0002'
  return username
}

function buildDefaultDeliverables(periodoId: number): Deliverable[] {
  const all: Deliverable[] = []
  for (const doc of DOCENTES_CATALOG) {
    const profile = INITIAL_PROFILES[doc.clave] ?? INITIAL_PROFILES.D0001
    REPORT_TYPES.forEach((rt, idx) => {
      all.push({
        id: `${doc.clave}-${rt.type}-${periodoId}`,
        docenteClave: doc.clave,
        periodoId,
        reportType: rt.type,
        reportingMonth: periodoId === 2 ? rt.monthP2 : rt.monthP1,
        status: profile[idx].status,
        delayDays: profile[idx].delay,
        fileName: profile[idx].fileName,
      })
    })
  }
  return all
}

function loadMockStore(): Record<string, Deliverable[]> {
  try {
    const raw = localStorage.getItem(MOCK_COMPLIANCE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Deliverable[]>
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch {
    // Ignorar errores de acceso a localStorage
  }
  return {}
}

function saveMockStore(store: Record<string, Deliverable[]>): void {
  try {
    localStorage.setItem(MOCK_COMPLIANCE_KEY, JSON.stringify(store))
  } catch {
    // Ignorar errores de cuota
  }
}

function getMockDeliverablesForPeriod(periodoId: number): Deliverable[] {
  const store = loadMockStore()
  const key = String(periodoId)
  if (!store[key] || store[key].length === 0) {
    store[key] = buildDefaultDeliverables(periodoId)
    saveMockStore(store)
  }
  return store[key]
}

export const complianceApi = {
  async getDeliverablesByDocente(docenteClave: string, periodoId: number): Promise<Deliverable[]> {
    const normalizedClave = resolveDocenteClave(docenteClave)
    try {
      const { data } = await http.get<Deliverable[]>(`/compliance/${normalizedClave}/${periodoId}`)
      return data
    } catch {
      const periodItems = getMockDeliverablesForPeriod(periodoId)
      const byDocente = periodItems.filter((d) => d.docenteClave === normalizedClave)
      if (byDocente.length > 0) return byDocente
      return periodItems.filter((d) => d.docenteClave === 'D0001')
    }
  },

  async getDocenteSummaries(periodoId: number): Promise<DocenteComplianceSummary[]> {
    try {
      const { data } = await http.get<DocenteComplianceSummary[]>(`/compliance/summary?periodoId=${periodoId}`)
      return data
    } catch {
      const periodItems = getMockDeliverablesForPeriod(periodoId)

      return DOCENTES_CATALOG.map((doc) => {
        const docDeliverables = periodItems.filter((d) => d.docenteClave === doc.clave)
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
      await new Promise((resolve) => setTimeout(resolve, 400))
      const store = loadMockStore()
      for (const key of Object.keys(store)) {
        const item = store[key].find((d) => d.id === deliverableId)
        if (item) {
          item.status = 'OnTime'
          item.delayDays = 0
          item.fileName = file.name
          item.uploadedAt = new Date().toISOString()
          saveMockStore(store)
          break
        }
      }
    }
  },
}
