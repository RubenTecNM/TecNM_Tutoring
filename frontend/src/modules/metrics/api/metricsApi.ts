import { http } from '../../../shared/api/http'
import type { PreviewFormat } from '../../compliance/types/compliance'
import type {
  CoordinatorFormatKey,
  CoordinatorSheetKey,
  CoordinatorWorkbook,
  CreateFailureReportRequest,
  FailureReportItem,
  FinalReportReadiness,
  MetricsFilters,
  PaginatedFailureReports,
  RiskLevel,
  SaveCoordinatorTabPayload,
  UnitFailureTrackingPayload,
  UnitResultsImportResponse,
  WorkbookPreviewResult,
} from '../types/metrics'

const MOCK_FAILURES_KEY = 'tecnm_metrics_failures_v1'
const MOCK_WORKBOOKS_KEY = 'tecnm_metrics_workbooks_v1'
const MOCK_IMPORTS_KEY = 'tecnm_metrics_unit_imports_v1'
const MOCK_UNIT_TRACKING_KEY = 'tecnm_metrics_unit_tracking_v1'
const MOCK_COMPLIANCE_TASKS_KEY = 'tecnm_compliance_tasks_v3'

const BUSINESS_ERROR_STATUSES = new Set([409, 413, 415, 422])

function shouldRethrowBusinessError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  return status !== undefined && BUSINESS_ERROR_STATUSES.has(status)
}

function computeRiskLevel(percentage: number): RiskLevel {
  if (percentage >= 45) return 'Critical'
  if (percentage >= 30) return 'High'
  if (percentage >= 15) return 'Medium'
  return 'Low'
}

const DEFAULT_FAILURES: FailureReportItem[] = [
  {
    id: 'fail-001',
    periodoId: 1,
    docenteClave: 'D0001',
    docenteName: 'Ing. Carlos Alberto Mendoza Gómez',
    claveMateria: 'ACF-0901',
    subjectName: 'Cálculo Diferencial',
    grupo: '1A',
    reportingMonth: 3,
    totalStudents: 35,
    failedStudents: 14,
    failurePercentage: 40,
    failedUnits: 'I, II',
    riskLevel: 'High',
    preventiveActions: 'Asesorías vespertinas en Ciencias Básicas y canalización a Tutorías.',
    requiresIntervention: true,
    createdAt: '2026-03-08T10:15:00Z',
  },
  {
    id: 'fail-002',
    periodoId: 1,
    docenteClave: 'D0002',
    docenteName: 'M.C. Laura Elena Sánchez Morales',
    claveMateria: 'AED-1026',
    subjectName: 'Estructura de Datos',
    grupo: '3B',
    reportingMonth: 3,
    totalStudents: 30,
    failedStudents: 15,
    failurePercentage: 50,
    failedUnits: 'II, III',
    riskLevel: 'Critical',
    preventiveActions: 'Taller intensivo de práctica y seguimiento individual con tutor.',
    requiresIntervention: true,
    createdAt: '2026-03-09T14:20:00Z',
  },
  {
    id: 'fail-003',
    periodoId: 1,
    docenteClave: 'D0003',
    docenteName: 'Dr. Roberto García Villarreal',
    claveMateria: 'ACA-0907',
    subjectName: 'Taller de Ética',
    grupo: '1C',
    reportingMonth: 2,
    totalStudents: 40,
    failedStudents: 4,
    failurePercentage: 10,
    failedUnits: 'I',
    riskLevel: 'Low',
    preventiveActions: 'Seguimiento regular en sesión grupal.',
    requiresIntervention: false,
    createdAt: '2026-02-12T09:00:00Z',
  },
]

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    // Ignorar error de almacenamiento local
  }
  return fallback
}

function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignorar cuota localStorage
  }
}

function getMockFailures(): FailureReportItem[] {
  const existing = loadJson<FailureReportItem[] | null>(MOCK_FAILURES_KEY, null)
  if (existing && Array.isArray(existing)) return existing
  saveJson(MOCK_FAILURES_KEY, DEFAULT_FAILURES)
  return [...DEFAULT_FAILURES]
}

