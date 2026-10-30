import * as THREE from 'three'

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const TMP_DIR = new THREE.Vector3()
const TMP_MID = new THREE.Vector3()
const TMP_FROM = new THREE.Vector3()
const TMP_TO = new THREE.Vector3()

const BASE_BARREL_RADIUS = 0.09
const BASE_ROD_RADIUS = 0.045

interface HydraulicGeometries {
  barrel: THREE.CylinderGeometry
  collar: THREE.CylinderGeometry
  cap: THREE.CylinderGeometry
  rod: THREE.CylinderGeometry
  eye: THREE.TorusGeometry
  pin: THREE.CylinderGeometry
  clevis: THREE.BoxGeometry
}

const HYDRAULIC_GEOMETRIES = new WeakMap<THREE.Material, HydraulicGeometries>()

export interface HydraulicOptions {
  name?: string
  /** 缸筒半径，默认 0.09，与既有吊车/搅拌车比例一致 */
  barrelRadius?: number
  /** 活塞杆半径，默认 0.045 */
  rodRadius?: number
}

/**
 * 在两点之间生成液压缸（缸筒靠近 from，活塞杆伸向 to）。
 * 销眼沿局部 X，与本场景绕 X 的关节轴一致。
 * 可用 `layoutHydraulic` 在运行时按锚点更新姿态与伸缩感。
 */
export function createHydraulic(
  from: THREE.Vector3 | [number, number, number],
  to: THREE.Vector3 | [number, number, number],
  barrelMat: THREE.MeshStandardMaterial,
  rodMat: THREE.MeshStandardMaterial,
  options?: HydraulicOptions,
): THREE.Group {
  const start = Array.isArray(from) ? new THREE.Vector3(from[0], from[1], from[2]) : from.clone()
  const end = Array.isArray(to) ? new THREE.Vector3(to[0], to[1], to[2]) : to.clone()

  const group = new THREE.Group()
  if (options?.name) {
    group.name = options.name
  }
  group.userData.isHydraulic = true
  group.userData.hydBarrelRadius = options?.barrelRadius ?? BASE_BARREL_RADIUS
  group.userData.hydRodRadius = options?.rodRadius ?? BASE_ROD_RADIUS

  const geometries = getHydraulicGeometries(barrelMat)
  const barrel = new THREE.Mesh(geometries.barrel, barrelMat)
  barrel.name = 'hyd_barrel'
  barrel.castShadow = true
  group.add(barrel)

  const collar = new THREE.Mesh(geometries.collar, barrelMat)
  collar.name = 'hyd_collar'
  group.add(collar)

  const cap = new THREE.Mesh(geometries.cap, barrelMat)
  cap.name = 'hyd_cap'
  group.add(cap)

  const rod = new THREE.Mesh(geometries.rod, rodMat)
  rod.name = 'hyd_rod'
  rod.castShadow = true
  group.add(rod)

  const eyeFrom = createHydraulicEye(geometries, barrelMat, rodMat, 'hyd_eye_from')
  group.add(eyeFrom)

  const eyeTo = createHydraulicEye(geometries, barrelMat, rodMat, 'hyd_eye_to')
  group.add(eyeTo)

  layoutHydraulic(group, start, end)
  return group
}

function createHydraulicEye(
  geometries: HydraulicGeometries,
  barrelMat: THREE.MeshStandardMaterial,
  rodMat: THREE.MeshStandardMaterial,
  name: string,
): THREE.Mesh {
  const eye = new THREE.Mesh(geometries.eye, rodMat)
  eye.name = name
  // 圆环默认孔沿 Z；转到局部 X，与动臂销轴同向。
  eye.rotation.y = Math.PI / 2

  const pin = new THREE.Mesh(geometries.pin, rodMat)
  pin.name = 'hyd_pin'
  pin.rotation.x = Math.PI / 2
  eye.add(pin)

  const clevisA = new THREE.Mesh(geometries.clevis, barrelMat)
  clevisA.position.z = 0.06
  eye.add(clevisA)
  const clevisB = clevisA.clone()
  clevisB.position.z = -0.06
  eye.add(clevisB)

  return eye
}

