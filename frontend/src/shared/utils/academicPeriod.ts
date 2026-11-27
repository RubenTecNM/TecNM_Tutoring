import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export type AcademicTerm = 1 | 2
export type AcademicPeriodStatus = 'finished' | 'active' | 'upcoming'

export interface AcademicPeriodInfo {
  /** Entero determinista YYYYT (ej. 20262 = Ago-Dic 2026, 20271 = Ene-Jul 2027) */
  id: number
  year: number
  term: AcademicTerm
  label: string
  shortLabel: string
  code: string
  startDate: Date
  endDate: Date
  /** Meses hábiles de entrega dentro del periodo (1..12) */
  reportingMonths: number[]
  defaultMonth: number
}

const MONTH_LABELS: Record<number, string> = {
  1: 'Enero',
  2: 'Febrero',
  3: 'Marzo',
  4: 'Abril',
  5: 'Mayo',
  6: 'Junio',
  7: 'Julio',
  8: 'Agosto',
  9: 'Septiembre',
  10: 'Octubre',
  11: 'Noviembre',
  12: 'Diciembre',
}

export function encodePeriodoId(year: number, term: AcademicTerm): number {
  return year * 10 + term
}

export function buildAcademicPeriod(year: number, term: AcademicTerm): AcademicPeriodInfo {
  const shortYear = String(year).slice(-2)
  if (term === 1) {
    return {
      id: encodePeriodoId(year, 1),
      year,
      term: 1,
      label: `Enero - Julio ${year}`,
      shortLabel: `Ene - Jul ${year}`,
      code: `EJ${shortYear}`,
      startDate: new Date(year, 0, 1, 0, 0, 0, 0),
      endDate: new Date(year, 6, 31, 23, 59, 59, 999),
      reportingMonths: [2, 3, 4, 5, 6, 7],
      defaultMonth: 5,
    }
  }
  return {
    id: encodePeriodoId(year, 2),
    year,
    term: 2,
    label: `Agosto - Diciembre ${year}`,
    shortLabel: `Ago - Dic ${year}`,
    code: `AD${shortYear}`,
    startDate: new Date(year, 7, 1, 0, 0, 0, 0),
    endDate: new Date(year, 11, 31, 23, 59, 59, 999),
    reportingMonths: [8, 9, 10, 11, 12],
    defaultMonth: 11,
  }
}

/**
 * Detecta el periodo escolar vigente según la fecha actual del sistema:
 * - Enero a Julio (meses 1..7) -> Enero - Julio <año>
 * - Agosto a Diciembre (meses 8..12) -> Agosto - Diciembre <año>
 */
export function getCurrentAcademicPeriod(now: Date = new Date()): AcademicPeriodInfo {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const term: AcademicTerm = month <= 7 ? 1 : 2
  return buildAcademicPeriod(year, term)
}

/**
 * Calcula el periodo inmediato siguiente:
 * - Ene-Jul <año> -> Ago-Dic <año>
 * - Ago-Dic <año> -> Ene-Jul <año + 1>
 */
export function getNextAcademicPeriod(period: Pick<AcademicPeriodInfo, 'year' | 'term'>): AcademicPeriodInfo {
  return period.term === 1
    ? buildAcademicPeriod(period.year, 2)
    : buildAcademicPeriod(period.year + 1, 1)
}

export function getPreviousAcademicPeriod(period: Pick<AcademicPeriodInfo, 'year' | 'term'>): AcademicPeriodInfo {
  return period.term === 2
    ? buildAcademicPeriod(period.year, 1)
    : buildAcademicPeriod(period.year - 1, 2)
}

/**
 * Resuelve tanto IDs dinámicos (20262, 20271...) como IDs legados (1, 2).
 */
export function resolveAcademicPeriodById(
  periodoId: number | string | undefined | null,
  now: Date = new Date(),
): AcademicPeriodInfo {
  const num = Number(periodoId)
  if (!Number.isInteger(num) || num <= 0) {
    return getCurrentAcademicPeriod(now)
  }
  if (num === 1) return buildAcademicPeriod(now.getFullYear(), 1)
  if (num === 2) return buildAcademicPeriod(now.getFullYear(), 2)
  if (num >= 20001) {
    const year = Math.floor(num / 10)
    const term: AcademicTerm = num % 10 === 2 ? 2 : 1
    return buildAcademicPeriod(year, term)
  }
  return getCurrentAcademicPeriod(now)
}