function computeMockReadiness(periodoId: number): FinalReportReadiness {
  const complianceStore = loadJson<Record<string, { docenteClave: string; status: string }[]>>(
    MOCK_COMPLIANCE_TASKS_KEY,
    {},
  )
  const periodTasks = complianceStore[String(periodoId)] ?? []

  if (periodTasks.length > 0) {
    const totalExpected = periodTasks.length
    const completed = periodTasks.filter(
      (t) => t.status === 'OnTime' || t.status === 'Late',
    ).length
    const totalTutors = new Set(periodTasks.map((t) => t.docenteClave)).size
    const percentage = totalExpected > 0 ? Number(((completed * 100) / totalExpected).toFixed(2)) : 0
    return {
      periodoId,
      totalTutors,
      completedDeliveries: completed,
      totalExpectedDeliveries: totalExpected,
      compliancePercentage: percentage,
      requiredThresholdPercentage: 90,
      canGenerateFinalReport: percentage >= 90,
    }
  }

  // Fallback determinista: 9 de 10 (90%) en periodo 1 para validar flujo completo, 6 de 10 (60%) en periodo 2
  const completed = periodoId === 1 ? 9 : 6
  const totalExpected = 10
  const percentage = Number(((completed * 100) / totalExpected).toFixed(2))
  return {
    periodoId,
    totalTutors: 54,
    completedDeliveries: completed,
    totalExpectedDeliveries: totalExpected,
    compliancePercentage: percentage,
    requiredThresholdPercentage: 90,
    canGenerateFinalReport: percentage >= 90,
  }
}

function buildDefaultWorkbook(
  formatKey: CoordinatorFormatKey,
  periodoId: number,
): CoordinatorWorkbook {
  const readiness = computeMockReadiness(periodoId)

  if (formatKey === 'ReporteSemestralCoordinador') {
    return {
      id: `wb-reporte-semestral-${periodoId}`,
      periodoId,
      formatKey,
      title: 'Reporte Semestral del Coordinador Institucional de Tutoría',
      templateFileName: 'REPORTE SEMESTRAL DEL COORNADOR  EDITABLE.xlsx',
      status: readiness.canGenerateFinalReport ? 'Ready' : 'Draft',
      compliancePercentage: readiness.compliancePercentage,
      rowVersion: 1,
      tabs: [
        {
          tabKey: 'hoja1',
          label: 'hoja1 — Concentrado General',
          excelSheetName: 'hoja1',
          isCompleted: false,
          rowVersion: 1,
          prefilledData: {
            plantel: 'TecNM Campus Monclova',
            periodo_id: periodoId,
            total_tutores: readiness.totalTutors,
            porcentaje_cumplimiento: `${readiness.compliancePercentage}%`,
          },
          tabPayload: {
            totalAttendedStudents: 0,
            totalReferrals: 0,
            summaryNotes: '',
          },
        },
        {
          tabKey: 'hoja2',
          label: 'hoja2 — Indicadores y Evidencias',
          excelSheetName: 'hoja2',
          isCompleted: false,
          rowVersion: 1,
          prefilledData: {
            periodo_id: periodoId,
            umbral_requerido: '90% (9 de 10 entregas)',
          },
          tabPayload: {
            highRiskSubjectsCount: 0,
            interventionActions: '',
            summaryNotes: '',
          },
        },
      ],
    }
  }

  return {
    id: `wb-matriz-control-${periodoId}`,
    periodoId,
    formatKey,
    title: 'Matriz de Control de Coordinación',
    templateFileName: 'tutores a-d 2026.xlsx',
    status: 'Draft',
    compliancePercentage: readiness.compliancePercentage,
    rowVersion: 1,
    tabs: [
      {
        tabKey: 'actividades',
        label: 'actividades',
        excelSheetName: 'actividades',
        isCompleted: false,
        rowVersion: 1,
        prefilledData: { periodo_id: periodoId, hoja_excel: 'actividades' },
        tabPayload: { completedActivities: 0, summaryNotes: '' },
      },
      {
        tabKey: 'asesores',
        label: 'asesores',
        excelSheetName: 'asesores',
        isCompleted: false,
        rowVersion: 1,
        prefilledData: { periodo_id: periodoId, hoja_excel: 'asesores' },
        tabPayload: { activeAdvisors: 0, summaryNotes: '' },
      },
      {
        tabKey: 'primero_y_tercero',
        label: '1º y 3º',
        excelSheetName: '1º y 3º',
        isCompleted: false,
        rowVersion: 1,
        prefilledData: { periodo_id: periodoId, hoja_excel: '1º y 3º' },
        tabPayload: { groupsMonitored: 0, summaryNotes: '' },
      },
      {
        tabKey: 'quinto_y_septimo',
        label: '5º y 7º',
        excelSheetName: '5º y 7º',
        isCompleted: false,
        rowVersion: 1,
        prefilledData: { periodo_id: periodoId, hoja_excel: '5º y 7º' },
        tabPayload: { groupsMonitored: 0, summaryNotes: '' },
      },
    ],
  }
}

