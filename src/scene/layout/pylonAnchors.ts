import * as THREE from 'three'
import {
  FACILITY_LAYOUT,
  listPylonClimbRungYs,
  PYLON_CLIMB,
  PYLON_SCALE,
  snapToClimbRungY,
} from '@/constants/scale'
import { getFacilityOrientations, SITE_LAYOUT } from '@/scene/layout/sceneLayout'
import type { PylonAnchorDef, XyzPoint } from '@/scene/layout/types'

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const TMP_VEC = new THREE.Vector3()

/** 攀爬主腿角点符号：+X / -Z（朝向变电站侧外缘，便于观看） */
const CLIMB_LEG_CX = 1
const CLIMB_LEG_CZ = -1

/** 横担作业取 +X 侧 */
const ARM_SIDE = 1

function mastHalfAt(y: number): number {
  const t = Math.min(1, Math.max(0, y / PYLON_SCALE.height))
  return PYLON_SCALE.baseHalf * (1 - t) + PYLON_SCALE.topHalf * t
}

/** 主腿外侧站位点（与脚钉同侧，略外偏） */
function legOutsideLocal(y: number, outward: number = PYLON_CLIMB.bodyOutward): XyzPoint {
  const half = mastHalfAt(y)
  return {
    x: CLIMB_LEG_CX * (half + outward),
    y,
    z: CLIMB_LEG_CZ * (half + outward),
  }
}

/**
 * 铁塔本地挂点 SSOT。
 * 塔身挂点高度吸附到横栏网格。
 */
export const PYLON_ANCHOR_DEFS: readonly PylonAnchorDef[] = [
  {
    id: 'mast_mid',
    local: legOutsideLocal(snapToClimbRungY(PYLON_SCALE.height * 0.45)),
    // 面朝塔心（由腿位指向原点），禁止朝外导致背对塔身作业
    facingYawLocal: Math.atan2(-CLIMB_LEG_CX, -CLIMB_LEG_CZ),
    workPose: 'inspect',
    kind: 'mast',
    label: '塔身中段',
  },
  {
    id: 'arm_lower',
    local: {
      x: ARM_SIDE * PYLON_SCALE.lowerReach * 0.65,
      // 坐在下层横担弦杆上方，并向前外偏，避免穿进腹杆
      y: PYLON_SCALE.height * 0.58 + PYLON_CLIMB.armSitLift,
      z: PYLON_CLIMB.armRideZ,
    },
    // 沿 +X 横担向外，便于骑跨挪移朝向
    facingYawLocal: ARM_SIDE > 0 ? Math.PI / 2 : -Math.PI / 2,
    workPose: 'tool',
    kind: 'arm',
    label: '下层横担',
  },
  {
    id: 'arm_upper',
    local: {
      x: ARM_SIDE * PYLON_SCALE.upperReach * 0.65,
      y: PYLON_SCALE.height * 0.76 + PYLON_CLIMB.armSitLift,
      z: PYLON_CLIMB.armRideZ,
    },
    facingYawLocal: ARM_SIDE > 0 ? Math.PI / 2 : -Math.PI / 2,
    workPose: 'tool',
    kind: 'arm',
    label: '上层横担',
  },
] as const

export type PylonAnchorId = (typeof PYLON_ANCHOR_DEFS)[number]['id']

export interface WorldAnchor {
  id: string
  position: XyzPoint
  facingYaw: number
  workPose: PylonAnchorDef['workPose']
  kind: PylonAnchorDef['kind']
  label: string
}

function rotateY(local: XyzPoint, rotY: number): XyzPoint {
  TMP_VEC.set(local.x, local.y, local.z).applyAxisAngle(Y_AXIS, rotY)
  return { x: TMP_VEC.x, y: TMP_VEC.y, z: TMP_VEC.z }
}

/** 塔基攀爬起点（世界系，地面） */
export function getPylonClimbBaseWorld(): XyzPoint {
  const { pylonRotY } = getFacilityOrientations()
  const local = legOutsideLocal(0, PYLON_CLIMB.bodyOutward + 0.5)
  const rotated = rotateY(local, pylonRotY)
  return {
    x: FACILITY_LAYOUT.pylonX + rotated.x,
    y: 0,
    z: FACILITY_LAYOUT.pylonZ + rotated.z,
  }
}

export function listPylonAnchorsWorld(): WorldAnchor[] {
  const { pylonRotY } = getFacilityOrientations()
  const ox = SITE_LAYOUT.facilities.pylon.x
  const oz = SITE_LAYOUT.facilities.pylon.z
  return PYLON_ANCHOR_DEFS.map((def: PylonAnchorDef) => {
    const rotated = rotateY(def.local, pylonRotY)
    return {
      id: def.id,
      position: {
        x: ox + rotated.x,
        y: rotated.y,
        z: oz + rotated.z,
      },
      facingYaw: pylonRotY + def.facingYawLocal,
      workPose: def.workPose,
      kind: def.kind,
      label: def.label,
    }
  })
}

