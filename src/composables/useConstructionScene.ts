import { onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import type { Ref } from 'vue'
import { constructionDataApi } from '@/api/constructionData'
import { SceneManager } from '@/scene/SceneManager'
import type { SceneSelectionPayload } from '@/types/scene'
import type { VitalsLevel } from '@/types/vitals'
import { useSiteStore } from '@/stores/siteStore'

/**
 * 工业基建施工场景生命周期封装。
 * 模板中需使用 ref="sceneContainer" 绑定画布容器。
 */
export function useConstructionScene(): {
  isReady: Ref<boolean>
  demoEnabled: Ref<boolean>
  physicsDebugVisible: Ref<boolean>
  selectedCanAnimate: Ref<boolean>
  selectedAnimating: Ref<boolean>
  clearSelection: () => void
  toggleDemo: () => void
  togglePhysicsDebug: () => void
  toggleSelectedAnimation: () => void
  selectByBusinessKey: (businessKey: string) => boolean
  applyWorkerHealthLevels: (levels: Map<string, VitalsLevel>) => void
  setWorkerHealthHalosVisible: (visible: boolean) => void
} {
  const containerRef = useTemplateRef<HTMLElement>('sceneContainer')
  const isReady = ref(false)
  const demoEnabled = ref(false)
  const physicsDebugVisible = ref(false)
  const selectedCanAnimate = ref(false)
  const selectedAnimating = ref(false)
  const manager = shallowRef<SceneManager | null>(null)
  const store = useSiteStore()

  const syncSelectionAnimState = (objectId: string | undefined): void => {
    const sceneManager = manager.value
    if (!sceneManager || !objectId) {
      selectedCanAnimate.value = false
      selectedAnimating.value = false
      return
    }
    selectedCanAnimate.value = sceneManager.hasAnimator(objectId)
    selectedAnimating.value = sceneManager.isObjectAnimating(objectId)
  }

  onMounted(async (): Promise<void> => {
    const container = containerRef.value
    if (!container) {
      return
    }

    const sceneManager = new SceneManager()
    manager.value = sceneManager

    await sceneManager.init({
      container,
      onSelect: (payload: SceneSelectionPayload | null): void => {
        void store.selectObject(payload)
        syncSelectionAnimState(payload?.objectId)
      },
      onReady: (): void => {
        isReady.value = true
      },
    })

    const [machines, workers] = await Promise.all([
      constructionDataApi.fetchMachines(),
      constructionDataApi.fetchWorkers(),
    ])
    sceneManager.applyMachineRunStates([...machines, ...workers])
    // 默认开启动态演示：仅 runState=running 的对象播放
    sceneManager.setDemoEnabled(true)
    demoEnabled.value = true

    await store.loadSummary()
  })

  onBeforeUnmount((): void => {
    manager.value?.dispose()
    manager.value = null
    isReady.value = false
    demoEnabled.value = false
    physicsDebugVisible.value = false
    selectedCanAnimate.value = false
    selectedAnimating.value = false
    store.clearSelection()
  })

  const clearSelection = (): void => {
    manager.value?.clearSelection()
    store.clearSelection()
    syncSelectionAnimState(undefined)
  }

  const toggleDemo = (): void => {
    const sceneManager = manager.value
    if (!sceneManager) {
      return
    }
    const next = !demoEnabled.value
    sceneManager.setDemoEnabled(next)
    demoEnabled.value = next
    syncSelectionAnimState(store.selected?.objectId)
  }

  const togglePhysicsDebug = (): void => {
    const sceneManager = manager.value
    if (!sceneManager || !sceneManager.hasPhysicsWorld()) {
      return
    }
    const next = !physicsDebugVisible.value
    sceneManager.setPhysicsDebugVisible(next)
    physicsDebugVisible.value = next
  }

  const toggleSelectedAnimation = (): void => {
    const sceneManager = manager.value
    const objectId = store.selected?.objectId
    if (!sceneManager || !objectId || !sceneManager.hasAnimator(objectId)) {
      return
    }
    if (sceneManager.isObjectAnimating(objectId)) {
      sceneManager.stopObjectAnimation(objectId)
    } else {
      sceneManager.playObjectAnimation(objectId)
    }
    selectedAnimating.value = sceneManager.isObjectAnimating(objectId)
  }

  const selectByBusinessKey = (businessKey: string): boolean => {
    return manager.value?.selectByBusinessKey(businessKey) ?? false
  }

  const applyWorkerHealthLevels = (levels: Map<string, VitalsLevel>): void => {
    manager.value?.applyWorkerHealthLevels(levels)
  }

  const setWorkerHealthHalosVisible = (visible: boolean): void => {
    manager.value?.setWorkerHealthHalosVisible(visible)
  }

  return {
    isReady,
    demoEnabled,
    physicsDebugVisible,
    selectedCanAnimate,
    selectedAnimating,
    clearSelection,
    toggleDemo,
    togglePhysicsDebug,
    toggleSelectedAnimation,
    selectByBusinessKey,
    applyWorkerHealthLevels,
    setWorkerHealthHalosVisible,
  }
}
