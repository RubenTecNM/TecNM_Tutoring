export type DetectionSource = 'Tutor' | 'Docente'

export type SupportArea =
  | 'Psychology'
  | 'Nursing'
  | 'Performance'
  | 'Tutoring'
  | 'SocialWork'
  | 'Academic'

export type ReferralReason =
  | 'Academic'
  | 'Emotional'
  | 'Personal'
  | 'Discipline'
  | 'Health'
  | 'Socioeconomic'

export type ReferralStatus =
  | 'Sent'
  | 'Received'
  | 'Read'
  | 'Unread'
  | 'Attended'
  | 'Unattended'

export type ReferralKpiBucket = 'all' | 'unread' | 'pending' | 'attended'

export interface StudentPreview {
  matricula: string
  fullName: string
  career: string
  semester: number
}

export interface TeacherDirectoryItem {
  clave: string
  fullName: string
  department?: string
}

export interface Referral {
  id: string
  periodoId: number
  matricula: string
  studentName: string
  studentCareer: string
  studentSemester: number
  tutorClave: string
  tutorName?: string
  detectionSource: DetectionSource
  detectedByTeacherName?: string
  supportArea: SupportArea
  referralReason: ReferralReason
  observations?: string
  coordinatorNotes?: string
  status: ReferralStatus
  isDeleted?: boolean
  createdAt: string
  updatedAt?: string
}

export interface CreateReferralRequest {
  periodoId: number
  matricula: string
  studentName?: string
  studentCareer: string
  studentSemester?: number
  detectionSource: DetectionSource
  detectedByTeacherName?: string
  supportArea: SupportArea
  referralReason: ReferralReason
  observations?: string
}

export interface UpdateReferralRequest {
  matricula: string
  studentName?: string
  studentCareer: string
  studentSemester?: number
  detectionSource: DetectionSource
  detectedByTeacherName?: string
  supportArea: SupportArea
  referralReason: ReferralReason
  observations?: string
}

export interface UpdateReferralStatusRequest {
  status: ReferralStatus
  coordinatorNotes?: string
}

export interface ReferralFilters {
  periodoId: number
  supportArea?: SupportArea
  referralReason?: ReferralReason
  status?: ReferralStatus
  kpiBucket?: ReferralKpiBucket
  search?: string
}
