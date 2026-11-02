import { defineStore } from 'pinia'
import { ref } from 'vue'
import { constructionDataApi } from '@/api/constructionData'
import { virusMonitorApi } from '@/api/virusMonitor'
import { vitalSignsApi } from '@/api/vitalSigns'
import { SceneObjectType } from '@/enums/SceneObjectType'
import type { BusinessEntity, SiteSummary } from '@/types/business'
import type { SceneSelectionPayload } from '@/types/scene'
import type { VirusMonitorSnapshot } from '@/types/virusMonitor'
import type { SiteHealthOverview, VitalsLevel, WorkerHealthDetail } from '@/types/vitals'

export const useSiteStore = defineStore('site', () => {
  const summary = ref<SiteSummary | null>(null)
  const selected = ref<SceneSelectionPayload | null>(null)
  const selectedEntity = ref<BusinessEntity | null>(null)
  const selectedVitals = ref<WorkerHealthDetail | null>(null)
  const healthOverview = ref<SiteHealthOverview | null>(null)
  const virusMonitorSnapshot = ref<VirusMonitorSnapshot | null>(null)
  const loading = ref(false)
  const vitalsLoading = ref(false)
  const overviewLoading = ref(false)
  const virusMonitorLoading = ref(false)
  const errorMessage = ref('')
  const vitalsError = ref('')
  const overviewError = ref('')
  const virusMonitorError = ref('')

  async function loadSummary(): Promise<void> {
    loading.value = true
    errorMessage.value = ''
    try {
      summary.value = await constructionDataApi.fetchSummary()
    } catch {
      errorMessage.value = '现场概况加载失败'
    } finally {
      loading.value = false
    }
  }

  async function loadHealthOverview(): Promise<void> {
    overviewLoading.value = true
    overviewError.value = ''
    try {
      healthOverview.value = await vitalSignsApi.fetchOverview()
    } catch {
      overviewError.value = '健康监测态势加载失败，请稍后重试'
    } finally {
      overviewLoading.value = false
    }
  }

  async function selectObject(payload: SceneSelectionPayload | null): Promise<void> {
    selected.value = payload
    selectedEntity.value = null
    selectedVitals.value = null
    vitalsError.value = ''
    if (!payload?.businessKey) {
      return
    }

    loading.value = true
    errorMessage.value = ''
    try {
      selectedEntity.value = await constructionDataApi.fetchEntityByKey(payload.businessKey)
      if (!selectedEntity.value) {
        selectedEntity.value = {
          id: payload.objectId,
          type: payload.objectType,
          name: payload.label,
          status: '已选中',
          updatedAt: new Date().toISOString(),
          metrics: {
            类型: payload.objectType,
            坐标X: payload.worldPosition.x.toFixed(1),
            坐标Z: payload.worldPosition.z.toFixed(1),
          },
        }
      }

      if (payload.objectType === SceneObjectType.Worker) {
        await loadWorkerVitals(payload.businessKey)
      }
    } catch {
      errorMessage.value = '对象业务数据加载失败'
    } finally {
      loading.value = false
    }
  }

  async function loadWorkerVitals(businessKey: string): Promise<void> {
    vitalsLoading.value = true
    vitalsError.value = ''
    try {
      const detail = await vitalSignsApi.fetchByBusinessKey(businessKey)
      selectedVitals.value = detail
      if (!detail) {
        vitalsError.value = '暂无该人员生命体征数据'
      }
    } catch {
      selectedVitals.value = null
      vitalsError.value = '生命体征同步失败，请稍后重试'
    } finally {
      vitalsLoading.value = false
    }
  }

  async function loadDemoVitals(): Promise<void> {
    vitalsLoading.value = true
    vitalsError.value = ''
    try {
      selectedVitals.value = await vitalSignsApi.fetchDemoProfile()
    } catch {
      selectedVitals.value = null
      vitalsError.value = '演示生命体征加载失败'
    } finally {
      vitalsLoading.value = false
    }
  }

  async function loadVirusMonitorDemo(): Promise<void> {
    virusMonitorLoading.value = true
    virusMonitorError.value = ''
    try {
      virusMonitorSnapshot.value = await virusMonitorApi.fetchDemoSnapshot()
    } catch (error) {
      console.error('[siteStore] loadVirusMonitorDemo failed', error)
      virusMonitorSnapshot.value = null
      virusMonitorError.value = '病毒监控演示数据加载失败，请稍后重试'
    } finally {
      virusMonitorLoading.value = false
    }
  }

  function clearVirusMonitor(): void {
    virusMonitorSnapshot.value = null
    virusMonitorError.value = ''
  }

  function workerLevelMap(): Map<string, VitalsLevel> {
    const map = new Map<string, VitalsLevel>()
    healthOverview.value?.workers.forEach((card) => {
      map.set(card.businessKey, card.overallStatus)
    })
    return map
  }

  function clearSelection(): void {
    selected.value = null
    selectedEntity.value = null
    selectedVitals.value = null
    vitalsError.value = ''
  }

  return {
    summary,
    selected,
    selectedEntity,
    selectedVitals,
    healthOverview,
    virusMonitorSnapshot,
    loading,
    vitalsLoading,
    overviewLoading,
    virusMonitorLoading,
    errorMessage,
    vitalsError,
    overviewError,
    virusMonitorError,
    loadSummary,
    loadHealthOverview,
    selectObject,
    loadWorkerVitals,
    loadDemoVitals,
    loadVirusMonitorDemo,
    clearVirusMonitor,
    workerLevelMap,
    clearSelection,
  }
})
