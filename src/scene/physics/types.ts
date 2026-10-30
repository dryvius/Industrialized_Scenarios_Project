import type RAPIER from '@dimforge/rapier3d-compat'
import type { Object3D } from 'three'
import type { EntityPlacement } from '@/scene/layout'

export type RapierModule = typeof RAPIER

export interface PhysicsBodyRecord {
  id: string
  rigidBody: RAPIER.RigidBody
  colliders: RAPIER.Collider[]
}

export interface DesiredPose {
  x: number
  z: number
  yaw: number
  /** true = 本帧瞬间传送，跳过角色控制器 */
  teleport?: boolean
}

export interface KinematicBinding {
  id: string
  rigidBody: RAPIER.RigidBody
  primaryCollider: RAPIER.Collider
  object3d: Object3D
  placement: EntityPlacement
  desired: DesiredPose | null
}

export interface PhysicsWorldOptions {
  gravityY?: number
  /** 固定步长（秒），默认 1/60 */
  fixedTimeStep?: number
  /** 单帧最多子步，防止螺旋死亡 */
  maxSubSteps?: number
}
