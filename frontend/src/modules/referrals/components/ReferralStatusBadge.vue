<script setup lang="ts">
import { computed } from 'vue'
import { UiBadge } from '../../../shared/components'
import type { ReferralStatus } from '../types/referrals'

const props = defineProps<{
  status: ReferralStatus | string
}>()

const badgeConfig = computed(() => {
  switch (props.status) {
    case 'Sent':
      return { tone: 'info' as const, label: 'Enviado' }
    case 'Received':
      return { tone: 'purple' as const, label: 'Recibido' }
    case 'Read':
      return { tone: 'info' as const, label: 'Leído' }
    case 'Unread':
      return { tone: 'danger' as const, label: 'Sin leer' }
    case 'Unattended':
      return { tone: 'warning' as const, label: 'Sin atender' }
    case 'Attended':
      return { tone: 'success' as const, label: 'Atendido' }
    default:
      return { tone: 'warning' as const, label: 'Sin atender' }
  }
})
</script>

<template>
  <UiBadge :tone="badgeConfig.tone">
    {{ badgeConfig.label }}
  </UiBadge>
</template>
