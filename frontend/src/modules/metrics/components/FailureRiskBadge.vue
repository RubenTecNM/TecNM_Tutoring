<script setup lang="ts">
import { computed } from 'vue'
import { UiBadge } from '../../../shared/components'
import type { RiskLevel } from '../types/metrics'

const props = defineProps<{
  riskLevel: RiskLevel | string
}>()

const config = computed(() => {
  switch (props.riskLevel) {
    case 'Critical':
      return { tone: 'danger' as const, label: 'Crítico' }
    case 'High':
      return { tone: 'warning' as const, label: 'Alto' }
    case 'Medium':
      return { tone: 'info' as const, label: 'Medio' }
    case 'Low':
    default:
      return { tone: 'success' as const, label: 'Bajo' }
  }
})
</script>

<template>
  <UiBadge :tone="config.tone">
    {{ config.label }}
  </UiBadge>
</template>
