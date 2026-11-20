import { http } from '../../../shared/api/http'
import type {
  CreateReferralRequest,
  Referral,
  ReferralFilters,
  StudentPreview,
  TeacherDirectoryItem,
  UpdateReferralRequest,
  UpdateReferralStatusRequest,
} from '../types/referrals'

const MOCK_STORAGE_KEY = 'tecnm_referrals_mock_v5'

export const MATRICULA_REGEX = /^[A-Z]\d{8}$/

export function isValidTecNmMatricula(value: string): boolean {
  return MATRICULA_REGEX.test(value.trim().toUpperCase())
}

export function resolveTutorClave(username?: string): string {
  if (!username) return ''
  if (username === 'usuario') return 'D0001'
  if (username === 'usuario2') return 'D0002'
  return username
}

// Catálogo mock de alumnos (espejo temporal de MAIN_Alumnos en BD Principal)
const STUDENT_CATALOG_MOCK: Record<string, StudentPreview> = {
  I12345678: {
    matricula: 'I12345678',
    fullName: 'Diego Alejandro Ramírez Castillo',
    career: 'Ingeniería en Sistemas Computacionales',
    semester: 4,
  },
  I21050012: {
    matricula: 'I21050012',
    fullName: 'Ana Sofía Rodríguez Fuentes',
    career: 'Ingeniería en Sistemas Computacionales',
    semester: 4,
  },
  I22050411: {
    matricula: 'I22050411',
    fullName: 'Luis Fernando Torres Aguilar',
    career: 'Ingeniería Electrónica',
    semester: 4,
  },
  I21050330: {
    matricula: 'I21050330',
    fullName: 'Jorge Eduardo Morales Dávila',
    career: 'Ingeniería Mecánica',
    semester: 5,
  },
  I20050844: {
    matricula: 'I20050844',
    fullName: 'Mateo Alejandro Garza Silva',
    career: 'Ingeniería Industrial',
    semester: 6,
  },
  I22050189: {
    matricula: 'I22050189',
    fullName: 'Mariana Lizeth Cantú Ortiz',
    career: 'Ingeniería en Gestión Empresarial',
    semester: 2,
  },
  I23050077: {
    matricula: 'I23050077',
    fullName: 'Valeria Guadalupe Pérez Ramos',
    career: 'Ingeniería Informática',
    semester: 1,
  },
  I24050115: {
    matricula: 'I24050115',
    fullName: 'Sofía Valentina Herrera Lozano',
    career: 'Ingeniería en Energías Renovables',
    semester: 3,
  },
}

