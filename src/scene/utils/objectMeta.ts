import type { Object3D } from 'three'
import type { SceneObjectType } from '@/enums/SceneObjectType'
import type { SceneObjectUserData } from '@/types/scene'
import { USER_DATA_KEYS } from '@/constants/scene'

export function tagSelectable(
  object: Object3D,
  meta: Omit<SceneObjectUserData, 'selectable'>,
): void {
  object.name = meta.objectId
  object.userData[USER_DATA_KEYS.objectId] = meta.objectId
  object.userData[USER_DATA_KEYS.objectType] = meta.objectType
  object.userData[USER_DATA_KEYS.selectable] = true
  object.userData[USER_DATA_KEYS.label] = meta.label
  if (meta.businessKey) {
    object.userData[USER_DATA_KEYS.businessKey] = meta.businessKey
  }
}

export function readSelectableMeta(object: Object3D): SceneObjectUserData | null {
  if (!object.userData[USER_DATA_KEYS.selectable]) {
    return null
  }

  return {
    objectId: String(object.userData[USER_DATA_KEYS.objectId] ?? ''),
    objectType: object.userData[USER_DATA_KEYS.objectType] as SceneObjectType,
    selectable: true,
    label: String(object.userData[USER_DATA_KEYS.label] ?? ''),
    businessKey: object.userData[USER_DATA_KEYS.businessKey]
      ? String(object.userData[USER_DATA_KEYS.businessKey])
      : undefined,
  }
}

export function findSelectableRoot(object: Object3D): Object3D | null {
  let current: Object3D | null = object
  while (current) {
    if (current.userData[USER_DATA_KEYS.selectable]) {
      return current
    }
    current = current.parent
  }
  return null
}
