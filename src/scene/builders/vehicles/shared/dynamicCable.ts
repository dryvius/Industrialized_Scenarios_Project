import * as THREE from 'three'

interface DynamicCableUserData {
  points: THREE.Object3D[]
}

const LOCAL_START = new THREE.Vector3()
const LOCAL_END = new THREE.Vector3()
const DIRECTION = new THREE.Vector3()
const MIDPOINT = new THREE.Vector3()
const Y_AXIS = new THREE.Vector3(0, 1, 0)

/**
 * 创建由多个锚点约束的分段线缆。几何体长度固定为 1，运行时仅更新变换。
 */
export const createDynamicCable = (
  name: string,
  points: THREE.Object3D[],
  radius: number,
  material: THREE.Material,
): THREE.Group => {
  const root = new THREE.Group()
  root.name = name
  const geometry = new THREE.CylinderGeometry(radius, radius, 1, 8)

  for (let index = 0; index < points.length - 1; index += 1) {
    const segment = new THREE.Mesh(geometry, material)
    segment.name = `${name}_segment_${index}`
    segment.castShadow = false
    root.add(segment)
  }

  const userData: DynamicCableUserData = { points }
  root.userData.dynamicCable = userData
  return root
}

/** 将锚点世界坐标转换到线缆父级局部空间，并更新各段的位置、方向和长度。 */
export const updateDynamicCable = (root: THREE.Group): void => {
  const metadata = root.userData.dynamicCable as DynamicCableUserData | undefined
  if (!metadata || metadata.points.length < 2) {
    return
  }

  root.updateWorldMatrix(true, false)
  metadata.points.forEach((point: THREE.Object3D) => point.updateWorldMatrix(true, false))

  for (let index = 0; index < metadata.points.length - 1; index += 1) {
    const segment = root.children[index]
    if (!(segment instanceof THREE.Mesh)) {
      continue
    }

    metadata.points[index].getWorldPosition(LOCAL_START)
    metadata.points[index + 1].getWorldPosition(LOCAL_END)
    root.worldToLocal(LOCAL_START)
    root.worldToLocal(LOCAL_END)
    DIRECTION.subVectors(LOCAL_END, LOCAL_START)
    const length = Math.max(DIRECTION.length(), 0.001)
    MIDPOINT.copy(LOCAL_START).addScaledVector(DIRECTION, 0.5)

    segment.position.copy(MIDPOINT)
    segment.quaternion.setFromUnitVectors(Y_AXIS, DIRECTION.normalize())
    segment.scale.set(1, length, 1)
  }
}
