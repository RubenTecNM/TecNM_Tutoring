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

export interface Referral {
  id: string
  periodoId: number
  matricula: string
  studentName?: string
  studentCareer: string
  studentSemester?: number
  tutorClave: string
  tutorName?: string
  detectionSource: DetectionSource
  detectedByTeacherName?: string
  supportArea: SupportArea
  referralReason: ReferralReason
  observations?: string
  coordinatorNotes?: string
  status: ReferralStatus
  createdAt: string
  updatedAt?: string
}

export interface CreateReferralRequest {
  periodoId: number
  matricula: string
  studentCareer: string
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
  search?: string
}
