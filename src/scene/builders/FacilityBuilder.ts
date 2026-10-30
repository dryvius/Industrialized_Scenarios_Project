import * as THREE from 'three'
import { PYLON_SCALE, SUBSTATION_SCALE } from '@/constants/scale'
import type { MaterialFactory } from '@/scene/MaterialFactory'
import { getFacilityOrientations, SITE_LAYOUT } from '@/scene/layout'
import { PylonBuilder } from '@/scene/builders/PylonBuilder'
import { SubstationBuilder } from '@/scene/builders/SubstationBuilder'

/** 细化版铁塔、变电站 */
export class FacilityBuilder {
  public constructor(private readonly materials: MaterialFactory) {}

  public build(): THREE.Group {
    const group = new THREE.Group()
    group.name = 'FacilitySystem'

    /**
     * 场景总摆位（示意档距约 60 m）：
     * 杆塔右中景 → 变电站左远景 → 中间为牵引/绞盘作业带
     * 坐标取自 SITE_LAYOUT。
     */
    const pylonPose = SITE_LAYOUT.facilities.pylon
    const subPose = SITE_LAYOUT.facilities.substation
    const { pylonRotY, subRotY } = getFacilityOrientations()
    const pylonX = pylonPose.x
    const pylonZ = pylonPose.z
    const subX = subPose.x
    const subZ = subPose.z

    const pylon = new PylonBuilder(this.materials).build(pylonX, pylonZ)
    pylon.rotation.y = pylonRotY
    group.add(pylon)

    group.add(new SubstationBuilder(this.materials).build(subX, subZ, subRotY))

    // 门架 → 杆塔 跨档导线示意
    group.add(this.createFeederSpans(pylonX, pylonZ, pylonRotY, subX, subZ, subRotY))

    return group
  }

  /**
   * 门架 → 杆塔跨档导线：
   * 两端按垂直于走廊方向的横向坐标排序后一一配对，避免左右交叉。
   */
  private createFeederSpans(
    pylonX: number,
    pylonZ: number,
    pylonRotY: number,
    subX: number,
    subZ: number,
    subRotY: number,
  ): THREE.Group {
    const group = new THREE.Group()
    group.name = 'FeederSpans'
    const cableMat = this.materials.cable()
    const yAxis = new THREE.Vector3(0, 1, 0)

    const spanDir = new THREE.Vector3(pylonX - subX, 0, pylonZ - subZ).normalize()
    const lateral = new THREE.Vector3(-spanDir.z, 0, spanDir.x)
    const lateralKey = (p: THREE.Vector3): number => p.x * lateral.x + p.z * lateral.z

    const toWorld = (local: THREE.Vector3, rotY: number, ox: number, oz: number): THREE.Vector3 => {
      const w = local.clone()
      w.applyAxisAngle(yAxis, rotY)
      w.x += ox
      w.z += oz
      return w
    }

    // 门架绝缘子串底部线夹（与 SubstationBuilder 一致；不再叠本地半截 stub）
    const gantryOrigin = new THREE.Vector3(1.5, 0, -5.8)
    const hangXs = [-3.4, -1.1, 1.1, 3.4]
    const hangClampY = SUBSTATION_SCALE.gantryPostH - 1.5 - 1.25
    const fromPoints = hangXs.map((hx: number) => {
      const local = new THREE.Vector3(hx, hangClampY, 0).add(gantryOrigin)
      return toWorld(local, subRotY, subX, subZ)
    })

    // 杆塔朝向变电站一侧的挂点：顶层悬垂串底 + 中层横担耐张端（本地 -Z）
    const height = PYLON_SCALE.height
    const upperY = height * 0.76
    const tHeadY = height + 0.15
    const tHeadHalfH = PYLON_SCALE.tHeadHalfH
    const tHeadReach = PYLON_SCALE.tHeadReach
    const upperReach = PYLON_SCALE.upperReach
    const suspBottomY = tHeadY - tHeadHalfH - 0.05 - 8 * 0.18 - 0.15
    const upperAttachY = upperY - 0.08 - 0.12
    const upperStringLen = 0.18 + 5 * 0.15 + 0.2
    const upperAttachZ = -upperStringLen

    const tipLocals = [
      new THREE.Vector3(-tHeadReach, suspBottomY, -0.22),
      new THREE.Vector3(-upperReach, upperAttachY, upperAttachZ),
      new THREE.Vector3(upperReach, upperAttachY, upperAttachZ),
      new THREE.Vector3(tHeadReach, suspBottomY, -0.22),
    ]
    const toPoints = tipLocals.map((local: THREE.Vector3) =>
      toWorld(local, pylonRotY, pylonX, pylonZ),
    )

    fromPoints.sort((a: THREE.Vector3, b: THREE.Vector3) => lateralKey(a) - lateralKey(b))
    toPoints.sort((a: THREE.Vector3, b: THREE.Vector3) => lateralKey(a) - lateralKey(b))

    fromPoints.forEach((from: THREE.Vector3, index: number) => {
      const to = toPoints[index]
      const span = from.distanceTo(to)
      const mid = from.clone().lerp(to, 0.5)
      // 轻微弧垂，但保持跨中净空，避免穿过中间车辆
      const sag = Math.min(2.2, span * 0.03)
      mid.y = Math.max((from.y + to.y) * 0.5 - sag, 9.5)

      const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.032, 5, false), cableMat)
      mesh.name = `Feeder_${index}`
      mesh.castShadow = true
      group.add(mesh)
    })

    return group
  }
}
