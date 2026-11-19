import { ref } from 'vue'
import { referralsApi } from '../api/referralsApi'
import type { Referral } from '../types/referrals'

const unreadReferralsCount = ref(0)

export function isNewReferral(referral: Pick<Referral, 'status'>): boolean {
  return referral.status === 'Unread' || referral.status === 'Sent'
}

export function useReferralNotifications() {
  async function refreshUnreadCount(): Promise<void> {
    try {
      const list = await referralsApi.getReferrals()
      unreadReferralsCount.value = list.filter(isNewReferral).length
    } catch {
      // Mantener contador actual si falla la sincronización
    }
  }

  function syncUnreadCountFromList(list: Referral[]): void {
    unreadReferralsCount.value = list.filter(isNewReferral).length
  }

  function clearUnreadCount(): void {
    unreadReferralsCount.value = 0
  }

  return {
    unreadReferralsCount,
    refreshUnreadCount,
    syncUnreadCountFromList,
    clearUnreadCount,
  }
}
