import * as THREE from 'three'
import { VEHICLE_SCALE } from '@/constants/scale'
import { SceneObjectType } from '@/enums/SceneObjectType'
import type { MaterialFactory } from '@/scene/MaterialFactory'
import { tagAnimatable } from '@/scene/utils/animatableMeta'
import { tagSelectable } from '@/scene/utils/objectMeta'
import { addWheels } from '@/scene/builders/vehicles/shared/addWheels'
import {
  createDynamicCable,
  updateDynamicCable,
} from '@/scene/builders/vehicles/shared/dynamicCable'

/**
 * 电缆牵引机（对照参考图）：
 * 前方橙色紧凑牵引单元 ← 铰接 ← A 形卷盘架 + 辐条卷盘，缆线自盘底向前穿入牵引机
 */
export class CableSpoolBuilder {
  public constructor(private readonly materials: MaterialFactory) {}

  public build(x: number, z: number, rotY: number): THREE.Group {
    const root = new THREE.Group()
    root.name = 'cable_spool_01'
    root.position.set(x, 0, z)
    root.rotation.y = rotY

    const orange = this.materials.orange()
    const orangeDark = this.materials.orangeDark()
    const metal = this.materials.metal()
    const dark = this.materials.metalDark()
    const cable = this.materials.cable()
    const chrome = this.materials.chrome()
    const silver = this.materials.get('spoolSilver', 0xc8d0d8, {
      roughness: 0.45,
      metalness: 0.35,
    })

    // ========== 橙色紧凑牵引单元（约卷盘高度 1/3） ==========
    const tractor = new THREE.Group()
    tractor.name = 'joint_tractor'
    tractor.position.set(0, 0, 3.2)
    root.add(tractor)

    // 车身底缘高于小轮轴心，减少轮毂穿入车体
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.05, 1.65), orange)
    body.position.y = 0.95
    body.castShadow = true
    tractor.add(body)
    const controlBand = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.28, 0.06), dark)
    controlBand.position.set(0, 1.18, 0.84)
    tractor.add(controlBand)
    for (const sx of [-0.68, 0.68]) {
      const nameplate = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.28, 0.62), metal)
      nameplate.position.set(sx, 1.12, 0.15)
      tractor.add(nameplate)
    }

    // 顶把手（参考图银色提手）
    const handlePostL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), chrome)
    handlePostL.position.set(-0.35, 1.55, 0)
    tractor.add(handlePostL)
    const handlePostR = handlePostL.clone()
    handlePostR.position.x = 0.35
    tractor.add(handlePostR)
    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.8, 8), chrome)
    handleBar.rotation.z = Math.PI / 2
    handleBar.position.set(0, 1.72, 0)
    tractor.add(handleBar)

    // 侧面通风 / 控制面板
    for (const sx of [-0.7, 0.7]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.9), metal)
      panel.position.set(sx, 0.9, 0.05)
      tractor.add(panel)
      for (let i = 0; i < 4; i += 1) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.7), dark)
        vent.position.set(sx > 0 ? sx + 0.02 : sx - 0.02, 0.7 + i * 0.12, 0.05)
        tractor.add(vent)
      }
    }

    // 前端格栅 + 牵引环
    const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.08), metal)
    frontPanel.position.set(0, 0.95, 0.88)
    tractor.add(frontPanel)
    for (let i = 0; i < 5; i += 1) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.03), dark)
      slot.position.set(0, 0.75 + i * 0.1, 0.93)
      tractor.add(slot)
    }

    const frontHitchArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.55), orange)
    frontHitchArm.position.set(0, 0.45, 1.15)
    frontHitchArm.castShadow = true
    tractor.add(frontHitchArm)
    const frontEye = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 8, 14), orangeDark)
    frontEye.position.set(0, 0.45, 1.45)
    tractor.add(frontEye)

    // 紧凑牵引头：小轮、轴心=半径，避免大卡车轮半径穿地/穿车身
    const tractorTireR = 0.3
    addWheels(
      this.materials,
      tractor,
      [
        [-0.78, tractorTireR, 0.5],
        [0.78, tractorTireR, 0.5],
        [-0.78, tractorTireR, -0.5],
        [0.78, tractorTireR, -0.5],
      ],
      { tireRadius: tractorTireR, tireWidth: 0.24 },
    )
    for (const sx of [-0.22, 0.22]) {
      const tractorFork = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.5), dark)
      tractorFork.position.set(sx, 0.5, -0.98)
      tractor.add(tractorFork)
    }

    // ========== 铰链：牵引机尾 ↔ 卷盘架前横梁（可明显辨认的铰接） ==========
    const hinge = new THREE.Group()
    hinge.position.set(0, 0.48, 2.15)
    root.add(hinge)

    // 牵引机侧铰耳
    const tractorClevis = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.35), dark)
    tractorClevis.position.set(0, 0, 0.35)
    tractorClevis.castShadow = true
    hinge.add(tractorClevis)
    for (const sx of [-0.18, 0.18]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.4), metal)
      ear.position.set(sx, 0.05, 0.15)
      hinge.add(ear)
    }

    // 铰接销
    const hingePin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 10), chrome)
    hingePin.rotation.z = Math.PI / 2
    hingePin.position.set(0, 0.05, 0.05)
    hinge.add(hingePin)

    // 短牵引杆
    const towBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.85), silver)
    towBar.position.set(0, 0, -0.4)
    towBar.castShadow = true
    hinge.add(towBar)

    // 卷盘架侧铰座
    const frameClevis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), dark)
    frameClevis.position.set(0, 0, -0.85)
    frameClevis.castShadow = true
    hinge.add(frameClevis)
    const framePin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 10), chrome)
    framePin.rotation.z = Math.PI / 2
    framePin.position.set(0, 0.05, -0.85)
    hinge.add(framePin)

    const spoolScale = VEHICLE_SCALE.spool

    // ========== 卷盘架：矩形底框 + 双侧 A 形支架 ==========
    const stand = new THREE.Group()
    stand.position.set(0, 0, -0.4)
    root.add(stand)

    // 矩形底座（方管梁）
    const baseLen = 3.2
    const baseWid = spoolScale.frameWidth
    const railH = 0.18
    const railW = 0.2

    const baseFront = new THREE.Mesh(new THREE.BoxGeometry(baseWid, railH, railW), silver)
    baseFront.position.set(0, 0.12, baseLen / 2 - 0.1)
    baseFront.castShadow = true
    stand.add(baseFront)
    const baseRear = baseFront.clone()
    baseRear.position.z = -(baseLen / 2 - 0.1)
    stand.add(baseRear)
    for (const sx of [-baseWid / 2 + 0.1, baseWid / 2 - 0.1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(railW, railH, baseLen), silver)
      side.position.set(sx, 0.12, 0)
      side.castShadow = true
      stand.add(side)
    }
    // 中横梁
    const baseMid = new THREE.Mesh(new THREE.BoxGeometry(baseWid - 0.2, railH, railW), dark)
    baseMid.position.set(0, 0.12, 0)
    stand.add(baseMid)

    // 铰接前伸梁（与铰链对接）
    const hitchBeam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.9), silver)
    hitchBeam.position.set(0, 0.22, baseLen / 2 + 0.25)
    hitchBeam.castShadow = true
    stand.add(hitchBeam)

    // 双侧 A 形架（两斜臂在轴心汇合）
    const axleY = spoolScale.axleY
    const axleZ = 0
    const sideX = baseWid * 0.48
    for (const sx of [-sideX, sideX]) {
      const aSide = new THREE.Group()
      aSide.position.x = sx
      stand.add(aSide)

      // 前斜臂
      const armF = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 2.55), silver)
      armF.position.set(0, axleY * 0.5, 0.7)
      armF.rotation.x = -0.72
      armF.castShadow = true
      aSide.add(armF)

      // 后斜臂
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 2.55), silver)
      armR.position.set(0, axleY * 0.5, -0.7)
      armR.rotation.x = 0.72
      armR.castShadow = true
      aSide.add(armR)

      // 轴座
      const bearing = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.4), dark)
      bearing.position.set(0, axleY, axleZ)
      bearing.castShadow = true
      aSide.add(bearing)
      const bearingCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12),
        chrome,
      )
      bearingCap.rotation.z = Math.PI / 2
      bearingCap.position.set(sx > 0 ? 0.22 : -0.22, axleY, axleZ)
      aSide.add(bearingCap)

      // 底座脚
      const footF = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.4), dark)
      footF.position.set(0, 0.2, 1.2)
      aSide.add(footF)
      const footR = footF.clone()
      footR.position.z = -1.2
      aSide.add(footR)
    }

    // 顶部横梁连接两侧 A 架
    const topTie = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.14), silver)
    topTie.position.set(0, axleY + 0.25, 0)
    stand.add(topTie)

    // ========== 卷盘 ==========
    const spool = new THREE.Group()
    spool.name = 'joint_spool'
    spool.position.set(0, axleY, axleZ)
    stand.add(spool)

    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 14), dark)
    axle.rotation.z = Math.PI / 2
    spool.add(axle)

    // 轮毂
    for (const sx of [-0.85, 0.85]) {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.28, 16), metal)
      hub.rotation.z = Math.PI / 2
      hub.position.x = sx
      spool.add(hub)
    }

    const flangeR = spoolScale.flangeRadius
    const packR = spoolScale.cablePackRadius
    for (const sx of [-0.95, 0.95]) {
      // 法兰盘（Ø 3.6 m）
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(flangeR, flangeR, 0.12, 40), silver)
      flange.rotation.z = Math.PI / 2
      flange.position.x = sx
      flange.castShadow = true
      spool.add(flange)

      // 外缘卷边
      const rim = new THREE.Mesh(new THREE.TorusGeometry(flangeR - 0.1, 0.07, 8, 40), metal)
      rim.rotation.y = Math.PI / 2
      rim.position.x = sx
      spool.add(rim)

      // 12 根辐条（参考图）
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.07, flangeR * 0.86, 0.07), silver)
        spoke.position.set(sx, Math.cos(a) * (flangeR * 0.46), Math.sin(a) * (flangeR * 0.46))
        spoke.rotation.x = a
        spool.add(spoke)
      }

      // 轮缘螺栓
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 6), chrome)
        bolt.rotation.z = Math.PI / 2
        bolt.position.set(
          sx > 0 ? sx + 0.08 : sx - 0.08,
          Math.cos(a) * (flangeR - 0.25),
          Math.sin(a) * (flangeR - 0.25),
        )
        spool.add(bolt)
      }
    }

    // 满绕黑缆：鼓身填满法兰间距 + 径向多层 + 轴向多排（避免只有一根环的感觉）
    const pack = new THREE.Mesh(new THREE.CylinderGeometry(packR, packR, 1.55, 32), cable)
    pack.rotation.z = Math.PI / 2
    pack.castShadow = true
    spool.add(pack)

    const drumHalfW = 0.7
    const rowCount = 7
    const layerCount = 3
    for (let layer = 0; layer < layerCount; layer += 1) {
      const r = 0.8 + layer * 0.09
      for (let row = 0; row < rowCount; row += 1) {
        const x =
          -drumHalfW + (row / (rowCount - 1)) * drumHalfW * 2 + (layer % 2 === 0 ? 0 : 0.035)
        const wind = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 6, 36), cable)
        wind.rotation.y = Math.PI / 2
        wind.position.x = x
        spool.add(wind)
      }
    }
    for (const phase of [0, Math.PI]) {
      spool.add(this.createCableHelix(packR + 0.035, drumHalfW, 2.4, phase, cable))
    }

    // 左侧橙色摇把 / 制动杠杆（参考图特征）
    const crank = new THREE.Group()
    crank.position.set(-1.2, 0, 0)
    spool.add(crank)
    const crankHub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.2, 12), orange)
    crankHub.rotation.z = Math.PI / 2
    crank.add(crankHub)
    const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.1), orangeDark)
    crankArm.position.set(-0.15, -0.55, 0.35)
    crankArm.rotation.x = 0.6
    crankArm.castShadow = true
    crank.add(crankArm)
    const crankGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.35, 8), dark)
    crankGrip.position.set(-0.15, -1.0, 0.7)
    crank.add(crankGrip)

    // ========== 出缆：盘底 → 前方 → 穿入牵引机尾部导辊 ==========
    // 卷盘底部出缆点（stand 本地 → root）
    const cableExitY = axleY - packR
    const outlet = new THREE.Group()
    outlet.name = 'anchor_spool_outlet'
    outlet.position.set(0, 0.55, 1.35)
    stand.add(outlet)

    // 底部导辊座（卷盘架前端）
    const outletBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.45), dark)
    outletBase.castShadow = true
    outlet.add(outletBase)
    for (const sx of [-0.22, 0.22]) {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.45, 0.35), metal)
      cheek.position.set(sx, 0.28, 0)
      outlet.add(cheek)
    }
    const bottomRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 12), chrome)
    bottomRoller.rotation.z = Math.PI / 2
    bottomRoller.position.set(0, 0.32, 0.05)
    outlet.add(bottomRoller)

    // 牵引机尾部进缆口 / 绞盘导辊
    const tractorInlet = new THREE.Group()
    tractorInlet.name = 'anchor_tractor_inlet'
    tractorInlet.position.set(0, 0.55, -0.85)
    tractor.add(tractorInlet)

    const inletHousing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.4), dark)
    inletHousing.castShadow = true
    tractorInlet.add(inletHousing)
    for (const sx of [-0.22, 0.22]) {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.3), metal)
      cheek.position.set(sx, 0.1, -0.05)
      tractorInlet.add(cheek)
    }
    const inletRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.38, 12), chrome)
    inletRoller.rotation.z = Math.PI / 2
    inletRoller.position.set(0, 0.12, -0.08)
    tractorInlet.add(inletRoller)

    // 活动缆线路径：固定导向点与牵引机锚点混合，运行时只更新线段变换。
    const createRootAnchor = (name: string, x: number, y: number, anchorZ: number): THREE.Group => {
      const anchor = new THREE.Group()
      anchor.name = name
      anchor.position.set(x, y, anchorZ)
      root.add(anchor)
      return anchor
    }
    const spoolExit = createRootAnchor('anchor_spool_exit', 0, cableExitY, -0.4)
    const hingeGuide = createRootAnchor('anchor_cable_hinge', 0, 0.62, 2.15)
    const rearCable = createDynamicCable(
      'dynamic_cable_rear',
      [spoolExit, outlet, hingeGuide, tractorInlet],
      0.09,
      cable,
    )
    root.add(rearCable)

    // 牵引机前方继续放出一小段缆；起点随牵引机前探，地面导向点保持固定。
    const tractorFront = new THREE.Group()
    tractorFront.name = 'anchor_tractor_front'
    tractorFront.position.set(0, 0.5, 0.75)
    tractor.add(tractorFront)
    const groundGuideNear = createRootAnchor('anchor_ground_guide_near', 0.15, 0.2, 5.0)
    const groundGuideMid = createRootAnchor('anchor_ground_guide_mid', 0.4, 0.16, 6.3)
    const groundGuideFar = createRootAnchor('anchor_ground_guide_far', 0.2, 0.14, 7.6)
    const frontCable = createDynamicCable(
      'dynamic_cable_front',
      [tractorFront, groundGuideNear, groundGuideMid, groundGuideFar],
      0.085,
      cable,
    )
    root.add(frontCable)
    updateDynamicCable(rearCable)
    updateDynamicCable(frontCable)

    for (const [gx, gz] of [
      [0.4, 6.3],
      [0.2, 7.6],
    ] as Array<[number, number]>) {
      const guide = new THREE.Group()
      guide.position.set(gx, 0, gz)
      root.add(guide)
      const gBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), orange)
      gBase.position.y = 0.06
      guide.add(gBase)
      const gPost = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.35, 0.16), orangeDark)
      gPost.position.y = 0.26
      guide.add(gPost)
      for (const sx of [-0.15, 0.15]) {
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.22), metal)
        cheek.position.set(sx, 0.48, 0)
        guide.add(cheek)
      }
      const gRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.28, 10), chrome)
      gRoller.rotation.z = Math.PI / 2
      gRoller.position.set(0, 0.48, 0)
      guide.add(gRoller)
    }

    tagSelectable(root, {
      objectId: 'cable_spool_01',
      objectType: SceneObjectType.CableSpool,
      label: '电缆牵引机 CS-01',
      businessKey: 'machine:spool-01',
    })
    tagAnimatable(root, 'cable_spool_01', {
      spool: 'joint_spool',
      tractor: 'joint_tractor',
    })
    return root
  }

  private createCableHelix(
    radius: number,
    halfWidth: number,
    turns: number,
    phase: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const points: THREE.Vector3[] = []
    const segments = 40
    for (let index = 0; index <= segments; index += 1) {
      const t = index / segments
      const angle = phase + t * Math.PI * 2 * turns
      points.push(
        new THREE.Vector3(
          THREE.MathUtils.lerp(-halfWidth, halfWidth, t),
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
        ),
      )
    }
    const curve = new THREE.CatmullRomCurve3(points)
    const helix = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, 0.045, 6, false), material)
    helix.name = 'CablePackHelix'
    return helix
  }
}
