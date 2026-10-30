import {
  FACILITY_LAYOUT,
  PYLON_SCALE,
  SUBSTATION_SCALE,
  VEHICLE_SCALE,
  WORKER_SCALE,
} from '@/constants/scale'
import type { BoxColliderDesc, EntityPlacement, PathDemoSpec, PoseXZ, XzPoint } from '@/scene/layout/types'

/**
 * 施工现场摆位 / 演示路径 / 占地与碰撞代理 SSOT。
 * 注意：相机与地面尺寸仍在 `@/constants/scene` 的 `SCENE_LAYOUT`。
 *
 * 分区约定（避免穿塔与人车对穿）：
 * - 铁塔 footprint 约 (22,4)，净空半径 ≥ 7 m
 * - 挖机：西北 (-12..-2, 9..15)
 * - 卷盘牵引：东南 (10..16, -12..-6)，与挖机直线距离 ≥ 15 m
 * - 吊车：站区西北外静置 (-42, -6)，距变电站地坪 ≥ 12 m（含支腿）
 * - 卡车 T-02 / 搅拌：东侧 x≥32，远离铁塔
 * - 工人 W-02 在挖机正南；W-03 在北侧走廊
 */

function vehicleBox(
  length: number,
  width: number,
  height: number,
  shrink = 0.92,
): BoxColliderDesc {
  return {
    kind: 'box',
    halfX: (width * shrink) / 2,
    halfY: (height * shrink) / 2,
    halfZ: (length * shrink) / 2,
    offsetY: (height * shrink) / 2,
  }
}

const TRUCK_COLLIDER = vehicleBox(
  VEHICLE_SCALE.truck.chassisLength,
  VEHICLE_SCALE.truck.chassisWidth,
  VEHICLE_SCALE.truck.cargoRoofY,
)

/** 含支腿外伸的代理盒，便于与其他移动体互斥 */
const CRANE_COLLIDER = vehicleBox(
  VEHICLE_SCALE.crane.chassisLength,
  Math.max(VEHICLE_SCALE.crane.chassisWidth, 5.8),
  VEHICLE_SCALE.crane.cabRoofY,
)

const EXCAVATOR_COLLIDER = vehicleBox(
  VEHICLE_SCALE.excavator.trackLength,
  VEHICLE_SCALE.excavator.trackSpread * 2 + 0.6,
  VEHICLE_SCALE.excavator.cabinRoofApprox,
)

const MIXER_COLLIDER = vehicleBox(
  VEHICLE_SCALE.mixer.trackLength,
  VEHICLE_SCALE.mixer.trackSpread * 2 + 0.8,
  VEHICLE_SCALE.mixer.overallHeightApprox,
)

/** 含前方牵引头伸出（local z≈3.2） */
const SPOOL_COLLIDER = vehicleBox(
  8.2,
  Math.max(VEHICLE_SCALE.spool.frameWidth, 2.0),
  VEHICLE_SCALE.spool.axleY + VEHICLE_SCALE.spool.flangeRadius,
)

function workerCapsuleProxy(): BoxColliderDesc {
  const height = WORKER_SCALE.defaultHeight
  const radius = 0.32
  return {
    kind: 'box',
    halfX: radius,
    halfY: height / 2,
    halfZ: radius,
    offsetY: height / 2,
  }
}

const WORKER_COLLIDER = workerCapsuleProxy()

/** 演示路径：首点必须与对应实体初始摆位一致 */
export const DEMO_PATHS = {
  truck_01: [
    { x: -24, z: 16 },
    { x: -10, z: 18 },
    { x: 4, z: 16 },
    { x: 4, z: 22 },
    { x: -18, z: 22 },
    { x: -24, z: 16 },
  ],
  /** 东侧环线，远离铁塔 (22,4) */
  truck_02: [
    { x: 36, z: 16 },
    { x: 42, z: 10 },
    { x: 40, z: 2 },
    { x: 34, z: 8 },
    { x: 36, z: 16 },
  ],
  /**
   * 挖机西北作业带（约 x∈[-12,-2], z∈[9,15]）。
   * 南界抬高，避免与卷盘/工人 W-02 重叠。
   */
  excavator_01: [
    { x: -10, z: 12 },
    { x: -6, z: 14 },
    { x: -2, z: 12 },
    { x: -6, z: 10 },
    { x: -10, z: 12 },
  ],
  /** 东侧搅拌环线，最近点距塔 ≥ 10 m */
  mixer_01: [
    { x: 32, z: 6 },
    { x: 38, z: 4 },
    { x: 40, z: 10 },
    { x: 34, z: 12 },
    { x: 32, z: 6 },
  ],
  /**
   * 卷盘东南作业带（约 x∈[10,16], z∈[-12,-6]）：
   * 远离挖机西北区、吊车西南区、铁塔 (22,4)。
   */
  cable_spool_01: [
    { x: 12, z: -6 },
    { x: 16, z: -8 },
    { x: 14, z: -12 },
    { x: 10, z: -10 },
    { x: 12, z: -6 },
  ],
  /** 挖机正南短环，z≤5，不进入挖机主路径 */
  worker_02: [
    { x: -14, z: 2 },
    { x: -11, z: 3.5 },
    { x: -8, z: 2 },
    { x: -11, z: 0.5 },
    { x: -14, z: 2 },
  ],
  /** 北侧走廊，远离挖机与铁塔 */
  worker_03: [
    { x: 10, z: 16 },
    { x: 16, z: 18 },
    { x: 18, z: 14 },
    { x: 12, z: 12 },
    { x: 10, z: 16 },
  ],
  /** 南侧放线工，偏西避开卷盘东南环线 */
  worker_04: [
    { x: 2, z: -14 },
    { x: 4.5, z: -13 },
    { x: 6, z: -15.5 },
    { x: 3, z: -16.5 },
    { x: 2, z: -14 },
  ],
} as const satisfies Record<string, readonly XzPoint[]>