// Directorio mock de docentes (espejo temporal de MAIN_Docentes en BD Principal)
const TEACHER_DIRECTORY_MOCK: TeacherDirectoryItem[] = [
  { clave: 'D0011', fullName: 'José Manuel Martínez López', department: 'Sistemas y Computación' },
  { clave: 'D0012', fullName: 'Juan Antonio Jiménez Pérez', department: 'Ciencias Básicas' },
  { clave: 'D0013', fullName: 'Julia Alejandra Morales Castro', department: 'Ingeniería Industrial' },
  { clave: 'D0014', fullName: 'Javier Eduardo Castillo Flores', department: 'Metal-Mecánica' },
  { clave: 'D0001', fullName: 'Carlos Alberto Mendoza Gómez', department: 'Sistemas y Computación' },
  { clave: 'D0002', fullName: 'Laura Elena Sánchez Morales', department: 'Ingeniería Industrial' },
  { clave: 'D0003', fullName: 'Roberto García Villarreal', department: 'Metal-Mecánica' },
  { clave: 'D0004', fullName: 'Patricia Guadalupe Garza Reyes', department: 'Electrónica' },
  { clave: 'D0005', fullName: 'Fernando Ortiz Domínguez', department: 'Ciencias Económico-Administrativas' },
  { clave: 'D0006', fullName: 'Silvia Margarita Treviño Luna', department: 'Ciencias Básicas' },
  { clave: 'D0015', fullName: 'Raúl Hernández Vela', department: 'Electrónica' },
  { clave: 'D0016', fullName: 'Alejandro Ruiz Lozano', department: 'Ciencias Básicas' },
  { clave: 'D0017', fullName: 'Sonia Patricia Morales Peña', department: 'Metal-Mecánica' },
  { clave: 'D0018', fullName: 'Miguel Ángel Delgado Ramos', department: 'Sistemas y Computación' },
  { clave: 'D0019', fullName: 'María del Carmen Flores Navarro', department: 'Ingeniería en Gestión Empresarial' },
]

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// Sin datos demo para usuario (D0001) ni usuario2 (D0002): inician limpios.
const DEFAULT_MOCK_REFERRALS: Referral[] = [
  {
    id: 'ref-006',
    periodoId: 1,
    matricula: 'I22050411',
    studentName: 'Luis Fernando Torres Aguilar',
    studentCareer: 'Ingeniería Electrónica',
    studentSemester: 4,
    tutorClave: 'D0004',
    tutorName: 'Ing. Patricia Guadalupe Garza Reyes',
    detectionSource: 'Docente',
    detectedByTeacherName: 'Raúl Hernández Vela',
    supportArea: 'Performance',
    referralReason: 'Academic',
    observations: 'Descenso marcado en el rendimiento de prácticas de laboratorio durante las últimas tres semanas.',
    status: 'Sent',
    createdAt: '2026-03-03T11:10:00Z',
  },
  {
    id: 'ref-004',
    periodoId: 1,
    matricula: 'I21050330',
    studentName: 'Jorge Eduardo Morales Dávila',
    studentCareer: 'Ingeniería Mecánica',
    studentSemester: 5,
    tutorClave: 'D0003',
    tutorName: 'Dr. Roberto García Villarreal',
    detectionSource: 'Docente',
    detectedByTeacherName: 'Sonia Patricia Morales Peña',
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
      if (Array.isArray(parsed)) return parsed
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
  async lookupStudentByMatricula(matricula: string): Promise<StudentPreview | null> {
    const clean = matricula.trim().toUpperCase()
    if (!isValidTecNmMatricula(clean)) return null

    try {
      const { data } = await http.get<StudentPreview>(`/students/${clean}`)
      return data
    } catch {
      if (STUDENT_CATALOG_MOCK[clean]) {
        return STUDENT_CATALOG_MOCK[clean]
      }
      // Fallback institucional estructurado cuando la matrícula tiene formato válido pero aún no está en catálogo mock
      const semesterDigit = (Number(clean.slice(-1)) % 8) + 1
      return {
        matricula: clean,
        fullName: `Alumno Registrado (${clean})`,
        career: 'Ingeniería en Sistemas Computacionales',
        semester: semesterDigit,
      }
    }
  },

  async searchTeachers(query: string): Promise<TeacherDirectoryItem[]> {
    const clean = normalizeText(query)
    try {
      const { data } = await http.get<TeacherDirectoryItem[]>(`/teachers?q=${encodeURIComponent(query)}`)
      return data
    } catch {
      if (!clean) return TEACHER_DIRECTORY_MOCK.slice(0, 8)

      // Priorizar docentes cuyo primer nombre o cualquier palabra del nombre empiece por la búsqueda
      const startsWithFirstName: TeacherDirectoryItem[] = []
      const startsWithWord: TeacherDirectoryItem[] = []
      const containsAnywhere: TeacherDirectoryItem[] = []

      for (const teacher of TEACHER_DIRECTORY_MOCK) {
        const normName = normalizeText(teacher.fullName)
        const words = normName.split(/\s+/)
        if (normName.startsWith(clean)) {
          startsWithFirstName.push(teacher)
        } else if (words.some((w) => w.startsWith(clean))) {
          startsWithWord.push(teacher)
        } else if (normName.includes(clean) || teacher.clave.toLowerCase().includes(clean)) {
          containsAnywhere.push(teacher)
        }
      }

      return [...startsWithFirstName, ...startsWithWord, ...containsAnywhere].slice(0, 8)
    }
  },

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
      return data.filter((r) => !r.isDeleted)
    } catch {
      let mock = loadMockReferrals().filter((r) => !r.isDeleted)
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
      const cleanMatricula = payload.matricula.trim().toUpperCase()
      const studentInfo = STUDENT_CATALOG_MOCK[cleanMatricula]
      const tutorClave = resolveTutorClave(currentUser?.username) || 'D0001'
      const created: Referral = {
        id: `ref-${Date.now()}`,
        periodoId: payload.periodoId,
        matricula: cleanMatricula,
        studentName: payload.studentName || studentInfo?.fullName || `Alumno Registrado (${cleanMatricula})`,
        studentCareer: payload.studentCareer || studentInfo?.career || 'Ingeniería en Sistemas Computacionales',
        studentSemester: payload.studentSemester ?? studentInfo?.semester ?? 1,
        tutorClave,
        tutorName: currentUser?.name || 'Docente Tutor',
        detectionSource: payload.detectionSource,
        detectedByTeacherName:
          payload.detectionSource === 'Docente' ? payload.detectedByTeacherName : undefined,
        supportArea: payload.supportArea,
        referralReason: payload.referralReason,
        observations: payload.observations,
        status: 'Sent',
        isDeleted: false,
        createdAt: new Date().toISOString(),
      }
      const existing = loadMockReferrals()
      existing.unshift(created)
      saveMockReferrals(existing)
      return created
    }
  },

  async updateReferral(referralId: string, payload: UpdateReferralRequest): Promise<Referral | null> {
    try {
      const { data } = await http.put<Referral>(`/referrals/${referralId}`, payload)
      return data
    } catch {
      const existing = loadMockReferrals()
      const idx = existing.findIndex((r) => r.id === referralId)
      if (idx === -1) return null
      const cleanMatricula = payload.matricula.trim().toUpperCase()
      const studentInfo = STUDENT_CATALOG_MOCK[cleanMatricula]
      const updated: Referral = {
        ...existing[idx],
        matricula: cleanMatricula,
        studentName: payload.studentName || studentInfo?.fullName || existing[idx].studentName,
        studentCareer: payload.studentCareer,
        studentSemester: payload.studentSemester ?? studentInfo?.semester ?? existing[idx].studentSemester,
        detectionSource: payload.detectionSource,
        detectedByTeacherName:
          payload.detectionSource === 'Docente' ? payload.detectedByTeacherName : undefined,
        supportArea: payload.supportArea,
        referralReason: payload.referralReason,
        observations: payload.observations,
        updatedAt: new Date().toISOString(),
      }
      existing[idx] = updated
      saveMockReferrals(existing)
      return updated
    }
  },

  async cancelReferral(referralId: string): Promise<void> {
    try {
      await http.delete(`/referrals/${referralId}`)
    } catch {
      // Soft-delete (nunca borrado físico)
      const existing = loadMockReferrals()
      const idx = existing.findIndex((r) => r.id === referralId)
      if (idx !== -1) {
        existing[idx] = {
          ...existing[idx],
          isDeleted: true,
          updatedAt: new Date().toISOString(),
        }
        saveMockReferrals(existing)
      }
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
