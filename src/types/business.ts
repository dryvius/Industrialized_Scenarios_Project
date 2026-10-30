import type { MachineRunState } from '@/enums/MachineRunState'
import type { SceneObjectType } from '@/enums/SceneObjectType'

/** 通用业务实体 */
export interface BusinessEntity {
  id: string
  type: SceneObjectType
  name: string
  status: string
  updatedAt: string
  /** 机械动画启停：running 播放 / idle 停止（可选） */
  runState?: MachineRunState
  metrics?: Record<string, string | number>
  tags?: string[]
}

/** 现场概况 */
export interface SiteSummary {
  id: string
  name: string
  status: string
  updatedAt: string
  machineCount: number
  workerCount: number
  activeTasks: number
  safetyScore: number
  temperature: number
  metrics?: Record<string, string | number>
}

/** 业务数据绑定接口 */
export interface ConstructionDataBinding {
  fetchSummary: () => Promise<SiteSummary>
  fetchEntityByKey: (businessKey: string) => Promise<BusinessEntity | null>
  fetchMachines: () => Promise<BusinessEntity[]>
  fetchWorkers: () => Promise<BusinessEntity[]>
  fetchFacilities: () => Promise<BusinessEntity[]>
}
