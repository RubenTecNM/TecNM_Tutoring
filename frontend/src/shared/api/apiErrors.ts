import type { AxiosError } from 'axios'

export interface ApiFieldError {
  field: string
  message: string
}

export interface NormalizedApiError {
  status: number
  code: string
  message: string
  fieldErrors?: ApiFieldError[]
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  const axiosErr = error as AxiosError<{
    code?: string
    message?: string
    errors?: ApiFieldError[]
  }>
  const status = axiosErr?.response?.status ?? 0
  const data = axiosErr?.response?.data

  if (status === 413) {
    return {
      status,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'El archivo excede el tamaño máximo permitido (5 MB por imagen).',
    }
  }
  if (status === 415) {
    return {
      status,
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: 'Tipo de archivo no permitido. Usa únicamente formatos válidos.',
    }
  }
  if (status === 409) {
    return {
      status,
      code: data?.code ?? 'CONFLICT',
      message:
        data?.message ??
        'Conflicto de concurrencia o registro duplicado. Recarga la tarea antes de guardar.',
    }
  }
  if (status === 422) {
    return {
      status,
      code: data?.code ?? 'VALIDATION_ERROR',
      message:
        data?.message ??
        'Hay campos obligatorios faltantes o con formato inválido. Revisa la captura.',
      fieldErrors: data?.errors ?? [],
    }
  }
  return {
    status,
    code: data?.code ?? 'UNKNOWN',
    message: data?.message ?? 'No fue posible completar la operación. Intenta nuevamente.',
  }
}