export function isSecondTerm(periodoId: number | string | undefined | null): boolean {
  return resolveAcademicPeriodById(periodoId).term === 2
}

export function getPeriodLabel(periodoId: number | string | undefined | null): string {
  return resolveAcademicPeriodById(periodoId).label
}

export function getPeriodStatus(
  period: Pick<AcademicPeriodInfo, 'startDate' | 'endDate'>,
  now: Date = new Date(),
): { status: AcademicPeriodStatus; daysRemaining: number } {
  const nowMs = now.getTime()
  if (nowMs > period.endDate.getTime()) {
    return { status: 'finished', daysRemaining: 0 }
  }
  if (nowMs < period.startDate.getTime()) {
    const daysUntilStart = Math.max(
      1,
      Math.ceil((period.startDate.getTime() - nowMs) / (1000 * 60 * 60 * 24)),
    )
    return { status: 'upcoming', daysRemaining: daysUntilStart }
  }
  const daysRemaining = Math.max(
    0,
    Math.ceil((period.endDate.getTime() - nowMs) / (1000 * 60 * 60 * 24)),
  )
  return { status: 'active', daysRemaining }
}

/**
 * Opciones para selectores de periodo: anterior (Finalizado), actual (En curso) y próximo.
 */
export function getAvailableAcademicPeriods(
  now: Date = new Date(),
): { id: number; label: string; status: AcademicPeriodStatus }[] {
  const current = getCurrentAcademicPeriod(now)
  const previous = getPreviousAcademicPeriod(current)
  const next = getNextAcademicPeriod(current)

  return [
    { id: previous.id, label: `${previous.shortLabel} (Finalizado)`, status: 'finished' },
    { id: current.id, label: `${current.shortLabel} (En curso)`, status: 'active' },
    { id: next.id, label: `${next.shortLabel} (Próximo)`, status: 'upcoming' },
  ]
}

export function getMonthOptionsForPeriodo(
  periodoId: number | string | undefined | null,
): { value: string; label: string }[] {
  const period = resolveAcademicPeriodById(periodoId)
  return [
    { value: '', label: 'Todos los meses' },
    ...period.reportingMonths.map((m) => ({
      value: String(m),
      label: MONTH_LABELS[m] ?? `Mes ${m}`,
    })),
  ]
}

export function getDefaultMonthLabelForPeriodo(
  periodoId: number | string | undefined | null,
  fallbackNow: Date = new Date(),
): string {
  const period = resolveAcademicPeriodById(periodoId, fallbackNow)
  const currentMonth = fallbackNow.getMonth() + 1
  if (period.reportingMonths.includes(currentMonth)) {
    return MONTH_LABELS[currentMonth]
  }
  return MONTH_LABELS[period.defaultMonth] ?? 'Mayo'
}

export function getMonthName(month: number): string {
  return MONTH_LABELS[month] ?? `Mes ${month}`
}

/**
 * Composable reactivo que vigila el cambio automático de periodo/año
 * al cruzar medianoche o al volver a enfocar la pestaña.
 */
export function useAcademicPeriod() {
  const clock = ref(new Date())
  let timerId: number | undefined

  function syncClock(): void {
    clock.value = new Date()
  }

  onMounted(() => {
    timerId = window.setInterval(syncClock, 60_000)
    document.addEventListener('visibilitychange', syncClock)
  })

  onBeforeUnmount(() => {
    if (timerId !== undefined) window.clearInterval(timerId)
    document.removeEventListener('visibilitychange', syncClock)
  })

  const currentPeriod = computed(() => getCurrentAcademicPeriod(clock.value))
  const nextPeriod = computed(() => getNextAcademicPeriod(currentPeriod.value))
  const currentStatus = computed(() => getPeriodStatus(currentPeriod.value, clock.value))
  const isClosingSoon = computed(
    () => currentStatus.value.status === 'active' && currentStatus.value.daysRemaining <= 15,
  )

  return {
    currentPeriod,
    nextPeriod,
    currentStatus,
    isClosingSoon,
  }
}
