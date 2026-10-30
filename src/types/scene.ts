import type { SceneObjectType } from '@/enums/SceneObjectType'

/** 场景对象用户数据 */
export interface SceneObjectUserData {
  objectId: string
  objectType: SceneObjectType
  selectable: boolean
  label: string
  businessKey?: string
}

/** 选中事件载荷 */
export interface SceneSelectionPayload {
  objectId: string
  objectType: SceneObjectType
  label: string
  businessKey?: string
  worldPosition: { x: number; y: number; z: number }
}

/** 场景初始化选项 */
export interface SceneInitOptions {
  container: HTMLElement
  onSelect?: (payload: SceneSelectionPayload | null) => void
  onReady?: () => void
}

/** 建造器返回结果 */
export interface BuildResult {
  group: import('three').Group
  disposables: Array<import('three').BufferGeometry | import('three').Material>
}