function getHydraulicGeometries(material: THREE.Material): HydraulicGeometries {
  const cached = HYDRAULIC_GEOMETRIES.get(material)
  if (cached) {
    return cached
  }
  const geometries: HydraulicGeometries = {
    barrel: new THREE.CylinderGeometry(BASE_BARREL_RADIUS, BASE_BARREL_RADIUS, 1, 14),
    collar: new THREE.CylinderGeometry(0.125, 0.125, 0.1, 14),
    cap: new THREE.CylinderGeometry(0.108, 0.108, 0.07, 14),
    rod: new THREE.CylinderGeometry(BASE_ROD_RADIUS, BASE_ROD_RADIUS, 1, 12),
    eye: new THREE.TorusGeometry(0.078, 0.02, 6, 12),
    pin: new THREE.CylinderGeometry(0.028, 0.028, 0.24, 8),
    clevis: new THREE.BoxGeometry(0.11, 0.16, 0.028),
  }
  HYDRAULIC_GEOMETRIES.set(material, geometries)
  return geometries
}

function readRadius(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  return fallback
}

/** 按父空间内 from→to 重排液压缸姿态与部件长度比例 */
export function layoutHydraulic(
  group: THREE.Group,
  from: THREE.Vector3 | [number, number, number],
  to: THREE.Vector3 | [number, number, number],
): void {
  const start = Array.isArray(from) ? TMP_FROM.set(from[0], from[1], from[2]) : TMP_FROM.copy(from)
  const end = Array.isArray(to) ? TMP_TO.set(to[0], to[1], to[2]) : TMP_TO.copy(to)

  TMP_DIR.subVectors(end, start)
  const length = Math.max(TMP_DIR.length(), 0.2)
  TMP_DIR.normalize()

  TMP_MID.copy(start).add(end).multiplyScalar(0.5)
  group.position.copy(TMP_MID)
  group.quaternion.setFromUnitVectors(Y_AXIS, TMP_DIR)

  const barrelRadius = readRadius(group.userData.hydBarrelRadius, BASE_BARREL_RADIUS)
  const rodRadius = readRadius(group.userData.hydRodRadius, BASE_ROD_RADIUS)
  const barrelRadial = barrelRadius / BASE_BARREL_RADIUS
  const rodRadial = rodRadius / BASE_ROD_RADIUS
  const eyeInset = Math.min(0.08 * barrelRadial, length * 0.14)
  const barrelLen = length * 0.56
  const rodLen = length * 0.5

  const barrel = group.getObjectByName('hyd_barrel')
  const collar = group.getObjectByName('hyd_collar')
  const cap = group.getObjectByName('hyd_cap')
  const rod = group.getObjectByName('hyd_rod')
  const eyeFrom = group.getObjectByName('hyd_eye_from')
  const eyeTo = group.getObjectByName('hyd_eye_to')

  const barrelStart = -length * 0.5 + eyeInset
  if (barrel) {
    barrel.scale.set(barrelRadial, barrelLen, barrelRadial)
    barrel.position.y = barrelStart + barrelLen * 0.5
  }
  if (collar) {
    collar.scale.set(barrelRadial, barrelRadial, barrelRadial)
    collar.position.y = barrelStart + barrelLen
  }
  if (cap) {
    cap.scale.set(barrelRadial, barrelRadial, barrelRadial)
    cap.position.y = barrelStart + 0.02 * barrelRadial
  }
  if (rod) {
    const rodTip = length * 0.5 - eyeInset * 0.65
    rod.scale.set(rodRadial, rodLen, rodRadial)
    rod.position.y = rodTip - rodLen * 0.5
  }
  if (eyeFrom) {
    eyeFrom.scale.setScalar(barrelRadial)
    eyeFrom.position.y = -length * 0.5
  }
  if (eyeTo) {
    eyeTo.scale.setScalar(Math.max(rodRadial, barrelRadial * 0.92))
    eyeTo.position.y = length * 0.5
  }

  group.userData.hydLength = length
}

/**
 * 根据两个锚点（可在不同父节点下）更新液压缸。
 * `space` 为液压缸所在父节点，用于把世界坐标转到父本地。
 */
export function updateHydraulicFromAnchors(
  cylinder: THREE.Object3D,
  fromAnchor: THREE.Object3D,
  toAnchor: THREE.Object3D,
  space: THREE.Object3D,
): void {
  if (!(cylinder instanceof THREE.Group) || !cylinder.userData.isHydraulic) {
    return
  }
  fromAnchor.getWorldPosition(TMP_FROM)
  toAnchor.getWorldPosition(TMP_TO)
  space.worldToLocal(TMP_FROM)
  space.worldToLocal(TMP_TO)
  layoutHydraulic(cylinder, TMP_FROM, TMP_TO)
}
