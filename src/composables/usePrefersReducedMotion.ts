import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Ref } from 'vue'

export function usePrefersReducedMotion(): Ref<boolean> {
  const prefersReducedMotion = ref(false)
  let media: MediaQueryList | null = null

  const sync = (): void => {
    prefersReducedMotion.value = media?.matches ?? false
  }

  onMounted((): void => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    sync()
    media.addEventListener('change', sync)
  })

  onBeforeUnmount((): void => {
    media?.removeEventListener('change', sync)
    media = null
  })

  return prefersReducedMotion
}
