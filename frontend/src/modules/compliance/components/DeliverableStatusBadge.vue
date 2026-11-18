<script setup lang="ts">
import { computed } from 'vue'
import { UiBadge } from '../../../shared/components'
import type { DeliverableStatus } from '../types/compliance'

const props = defineProps<{
  status: DeliverableStatus | string
}>()

const badgeConfig = computed(() => {
  switch (props.status) {
    case 'OnTime':
      return { tone: 'success' as const, label: 'En tiempo' }
    case 'Late':
      return { tone: 'danger' as const, label: 'Con retraso' }
    case 'Pending':
    default:
      return { tone: 'warning' as const, label: 'Pendiente' }
  }
})
</script>

<template>
  <UiBadge :tone="badgeConfig.tone">
    {{ badgeConfig.label }}
  </UiBadge>
</template>
