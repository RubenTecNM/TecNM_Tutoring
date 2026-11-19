import { http } from '../../../shared/api/http'
import type {
  CreateReferralRequest,
  Referral,
  ReferralFilters,
  UpdateReferralStatusRequest,
} from '../types/referrals'

const MOCK_STORAGE_KEY = 'tecnm_referrals_mock_v2'

const DEFAULT_MOCK_REFERRALS: Referral[] = [
  {
    id: 'ref-005',
    periodoId: 1,
    matricula: '23050077',
    studentName: 'Valeria Guadalupe Pérez Ramos',
    studentCareer: 'Ingeniería en Sistemas Computacionales',
    studentSemester: 1,
    tutorClave: 'usuario',
    tutorName: 'Ing. Carlos Alberto Mendoza Gómez',
    detectionSource: 'Tutor',
    supportArea: 'Psychology',
    referralReason: 'Emotional',
    observations: 'Proceso de duelo familiar que impacta asistencia y entrega de actividades.',
    status: 'Unread',
    createdAt: '2026-03-04T15:20:00Z',
  },
  {
    id: 'ref-006',
    periodoId: 1,
    matricula: '22050411',
    studentName: 'Luis Fernando Torres Aguilar',
    studentCareer: 'Ingeniería Electrónica',
    studentSemester: 4,
    tutorClave: 'D0004',
    tutorName: 'Ing. Patricia Guadalupe Garza Reyes',
    detectionSource: 'Docente',
    detectedByTeacherName: 'M.C. Raúl Hernández Vela',
    supportArea: 'Performance',
    referralReason: 'Academic',
    observations: 'Descenso marcado en el rendimiento de prácticas de laboratorio durante las últimas tres semanas.',
    status: 'Sent',
    createdAt: '2026-03-03T11:10:00Z',
  },
  {
    id: 'ref-002',
    periodoId: 1,
    matricula: '20050844',
    studentName: 'Mateo Alejandro Garza Silva',
    studentCareer: 'Ingeniería Industrial',
    studentSemester: 6,
    tutorClave: 'usuario',
    tutorName: 'Ing. Carlos Alberto Mendoza Gómez',
    detectionSource: 'Docente',
    detectedByTeacherName: 'Ing. Alejandro Ruiz Lozano',
    supportArea: 'Academic',
    referralReason: 'Academic',
    observations: 'Riesgo inminente de reprobación en Cálculo Integral. Requiere asesoría académica niveladora.',
    coordinatorNotes: 'Canalizado a sesión de asesorías con departamento de Ciencias Básicas.',
    status: 'Received',
    createdAt: '2026-02-22T12:15:00Z',
    updatedAt: '2026-02-23T09:00:00Z',
  },
  {
    id: 'ref-001',
    periodoId: 1,
    matricula: '21050012',
    studentName: 'Ana Sofía Rodríguez Fuentes',
    studentCareer: 'Ingeniería en Sistemas Computacionales',
    studentSemester: 4,
    tutorClave: 'usuario',
    tutorName: 'Ing. Carlos Alberto Mendoza Gómez',
    detectionSource: 'Tutor',
    supportArea: 'Psychology',
    referralReason: 'Emotional',
    observations: 'Estudiante presenta ansiedad recurrente y falta de concentración en exámenes parciales.',
    coordinatorNotes: 'Reporte revisado, pendiente agendar primera sesión con Psicología.',
    status: 'Unattended',
    createdAt: '2026-02-18T10:30:00Z',
    updatedAt: '2026-02-19T10:00:00Z',
  },
  {
    id: 'ref-004',
    periodoId: 1,
    matricula: '21050330',
    studentName: 'Jorge Eduardo Morales Dávila',
    studentCareer: 'Ingeniería Mecánica',
    studentSemester: 5,
    tutorClave: 'D0003',
    tutorName: 'Dr. Roberto García Villarreal',
    detectionSource: 'Docente',
    detectedByTeacherName: 'Ing. Sonia Patricia Morales',
    supportArea: 'Nursing',
    referralReason: 'Health',
    observations: 'Cuadro constante de fatiga y mareos durante clases matutinas.',
    coordinatorNotes: 'Valoración realizada en enfermería del campus. Seguimiento concluido.',
    status: 'Attended',
    createdAt: '2026-02-14T11:45:00Z',
    updatedAt: '2026-02-20T16:00:00Z',
  },
  {
    id: 'ref-003',
    periodoId: 1,
    matricula: '22050189',
    studentName: 'Mariana Lizeth Cantú Ortiz',
    studentCareer: 'Ingeniería en Gestión Empresarial',
    studentSemester: 2,
    tutorClave: 'usuario',
    tutorName: 'Ing. Carlos Alberto Mendoza Gómez',
    detectionSource: 'Tutor',
    supportArea: 'SocialWork',
    referralReason: 'Socioeconomic',
    observations: 'Dificultad de traslado y problemas socioeconómicos que amenazan con baja temporal.',
    coordinatorNotes: 'Se vinculó con beca de transporte y apoyo de Trabajo Social.',
    status: 'Attended',
    createdAt: '2026-02-10T09:00:00Z',
    updatedAt: '2026-02-25T14:20:00Z',
  },
]

