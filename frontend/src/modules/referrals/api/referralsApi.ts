import { http } from '../../../shared/api/http'
import type {
  CreateReferralRequest,
  Referral,
  ReferralFilters,
  UpdateReferralStatusRequest,
} from '../types/referrals'

const MOCK_STORAGE_KEY = 'tecnm_referrals_mock_v4'

export function resolveTutorClave(username?: string): string {
  if (!username) return ''
  if (username === 'usuario') return 'D0001'
  if (username === 'usuario2') return 'D0002'
  return username
}

// Sin datos demo para usuario (D0001) ni usuario2 (D0002): inician en blanco para pruebas limpias.
const DEFAULT_MOCK_REFERRALS: Referral[] = [
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
  async getReferrals(
    filters?: Partial<ReferralFilters> & { tutorClave?: string },
  ): Promise<Referral[]> {
    try {
      const params = new URLSearchParams()
      if (filters?.periodoId) params.append('periodoId', String(filters.periodoId))
      if (filters?.supportArea) params.append('supportArea', filters.supportArea)
      if (filters?.referralReason) params.append('referralReason', filters.referralReason)
      if (filters?.status) params.append('status', filters.status)
      if (filters?.tutorClave) params.append('tutorClave', filters.tutorClave)

      const { data } = await http.get<Referral[]>(`/referrals?${params.toString()}`)
      return data
    } catch {
      let mock = loadMockReferrals()
      if (filters?.periodoId) {
        mock = mock.filter((r) => r.periodoId === filters.periodoId)
      }
      if (filters?.tutorClave) {
        const normalized = resolveTutorClave(filters.tutorClave)
        mock = mock.filter((r) => r.tutorClave === normalized)
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
      const tutorClave = resolveTutorClave(currentUser?.username) || 'D0001'
      const created: Referral = {
        id: `ref-${Date.now()}`,
        periodoId: payload.periodoId,
        matricula: payload.matricula,
        studentName: `Estudiante ${payload.matricula}`,
        studentCareer: payload.studentCareer,
        tutorClave,
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
