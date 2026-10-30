import * as THREE from 'three'
import { VEHICLE_SCALE } from '@/constants/scale'
import { SceneObjectType } from '@/enums/SceneObjectType'
import type { MaterialFactory } from '@/scene/MaterialFactory'
import { tagAnimatable } from '@/scene/utils/animatableMeta'
import { tagSelectable } from '@/scene/utils/objectMeta'
import { createHydraulic } from '@/scene/builders/vehicles/shared/createHydraulic'
import { markTrackShoe, markTrackSprocket } from '@/scene/builders/vehicles/shared/trackAnim'

/**
 * 履带搅拌车（对照参考图布局）：
 * 前部矮驾驶室 → 中间减速座间隙 → 后倾滚筒 + 高位进料斗 + 长出料槽
 */
export class MixerBuilder {
  public constructor(private readonly materials: MaterialFactory) {}

  public build(x: number, z: number, rotY: number): THREE.Group {
    const root = new THREE.Group()
    root.name = 'mixer_01'
    root.position.set(x, 0, z)
    root.rotation.y = rotY

    const orange = this.materials.orange()
    const orangeDark = this.materials.orangeDark()
    const white = this.materials.white()
    const metal = this.materials.metal()
    const dark = this.materials.metalDark()
    const black = this.materials.tire()
    const glass = this.materials.glass()
    const chrome = this.materials.chrome()
    const workLamp = this.materials.workLamp()
    const chassisGrey = this.materials.get('mixerChassis', 0xd0d6de, {
      roughness: 0.7,
      metalness: 0.18,
    })
    const drumWhite = this.materials.get('mixerDrumWhite', 0xf3f5f4, {
      roughness: 0.68,
      metalness: 0.08,
    })

    const mx = VEHICLE_SCALE.mixer
    const trackLen = mx.trackLength
    const trackSpread = mx.trackSpread
    const halfTrack = trackLen * 0.5
    const drumR = mx.drumRadius

    // ========== 履带（可滚动履带板 + 可转链轮） ==========
    const trackJoints: Record<string, string> = {}
    ;([-trackSpread, trackSpread] as const).forEach((sx: number, trackIndex: number) => {
      const side = trackIndex === 0 ? 'L' : 'R'
      const track = new THREE.Group()
      track.name = `joint_track_${side}`
      track.position.x = sx
      root.add(track)
      trackJoints[`track${side}`] = track.name

      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, trackLen), dark)
      frame.position.y = 0.48
      frame.castShadow = true
      track.add(frame)

      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.48, trackLen * 0.8), orangeDark)
      guard.position.set(sx > 0 ? 0.3 : -0.3, 0.52, 0)
      track.add(guard)

      for (const [sz, r] of [
        [-halfTrack + 0.4, 0.36],
        [halfTrack - 0.4, 0.36],
      ] as Array<[number, number]>) {
        const spin = new THREE.Group()
        spin.position.set(0, 0.4, sz)
        markTrackSprocket(spin)
        track.add(spin)
        const sprocket = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.5, 16), metal)
        sprocket.rotation.z = Math.PI / 2
        sprocket.castShadow = true
        spin.add(sprocket)
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r * 0.4, 0.54, 10), chrome)
        hub.rotation.z = Math.PI / 2
        spin.add(hub)
      }

      for (let i = 0; i < 8; i += 1) {
        const rollerSpin = new THREE.Group()
        rollerSpin.position.set(0, 0.22, -halfTrack + 0.9 + i * ((trackLen - 1.8) / 7))
        markTrackSprocket(rollerSpin)
        track.add(rollerSpin)
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.48, 12), metal)
        roller.rotation.z = Math.PI / 2
        rollerSpin.add(roller)
      }

      const shoeZMin = -halfTrack + 0.2
      const shoeZMax = halfTrack - 0.2
      const shoeCount = 28
      for (let i = 0; i < shoeCount; i += 1) {
        const sz = shoeZMin + i * ((shoeZMax - shoeZMin) / (shoeCount - 1))
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.18), black)
        shoe.position.set(0, 0.07, sz)
        shoe.castShadow = true
        markTrackShoe(shoe, { lane: 'bottom', zMin: shoeZMin, zMax: shoeZMax })
        track.add(shoe)
      }
      const topZMin = -halfTrack + 0.55
      const topZMax = halfTrack - 0.55
      for (let i = 0; i < 24; i += 1) {
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.16), black)
        shoe.position.set(0, 0.86, topZMin + i * ((topZMax - topZMin) / 23))
        markTrackShoe(shoe, { lane: 'top', zMin: topZMin, zMax: topZMax })
        track.add(shoe)
      }
      const endZ = halfTrack - 0.4
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i / 4) * Math.PI
        const shoeF = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 0.16), black)
        shoeF.position.set(0, 0.4 + Math.cos(a) * 0.36, endZ + Math.sin(a) * 0.36)
        shoeF.rotation.x = -a
        track.add(shoeF)
        const shoeR = shoeF.clone()
        shoeR.position.set(0, 0.4 + Math.cos(a) * 0.36, -endZ - Math.sin(a) * 0.36)
        shoeR.rotation.x = a
        track.add(shoeR)
      }
    })

    // ========== 底盘：前后分区明显 ==========
    const platform = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.26, trackLen + 0.1), chassisGrey)
    platform.position.set(0, 0.98, 0)
    platform.castShadow = true
    root.add(platform)

    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.22, 5.0), metal)
    bed.position.set(0, 1.2, -0.7)
    bed.castShadow = true
    root.add(bed)

    for (const sx of [-1.4, 1.4]) {
      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, trackLen - 0.4), dark)
      sill.position.set(sx, 1.05, 0)
      root.add(sill)
    }

    for (let i = 0; i < 3; i += 1) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.24), metal)
      step.position.set(1.55, 0.32 + i * 0.26, halfTrack - 0.55)
      root.add(step)
    }

    // ========== 分区：驾驶室(前) | 空隙 | 减速座 | 滚筒(后) ==========
    const cabin = new THREE.Group()
    cabin.position.set(0, 1.12, halfTrack - 1.15)
    root.add(cabin)

    const cabinBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.05), orange)
    cabinBody.position.y = 0.32
    cabinBody.castShadow = true
    cabin.add(cabinBody)

    for (const [cx, cz] of [
      [-0.65, -0.42],
      [0.65, -0.42],
      [-0.65, 0.42],
      [0.65, 0.42],
    ] as Array<[number, number]>) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), orange)
      pillar.position.set(cx, 0.95, cz)
      cabin.add(pillar)
    }

    const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.12, 1.1), orangeDark)
    cabinRoof.position.y = 1.42
    cabinRoof.castShadow = true
    cabin.add(cabinRoof)

    const winF = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.05), glass)
    winF.position.set(0, 0.95, 0.5)
    cabin.add(winF)
    for (const sx of [-0.72, 0.72]) {
      const winS = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.65, 0.75), glass)
      winS.position.set(sx, 0.95, 0)
      cabin.add(winS)
    }
    const winR = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 0.05), glass)
    winR.position.set(0, 1.0, -0.5)
    cabin.add(winR)

    const doorLine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, 0.7), orangeDark)
    doorLine.position.set(0.74, 0.85, 0.05)
    cabin.add(doorLine)

    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.12), dark)
    mirror.position.set(0.85, 1.1, 0.35)
    cabin.add(mirror)

    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.14, 0.08),
      workLamp,
    )
    lamp.position.set(0, 0.38, 0.58)
    cabin.add(lamp)
    const cabinGuard = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.16, 0.14), chassisGrey)
    cabinGuard.position.set(0, 0.22, 0.6)
    cabin.add(cabinGuard)
    for (const sx of [-0.92, 0.92]) {
      const cabinToolbox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.65), metal)
      cabinToolbox.position.set(sx, 0.32, -0.12)
      cabin.add(cabinToolbox)
    }

    // 减速座：矮平台 + 后侧减速箱（不挡滚筒前锥）
    const pedestal = new THREE.Group()
    pedestal.position.set(0, 1.15, halfTrack - 2.35)
    root.add(pedestal)

    const pedestalBase = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 0.7), chassisGrey)
    pedestalBase.position.y = 0.18
    pedestalBase.castShadow = true
    pedestal.add(pedestalBase)

    const pedestalHouse = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.75, 0.55), metal)
    pedestalHouse.position.set(0, 0.7, 0.05)
    pedestalHouse.castShadow = true
    pedestal.add(pedestalHouse)

    const reducer = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.45, 16), dark)
    reducer.rotation.x = Math.PI / 2
    reducer.position.set(0, 0.85, -0.4)
    pedestal.add(reducer)

    // ========== 滚筒托架（前辊轮托住筒腹，后 A 架加粗落地） ==========
    const frontCradle = new THREE.Group()
    frontCradle.position.set(0, 1.2, -0.35)
    root.add(frontCradle)

    const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.2, 0.4), metal)
    frontBeam.position.y = 0.2
    frontCradle.add(frontBeam)
    for (const sx of [-0.75, 0.75]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), dark)
      leg.position.set(sx, 0.12, 0)
      frontCradle.add(leg)
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.36, 12), chrome)
      roller.rotation.z = Math.PI / 2
      roller.position.set(sx * 0.55, 0.85, 0)
      frontCradle.add(roller)
    }

    const rearFrame = new THREE.Group()
    // 略后移，承接进料斗与滚筒尾口
    rearFrame.position.set(0, 1.15, -halfTrack + 0.85)
    root.add(rearFrame)

    const rearBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 0.7), dark)
    rearBase.position.y = 0.15
    rearBase.castShadow = true
    rearFrame.add(rearBase)

    for (const sx of [-0.95, 0.95]) {
      const aLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.0, 0.2), metal)
      aLeg.position.set(sx, 1.15, 0)
      aLeg.rotation.z = sx > 0 ? -0.28 : 0.28
      aLeg.castShadow = true
      rearFrame.add(aLeg)
    }
    const aCross = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 0.16), metal)
    aCross.position.set(0, 1.85, 0)
    rearFrame.add(aCross)
    const aCrossLow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), metal)
    aCrossLow.position.set(0, 0.85, 0)
    rearFrame.add(aCrossLow)
    const rearRoller = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 14), chrome)
    rearRoller.rotation.z = Math.PI / 2
    rearRoller.position.set(0, 2.05, 0.12)
    rearFrame.add(rearRoller)
    for (const sx of [-0.82, 0.82]) {
      const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.08), dark)
      gusset.position.set(sx, 1.58, 0.02)
      gusset.rotation.z = sx > 0 ? -0.28 : 0.28
      rearFrame.add(gusset)
    }

    // 侧置电机 + 驱动小齿轮（咬合齿圈）
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.5, 0.6), dark)
    motor.position.set(-1.2, 1.55, -0.9)
    motor.castShadow = true
    root.add(motor)
    const pinionGroup = new THREE.Group()
    pinionGroup.name = 'joint_mixer_pinion'
    pinionGroup.position.set(-0.9, 2.2, -1.2)
    root.add(pinionGroup)
    const pinion = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 14), metal)
    pinion.rotation.z = Math.PI / 2
    pinionGroup.add(pinion)

    // ========== 滚筒：加长加大，对齐 6 m³ / Ø2.4 m ==========
    const drumTilt = 0.26
    const drumGroupPos = new THREE.Vector3(0, 2.85, -1.35)
    const drumGroup = new THREE.Group()
    drumGroup.name = 'joint_drum'
    drumGroup.position.copy(drumGroupPos)
    drumGroup.rotation.x = drumTilt
    root.add(drumGroup)

    const drumNose = new THREE.Mesh(
      new THREE.CylinderGeometry(drumR * 0.55, drumR * 0.88, 0.85, 24),
      drumWhite,
    )
    drumNose.rotation.x = Math.PI / 2
    drumNose.position.z = 1.55
    drumNose.castShadow = true
    drumGroup.add(drumNose)

    const drumMain = new THREE.Mesh(
      new THREE.CylinderGeometry(drumR * 0.88, drumR, 2.4, 28),
      drumWhite,
    )
    drumMain.rotation.x = Math.PI / 2
    drumMain.position.z = -0.05
    drumMain.castShadow = true
    drumGroup.add(drumMain)

    // 尾锥：窄口朝后；半长用于计算进料斗挂点，避免穿入实心桶体
    const drumTailLen = 1.2
    const drumTail = new THREE.Mesh(
      new THREE.CylinderGeometry(drumR, drumR * 0.48, drumTailLen, 24),
      drumWhite,
    )
    drumTail.rotation.x = Math.PI / 2
    drumTail.position.z = -1.85
    drumTail.castShadow = true
    drumGroup.add(drumTail)

    const band = new THREE.Mesh(new THREE.CylinderGeometry(drumR + 0.08, drumR + 0.08, 0.65, 28), orange)
    band.rotation.x = Math.PI / 2
    band.position.z = 0
    drumGroup.add(band)

    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.4), metal)
      fin.position.set(Math.cos(a) * (drumR + 0.12), Math.sin(a) * (drumR + 0.12), 0)
      fin.rotation.z = a
      drumGroup.add(fin)
    }

    for (const zz of [0.85, -0.85]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(drumR * 0.92, 0.04, 8, 28), metal)
      ring.position.z = zz
      drumGroup.add(ring)
    }
    for (const phase of [0, Math.PI]) {
      drumGroup.add(this.createDrumHelix(drumR + 0.1, -1.1, 1.15, 1.35, phase, orangeDark))
    }
    const noseLip = new THREE.Mesh(
      new THREE.TorusGeometry(drumR * 0.58, 0.055, 8, 24),
      chrome,
    )
    noseLip.position.z = 1.98
    drumGroup.add(noseLip)
    const noseCap = new THREE.Mesh(
      new THREE.CylinderGeometry(drumR * 0.3, drumR * 0.3, 0.08, 18),
      dark,
    )
    noseCap.rotation.x = Math.PI / 2
    noseCap.position.z = 2.0
    drumGroup.add(noseCap)

    // ========== 后部进料斗：贴在滚筒尾口外侧，随筒倾角，避免穿模 ==========
    // 尾锥窄口在 drumGroup 本地 z（轴心 - 半长），再沿轴向外留缝
    const mouthLocalZ = drumTail.position.z - drumTailLen * 0.5 - 0.08
    const mouthWorld = new THREE.Vector3(0, 0, mouthLocalZ)
      .applyEuler(new THREE.Euler(drumTilt, 0, 0))
      .add(drumGroupPos)

    const hopper = new THREE.Group()
    // 斗体中心在口外略上方，使下口对准尾口而不切入桶壁
    hopper.position.set(mouthWorld.x, mouthWorld.y + 0.55, mouthWorld.z - 0.12)
    hopper.rotation.x = drumTilt * 0.85
    root.add(hopper)

    // 下口略小于尾口半径，从上向下收束进筒口
    const mouthR = drumR * 0.48
    const hopperMouth = new THREE.Mesh(
      new THREE.CylinderGeometry(mouthR * 1.15, mouthR * 0.92, 0.45, 16),
      metal,
    )
    hopperMouth.position.y = -0.22
    hopperMouth.castShadow = true
    hopper.add(hopperMouth)

    const hopperBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(mouthR * 1.55, mouthR * 1.15, 0.42, 16, 1, true),
      chassisGrey,
    )
    hopperBowl.position.y = 0.18
    hopper.add(hopperBowl)

    const hopperRim = new THREE.Mesh(
      new THREE.TorusGeometry(mouthR * 1.52, 0.05, 8, 20),
      chrome,
    )
    hopperRim.rotation.x = Math.PI / 2
    hopperRim.position.y = 0.4
    hopper.add(hopperRim)

    const hopperSupport = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 0.55), dark)
    hopperSupport.position.set(0, -0.55, 0.28)
    hopper.add(hopperSupport)

    // ========== 出料槽：主槽 + 铰接折叠副槽（不再悬空） ==========
    const chutePivot = new THREE.Group()
    chutePivot.name = 'joint_chute'
    chutePivot.position.set(0, 1.75, -halfTrack + 0.45)
    chutePivot.rotation.set(0.4, -0.25, 0)
    root.add(chutePivot)

    const chuteHinge = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.55, 10), chrome)
    chuteHinge.rotation.z = Math.PI / 2
    chuteHinge.position.set(0, 0.1, 0)
    chutePivot.add(chuteHinge)

    const chuteMount = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.4), dark)
    chuteMount.position.set(0, 0, 0.1)
    chuteMount.castShadow = true
    chutePivot.add(chuteMount)

    const chuteFloor = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.07, 2.2), orange)
    chuteFloor.position.set(0, -0.05, -1.15)
    chuteFloor.castShadow = true
    chutePivot.add(chuteFloor)
    for (const sx of [-0.26, 0.26]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 2.2), orange)
      wall.position.set(sx, 0.1, -1.15)
      chutePivot.add(wall)
    }

    // 副槽铰接在主槽末端，略下折，与主槽相连
    const subPivot = new THREE.Group()
    subPivot.position.set(0, 0, -2.25)
    subPivot.rotation.x = 0.35
    chutePivot.add(subPivot)

    const subPin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), chrome)
    subPin.rotation.z = Math.PI / 2
    subPivot.add(subPin)

    const subFloor = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 1.0), orange)
    subFloor.position.set(0, -0.04, -0.5)
    subFloor.castShadow = true
    subPivot.add(subFloor)
    for (const sx of [-0.24, 0.24]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 1.0), orange)
      wall.position.set(sx, 0.08, -0.5)
      subPivot.add(wall)
    }

    chutePivot.add(createHydraulic([0.2, 0.28, 0.05], [0.15, 0.05, -1.2], metal, chrome))

    // 护栏：仅驾驶室侧面，不穿过滚筒区
    const railZ = halfTrack - 1.35
    for (const rz of [railZ - 0.4, railZ, railZ + 0.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), chrome)
      post.position.set(-1.35, 1.45, rz)
      root.add(post)
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.9), chrome)
    rail.position.set(-1.35, 1.68, railZ)
    root.add(rail)

    // 水箱靠驾驶室侧面，远离滚筒轴线
    const waterTank = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.85, 14), white)
    waterTank.rotation.z = Math.PI / 2
    waterTank.position.set(1.3, 1.5, halfTrack - 1.55)
    waterTank.castShadow = true
    root.add(waterTank)

    tagSelectable(root, {
      objectId: 'mixer_01',
      objectType: SceneObjectType.Mixer,
      label: '履带搅拌车 MX-01',
      businessKey: 'machine:mixer-01',
    })
    tagAnimatable(root, 'mixer_01', {
      drum: 'joint_drum',
      chute: 'joint_chute',
      ...trackJoints,
    })
    return root
  }

  private createDrumHelix(
    radius: number,
    startZ: number,
    endZ: number,
    turns: number,
    phase: number,
    material: THREE.Material,
  ): THREE.Mesh {
    const points: THREE.Vector3[] = []
    const segments = 32
    for (let index = 0; index <= segments; index += 1) {
      const t = index / segments
      const angle = phase + t * Math.PI * 2 * turns
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
          THREE.MathUtils.lerp(startZ, endZ, t),
        ),
      )
    }
    const curve = new THREE.CatmullRomCurve3(points)
    const helix = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, 0.035, 6, false), material)
    helix.name = 'DrumHelixRib'
    return helix
  }
}
