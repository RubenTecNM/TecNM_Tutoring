import { http } from '../../../shared/api/http'
import type {
  ComplianceFilters,
  DeliverableStatus,
  DeliverableTask,
  DocenteComplianceSummary,
  FormatKey,
  FormatTabDefinition,
  PaginatedResponse,
  PreviewFormat,
  TemplatePreviewResult,
} from '../types/compliance'

const MOCK_COMPLIANCE_TASKS_KEY = 'tecnm_compliance_tasks_v3'

const DOCENTES_CATALOG = [
  { clave: 'D0001', name: 'Ing. Carlos Alberto Mendoza Gómez' },
  { clave: 'D0002', name: 'M.C. Laura Elena Sánchez Morales' },
  { clave: 'D0003', name: 'Dr. Roberto García Villarreal' },
  { clave: 'D0004', name: 'Ing. Patricia Guadalupe Garza Reyes' },
  { clave: 'D0005', name: 'Lic. Fernando Ortiz Domínguez' },
  { clave: 'D0006', name: 'M.A. Silvia Margarita Treviño Luna' },
]

const MENSUAL_TABS: FormatTabDefinition[] = [
  { tabKey: 'anexo_14_trayectoria_academica', label: 'ANEXO 14 Trayectoria Academica' },
  { tabKey: 'anexo_15_desempeno_acad', label: 'ANEXO 15 desempeño acad' },
  { tabKey: 'seguimiento_ind_reprob', label: 'SEGUIMIENTO IND. REPROB.' },
  { tabKey: 'anexo_19a_mensual_tutor', label: 'Anexo 19A Mensual del tutor' },
  { tabKey: 'seguimiento_individual', label: 'SEGUIMIENTO INDIVIDUAL' },
  { tabKey: 'lista_asistencia', label: 'LISTA DE ASISTENCIA' },
]

const FINAL_TABS: FormatTabDefinition[] = [
  { tabKey: 'anexo_19_reporte_semestral', label: 'Anexo 19 Reporte Semestral' },
  { tabKey: 'informe_final_tutores', label: 'informe final de tutores' },
  { tabKey: 'resultados_indice_reprob', label: 'RESULTADOS DE INDICE DE REPROB.' },
  { tabKey: 'caracteristicas_gpo', label: 'CARACTERISTICAS DEL GPO.' },
]

const FORMAT_CATALOG: {
  formatKey: FormatKey
  title: string
  hasTabs: boolean
  tabs?: FormatTabDefinition[]
  monthP1: number
  monthP2: number
  requiresPhotoEvidence: boolean
  defaultStatus: DeliverableStatus
  defaultDelay: number
}[] = [
  {
    formatKey: 'PlanTrabajo',
    title: 'Plan de trabajo del tutor',
    hasTabs: false,
    monthP1: 2,
    monthP2: 9,
    requiresPhotoEvidence: false,
    defaultStatus: 'Pending',
    defaultDelay: 0,
  },
  {
    formatKey: 'DiagnosticoInicial',
    title: 'Informe del Diagnóstico',
    hasTabs: false,
    monthP1: 2,
    monthP2: 9,
    requiresPhotoEvidence: false,
    defaultStatus: 'Pending',
    defaultDelay: 0,
  },
  {
    formatKey: 'Anexo14',
    title: 'Anexo 14 — Trayectoria Académica',
    hasTabs: false,
    monthP1: 3,
    monthP2: 10,
    requiresPhotoEvidence: false,
    defaultStatus: 'Pending',
    defaultDelay: 0,
  },
  {
    formatKey: 'Anexo15',
    title: 'Anexo 15 — Desempeño Académico',
    hasTabs: false,
    monthP1: 4,
    monthP2: 11,
    requiresPhotoEvidence: false,
    defaultStatus: 'Pending',
    defaultDelay: 0,
  },
  {
    formatKey: 'Anexo19AMensual',
    title: 'Anexo 19-A — Reporte Mensual del Tutor',
    hasTabs: false,
    monthP1: 4,
    monthP2: 11,
    requiresPhotoEvidence: false,
    defaultStatus: 'Pending',
    defaultDelay: 0,
  },
  {
    formatKey: 'SeguimientoMensual',
    title: 'Seguimiento Mensual del Tutor (6 hojas)',
    hasTabs: true,
    tabs: MENSUAL_TABS,
    monthP1: 5,
    monthP2: 12,
    requiresPhotoEvidence: false,
    defaultStatus: 'Pending',
    defaultDelay: 0,
  },
  {
    formatKey: 'SeguimientoFinal',
    title: 'Seguimiento Final del Tutor (4 hojas)',
    hasTabs: true,
    tabs: FINAL_TABS,
    monthP1: 6,
    monthP2: 12,
    requiresPhotoEvidence: true,
    defaultStatus: 'Pending',
    defaultDelay: 0,
  },
]

