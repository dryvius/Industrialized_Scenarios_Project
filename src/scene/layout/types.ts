/** 世界 XZ 平面点（单位：米） */
export interface XzPoint {
  x: number
  z: number
}

/** 地面姿态：位置 + 绕 Y 朝向 */
export interface PoseXZ {
  x: number
  z: number
  rotationY: number
}

/** 轴对齐盒碰撞代理（半尺寸，单位：米） */
export interface BoxColliderDesc {
  kind: 'box'
  halfX: number
  halfY: number
  halfZ: number
  /** 相对实体原点的 Y 偏移（盒中心）；默认 halfY（底面贴 y=0） */
  offsetY?: number
  /** 相对实体原点的 X/Z 偏移 */
  offsetX?: number
  offsetZ?: number
}

export interface EntityPlacement extends PoseXZ {
  id: string
  /** XZ 占地圆半径（软检测 / 文档用） */
  footprintRadius: number
  /** 物理静态 / 动态代理碰撞体 */
  colliders: readonly BoxColliderDesc[]
  /**
   * 为 true 时不注册地面 Kinematic（塔上作业等需自由写 Y，
   * 且避免与塔身 Fixed 互推）。
   */
  skipKinematic?: boolean
}

/** 世界系三维点（单位：米） */
export interface XyzPoint {
  x: number
  y: number
  z: number
}

/** 杆塔作业挂点工作姿态 */
export type TowerWorkPose = 'inspect' | 'tool'

/** 挂点所在结构：决定朝向与下肢（站立扶塔 / 骑跨横担） */
export type TowerAnchorKind = 'mast' | 'arm'

/** 铁塔本地挂点描述（经 pylonRotY 转到世界系） */
export interface PylonAnchorDef {
  id: string
  local: XyzPoint
  /** 相对铁塔本地的朝向（绕 Y）；mast 应指向塔心 */
  facingYawLocal: number
  workPose: TowerWorkPose
  kind: TowerAnchorKind
  label: string
}

export interface PathDemoSpec {
  objectId: string
  path: readonly XzPoint[]
  loop: boolean
}
