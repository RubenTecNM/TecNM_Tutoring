import type { FormatKey } from '../types/compliance'

export interface OfficialTemplateMeta {
  formatKey: FormatKey
  title: string
  templateFileName: string
  extension: 'docx' | 'xlsx'
  hasTabs: boolean
  tabsCount: number
  description: string
}

export const OFFICIAL_FORMAT_TEMPLATES: OfficialTemplateMeta[] = [
  {
    formatKey: 'PlanTrabajo',
    title: 'Plan de trabajo del tutor',
    templateFileName: 'FORMATO PLAN DE TRABAJO TUTORIAS ene-junio-26.docx',
    extension: 'docx',
    hasTabs: false,
    tabsCount: 1,
    description: '16 sesiones semanales, actividades mensuales normativas y firma del tutor.',
  },
  {
    formatKey: 'DiagnosticoInicial',
    title: 'Informe del Diagnóstico',
    templateFileName: 'DIAGNOSTICO-INICIAL TUTORIAS - FJ-26.xlsx',
    extension: 'xlsx',
    hasTabs: false,
    tabsCount: 1,
    description: 'Diagnóstico inicial del grupo tutorado (4 preguntas estructuradas).',
  },
  {
    formatKey: 'Anexo14',
    title: 'Anexo 14 — Trayectoria Académica',
    templateFileName: 'Anexo 14.docx',
    extension: 'docx',
    hasTabs: false,
    tabsCount: 1,
    description: 'Matriz de estudiantes, 6 asignaturas e incidencias 1–7.',
  },
  {
    formatKey: 'Anexo15',
    title: 'Anexo 15 — Desempeño Académico',
    templateFileName: 'Anexo 15.docx',
    extension: 'docx',
    hasTabs: false,
    tabsCount: 1,
    description: 'Registro de calificaciones por tema (I–VIII) y focos de alerta.',
  },
  {
    formatKey: 'Anexo19AMensual',
    title: 'Anexo 19-A — Reporte Mensual del Tutor',
    templateFileName: 'Anexo 19-A.docx',
    extension: 'docx',
    hasTabs: false,
    tabsCount: 1,
    description: 'Atención grupal/individual, canalizaciones y áreas de apoyo.',
  },
  {
    formatKey: 'SeguimientoMensual',
    title: 'Seguimiento Mensual del Tutor (6 hojas)',
    templateFileName: 'Anexos Seguimiento de Tutorías-MENSUAL-FJ-26.xlsx',
    extension: 'xlsx',
    hasTabs: true,
    tabsCount: 6,
    description: 'Libro mensual: Anexo 14, Anexo 15, Reprobación, Anexo 19-A, Individual y Asistencia.',
  },
  {
    formatKey: 'SeguimientoFinal',
    title: 'Seguimiento Final del Tutor (4 hojas)',
    templateFileName: 'Anexos Seguimiento de Tutorías-FINAL- FJ-26.xlsx',
    extension: 'xlsx',
    hasTabs: true,
    tabsCount: 4,
    description: 'Libro final: Anexo 19 Semestral, Informe Final, Índice Reprobación, Características y Evidencias.',
  },
]

export function getOfficialTemplateMeta(formatKey: FormatKey): OfficialTemplateMeta {
  return (
    OFFICIAL_FORMAT_TEMPLATES.find((t) => t.formatKey === formatKey) ??
    OFFICIAL_FORMAT_TEMPLATES[0]
  )
}

export function getOfficialTemplateUrl(formatKey: FormatKey): string {
  const meta = getOfficialTemplateMeta(formatKey)
  return `/templates/${encodeURIComponent(meta.templateFileName)}`
}

export function buildOfficialDownloadFileName(
  formatKey: FormatKey,
  docenteClave?: string,
  tabKey?: string,
): string {
  const meta = getOfficialTemplateMeta(formatKey)
  const baseName = meta.templateFileName.replace(/\.(docx|xlsx)$/i, '')
  const suffixParts = [docenteClave, tabKey].filter(Boolean).join('_')
  return suffixParts ? `${baseName}_${suffixParts}.${meta.extension}` : meta.templateFileName
}
