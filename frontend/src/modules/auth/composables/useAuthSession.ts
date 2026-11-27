import { ref } from 'vue'
import type { UserResponse } from '../types/auth'

const cachedUser = ref<UserResponse | null>(null)
let inflightRequest: Promise<UserResponse> | null = null

export function getCachedAuthUser(): UserResponse | null {
  return cachedUser.value
}

export function setAuthSession(user: UserResponse | null): void {
  cachedUser.value = user
}

export function clearAuthSession(): void {
  cachedUser.value = null
  inflightRequest = null
}

export async function resolveAuthSession(
  fetcher: () => Promise<UserResponse>,
  force = false,
): Promise<UserResponse> {
  if (!force && cachedUser.value) {
    return cachedUser.value
  }
  if (!inflightRequest) {
    inflightRequest = fetcher()
      .then((user) => {
        cachedUser.value = user
        return user
      })
      .finally(() => {
        inflightRequest = null
      })
  }
  return inflightRequest
}