function loadMockReferrals(): Referral[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Referral[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // Ignorar errores de acceso a localStorage
  }
  saveMockReferrals(DEFAULT_MOCK_REFERRALS)
  return [...DEFAULT_MOCK_REFERRALS]
}

function saveMockReferrals(items: Referral[]): void {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Ignorar errores de cuota
  }
}

export const referralsApi = {
  async getReferrals(filters?: Partial<ReferralFilters>): Promise<Referral[]> {
    try {
      const params = new URLSearchParams()
      if (filters?.periodoId) params.append('periodoId', String(filters.periodoId))
      if (filters?.supportArea) params.append('supportArea', filters.supportArea)
      if (filters?.referralReason) params.append('referralReason', filters.referralReason)
      if (filters?.status) params.append('status', filters.status)

      const { data } = await http.get<Referral[]>(`/referrals?${params.toString()}`)
      return data
    } catch {
      const mock = loadMockReferrals()
      if (filters?.periodoId) {
        return mock.filter((r) => r.periodoId === filters.periodoId)
      }
      return mock
    }
  },

  async createReferral(
    payload: CreateReferralRequest,
    currentUser?: { username: string; name: string },
  ): Promise<Referral> {
    try {
      const { data } = await http.post<Referral>('/referrals', payload)
      return data
    } catch {
      const created: Referral = {
        id: `ref-${Date.now()}`,
        periodoId: payload.periodoId,
        matricula: payload.matricula,
        studentName: `Estudiante ${payload.matricula}`,
        studentCareer: payload.studentCareer,
        tutorClave: currentUser?.username || 'usuario',
        tutorName: currentUser?.name || 'Docente Tutor',
        detectionSource: payload.detectionSource,
        detectedByTeacherName:
          payload.detectionSource === 'Docente' ? payload.detectedByTeacherName : undefined,
        supportArea: payload.supportArea,
        referralReason: payload.referralReason,
        observations: payload.observations,
        status: 'Sent',
        createdAt: new Date().toISOString(),
      }
      const existing = loadMockReferrals()
      existing.unshift(created)
      saveMockReferrals(existing)
      return created
    }
  },

  async updateReferralStatus(
    referralId: string,
    payload: UpdateReferralStatusRequest,
  ): Promise<void> {
    try {
      await http.patch(`/referrals/${referralId}/status`, payload)
    } catch {
      const existing = loadMockReferrals()
      const idx = existing.findIndex((r) => r.id === referralId)
      if (idx !== -1) {
        existing[idx] = {
          ...existing[idx],
          status: payload.status,
          coordinatorNotes: payload.coordinatorNotes ?? existing[idx].coordinatorNotes,
          updatedAt: new Date().toISOString(),
        }
        saveMockReferrals(existing)
      }
    }
  },
}