function getMockWorkbooksMap(): Record<string, CoordinatorWorkbook> {
  return loadJson<Record<string, CoordinatorWorkbook>>(MOCK_WORKBOOKS_KEY, {})
}

export const metricsApi = {
  async getReadiness(periodoId: number): Promise<FinalReportReadiness> {
    try {
      const { data } = await http.get<FinalReportReadiness>('/metrics/readiness', {
        params: { periodoId },
      })
      return data
    } catch (error) {
      if (shouldRethrowBusinessError(error)) throw error
      return computeMockReadiness(periodoId)
    }
  },

  async getFailureReports(
    filters: MetricsFilters,
    page = 1,
    limit = 10,
  ): Promise<PaginatedFailureReports> {
    try {
      const { data } = await http.get<PaginatedFailureReports>('/metrics/failures', {
        params: { ...filters, page, limit },
      })
      return data
    } catch (error) {
      if (shouldRethrowBusinessError(error)) throw error
      let items = getMockFailures().filter((f) => f.periodoId === filters.periodoId)
      if (filters.month) items = items.filter((f) => f.reportingMonth === filters.month)
      if (filters.riskLevel) items = items.filter((f) => f.riskLevel === filters.riskLevel)
      if (filters.search?.trim()) {
        const normalizeText = (v: string) =>
          v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        const q = normalizeText(filters.search.trim())
        items = items.filter(
          (f) =>
            normalizeText(f.claveMateria).includes(q) ||
            normalizeText(f.subjectName ?? '').includes(q) ||
            normalizeText(f.grupo).includes(q) ||
            normalizeText(f.docenteName ?? '').includes(q) ||
            normalizeText(f.docenteClave).includes(q),
        )
      }
      const total = items.length
      const start = (page - 1) * limit
      return { data: items.slice(start, start + limit), page, limit, total }
    }
  },

  async createFailureReport(
    payload: CreateFailureReportRequest,
    currentUser?: { username: string; name: string },
  ): Promise<FailureReportItem> {
    try {
      const { data } = await http.post<FailureReportItem>('/metrics/failures', payload)
      return data
    } catch (error) {
      if (shouldRethrowBusinessError(error)) throw error
      const percentage =
        payload.totalStudents > 0
          ? Number(((payload.failedStudents * 100) / payload.totalStudents).toFixed(2))
          : 0
      const created: FailureReportItem = {
        id: `fail-${Date.now()}`,
        periodoId: payload.periodoId,
        docenteClave:
          currentUser?.username === 'usuario'
            ? 'D0001'
            : currentUser?.username === 'usuario2'
              ? 'D0002'
              : (currentUser?.username ?? 'D0001'),
        docenteName: currentUser?.name ?? 'Docente Tutor',
        claveMateria: payload.claveMateria.trim().toUpperCase(),
        subjectName: payload.subjectName?.trim() || payload.claveMateria.trim().toUpperCase(),
        grupo: payload.grupo.trim().toUpperCase(),
        reportingMonth: payload.reportingMonth,
        totalStudents: payload.totalStudents,
        failedStudents: payload.failedStudents,
        failurePercentage: percentage,
        failedUnits: payload.failedUnits?.trim() || undefined,
        riskLevel: computeRiskLevel(percentage),
        preventiveActions: payload.preventiveActions?.trim() || undefined,
        requiresIntervention: percentage > 30,
        createdAt: new Date().toISOString(),
      }
      const existing = getMockFailures()
      existing.unshift(created)
      saveJson(MOCK_FAILURES_KEY, existing)
      return created
    }
  },

  async importUnitResults(periodoId: number, file: File): Promise<UnitResultsImportResponse> {
    const formData = new FormData()
    formData.append('periodoId', String(periodoId))
    formData.append('file', file)

    try {
      const { data } = await http.post<UnitResultsImportResponse>(
        '/metrics/imports/unit-results',
        formData,
      )
      return data
    } catch (error) {
      if (shouldRethrowBusinessError(error)) throw error
      const now = new Date().toISOString()
      const reportingMonth = periodoId === 2 ? 11 : 5
      const importedSamples: FailureReportItem[] = [
        {
          id: `imp-unit-1-p${periodoId}`,
          periodoId,
          docenteClave: 'D0001',
          docenteName: 'Ing. Carlos Alberto Mendoza Gómez',
          claveMateria: 'ACF-0902',
          subjectName: 'Cálculo Integral (Insumo FINAL.xls)',
          grupo: '2A',
          reportingMonth,
          totalStudents: 34,
          failedStudents: 16,
          failurePercentage: 47.06,
          failedUnits: 'II, III, IV',
          riskLevel: 'Critical',
          preventiveActions: 'Contraste automático Resultados-por-unidad FINAL.xls — canalizar a asesoría.',
          requiresIntervention: true,
          createdAt: now,
        },
        {
          id: `imp-unit-2-p${periodoId}`,
          periodoId,
          docenteClave: 'D0002',
          docenteName: 'M.C. Laura Elena Sánchez Morales',
          claveMateria: 'AEF-1041',
          subjectName: 'Matemáticas Discretas (Insumo FINAL.xls)',
          grupo: '1B',
          reportingMonth,
          totalStudents: 32,
          failedStudents: 11,
          failurePercentage: 34.38,
          failedUnits: 'I, III',
          riskLevel: 'High',
          preventiveActions: 'Seguimiento grupal e individual por índice > 30%.',
          requiresIntervention: true,
          createdAt: now,
        },
      ]
      const existing = getMockFailures().filter(
        (item) => !importedSamples.some((sample) => sample.id === item.id),
      )
      saveJson(MOCK_FAILURES_KEY, [...importedSamples, ...existing])

      const result: UnitResultsImportResponse = {
        importId: `imp-${Date.now()}`,
        periodoId,
        fileName: file.name,
        importedRows: importedSamples.length,
        highRiskSubjects: importedSamples.filter((s) => s.requiresIntervention).length,
        importedAt: now,
      }
      const history = loadJson<UnitResultsImportResponse[]>(MOCK_IMPORTS_KEY, [])
      history.unshift(result)
      saveJson(MOCK_IMPORTS_KEY, history.slice(0, 10))
      return result
    }
  },

  getLatestUnitImport(periodoId: number): UnitResultsImportResponse | null {
    const history = loadJson<UnitResultsImportResponse[]>(MOCK_IMPORTS_KEY, [])
    return history.find((h) => h.periodoId === periodoId) ?? null
  },

  async getUnitFailureTracking(periodoId: number): Promise<UnitFailureTrackingPayload> {
    try {
      const { data } = await http.get<UnitFailureTrackingPayload>('/metrics/unit-failure-tracking', {
        params: { periodoId },
      })
      return data
    } catch (error) {
      if (shouldRethrowBusinessError(error)) throw error
      const map = loadJson<Record<string, UnitFailureTrackingPayload>>(MOCK_UNIT_TRACKING_KEY, {})
      const key = String(periodoId)
      if (!map[key]) {
        map[key] = {
          periodoId,
          rows: [
            {
              id: `ut-1-p${periodoId}`,
              subjectName: 'Cálculo Diferencial',
              teacherName: 'Ing. Carlos Alberto Mendoza Gómez',
              units: ['28.5', '35.0', '31.2', '', '', '', '', ''],
            },
            {
              id: `ut-2-p${periodoId}`,
              subjectName: 'Estructura de Datos',
              teacherName: 'M.C. Laura Elena Sánchez Morales',
              units: ['20.0', '42.0', '48.5', '', '', '', '', ''],
            },
            {
              id: `ut-3-p${periodoId}`,
              subjectName: 'Taller de Ética',
              teacherName: 'Dr. Roberto García Villarreal',
              units: ['10.0', '8.5', '', '', '', '', '', ''],
            },
          ],
          comments: '',
        }
        saveJson(MOCK_UNIT_TRACKING_KEY, map)
      }
      return map[key]
    }
  },

  async saveUnitFailureTracking(
    payload: UnitFailureTrackingPayload,
  ): Promise<UnitFailureTrackingPayload> {
    try {
      const { data } = await http.put<UnitFailureTrackingPayload>(
        '/metrics/unit-failure-tracking',
        payload,
      )
      return data
    } catch (error) {
      if (shouldRethrowBusinessError(error)) throw error
      const map = loadJson<Record<string, UnitFailureTrackingPayload>>(MOCK_UNIT_TRACKING_KEY, {})
      const saved: UnitFailureTrackingPayload = {
        ...payload,
        updatedAt: new Date().toISOString(),
      }
      map[String(payload.periodoId)] = saved
      saveJson(MOCK_UNIT_TRACKING_KEY, map)
      return saved
    }
  },

  async getCoordinatorWorkbook(
    formatKey: CoordinatorFormatKey,
    periodoId: number,
    tabKey?: CoordinatorSheetKey,
  ): Promise<CoordinatorWorkbook> {
    try {
      const { data } = await http.get<CoordinatorWorkbook>(`/metrics/workbooks/${formatKey}`, {
        params: { periodoId, tabKey },
      })
      return data
    } catch (error) {
      if (shouldRethrowBusinessError(error)) throw error
      const map = getMockWorkbooksMap()
      const key = `${formatKey}-${periodoId}`
      if (!map[key]) {
        map[key] = buildDefaultWorkbook(formatKey, periodoId)
        saveJson(MOCK_WORKBOOKS_KEY, map)
      }
      const readiness = computeMockReadiness(periodoId)
      map[key].compliancePercentage = readiness.compliancePercentage
      return { ...map[key] }
    }
  },

  async saveCoordinatorTab(
    workbookId: string,
    payload: SaveCoordinatorTabPayload,
  ): Promise<CoordinatorWorkbook> {
    try {
      const { data } = await http.put<CoordinatorWorkbook>(
        `/metrics/workbooks/${workbookId}/tabs`,
        payload,
      )
      return data
    } catch (error) {
      if (shouldRethrowBusinessError(error)) throw error
      const map = getMockWorkbooksMap()
      const entryKey = Object.keys(map).find((k) => map[k].id === workbookId)
      if (!entryKey) {
        throw new Error('Libro de coordinación no encontrado.')
      }
      const wb = map[entryKey]
      const tab = wb.tabs.find((t) => t.tabKey === payload.tabKey)
      if (tab) {
        tab.tabPayload = { ...tab.tabPayload, ...payload.tabPayload }
        tab.isCompleted = Boolean(payload.markCompleted ?? tab.isCompleted)
        tab.rowVersion += 1
      }
      wb.rowVersion += 1
      wb.updatedAt = new Date().toISOString()
      saveJson(MOCK_WORKBOOKS_KEY, map)
      return { ...wb }
    }
  },

  async finalizeFinalReport(periodoId: number): Promise<CoordinatorWorkbook> {
    try {
      const { data } = await http.post<CoordinatorWorkbook>('/metrics/final-report/finalize', {
        periodoId,
      })
      return data
    } catch (error) {
      if (shouldRethrowBusinessError(error)) throw error
      const readiness = computeMockReadiness(periodoId)
      if (!readiness.canGenerateFinalReport) {
        throw {
          response: {
            status: 409,
            data: {
              code: 'THRESHOLD_NOT_MET',
              message: `Umbral insuficiente (${readiness.compliancePercentage}%). Se requiere al menos 90% (9 de 10 entregas).`,
            },
          },
        }
      }
      const map = getMockWorkbooksMap()
      const key = `ReporteSemestralCoordinador-${periodoId}`
      if (!map[key]) {
        map[key] = buildDefaultWorkbook('ReporteSemestralCoordinador', periodoId)
      }
      map[key].status = 'Finalized'
      map[key].finalizedAt = new Date().toISOString()
      map[key].rowVersion += 1
      saveJson(MOCK_WORKBOOKS_KEY, map)
      return { ...map[key] }
    }
  },

  async previewWorkbook(
    workbookId: string,
    tabKey?: CoordinatorSheetKey,
    format: PreviewFormat = 'pdf',
  ): Promise<WorkbookPreviewResult> {
    try {
      const { data } = await http.get<WorkbookPreviewResult>(
        `/metrics/workbooks/${workbookId}/preview`,
        { params: { tabKey, format } },
      )
      return data
    } catch (error) {
      if (shouldRethrowBusinessError(error)) throw error
      return {
        workbookId,
        tabKey,
        previewFormat: format,
        previewUrlOrContent: '',
        fileName: `${workbookId}${tabKey ? `_${tabKey}` : ''}.${format}`,
      }
    }
  },

  async exportWorkbook(workbookId: string, tabKey?: CoordinatorSheetKey): Promise<Blob> {
    const { data } = await http.get<Blob>(`/metrics/workbooks/${workbookId}/export`, {
      params: { tabKey },
      responseType: 'blob',
    })
    return data
  },
}
