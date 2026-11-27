import { http } from '../../../shared/api/http'
import {
  clearAuthSession,
  resolveAuthSession,
  setAuthSession,
} from '../composables/useAuthSession'
import type { LoginRequest, UserResponse } from '../types/auth'

export async function login(credentials: LoginRequest): Promise<UserResponse> {
  const { data } = await http.post<UserResponse>('/auth/login', credentials)
  setAuthSession(data)
  return data
}

export async function me(forceRefresh = false): Promise<UserResponse> {
  return resolveAuthSession(async () => {
    const { data } = await http.get<UserResponse>('/auth/me')
    return data
  }, forceRefresh)
}

export async function logout(): Promise<void> {
  try {
    await http.post('/auth/logout')
  } finally {
    clearAuthSession()
  }
}