export function getPylonAnchorWorld(anchorId: string): WorldAnchor | null {
  return listPylonAnchorsWorld().find((a: WorldAnchor) => a.id === anchorId) ?? null
}

/**
 * 构造攀爬折线（世界系）：
 * 竖直段按横栏一档一点，保证手脚相位可与横栏对齐。
 */
export function buildClimbPath(from: XyzPoint, targetId: string): XyzPoint[] {
  const target = getPylonAnchorWorld(targetId)
  if (!target) {
    return [from]
  }

  const { pylonRotY } = getFacilityOrientations()
  const ox = SITE_LAYOUT.facilities.pylon.x
  const oz = SITE_LAYOUT.facilities.pylon.z
  const toWorld = (local: XyzPoint): XyzPoint => {
    const r = rotateY(local, pylonRotY)
    return { x: ox + r.x, y: r.y, z: oz + r.z }
  }

  const path: XyzPoint[] = [{ ...from }]
  const isArm = targetId.startsWith('arm_')
  // 竖直攀爬只爬到横担弦杆高度（未含 sitLift）；塔身挂点吸附横栏
  const climbTopY = isArm
    ? targetId === 'arm_lower'
      ? PYLON_SCALE.height * 0.58
      : PYLON_SCALE.height * 0.76
    : snapToClimbRungY(target.position.y)
  const rungYs = listPylonClimbRungYs()

  // 从当前高度之上的下一档横栏开始，逐档爬到目标高度
  const startY = from.y
  rungYs.forEach((ry: number) => {
    if (ry > startY + 0.08 && ry <= climbTopY + 1e-6) {
      path.push(toWorld(legOutsideLocal(ry)))
    }
  })

  if (isArm) {
    const sitY = target.position.y
    const rideZ = PYLON_CLIMB.armRideZ
    const reach =
      targetId === 'arm_lower' ? PYLON_SCALE.lowerReach : PYLON_SCALE.upperReach
    // 1) 塔身外侧升到弦杆高度后，抬坐到骑跨高度（仍在塔外）
    path.push(toWorld(legOutsideLocal(climbTopY)))
    path.push(
      toWorld({
        x: CLIMB_LEG_CX * (mastHalfAt(climbTopY) + PYLON_CLIMB.bodyOutward),
        y: sitY,
        z: CLIMB_LEG_CZ * (mastHalfAt(climbTopY) + PYLON_CLIMB.bodyOutward),
      }),
    )
    // 2) 转到横担前方骑跨线（避开腹杆），再沿 +X 外挪
    path.push(
      toWorld({
        x: ARM_SIDE * Math.max(mastHalfAt(climbTopY) + 0.8, reach * 0.28),
        y: sitY,
        z: rideZ,
      }),
    )
    path.push(
      toWorld({
        x: ARM_SIDE * reach * 0.45,
        y: sitY,
        z: rideZ,
      }),
    )
  }

  path.push({
    x: target.position.x,
    y: isArm ? target.position.y : climbTopY,
    z: target.position.z,
  })
  return dedupePath(path)
}

/** 下降路径：目标 → 主腿横栏折点 → 塔基 */
export function buildDescendPath(from: XyzPoint): XyzPoint[] {
  const base = getPylonClimbBaseWorld()
  const upward = buildClimbPath(base, nearestAnchorId(from))
  const reversed = [...upward].reverse()
  if (reversed.length === 0) {
    return [from, base]
  }
  return dedupePath([{ ...from }, ...reversed.slice(1), base])
}

function nearestAnchorId(from: XyzPoint): string {
  const anchors = listPylonAnchorsWorld()
  let best = anchors[0]?.id ?? 'mast_mid'
  let bestD = Number.POSITIVE_INFINITY
  anchors.forEach((a: WorldAnchor) => {
    const dx = a.position.x - from.x
    const dy = a.position.y - from.y
    const dz = a.position.z - from.z
    const d = dx * dx + dy * dy + dz * dz
    if (d < bestD) {
      bestD = d
      best = a.id
    }
  })
  return best
}

function dedupePath(points: XyzPoint[]): XyzPoint[] {
  const out: XyzPoint[] = []
  points.forEach((p: XyzPoint) => {
    const prev = out[out.length - 1]
    if (!prev || distSq(prev, p) > 0.02) {
      out.push(p)
    }
  })
  return out
}

function distSq(a: XyzPoint, b: XyzPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return dx * dx + dy * dy + dz * dz
}

/** demo 默认挂点顺序 */
export const TOWER_DEMO_ANCHOR_ORDER: readonly PylonAnchorId[] = [
  'mast_mid',
  'arm_lower',
  'arm_upper',
] as const