function pathStart(path: readonly XzPoint[]): XzPoint {
  return path[0]
}

export const SITE_LAYOUT = {
  ground: {
    halfX: 90,
    halfY: 0.25,
    halfZ: 90,
  },

  facilities: {
    pylon: {
      id: 'pylon_01',
      x: FACILITY_LAYOUT.pylonX,
      z: FACILITY_LAYOUT.pylonZ,
      rotationY: 0,
      footprintRadius: PYLON_SCALE.baseHalf + 0.5,
      colliders: [
        {
          kind: 'box' as const,
          halfX: PYLON_SCALE.baseHalf,
          halfY: 0.45,
          halfZ: PYLON_SCALE.baseHalf,
          offsetY: 0.45,
        },
        {
          kind: 'box' as const,
          halfX: 1.35,
          halfY: PYLON_SCALE.height * 0.5,
          halfZ: 1.35,
          offsetY: PYLON_SCALE.height * 0.5,
        },
      ],
    } satisfies EntityPlacement,

    substation: {
      id: 'substation_01',
      x: FACILITY_LAYOUT.subX,
      z: FACILITY_LAYOUT.subZ,
      rotationY: 0,
      footprintRadius: Math.hypot(SUBSTATION_SCALE.padW, SUBSTATION_SCALE.padD) * 0.55,
      colliders: [
        {
          kind: 'box' as const,
          halfX: SUBSTATION_SCALE.padW / 2,
          halfY: 0.35,
          halfZ: SUBSTATION_SCALE.padD / 2,
          offsetY: 0.35,
          /** 与 SubstationBuilder 地坪本地偏置一致 */
          offsetX: -1,
          offsetZ: -1,
        },
        {
          kind: 'box' as const,
          halfX: SUBSTATION_SCALE.mainW / 2,
          halfY: SUBSTATION_SCALE.mainH / 2,
          halfZ: SUBSTATION_SCALE.mainD / 2,
          offsetY: SUBSTATION_SCALE.mainH / 2,
        },
      ],
    } satisfies EntityPlacement,
  },

  vehicles: {
    truck_01: {
      id: 'truck_01',
      ...pathStart(DEMO_PATHS.truck_01),
      rotationY: Math.PI * 0.92,
      footprintRadius: VEHICLE_SCALE.truck.chassisLength * 0.55,
      colliders: [TRUCK_COLLIDER],
    } satisfies EntityPlacement,

    truck_02: {
      id: 'truck_02',
      ...pathStart(DEMO_PATHS.truck_02),
      rotationY: -Math.PI * 0.55,
      footprintRadius: VEHICLE_SCALE.truck.chassisLength * 0.55,
      colliders: [TRUCK_COLLIDER],
    } satisfies EntityPlacement,

    truck_03: {
      id: 'truck_03',
      x: -36,
      z: -6,
      rotationY: Math.PI * 0.35,
      footprintRadius: VEHICLE_SCALE.truck.chassisLength * 0.55,
      colliders: [TRUCK_COLLIDER],
    } satisfies EntityPlacement,

    /** 站区西北外静置，避开变电站地坪/围栏（含支腿外伸） */
    crane_truck_01: {
      id: 'crane_truck_01',
      x: -42,
      z: -6,
      rotationY: 0.55,
      footprintRadius: VEHICLE_SCALE.crane.chassisLength * 0.65,
      colliders: [CRANE_COLLIDER],
    } satisfies EntityPlacement,

    excavator_01: {
      id: 'excavator_01',
      ...pathStart(DEMO_PATHS.excavator_01),
      rotationY: -0.4,
      footprintRadius: VEHICLE_SCALE.excavator.trackLength * 0.55,
      colliders: [EXCAVATOR_COLLIDER],
    } satisfies EntityPlacement,

    mixer_01: {
      id: 'mixer_01',
      ...pathStart(DEMO_PATHS.mixer_01),
      rotationY: 0.15,
      footprintRadius: VEHICLE_SCALE.mixer.trackLength * 0.55,
      colliders: [MIXER_COLLIDER],
    } satisfies EntityPlacement,

    cable_spool_01: {
      id: 'cable_spool_01',
      ...pathStart(DEMO_PATHS.cable_spool_01),
      rotationY: 0.35,
      footprintRadius: 4.2,
      colliders: [SPOOL_COLLIDER],
    } satisfies EntityPlacement,
  },

  workers: {
    worker_01: {
      id: 'worker_01',
      x: -12,
      z: 10,
      rotationY: 0.4,
      footprintRadius: 0.45,
      colliders: [WORKER_COLLIDER],
    } satisfies EntityPlacement,

    worker_02: {
      id: 'worker_02',
      ...pathStart(DEMO_PATHS.worker_02),
      rotationY: -0.3,
      footprintRadius: 0.45,
      colliders: [WORKER_COLLIDER],
    } satisfies EntityPlacement,

    worker_03: {
      id: 'worker_03',
      ...pathStart(DEMO_PATHS.worker_03),
      rotationY: 1.2,
      footprintRadius: 0.45,
      colliders: [WORKER_COLLIDER],
    } satisfies EntityPlacement,

    worker_04: {
      id: 'worker_04',
      ...pathStart(DEMO_PATHS.worker_04),
      rotationY: 2.1,
      footprintRadius: 0.45,
      colliders: [WORKER_COLLIDER],
    } satisfies EntityPlacement,

    /** 站区北门外侧，不进入围栏地坪 */
    worker_05: {
      id: 'worker_05',
      x: -10,
      z: -18,
      rotationY: 0.2,
      footprintRadius: 0.45,
      colliders: [WORKER_COLLIDER],
    } satisfies EntityPlacement,

    /** 远离铁塔，避免静态贴塔 */
    worker_06: {
      id: 'worker_06',
      x: 30,
      z: 18,
      rotationY: -1.0,
      footprintRadius: 0.45,
      colliders: [WORKER_COLLIDER],
    } satisfies EntityPlacement,

    /**
     * 高空作业人员：塔基外侧待机；skipKinematic 由 TowerWorkController 直接写 Y。
     * 精确塔基坐标在控制器内对齐 getPylonClimbBaseWorld()。
     */
    worker_07: {
      id: 'worker_07',
      x: FACILITY_LAYOUT.pylonX,
      z: FACILITY_LAYOUT.pylonZ - 6,
      rotationY: 0,
      footprintRadius: 0.45,
      colliders: [WORKER_COLLIDER],
      skipKinematic: true,
    } satisfies EntityPlacement,
  },
} as const

