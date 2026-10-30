import * as THREE from 'three'
import { VEHICLE_SCALE } from '@/constants/scale'
import { SceneObjectType } from '@/enums/SceneObjectType'
import type { MaterialFactory } from '@/scene/MaterialFactory'
import { tagAnimatable } from '@/scene/utils/animatableMeta'
import { tagSelectable } from '@/scene/utils/objectMeta'
import { addWheels } from '@/scene/builders/vehicles/shared/addWheels'
import { createHydraulic } from '@/scene/builders/vehicles/shared/createHydraulic'
import {
  createDynamicCable,
  updateDynamicCable,
} from '@/scene/builders/vehicles/shared/dynamicCable'

/**
 * 汽车吊（对照参考图）：
 * 白色四轴底盘 + H 型支腿 + 橙色回转台/操作室/配重 + 橙黑伸缩臂上扬 + 吊钩
 */
export class CraneTruckBuilder {
  public constructor(private readonly materials: MaterialFactory) {}

  public build(x: number, z: number, rotY: number): THREE.Group {
    const root = new THREE.Group()
    root.name = 'crane_truck_01'
    root.position.set(x, 0, z)
    root.rotation.y = rotY

    const white = this.materials.white()
    const orange = this.materials.orange()
    const orangeDark = this.materials.orangeDark()
    const metal = this.materials.metal()
    const dark = this.materials.metalDark()
    const glass = this.materials.glass()
    const black = this.materials.tire()
    const chrome = this.materials.chrome()
    const workLamp = this.materials.workLamp()
    const cableMat = this.materials.cable()

    const crane = VEHICLE_SCALE.crane
    const chassisLen = crane.chassisLength
    const chassisWid = crane.chassisWidth

    // ========== 白色底盘 / 货台 ==========
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(chassisWid, 0.35, chassisLen), dark)
    chassis.position.set(0, 0.72, -0.35)
    chassis.castShadow = true
    root.add(chassis)

