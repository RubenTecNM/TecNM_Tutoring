<script setup lang="ts">
import { computed } from 'vue'
import { UiChip } from '../../../shared/components'
import type { SupportArea } from '../types/referrals'

const props = defineProps<{
  area: SupportArea | string
}>()

const areaConfig = computed(() => {
  switch (props.area) {
    case 'Psychology':
      return { label: 'Psicología', class: 'area-psychology' }
    case 'Nursing':
      return { label: 'Enfermería', class: 'area-nursing' }
    case 'Performance':
      return { label: 'Desempeño', class: 'area-performance' }
    case 'Tutoring':
      return { label: 'Tutorías', class: 'area-tutoring' }
    case 'SocialWork':
      return { label: 'Trabajo Social', class: 'area-social' }
    case 'Academic':
    default:
      return { label: 'Académico', class: 'area-academic' }
  }
})
</script>

<template>
  <UiChip :class="['area-chip', areaConfig.class]">
    {{ areaConfig.label }}
  </UiChip>
</template>

<style scoped>
.area-chip {
  font-weight: 500;
  font-size: 0.8125rem;
}

.area-psychology {
  background-color: var(--color-purple-bg, #ede9fe);
  color: var(--color-purple-text, #5b21b6);
  border: 1px solid var(--color-purple-border, #ddd6fe);
}

.area-social {
  background-color: var(--color-info-bg, #eff6ff);
  color: var(--color-info-text, #075985);
  border: 1px solid var(--color-info-border, #bfdbfe);
}

.area-nursing {
  background-color: var(--color-success-bg, #f0fdf4);
  color: var(--color-success-text, #065f46);
  border: 1px solid var(--color-success-border, #a7f3d0);
}

.area-tutoring {
  background-color: var(--color-warning-bg, #fffbeb);
  color: var(--color-warning-text, #92400e);
  border: 1px solid var(--color-warning-border, #fde68a);
}

.area-performance {
  background-color: var(--color-danger-bg, #fef2f2);
  color: var(--color-danger-text, #991b1b);
  border: 1px solid var(--color-danger-border, #fecaca);
}

.area-academic {
  background-color: var(--color-primary-subtle, #ebf3ff);
  color: var(--color-primary, #1b396a);
  border: 1px solid var(--color-border-medium, #cbd5e1);
}
</style>