export function getFacilityOrientations(): { pylonRotY: number; subRotY: number } {
  const pylon = SITE_LAYOUT.facilities.pylon
  const sub = SITE_LAYOUT.facilities.substation
  const toSubX = sub.x - pylon.x
  const toSubZ = sub.z - pylon.z
  const pylonRotY = Math.atan2(-toSubX, -toSubZ)
  const subRotY = Math.atan2(pylon.x - sub.x, pylon.z - sub.z) + Math.PI
  return { pylonRotY, subRotY }
}

export function getDemoPath(objectId: string): PathDemoSpec | null {
  const path = DEMO_PATHS[objectId as keyof typeof DEMO_PATHS]
  if (!path) {
    return null
  }
  return {
    objectId,
    path: [...path],
    loop: true,
  }
}

export function getVehiclePose(objectId: keyof typeof SITE_LAYOUT.vehicles): PoseXZ {
  const v = SITE_LAYOUT.vehicles[objectId]
  return { x: v.x, z: v.z, rotationY: v.rotationY }
}

export function listStaticFacilityPlacements(): EntityPlacement[] {
  return [SITE_LAYOUT.facilities.pylon, SITE_LAYOUT.facilities.substation]
}

/** 全部可移动实体摆位（车辆 + 工人），供 Kinematic 注册；排除 skipKinematic */
export function listMovablePlacements(): EntityPlacement[] {
  return [
    ...Object.values(SITE_LAYOUT.vehicles),
    ...Object.values(SITE_LAYOUT.workers),
  ].filter((p: EntityPlacement) => !p.skipKinematic)
}

export function findMovablePlacement(objectId: string): EntityPlacement | null {
  const vehicles = SITE_LAYOUT.vehicles as Record<string, EntityPlacement>
  const workers = SITE_LAYOUT.workers as Record<string, EntityPlacement>
  return vehicles[objectId] ?? workers[objectId] ?? null
}
