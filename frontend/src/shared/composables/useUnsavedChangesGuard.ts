import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

/**
 * Protege contra pérdida accidental de cambios tanto al navegar dentro de la SPA
 * como al recargar (F5) o cerrar la pestaña del navegador.
 */
export function useUnsavedChangesGuard(
  isDirty: Ref<boolean>,
  message = 'Hay cambios sin guardar en la pestaña actual. ¿Deseas salir?',
): void {
  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!isDirty.value) return
    event.preventDefault()
    event.returnValue = ''
  }

  onMounted(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })

  onBeforeRouteLeave(() => {
    if (!isDirty.value) return true
    return window.confirm(message)
  })
}