export function resolveDocenteClave(username?: string): string {
  if (!username) return 'D0001'
  if (username === 'usuario') return 'D0001'
  if (username === 'usuario2') return 'D0002'
  return username
}

function buildDefaultTasks(periodoId: number): DeliverableTask[] {
  const all: DeliverableTask[] = []

  for (const doc of DOCENTES_CATALOG) {
    FORMAT_CATALOG.forEach((fmt) => {
      const tabsPayload = fmt.tabs
        ? Object.fromEntries(fmt.tabs.map((t) => [t.tabKey, { observations: '', items: [] }]))
        : undefined

      all.push({
        id: `${doc.clave}-${fmt.formatKey}-${periodoId}`,
        docenteClave: doc.clave,
        periodoId,
        formatKey: fmt.formatKey,
        title: fmt.title,
        hasTabs: fmt.hasTabs,
        tabs: fmt.tabs,
        activeTabKey: fmt.tabs?.[0]?.tabKey,
        reportingMonth: periodoId === 2 ? fmt.monthP2 : fmt.monthP1,
        status: fmt.defaultStatus,
        delayDays: fmt.defaultDelay,
        requiresPhotoEvidence: fmt.requiresPhotoEvidence,
        photoEvidenceUrls: [],
        prefilledData: {
          docente_clave: doc.clave,
          docente_nombre: doc.name,
          periodo_id: periodoId,
          plantel: 'TecNM Campus Monclova',
        },
        formPayload: fmt.hasTabs
          ? { tabs: tabsPayload, observations: '' }
          : { checklist: [], observations: '' },
      })
    })
  }

  return all
}

