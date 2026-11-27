/**
 * Valida que una URL de vista previa para <iframe> use únicamente esquemas seguros
 * (rutas relativas '/', 'https:', 'http:' o 'blob:'), bloqueando 'javascript:' y 'data:'.
 */
export function sanitizePreviewUrl(raw?: string | null): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'blob:') {
      return trimmed
    }
    return ''
  } catch {
    return ''
  }
}