    const bed = new THREE.Mesh(new THREE.BoxGeometry(chassisWid - 0.1, 0.22, 7.2), metal)
    bed.position.set(0, 1.12, -1.15)
    bed.castShadow = true
    root.add(bed)
    for (const side of [-1, 1]) {
      const bedRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 7.0), dark)
      bedRail.position.set(side * (chassisWid * 0.5 - 0.08), 1.3, -1.15)
      root.add(bedRail)
    }

    // ========== 白色平头驾驶室 ==========
    const cab = new THREE.Group()
    cab.position.set(0, 0, chassisLen * 0.38)
    root.add(cab)

    const cabBody = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.65, 2.15), white)
    cabBody.position.y = 1.95
    cabBody.castShadow = true
    cab.add(cabBody)

    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.16, 2.0), white)
    cabRoof.position.y = crane.cabRoofY
    cab.add(cabRoof)

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.95, 0.06), glass)
    windshield.position.set(0, 2.15, 1.1)
    cab.add(windshield)
    for (const sx of [-1.18, 1.18]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.85, 1.4), glass)
      side.position.set(sx, 2.1, 0.05)
      cab.add(side)
      const doorSeam = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.3, 0.06), dark)
      doorSeam.position.set(sx * 1.01, 1.82, -0.45)
      cab.add(doorSeam)
      const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04), dark)
      mirrorArm.position.set(sx * 1.08, 2.35, 0.75)
      cab.add(mirrorArm)
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.2), glass)
      mirror.position.set(sx * 1.2, 2.35, 0.75)
      cab.add(mirror)
    }
    const cabStep = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.1, 0.32), metal)
    cabStep.position.set(0, 0.88, -0.1)
    cab.add(cabStep)

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.55, 0.1), dark)
    grille.position.set(0, 1.3, 1.12)
    cab.add(grille)
    for (let r = 0; r < 5; r += 1) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.04), metal)
      slot.position.set(0, 1.12 + r * 0.09, 1.18)
      cab.add(slot)
    }

    for (const hx of [-0.85, 0.85]) {
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.2, 0.1),
        workLamp,
      )
      lamp.position.set(hx, 1.3, 1.15)
      cab.add(lamp)
    }

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.2, 0.32), metal)
    bumper.position.set(0, 0.75, 1.1)
    bumper.castShadow = true
    cab.add(bumper)

    // 油箱 / 储物箱
    const fuelTank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 14), white)
    fuelTank.rotation.z = Math.PI / 2
    fuelTank.position.set(-1.35, 1.15, 1.2)
    fuelTank.castShadow = true
    root.add(fuelTank)
    const toolbox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 1.0), metal)
    toolbox.position.set(1.35, 1.2, 0.3)
    root.add(toolbox)

    // ========== H 型支腿：横梁外伸避开轮轴；立柱在轮距外侧 ==========
    // 轮位 z≈4.0/2.0/-0.2/-2.2/-4.2，支腿落在轮档间隙，避免横梁/千斤顶穿轮
    const outriggers: Array<[number, number]> = [
      [-1, 3.15],
      [1, 3.15],
      [-1, -3.15],
      [1, -3.15],
    ]
    const outriggerJoints: Record<string, string> = {}
    outriggers.forEach(([side, oz], index: number) => {
      const beamInnerX = side * (chassisWid * 0.5 + 0.05)
      const beamOuterX = side * 2.85
      const beamMidX = (beamInnerX + beamOuterX) / 2
      const beamLen = Math.abs(beamOuterX - beamInnerX)
      // 横梁贴货台外缘上方，不穿入底盘盒体
      const beamY = 1.28

      const mount = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.4), dark)
      mount.position.set(beamInnerX, beamY, oz)
      mount.castShadow = true
      root.add(mount)

      const beam = new THREE.Mesh(new THREE.BoxGeometry(beamLen, 0.18, 0.22), metal)
      beam.position.set(beamMidX, beamY, oz)
      beam.castShadow = true
      root.add(beam)

      const jackHousing = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), dark)
      jackHousing.position.set(beamOuterX, beamY - 0.05, oz)
      jackHousing.castShadow = true
      root.add(jackHousing)

      // 可升降组：收起时抬高，落下后垫盘贴地
      const leg = new THREE.Group()
      leg.name = `joint_outrigger_${index}`
      leg.position.set(beamOuterX, 0, oz)
      root.add(leg)

      const jackTop = 0.95
      const jackBottom = 0.14
      const jackH = jackTop - jackBottom
      const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, jackH, 12), chrome)
      jack.position.set(0, (jackTop + jackBottom) / 2, 0)
      jack.castShadow = true
      leg.add(jack)

      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.1, 16), orange)
      pad.position.set(0, 0.05, 0)
      pad.castShadow = true
      leg.add(pad)

      // 初始为收起态，播放时落下
      leg.position.y = 0.48
      outriggerJoints[`outrigger${index}`] = leg.name
    })

    // ========== 回转台总成（贴合货台，不悬空） ==========
    const turret = new THREE.Group()
    turret.name = 'joint_turret'
    turret.position.set(0, 1.22, -0.8)
    root.add(turret)

    const slew = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.32, 28), orange)
    slew.position.y = 0.16
    slew.castShadow = true
    turret.add(slew)
    const slewRing = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.07, 8, 28), chrome)
    slewRing.rotation.x = Math.PI / 2
    slewRing.position.y = 0.38
    turret.add(slewRing)

    // 回转平台
    const platform = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.28, 2.8), orange)
    platform.position.set(0, 0.5, -0.15)
    platform.castShadow = true
    turret.add(platform)

    // 操作室（左侧，带玻璃）
    const opCab = new THREE.Group()
    opCab.position.set(0.85, 0.65, 0.35)
    turret.add(opCab)

    const opBody = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.35, 1.35), orange)
    opBody.position.y = 0.7
    opBody.castShadow = true
    opCab.add(opBody)
    const opRoof = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.1, 1.4), orangeDark)
    opRoof.position.y = 1.42
    opCab.add(opRoof)

    const opWinF = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.05), glass)
    opWinF.position.set(0, 0.85, 0.7)
    opCab.add(opWinF)
    const opWinS = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 1.0), glass)
    opWinS.position.set(0.52, 0.85, 0)
    opCab.add(opWinS)
    const opWinL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.9), glass)
    opWinL.position.set(-0.52, 0.9, 0)
    opCab.add(opWinL)

    // 配重（回转台后部）
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 0.85), orange)
    counter.position.set(0, 1.05, -1.35)
    counter.castShadow = true
    turret.add(counter)
    const counterLip = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.12, 0.2), orangeDark)
    counterLip.position.set(0, 0.55, -1.75)
    turret.add(counterLip)

    // 动臂支座：矮耳板 + 宽间隙，避免臂根盒子穿入夹板
    const boomMountY = 1.28
    const boomMountZ = 0.72
    const boomPivotX = 0
    const boomHalfW = 0.28
    for (const sx of [-0.48, 0.48]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.55), metal)
      plate.position.set(boomPivotX + sx, boomMountY + 0.05, boomMountZ)
      plate.castShadow = true
      turret.add(plate)
    }
    const boomPin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.95, 12), chrome)
    boomPin.rotation.z = Math.PI / 2
    boomPin.position.set(boomPivotX, boomMountY + 0.12, boomMountZ + 0.05)
    turret.add(boomPin)

    // 卷扬筒（吊索来源）：偏到操作室侧后方，避开臂根与举升缸
    const winch = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.62, 14), dark)
    winch.rotation.z = Math.PI / 2
    winch.position.set(0.75, 0.95, -0.55)
    winch.castShadow = true
    turret.add(winch)
    const winchCable = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.48, 14), cableMat)
    winchCable.rotation.z = Math.PI / 2
    winchCable.position.set(0.75, 0.95, -0.55)
    turret.add(winchCable)
    const winchAnchor = new THREE.Object3D()
    winchAnchor.name = 'anchor_crane_winch'
    winchAnchor.position.set(0.75, 1.18, -0.55)
    turret.add(winchAnchor)

    // ========== 伸缩臂：臂根从销轴前方起算，不向 -Z 伸入支座 ==========
    const [baseLen, midLen, tipLen] = crane.boomSections
    const boomAngle = -0.78
    const boomPivot = new THREE.Group()
    boomPivot.name = 'joint_boom'
    boomPivot.position.set(boomPivotX, boomMountY + 0.12, boomMountZ + 0.05)
    boomPivot.rotation.x = boomAngle
    turret.add(boomPivot)

    // 后脸落在销轴前约 0.22 m，抬臂时不扫进耳板/平台
    const baseBoom = new THREE.Mesh(
      new THREE.BoxGeometry(boomHalfW * 2, 0.48, baseLen),
      orange,
    )
    baseBoom.position.set(0, 0.04, baseLen * 0.5 + 0.22)
    baseBoom.castShadow = true
    baseBoom.name = 'BoomSection_0'
    boomPivot.add(baseBoom)
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, baseLen * 0.9), orangeDark)
      rail.position.set(side * (boomHalfW + 0.025), 0.24, baseLen * 0.5 + 0.22)
      boomPivot.add(rail)
    }

    for (let i = 0; i < 12; i += 1) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(boomHalfW * 2 + 0.04, 0.035, 0.07), dark)
      rib.position.set(0, 0.3, 0.85 + i * 0.55)
      boomPivot.add(rib)
    }

    const collar1 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.2), orangeDark)
    collar1.position.set(0, 0.04, baseLen * 0.88 + 0.22)
    boomPivot.add(collar1)

    // 中臂滑移组（沿 +Z 伸出）
    const midSlide = new THREE.Group()
    midSlide.name = 'joint_boom_mid'
    midSlide.position.set(0, 0, 0)
    boomPivot.add(midSlide)

    const boomRootClear = 0.22
    const midCenterZ = boomRootClear + baseLen * 0.82 + midLen * 0.42
    const midBoom = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.4, midLen), dark)
    midBoom.position.set(0, 0.05, midCenterZ)
    midBoom.castShadow = true
    midBoom.name = 'BoomSection_1'
    midSlide.add(midBoom)
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.075, midLen * 0.86), metal)
      rail.position.set(side * 0.235, 0.22, midCenterZ)
      midSlide.add(rail)
    }

    const collar2 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.44, 0.18), dark)
    collar2.position.set(0, 0.05, midCenterZ + midLen * 0.38)
    midSlide.add(collar2)

    // 尖臂滑移组（相对中臂再伸出）
    const tipSlide = new THREE.Group()
    tipSlide.name = 'joint_boom_tip'
    tipSlide.position.set(0, 0, 0)
    midSlide.add(tipSlide)

    const tipCenterZ = midCenterZ + midLen * 0.42 + tipLen * 0.42
    const tipBoom = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, tipLen), black)
    tipBoom.position.set(0, 0.06, tipCenterZ)
    tipBoom.castShadow = true
    tipBoom.name = 'BoomSection_2'
    tipSlide.add(tipBoom)
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, tipLen * 0.84), metal)
      rail.position.set(side * 0.185, 0.19, tipCenterZ)
      tipSlide.add(rail)
    }

    const tipZ = tipCenterZ + tipLen * 0.48
    const tipHead = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.7), orange)
    tipHead.position.set(0, 0.08, tipZ)
    tipHead.castShadow = true
    tipSlide.add(tipHead)
    for (const sx of [-0.15, 0.15]) {
      const sheave = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 14), chrome)
      sheave.rotation.z = Math.PI / 2
      sheave.position.set(sx, 0.12, tipZ + 0.28)
      tipSlide.add(sheave)
    }
    const boomGuideAnchor = new THREE.Object3D()
    boomGuideAnchor.name = 'anchor_crane_boom_guide'
    boomGuideAnchor.position.set(0, 0.34, 1.1)
    boomPivot.add(boomGuideAnchor)
    const tipCableAnchor = new THREE.Object3D()
    tipCableAnchor.name = 'anchor_crane_tip_cable'
    tipCableAnchor.position.set(0, 0.35, tipZ + 0.28)
    tipSlide.add(tipCableAnchor)
    const hoistCable = createDynamicCable(
      'dynamic_crane_hoist_cable',
      [winchAnchor, boomGuideAnchor, tipCableAnchor],
      0.022,
      cableMat,
    )
    turret.add(hoistCable)
    updateDynamicCable(hoistCable)

    // 举升缸：支座前移/外偏，减少穿入回转平台
    const cylBaseY = 0.62
    const cylBaseZ = 0.15
    for (const sx of [-0.45, 0.45]) {
      const cylFoot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.26), dark)
      cylFoot.position.set(boomPivotX + sx, cylBaseY, cylBaseZ)
      turret.add(cylFoot)
    }
    const boomAttachLocal = new THREE.Vector3(0, -0.28, 2.35)
    const boomAttachTurret = boomAttachLocal.clone().applyEuler(new THREE.Euler(boomAngle, 0, 0))
    boomAttachTurret.add(boomPivot.position)
    ;[-0.45, 0.45].forEach((sx: number, index: number) => {
      const side = index === 0 ? 'L' : 'R'
      const fromAnchor = new THREE.Object3D()
      fromAnchor.name = `anchor_crane_boom_from_${side}`
      fromAnchor.position.set(boomPivotX + sx, cylBaseY + 0.12, cylBaseZ)
      turret.add(fromAnchor)
      const toAnchor = new THREE.Object3D()
      toAnchor.name = `anchor_crane_boom_to_${side}`
      toAnchor.position.copy(boomAttachLocal)
      toAnchor.position.x = sx * 0.04
      boomPivot.add(toAnchor)
      turret.add(
        createHydraulic(
          [boomPivotX + sx, cylBaseY + 0.12, cylBaseZ],
          [boomPivotX + sx, boomAttachTurret.y, boomAttachTurret.z],
          orange,
          chrome,
          { name: `hyd_crane_boom_${side}` },
        ),
      )
    })

    // 吊钩组挂在尖臂滑移组末端
    const hookLen = 4.5
    const hookGroup = new THREE.Group()
    hookGroup.name = 'joint_hook'
    hookGroup.position.set(0, 0.05, tipZ + 0.3)
    hookGroup.rotation.x = -boomAngle
    tipSlide.add(hookGroup)

    for (const ox of [-0.07, 0.07]) {
      const line = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, hookLen, 6), cableMat)
      line.position.set(ox, -hookLen / 2, 0)
      hookGroup.add(line)
    }

    const hookBlock = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.32), orange)
    hookBlock.position.set(0, -hookLen - 0.15, 0)
    hookBlock.castShadow = true
    hookGroup.add(hookBlock)
    const hookSheave = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.28, 12), chrome)
    hookSheave.rotation.z = Math.PI / 2
    hookSheave.position.set(0, -hookLen + 0.05, 0)
    hookGroup.add(hookSheave)

    // 吊钩：沿 J 形曲线扫掠的单钩（侧视像吊钩，不是对称夹爪）
    const hookAsm = new THREE.Group()
    hookAsm.position.set(0, -hookLen - 0.38, 0)
    hookGroup.add(hookAsm)

    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.028, 6, 12), chrome)
    eye.position.y = 0.14
    hookAsm.add(eye)

    const hookCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(0, -0.18, 0),
      new THREE.Vector3(0.02, -0.38, 0),
      new THREE.Vector3(0.16, -0.48, 0),
      new THREE.Vector3(0.32, -0.38, 0),
      new THREE.Vector3(0.34, -0.18, 0),
      new THREE.Vector3(0.28, -0.08, 0),
    ])
    const hookBody = new THREE.Mesh(
      new THREE.TubeGeometry(hookCurve, 24, 0.045, 8, false),
      dark,
    )
    hookBody.castShadow = true
    hookAsm.add(hookBody)

    const tipBall = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), chrome)
    tipBall.position.set(0.28, -0.08, 0)
    hookAsm.add(tipBall)

    // 四轴车轮（加长底盘后重新分布）
    const wheelCenterY = 0.48
    addWheels(this.materials, root, [
      [-1.25, wheelCenterY, 4.0],
      [1.25, wheelCenterY, 4.0],
      [-1.25, wheelCenterY, 2.0],
      [1.25, wheelCenterY, 2.0],
      [-1.25, wheelCenterY, -0.2],
      [1.25, wheelCenterY, -0.2],
      [-1.25, wheelCenterY, -2.2],
      [1.25, wheelCenterY, -2.2],
      [-1.25, wheelCenterY, -4.2],
      [1.25, wheelCenterY, -4.2],
    ])

    tagSelectable(root, {
      objectId: 'crane_truck_01',
      objectType: SceneObjectType.CraneTruck,
      label: '汽车吊 CT-01',
      businessKey: 'machine:crane-01',
    })
    tagAnimatable(root, 'crane_truck_01', {
      turret: 'joint_turret',
      boom: 'joint_boom',
      boomMid: 'joint_boom_mid',
      boomTip: 'joint_boom_tip',
      hook: 'joint_hook',
      ...outriggerJoints,
    })
    return root
  }
}
