import type { Object3D } from 'three'
import type { AnimatableMeta } from '@/scene/animation/types'

const ANIMATABLE_KEY = 'animatable'
const JOINTS_KEY = 'joints'

/** 标记根节点可动画，并登记逻辑关节名 → Object3D.name */
export function tagAnimatable(
  root: Object3D,
  objectId: string,
  joints: Record<string, string>,
): void {
  root.userData[ANIMATABLE_KEY] = true
  root.userData[JOINTS_KEY] = { ...joints }
  root.userData.objectId = root.userData.objectId ?? objectId
}

export function readAnimatableMeta(root: Object3D): AnimatableMeta | null {
  if (!root.userData[ANIMATABLE_KEY]) {
    return null
  }
  const joints = root.userData[JOINTS_KEY] as Record<string, string> | undefined
  if (!joints) {
    return null
  }
  return {
    animatable: true,
    objectId: String(root.userData.objectId ?? root.name),
    joints,
  }
}

/** 按逻辑名解析关节 Object3D */
export function resolveJoint(root: Object3D, logicalName: string): Object3D | null {
  const meta = readAnimatableMeta(root)
  if (!meta) {
    return null
  }
  const objectName = meta.joints[logicalName]
  if (!objectName) {
    return null
  }
  return root.getObjectByName(objectName) ?? null
}

export function resolveJoints(
  root: Object3D,
  logicalNames: string[],
): Record<string, Object3D | null> {
  const result: Record<string, Object3D | null> = {}
  logicalNames.forEach((name: string) => {
    result[name] = resolveJoint(root, name)
  })
  return result
}
