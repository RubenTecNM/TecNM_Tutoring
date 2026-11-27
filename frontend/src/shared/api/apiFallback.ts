const FALLBACK_STATUSES = new Set([404, 502, 503, 504])

/**
 * Permite fallback local únicamente cuando el endpoint backend aún no existe
 * o no hay conectividad. Nunca oculta errores reales de negocio/auth (400, 401, 403, 409, 413, 415, 422, 500).
 */
export function shouldFallbackToLocal(error: unknown): boolean {
  const response = (error as { response?: { status?: number } })?.response
  if (!response) return true
  const status = response.status
  return status === undefined || FALLBACK_STATUSES.has(status)
}