function loadMockStore(): Record<string, DeliverableTask[]> {
  try {
    const raw = localStorage.getItem(MOCK_COMPLIANCE_TASKS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, DeliverableTask[]>
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch {
    // Ignorar errores de acceso a localStorage
  }
  return {}
}

function saveMockStore(store: Record<string, DeliverableTask[]>): void {
  try {
    localStorage.setItem(MOCK_COMPLIANCE_TASKS_KEY, JSON.stringify(store))
  } catch {
    // Ignorar errores de cuota
  }
}

function getMockTasksForPeriod(periodoId: number): DeliverableTask[] {
  const store = loadMockStore()
  const key = String(periodoId)
  if (!store[key] || store[key].length === 0) {
    store[key] = buildDefaultTasks(periodoId)
    saveMockStore(store)
  }
  return store[key]
}

export const complianceApi = {
  async getDeliverables(
    docenteClave: string,
    periodoId: number,
    page = 1,
    limit = 20,
    filters?: Pick<ComplianceFilters, 'month' | 'formatKey' | 'status'>,
  ): Promise<PaginatedResponse<DeliverableTask>> {
    const normalizedClave = resolveDocenteClave(docenteClave)
    try {
      const { data } = await http.get<PaginatedResponse<DeliverableTask>>(
        `/compliance/${normalizedClave}/${periodoId}`,
        { params: { page, limit, ...filters } },
      )
      return data
    } catch {
      const periodItems = getMockTasksForPeriod(periodoId)
      let items = periodItems.filter((d) => d.docenteClave === normalizedClave)
      if (items.length === 0) {
        items = periodItems.filter((d) => d.docenteClave === 'D0001')
      }
      if (filters?.month) items = items.filter((i) => i.reportingMonth === filters.month)
      if (filters?.formatKey) items = items.filter((i) => i.formatKey === filters.formatKey)
      if (filters?.status) items = items.filter((i) => i.status === filters.status)

      const total = items.length
      const start = (page - 1) * limit
      return {
        data: items.slice(start, start + limit),
        page,
        limit,
        total,
      }
    }
  },

  async getDocenteSummaries(
    filters: ComplianceFilters,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResponse<DocenteComplianceSummary>> {
    try {
      const { data } = await http.get<PaginatedResponse<DocenteComplianceSummary>>(
        '/compliance/summary',
        { params: { ...filters, page, limit } },
      )
      return data
    } catch {
      const periodItems = getMockTasksForPeriod(filters.periodoId)

      let summaries: DocenteComplianceSummary[] = DOCENTES_CATALOG.map((doc) => {
        let docItems = periodItems.filter((d) => d.docenteClave === doc.clave)
        if (filters.month) docItems = docItems.filter((i) => i.reportingMonth === filters.month)
        if (filters.formatKey) docItems = docItems.filter((i) => i.formatKey === filters.formatKey)
        if (filters.status) docItems = docItems.filter((i) => i.status === filters.status)

        const onTime = docItems.filter((d) => d.status === 'OnTime').length
        const late = docItems.filter((d) => d.status === 'Late').length
        const pending = docItems.filter((d) => d.status === 'Pending').length
        const totalDelayDays = docItems.reduce((acc, curr) => acc + curr.delayDays, 0)

        return {
          docenteClave: doc.clave,
          docenteName: doc.name,
          totalDeliverables: docItems.length,
          onTime,
          late,
          pending,
          totalDelayDays,
        }
      })

      if (filters.search?.trim()) {
        const q = filters.search.trim().toLowerCase()
        summaries = summaries.filter(
          (s) => s.docenteClave.toLowerCase().includes(q) || s.docenteName.toLowerCase().includes(q),
        )
      }

      const total = summaries.length
      const start = (page - 1) * limit
      return {
        data: summaries.slice(start, start + limit),
        page,
        limit,
        total,
      }
    }
  },

  async getDeliverableForm(deliverableId: string, tabKey?: string): Promise<DeliverableTask> {
    try {
      const { data } = await http.get<DeliverableTask>(`/compliance/tasks/${deliverableId}`, {
        params: { tabKey },
      })
      return data
    } catch {
      const store = loadMockStore()
      for (const key of Object.keys(store)) {
        const found = store[key].find((t) => t.id === deliverableId)
        if (found) {
          return {
            ...found,
            activeTabKey: tabKey ?? found.activeTabKey ?? found.tabs?.[0]?.tabKey,
          }
        }
      }
      throw new Error(`Tarea no encontrada: ${deliverableId}`)
    }
  },

  async saveDeliverableForm(
    deliverableId: string,
    payload: {
      tabKey?: string
      formPayload: Record<string, unknown>
      photoEvidenceFiles?: File[]
      submit?: boolean
    },
  ): Promise<DeliverableTask> {
    try {
      const hasFiles = Boolean(payload.photoEvidenceFiles && payload.photoEvidenceFiles.length > 0)
      if (hasFiles) {
        const formData = new FormData()
        formData.append('formPayload', JSON.stringify(payload.formPayload))
        if (payload.tabKey) formData.append('tabKey', payload.tabKey)
        formData.append('submit', String(Boolean(payload.submit)))
        payload.photoEvidenceFiles!.forEach((file) => formData.append('photoEvidenceFiles', file))
        const { data } = await http.post<DeliverableTask>(
          `/compliance/tasks/${deliverableId}/form`,
          formData,
        )
        return data
      }

      const { data } = await http.put<DeliverableTask>(
        `/compliance/tasks/${deliverableId}/form`,
        {
          tabKey: payload.tabKey,
          formPayload: payload.formPayload,
          submit: Boolean(payload.submit),
        },
      )
      return data
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 409 || status === 413 || status === 415 || status === 422) {
        throw error
      }
      const store = loadMockStore()
      for (const key of Object.keys(store)) {
        const item = store[key].find((t) => t.id === deliverableId)
        if (item) {
          if (payload.tabKey && item.hasTabs) {
            const currentTabs =
              (item.formPayload.tabs as Record<string, unknown> | undefined) ?? {}
            item.formPayload = {
              ...item.formPayload,
              tabs: {
                ...currentTabs,
                [payload.tabKey]: payload.formPayload,
              },
            }
            item.activeTabKey = payload.tabKey
          } else {
            item.formPayload = {
              ...item.formPayload,
              ...payload.formPayload,
            }
          }

          if (item.requiresPhotoEvidence && payload.photoEvidenceFiles?.length) {
            const newUrls = payload.photoEvidenceFiles.map((f) => URL.createObjectURL(f))
            item.photoEvidenceUrls = [...(item.photoEvidenceUrls ?? []), ...newUrls]
          }

          if (payload.submit) {
            item.status = 'OnTime'
            item.delayDays = 0
          }
          item.updatedAt = new Date().toISOString()
          saveMockStore(store)
          return { ...item }
        }
      }
      throw new Error(`No se pudo guardar la tarea: ${deliverableId}`)
    }
  },

  async previewDeliverableTemplate(
    deliverableId: string,
    tabKey?: string,
    format: PreviewFormat = 'pdf',
  ): Promise<TemplatePreviewResult> {
    try {
      const { data } = await http.get<TemplatePreviewResult>(
        `/compliance/tasks/${deliverableId}/preview`,
        { params: { tabKey, format } },
      )
      return data
    } catch {
      return {
        deliverableId,
        tabKey,
        previewFormat: format,
        previewUrlOrContent: '',
        fileName: `${deliverableId}${tabKey ? `_${tabKey}` : ''}.${format}`,
      }
    }
  },

  async exportDeliverableTemplate(deliverableId: string, tabKey?: string): Promise<Blob> {
    const { data } = await http.get<Blob>(`/compliance/tasks/${deliverableId}/export`, {
      params: { tabKey },
      responseType: 'blob',
    })
    return data
  },
}