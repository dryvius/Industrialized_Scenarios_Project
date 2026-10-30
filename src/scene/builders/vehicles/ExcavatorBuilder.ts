import * as THREE from 'three'
import { SCENE_COLORS } from '@/constants/colors'
import { VEHICLE_SCALE } from '@/constants/scale'
import { SceneObjectType } from '@/enums/SceneObjectType'
import type { MaterialFactory } from '@/scene/MaterialFactory'
import { tagAnimatable } from '@/scene/utils/animatableMeta'
import { tagSelectable } from '@/scene/utils/objectMeta'
import { createHydraulic } from '@/scene/builders/vehicles/shared/createHydraulic'
import { markTrackShoe, markTrackSprocket } from '@/scene/builders/vehicles/shared/trackAnim'

/**
 * 铲斗壳体相对斗销的俯仰。
 * 斗底保持朝下，斗口在局部 -Z，收回朝向斗杆和机体，不是把整斗翻个面。
 */
const BUCKET_SHELL_PITCH = -1.05

function addAnchor(parent: THREE.Object3D, name: string, x: number, y: number, z: number): THREE.Object3D {
  const anchor = new THREE.Object3D()
  anchor.name = name
  anchor.position.set(x, y, z)
  parent.add(anchor)
  return anchor
}

function addPinBracket(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
): void {
  const lug = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.2), material)
  lug.position.set(x, y, z)
  lug.castShadow = true
  parent.add(lug)
}

/** 在两点之间放一根连杆，长度沿局部 Z */
function addSpanBox(
  parent: THREE.Object3D,
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
  width: number,
  height: number,
  material: THREE.Material,
  castShadow: boolean,
): void {
  const direction = new THREE.Vector3(toX - fromX, toY - fromY, toZ - fromZ)
  const length = Math.max(direction.length(), 0.04)
  direction.multiplyScalar(1 / length)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material)
  mesh.position.set((fromX + toX) * 0.5, (fromY + toY) * 0.5, (fromZ + toZ) * 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction)
  mesh.castShadow = castShadow
  parent.add(mesh)
}

function pitchPoint(y: number, z: number): readonly [number, number] {
  const cosine = Math.cos(BUCKET_SHELL_PITCH)
  const sine = Math.sin(BUCKET_SHELL_PITCH)
  return [y * cosine - z * sine, y * sine + z * cosine]
}

interface TrackMaterials {
  dark: THREE.MeshStandardMaterial
  orangeDark: THREE.MeshStandardMaterial
  black: THREE.MeshStandardMaterial
  metal: THREE.MeshStandardMaterial
  chrome: THREE.MeshStandardMaterial
}

interface TrackShoeGeometries {
  pad: THREE.BoxGeometry
  grouser: THREE.BoxGeometry
  guide: THREE.BoxGeometry
}

function createTrackShoe(geometries: TrackShoeGeometries, materials: TrackMaterials, castShadow: boolean): THREE.Group {
  const shoe = new THREE.Group()
  const pad = new THREE.Mesh(geometries.pad, materials.black)
  pad.castShadow = castShadow
  shoe.add(pad)
  for (const offsetZ of [-0.042, 0.042]) {
    const grouser = new THREE.Mesh(geometries.grouser, materials.dark)
    grouser.position.set(0, -0.052, offsetZ)
    shoe.add(grouser)
  }
  const guide = new THREE.Mesh(geometries.guide, materials.metal)
  guide.position.set(0, 0.055, 0)
  shoe.add(guide)
  return shoe
}

function addSplitDrum(
  parent: THREE.Object3D,
  radius: number,
  width: number,
  gap: number,
  material: THREE.Material,
  castShadow: boolean,
): void {
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 14), material)
  drum.rotation.z = Math.PI / 2
  drum.castShadow = castShadow
  drum.position.x = gap
  parent.add(drum)
  const other = drum.clone()
  other.position.x = -gap
  parent.add(other)
}

function buildExcavatorTracks(
  root: THREE.Group,
  materials: TrackMaterials,
  trackSpread: number,
  trackLen: number,
): Record<string, string> {
  const halfTrack = trackLen * 0.5
  const wheelY = 0.52
  const pitchRadius = 0.42
  const frontZ = halfTrack - 0.5
  const rearZ = -frontZ
  const bottomY = wheelY - pitchRadius
  const topY = wheelY + pitchRadius
  const shoeGeometries: TrackShoeGeometries = {
    pad: new THREE.BoxGeometry(0.92, 0.06, 0.155),
    grouser: new THREE.BoxGeometry(0.8, 0.05, 0.038),
    guide: new THREE.BoxGeometry(0.1, 0.068, 0.09),
  }
  const trackJoints: Record<string, string> = {}

  ;([-trackSpread, trackSpread] as const).forEach((sx: number, trackIndex: number) => {
    const side = trackIndex === 0 ? 'L' : 'R'
    const track = new THREE.Group()
    track.name = `joint_track_${side}`
    track.position.x = sx
    root.add(track)
    trackJoints[`track${side}`] = track.name

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, frontZ * 2 - 0.15), materials.dark)
    frame.position.y = wheelY
    frame.castShadow = true
    track.add(frame)
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, frontZ * 2 - 0.35), materials.dark)
    rail.position.y = 0.3
    track.add(rail)

    const outerX = sx > 0 ? 0.4 : -0.4
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, trackLen * 0.52), materials.orangeDark)
    skirt.position.set(outerX, 0.7, 0)
    skirt.castShadow = true
    track.add(skirt)
    const skirtLip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, trackLen * 0.52), materials.dark)
    skirtLip.position.set(outerX, 0.54, 0)
    track.add(skirtLip)
    for (let boltIndex = 0; boltIndex < 6; boltIndex += 1) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 6), materials.chrome)
      bolt.rotation.z = Math.PI / 2
      bolt.position.set(outerX + (sx > 0 ? 0.04 : -0.04), 0.78, -0.9 + boltIndex * 0.36)
      track.add(bolt)
    }
    for (const endZ of [frontZ * 0.72, -frontZ * 0.72]) {
      const deflector = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.42), materials.orangeDark)
      deflector.position.set(outerX, 0.66, endZ)
      deflector.rotation.x = endZ > 0 ? -0.45 : 0.45
      track.add(deflector)
    }

    addTrackWheel(track, rearZ, wheelY, 'drive', materials)
    addTrackWheel(track, frontZ, wheelY, 'idler', materials)

    const rollerCount = 6
    for (let rollerIndex = 0; rollerIndex < rollerCount; rollerIndex += 1) {
      const rollerZ = rearZ + 0.55 + rollerIndex * ((frontZ - rearZ - 1.1) / (rollerCount - 1))
      addTrackRoller(track, 0.28, rollerZ, 0.15, 0.16, materials)
    }
    for (const carrierZ of [-0.55, 0.55]) {
      addTrackRoller(track, topY - 0.16, carrierZ, 0.12, 0.14, materials)
    }

    const bottomMin = rearZ + 0.08
    const bottomMax = frontZ - 0.08
    const bottomCount = 20
    for (let shoeIndex = 0; shoeIndex < bottomCount; shoeIndex += 1) {
      const shoe = createTrackShoe(shoeGeometries, materials, true)
      shoe.position.set(0, bottomY, bottomMin + (shoeIndex * (bottomMax - bottomMin)) / (bottomCount - 1))
      markTrackShoe(shoe, { lane: 'bottom', zMin: bottomMin, zMax: bottomMax })
      track.add(shoe)
    }
    const topMin = rearZ + 0.02
    const topMax = frontZ - 0.02
    const topCount = 18
    for (let shoeIndex = 0; shoeIndex < topCount; shoeIndex += 1) {
      const shoe = createTrackShoe(shoeGeometries, materials, false)
      shoe.rotation.x = Math.PI
      shoe.position.set(0, topY, topMin + (shoeIndex * (topMax - topMin)) / (topCount - 1))
      markTrackShoe(shoe, { lane: 'top', zMin: topMin, zMax: topMax })
      track.add(shoe)
    }

    const wrapSteps = 7
    for (let step = 0; step <= wrapSteps; step += 1) {
      const angle = (step / wrapSteps) * Math.PI
      const frontShoe = createTrackShoe(shoeGeometries, materials, false)
      frontShoe.position.set(
        0,
        wheelY - Math.cos(angle) * pitchRadius,
        frontZ + Math.sin(angle) * pitchRadius,
      )
      frontShoe.rotation.x = -angle
      track.add(frontShoe)

      const rearShoe = createTrackShoe(shoeGeometries, materials, false)
      rearShoe.position.set(
        0,
        wheelY - Math.cos(angle) * pitchRadius,
        rearZ - Math.sin(angle) * pitchRadius,
      )
      rearShoe.rotation.x = angle
      track.add(rearShoe)
    }
  })

  return trackJoints
}

function addTrackWheel(
  track: THREE.Group,
  z: number,
  y: number,
  mode: 'drive' | 'idler',
  materials: TrackMaterials,
): void {
  const spin = new THREE.Group()
  spin.position.set(0, y, z)
  markTrackSprocket(spin)
  track.add(spin)

  const drumRadius = mode === 'drive' ? 0.3 : 0.34
  addSplitDrum(spin, drumRadius, 0.16, 0.16, materials.metal, true)
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), materials.chrome)
  axle.rotation.z = Math.PI / 2
  spin.add(axle)
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), materials.chrome)
  hub.rotation.z = Math.PI / 2
  hub.position.x = 0.22
  spin.add(hub)

  if (mode === 'idler') {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.07, 16), materials.metal)
    flange.rotation.z = Math.PI / 2
    spin.add(flange)
    return
  }

  const toothCount = 10
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const angle = (toothIndex / toothCount) * Math.PI * 2
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.1), materials.dark)
    const radius = 0.34
    tooth.position.set(0, Math.sin(angle) * radius, Math.cos(angle) * radius)
    tooth.rotation.x = Math.PI / 2 - angle
    spin.add(tooth)
  }
}

function addTrackRoller(
  track: THREE.Group,
  y: number,
  z: number,
  radius: number,
  halfGap: number,
  materials: TrackMaterials,
): void {
  const spin = new THREE.Group()
  spin.position.set(0, y, z)
  markTrackSprocket(spin)
  track.add(spin)
  addSplitDrum(spin, radius, 0.16, halfGap, materials.metal, false)
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.48, 8), materials.chrome)
  axle.rotation.z = Math.PI / 2
  spin.add(axle)
}

/** 截面坐标里斗销所在的点，挤出后会挪到壳体原点 */
const BUCKET_PIN_SHAPE_X = 0.02
const BUCKET_PIN_SHAPE_Y = 0.16

/** 斗背销耳，壳体局部坐标。缸销直接穿在这里，不再往斗外伸一截摇杆。 */
const BUCKET_HORN_Y = -0.04
const BUCKET_HORN_Z = 0.22

interface BucketLinkAnchor {
  readonly y: number
  readonly z: number
}

/** 截面 +X / -Y 对应壳体斗口方向（局部 -Z 且略朝下） */
function shapeToShell(shapeX: number, shapeY: number): readonly [number, number] {
  return [shapeY - BUCKET_PIN_SHAPE_Y, BUCKET_PIN_SHAPE_X - shapeX]
}

function createBucketWallShape(): THREE.Shape {
  const shape = new THREE.Shape()
  shape.moveTo(-0.18, 0.48)
  shape.lineTo(-0.34, 0.18)
  shape.lineTo(-0.28, -0.16)
  shape.quadraticCurveTo(0.04, -1.0, 0.62, -0.76)
  shape.lineTo(0.9, -0.68)
  shape.lineTo(1.2, -0.82)
  shape.lineTo(1.08, -0.64)
  shape.lineTo(0.74, -0.54)
  shape.quadraticCurveTo(0.22, -0.64, -0.02, -0.02)
  shape.lineTo(0.08, 0.34)
  shape.closePath()
  return shape
}

function createBucketCheekShape(): THREE.Shape {
  const shape = new THREE.Shape()
  shape.moveTo(-0.22, 0.54)
  shape.lineTo(-0.4, 0.16)
  shape.lineTo(-0.34, -0.22)
  shape.quadraticCurveTo(0.02, -1.08, 0.66, -0.84)
  shape.lineTo(1.02, -0.76)
  shape.lineTo(1.34, -0.92)
  shape.lineTo(1.1, -0.52)
  shape.lineTo(0.12, 0.42)
  shape.closePath()
  return shape
}

function createBucketShellGeometry(bucketWidth: number): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(createBucketWallShape(), {
    depth: bucketWidth,
    bevelEnabled: false,
    curveSegments: 12,
  })
  geometry.translate(0, 0, -bucketWidth * 0.5)
  return geometry
}

function createBucketCheekGeometry(thickness: number): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(createBucketCheekShape(), {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 12,
  })
  geometry.translate(0, 0, -thickness * 0.5)
  return geometry
}

function alignAxis(
  mesh: THREE.Object3D,
  axis: THREE.Vector3,
  dirY: number,
  dirZ: number,
): void {
  const direction = new THREE.Vector3(0, dirY, dirZ)
  if (direction.lengthSq() < 1e-6) {
    return
  }
  direction.normalize()
  mesh.quaternion.setFromUnitVectors(axis, direction)
}

function buildBucket(
  bucketPivot: THREE.Group,
  bucketWidth: number,
  shellMaterial: THREE.MeshStandardMaterial,
  metal: THREE.MeshStandardMaterial,
  chrome: THREE.MeshStandardMaterial,
  dark: THREE.MeshStandardMaterial,
): BucketLinkAnchor {
  const bucketPin = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, bucketWidth * 0.62, 14), chrome)
  bucketPin.rotation.z = Math.PI / 2
  bucketPin.castShadow = true
  bucketPivot.add(bucketPin)

  const shell = new THREE.Group()
  shell.rotation.x = BUCKET_SHELL_PITCH
  bucketPivot.add(shell)

  const mount = new THREE.Group()
  mount.rotation.y = Math.PI / 2
  mount.position.set(0, -BUCKET_PIN_SHAPE_Y, BUCKET_PIN_SHAPE_X)
  shell.add(mount)

  const body = new THREE.Mesh(createBucketShellGeometry(bucketWidth), shellMaterial)
  body.castShadow = true
  mount.add(body)

  const cheekThickness = 0.07
  const cheekGeometry = createBucketCheekGeometry(cheekThickness)
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(cheekGeometry, shellMaterial)
    cheek.position.z = side * (bucketWidth * 0.5 + 0.012)
    cheek.castShadow = true
    mount.add(cheek)
  }

  const earX = bucketWidth * 0.27
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.58), dark)
    ear.position.set(side * earX, 0.04, 0.02)
    ear.castShadow = true
    shell.add(ear)
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), metal)
    boss.rotation.z = Math.PI / 2
    boss.position.set(side * (earX + 0.06), 0.04, 0.02)
    shell.add(boss)
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(earX * 2 - 0.08, 0.1, 0.42), dark)
  bridge.position.set(0, 0.22, 0.04)
  bridge.castShadow = true
  shell.add(bridge)

  const [lipY, lipZ] = shapeToShell(1.02, -0.74)
  const [tipY, tipZ] = shapeToShell(1.2, -0.82)
  const digY = tipY - lipY
  const digZ = tipZ - lipZ
  const blade = new THREE.Mesh(new THREE.BoxGeometry(bucketWidth * 0.78, 0.07, 0.2), metal)
  alignAxis(blade, new THREE.Vector3(0, 0, 1), digY, digZ)
  blade.position.set(0, lipY, lipZ)
  blade.castShadow = true
  shell.add(blade)

  const toothGeometry = new THREE.CylinderGeometry(0.012, 0.05, 0.34, 4)
  const adapterGeometry = new THREE.BoxGeometry(0.11, 0.08, 0.12)
  const toothSpan = bucketWidth * 0.62
  const toothReach = 0.16
  for (let toothIndex = 0; toothIndex < 5; toothIndex += 1) {
    const toothX = -toothSpan * 0.5 + (toothIndex * toothSpan) / 4
    const adapter = new THREE.Mesh(adapterGeometry, metal)
    alignAxis(adapter, new THREE.Vector3(0, 0, 1), digY, digZ)
    adapter.position.set(toothX, lipY, lipZ)
    shell.add(adapter)
    const tooth = new THREE.Mesh(toothGeometry, chrome)
    alignAxis(tooth, new THREE.Vector3(0, 1, 0), digY, digZ)
    const digLength = Math.hypot(digY, digZ) || 1
    tooth.position.set(toothX, lipY + (digY / digLength) * toothReach, lipZ + (digZ / digLength) * toothReach)
    tooth.castShadow = true
    shell.add(tooth)
  }

  const cutterGeometry = new THREE.CylinderGeometry(0.016, 0.055, 0.4, 4)
  for (const side of [-1, 1]) {
    const cutter = new THREE.Mesh(cutterGeometry, metal)
    alignAxis(cutter, new THREE.Vector3(0, 1, 0), digY, digZ)
    const digLength = Math.hypot(digY, digZ) || 1
    cutter.position.set(
      side * (bucketWidth * 0.48),
      lipY + (digY / digLength) * 0.12,
      lipZ + (digZ / digLength) * 0.12,
    )
    cutter.castShadow = true
    shell.add(cutter)
  }

  const bellyStart: readonly [number, number] = [-0.28, -0.16]
  const bellyControl: readonly [number, number] = [0.04, -1.0]
  const bellyEnd: readonly [number, number] = [0.62, -0.76]
  for (const sample of [0.32, 0.55, 0.78]) {
    const remain = 1 - sample
    const shapeX =
      remain * remain * bellyStart[0] + 2 * remain * sample * bellyControl[0] + sample * sample * bellyEnd[0]
    const shapeY =
      remain * remain * bellyStart[1] + 2 * remain * sample * bellyControl[1] + sample * sample * bellyEnd[1]
    const [wearY, wearZ] = shapeToShell(shapeX, shapeY - 0.045)
    const tangentX =
      2 * remain * (bellyControl[0] - bellyStart[0]) + 2 * sample * (bellyEnd[0] - bellyControl[0])
    const tangentY =
      2 * remain * (bellyControl[1] - bellyStart[1]) + 2 * sample * (bellyEnd[1] - bellyControl[1])
    const wear = new THREE.Mesh(new THREE.BoxGeometry(bucketWidth * 0.66, 0.03, 0.14), metal)
    alignAxis(wear, new THREE.Vector3(0, 0, 1), tangentY, -tangentX)
    wear.position.set(0, wearY, wearZ)
    shell.add(wear)
  }

  for (const ribX of [-0.34, 0, 0.34]) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), dark)
    rib.position.set(ribX, -0.08, 0.3)
    shell.add(rib)
  }

  const hornPin = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.42, 10), chrome)
  hornPin.rotation.z = Math.PI / 2
  hornPin.position.set(0, BUCKET_HORN_Y, BUCKET_HORN_Z)
  hornPin.castShadow = true
  shell.add(hornPin)
  for (const side of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.28, 0.24), dark)
    lug.position.set(side * 0.16, BUCKET_HORN_Y - 0.02, BUCKET_HORN_Z - 0.02)
    lug.castShadow = true
    shell.add(lug)
  }
  const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.12), dark)
  gusset.position.set(0, BUCKET_HORN_Y - 0.12, BUCKET_HORN_Z - 0.08)
  shell.add(gusset)

  const [anchorY, anchorZ] = pitchPoint(BUCKET_HORN_Y, BUCKET_HORN_Z)
  addAnchor(bucketPivot, 'anchor_bucket_to', 0, anchorY, anchorZ)
  return { y: anchorY, z: anchorZ }
}

/**
 * 挖掘机：橙机身 + 黑履带/前伸动臂铲斗
 */
export class ExcavatorBuilder {
  public constructor(private readonly materials: MaterialFactory) {}

  public build(x: number, z: number, rotY: number): THREE.Group {
    const root = new THREE.Group()
    root.name = 'excavator_01'
    root.position.set(x, 0, z)
    root.rotation.y = rotY

    const orange = this.materials.orange()
    const orangeDark = this.materials.orangeDark()
    const dark = this.materials.metalDark()
    const black = this.materials.tire()
    const metal = this.materials.metal()
    const glass = this.materials.glass()
    const chrome = this.materials.chrome()
    const lampMat = this.materials.workLamp()
    const hoseMat = this.materials.hose()
    const bucketShellMat = this.materials.get('bucketShell', SCENE_COLORS.tireBlack, {
      roughness: 0.88,
      metalness: 0.08,
      side: THREE.DoubleSide,
    })

    const ex = VEHICLE_SCALE.excavator
    const trackSpread = ex.trackSpread
    const trackLen = ex.trackLength

    const trackJoints = buildExcavatorTracks(
      root,
      { dark, orangeDark, black, metal, chrome },
      trackSpread,
      trackLen,
    )

    const xBeam = new THREE.Mesh(new THREE.BoxGeometry(trackSpread * 2 + 0.2, 0.32, 0.65), dark)
    xBeam.position.set(0, 0.72, 0)
    xBeam.castShadow = true
    root.add(xBeam)
    const longBeam = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 2.2), dark)
    longBeam.position.set(0, 0.7, 0)
    root.add(longBeam)

    const slewBase = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.22, 28), metal)
    slewBase.position.set(0, 1.0, 0)
    slewBase.castShadow = true
    root.add(slewBase)

    const house = new THREE.Group()
    house.name = 'joint_slew'
    house.position.y = 1.45
    root.add(house)

    const slew = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.15, 0.18, 28), dark)
    slew.position.set(0, 1.18 - house.position.y, 0)
    house.add(slew)
    const slewRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 8, 32), chrome)
    slewRing.rotation.x = Math.PI / 2
    slewRing.position.set(0, 1.28 - house.position.y, 0)
    house.add(slewRing)
    const slewSkirt = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.12, 0.12, 24), orangeDark)
    slewSkirt.position.set(0, 1.38 - house.position.y, 0)
    house.add(slewSkirt)
    for (let boltIndex = 0; boltIndex < 12; boltIndex += 1) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6), chrome)
      const angle = (boltIndex / 12) * Math.PI * 2
      bolt.position.set(Math.cos(angle) * 1.05, 1.3 - house.position.y, Math.sin(angle) * 1.05)
      house.add(bolt)
    }

    const floor = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 3.0), dark)
    floor.position.set(0, 0.12, -0.1)
    floor.castShadow = true
    house.add(floor)

    const engineHood = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.95, 1.7), orange)
    engineHood.position.set(0, 0.7, -0.55)
    engineHood.castShadow = true
    house.add(engineHood)

    const topCover = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.55), orangeDark)
    topCover.position.set(0, 1.22, -0.5)
    house.add(topCover)

    for (const sideX of [-1.18, 1.18]) {
      const sideDoor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 1.5), orangeDark)
      sideDoor.position.set(sideX, 0.7, -0.5)
      house.add(sideDoor)
      for (let seamIndex = 0; seamIndex < 3; seamIndex += 1) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 1.35), dark)
        seam.position.set(sideX, 0.45 + seamIndex * 0.25, -0.5)
        house.add(seam)
      }
    }

    for (let ventIndex = 0; ventIndex < 7; ventIndex += 1) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.04), dark)
      vent.position.set(-0.5, 0.4 + ventIndex * 0.11, -1.42)
      house.add(vent)
    }
    for (let ventIndex = 0; ventIndex < 5; ventIndex += 1) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 0.05), dark)
      vent.position.set(-1.22, 0.7, -0.2 - ventIndex * 0.22)
      house.add(vent)
    }

    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.1, 1.0), orange)
    counter.position.set(0, 0.72, -1.7)
    counter.castShadow = true
    house.add(counter)
    const counterCurve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, 2.3, 18, 1, false, 0, Math.PI),
      orange,
    )
    counterCurve.rotation.z = Math.PI / 2
    counterCurve.rotation.y = Math.PI
    counterCurve.position.set(0, 0.72, -2.18)
    counterCurve.castShadow = true
    house.add(counterCurve)
    const counterLip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.2), dark)
    counterLip.position.set(0, 0.2, -2.2)
    house.add(counterLip)
    for (const liftX of [-0.72, 0.72]) {
      const liftEye = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 6, 10), metal)
      liftEye.position.set(liftX, 1.2, -2.02)
      house.add(liftEye)
    }

    const fuelTank = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 1.1), orangeDark)
    fuelTank.position.set(-1.35, 0.5, 0.35)
    fuelTank.castShadow = true
    house.add(fuelTank)
    const fuelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 10), chrome)
    fuelCap.position.set(-1.35, 0.88, 0.35)
    house.add(fuelCap)

    for (let stepIndex = 0; stepIndex < 3; stepIndex += 1) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.28), metal)
      step.position.set(1.4, 0.15 + stepIndex * 0.28, 0.9)
      step.castShadow = true
      house.add(step)
    }

    const cabin = new THREE.Group()
    cabin.position.set(0.65, 0.95, 0.95)
    house.add(cabin)

    const cabinBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 1.55), orange)
    cabinBase.position.y = -0.1
    cabinBase.castShadow = true
    cabin.add(cabinBase)

    for (const [cornerX, cornerZ] of [
      [-0.62, -0.68],
      [0.62, -0.68],
      [-0.62, 0.68],
      [0.62, 0.68],
    ] as Array<[number, number]>) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.35, 0.1), orange)
      pillar.position.set(cornerX, 0.6, cornerZ)
      pillar.castShadow = true
      cabin.add(pillar)
    }
    const midPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), orange)
    midPillar.position.set(0.62, 0.55, 0)
    cabin.add(midPillar)

    const roofFrame = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.1, 1.55), orange)
    roofFrame.position.y = 1.28
    cabin.add(roofFrame)
    const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.12, 1.62), black)
    cabinRoof.position.y = 1.4
    cabinRoof.castShadow = true
    cabin.add(cabinRoof)

    const winR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, 1.25), glass)
    winR.position.set(0.68, 0.55, 0)
    cabin.add(winR)
    const winF = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 0.05), glass)
    winF.position.set(0, 0.55, 0.74)
    cabin.add(winF)
    const winL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 1.0), glass)
    winL.position.set(-0.68, 0.55, 0.05)
    cabin.add(winL)
    const winRear = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.05), glass)
    winRear.position.set(0, 0.7, -0.74)
    cabin.add(winRear)
    const winTop = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.04, 1.15), glass)
    winTop.position.set(0, 1.25, 0.05)
    cabin.add(winTop)
    const windshieldSill = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.06), orange)
    windshieldSill.position.set(0, 0.02, 0.74)
    cabin.add(windshieldSill)

    const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 0.03), dark)
    wiper.position.set(0.2, 0.45, 0.78)
    wiper.rotation.z = 0.25
    cabin.add(wiper)
    const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.04), dark)
    mirrorArm.position.set(0.9, 0.95, 0.55)
    cabin.add(mirrorArm)
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.16), dark)
    mirror.position.set(1.04, 0.84, 0.55)
    cabin.add(mirror)
    const mirrorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.1), glass)
    mirrorGlass.position.set(1.07, 0.84, 0.55)
    cabin.add(mirrorGlass)
    const grab = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.04), chrome)
    grab.position.set(0.78, 0.35, 0.55)
    cabin.add(grab)

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.45), dark)
    seat.position.set(0, 0.2, -0.15)
    cabin.add(seat)
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.1), dark)
    seatBack.position.set(0, 0.5, -0.35)
    cabin.add(seatBack)

    const walkway = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 1.8), metal)
    walkway.position.set(-0.95, 1.28, 0.1)
    house.add(walkway)
    for (const railZ of [-0.6, 0, 0.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), chrome)
      post.position.set(-1.15, 1.55, railZ + 0.1)
      house.add(post)
    }
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 1.4), chrome)
    railTop.position.set(-1.15, 1.8, 0.1)
    house.add(railTop)

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 10), dark)
    exhaust.position.set(-0.95, 1.55, -0.9)
    house.add(exhaust)
    const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.35, 10), dark)
    muffler.position.set(-0.95, 1.35, -0.9)
    house.add(muffler)

    for (const [lampX, lampZ] of [
      [0.2, 1.55],
      [-0.5, 1.4],
    ] as Array<[number, number]>) {
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.12), lampMat)
      light.position.set(lampX, 1.55, lampZ)
      house.add(light)
    }

    const boomMount = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.8), dark)
    boomMount.position.set(-0.35, 0.5, 1.25)
    boomMount.castShadow = true
    house.add(boomMount)
    for (const side of [-0.42, 0.42]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.85, 0.95), metal)
      plate.position.set(-0.35 + side, 0.55, 1.25)
      house.add(plate)
    }
    const pin1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.0, 12), chrome)
    pin1.rotation.z = Math.PI / 2
    pin1.position.set(-0.35, 0.75, 1.45)
    house.add(pin1)

    const boomPivot = new THREE.Group()
    boomPivot.name = 'joint_boom'
    boomPivot.position.set(-0.35, 0.8, 1.5)
    boomPivot.rotation.x = -0.72
    house.add(boomPivot)

    const boomLower = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 2.5), black)
    boomLower.position.set(0, 0.08, 1.2)
    boomLower.castShadow = true
    boomPivot.add(boomLower)
    for (const flangeY of [0.48, -0.3]) {
      const flange = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 2.4), dark)
      flange.position.set(0, flangeY, 1.2)
      boomPivot.add(flange)
    }
    for (const side of [-1, 1]) {
      const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.32, 1.95), dark)
      sidePlate.position.set(side * 0.28, 0.08, 1.25)
      sidePlate.rotation.x = -0.08
      boomPivot.add(sidePlate)
    }

    const boomKnee = new THREE.Group()
    boomKnee.position.set(0, 0.12, 2.5)
    boomKnee.rotation.x = 0.38
    boomPivot.add(boomKnee)

    const kneePin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.72, 12), chrome)
    kneePin.rotation.z = Math.PI / 2
    boomKnee.add(kneePin)

    const boomUpper = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 2.6), black)
    boomUpper.position.set(0, 0, 1.25)
    boomUpper.castShadow = true
    boomKnee.add(boomUpper)
    for (const flangeY of [0.34, -0.28]) {
      const flange = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.09, 2.5), dark)
      flange.position.set(0, flangeY, 1.25)
      boomKnee.add(flange)
    }
    for (const side of [-1, 1]) {
      const sidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 2.05), dark)
      sidePlate.position.set(side * 0.23, 0.02, 1.28)
      sidePlate.rotation.x = 0.06
      boomKnee.add(sidePlate)
      const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.48, 0.62), dark)
      gusset.position.set(side * 0.28, 0.02, -0.18)
      gusset.rotation.x = -0.22
      boomKnee.add(gusset)
    }

    ;[-0.38, 0.38].forEach((sideX: number, index: number) => {
      const side = index === 0 ? 'L' : 'R'
      const fromX = sideX - 0.35
      addAnchor(house, `anchor_boom_from_${side}`, fromX, -0.55, 0.35)
      addPinBracket(house, fromX, -0.55, 0.35, dark)
      addAnchor(boomPivot, `anchor_boom_to_${side}`, sideX, -0.42, 1.65)
      addPinBracket(boomPivot, sideX, -0.42, 1.65, dark)
      const cylinder = createHydraulic(
        [fromX, -0.55, 0.35],
        [sideX, -0.42, 1.65],
        metal,
        chrome,
        { name: `hyd_boom_${side}`, barrelRadius: 0.125, rodRadius: 0.058 },
      )
      house.add(cylinder)
    })

    for (const hoseX of [-0.18, 0.18]) {
      const hoseCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hoseX, 0.4, 0.38),
        new THREE.Vector3(hoseX, 0.52, 1.25),
        new THREE.Vector3(hoseX, 0.38, 2.25),
      ])
      const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 10, 0.025, 6, false), hoseMat)
      boomPivot.add(hose)
    }

    const stickPivot = new THREE.Group()
    stickPivot.name = 'joint_stick'
    stickPivot.position.set(0, 0, 2.6)
    stickPivot.rotation.x = 1.55
    boomKnee.add(stickPivot)

    const stickPin = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.72, 12), chrome)
    stickPin.rotation.z = Math.PI / 2
    stickPivot.add(stickPin)

    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 2.9), black)
    stick.position.set(0, 0, 1.35)
    stick.castShadow = true
    stickPivot.add(stick)
    const stickRib = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 2.7), dark)
    stickRib.position.set(0, 0.06, 1.35)
    stickPivot.add(stickRib)
    for (const side of [-1, 1]) {
      const stickSidePlate = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.24, 2.35), dark)
      stickSidePlate.position.set(side * 0.19, 0.03, 1.38)
      stickPivot.add(stickSidePlate)
      const stickCheek = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.48), dark)
      stickCheek.position.set(side * 0.24, 0.04, 2.68)
      stickCheek.castShadow = true
      stickPivot.add(stickCheek)
    }
    for (let ribIndex = 0; ribIndex < 5; ribIndex += 1) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.08), metal)
      rib.position.set(0, 0.24, 0.45 + ribIndex * 0.5)
      stickPivot.add(rib)
    }

    addAnchor(boomKnee, 'anchor_stick_from', 0, 0.48, 0.85)
    addPinBracket(boomKnee, 0, 0.48, 0.85, dark)
    addAnchor(stickPivot, 'anchor_stick_to', 0, 0.32, 0.18)
    addPinBracket(stickPivot, 0, 0.32, 0.18, dark)
    boomKnee.add(
      createHydraulic([0, 0.48, 0.85], [0, 0.32, 2.5], metal, chrome, {
        name: 'hyd_stick',
        barrelRadius: 0.11,
        rodRadius: 0.05,
      }),
    )

    for (const hoseX of [-0.12, 0.12]) {
      const hoseCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hoseX, 0.34, 0.25),
        new THREE.Vector3(hoseX, 0.42, 1.35),
        new THREE.Vector3(hoseX, 0.36, 2.45),
      ])
      const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 8, 0.02, 5, false), hoseMat)
      stickPivot.add(hose)
    }

    addAnchor(stickPivot, 'anchor_bucket_from', 0, 0.4, 1.65)
    addPinBracket(stickPivot, 0, 0.4, 1.65, dark)

    const bucketPivotZ = 2.9
    const bucketBaseRotX = 0.55
    const bucketPivot = new THREE.Group()
    bucketPivot.name = 'joint_bucket'
    bucketPivot.position.set(0, 0, bucketPivotZ)
    bucketPivot.rotation.x = bucketBaseRotX
    stickPivot.add(bucketPivot)

    const bucketAnchor = buildBucket(bucketPivot, ex.bucketWidth, bucketShellMat, metal, chrome, dark)
    const bucketCos = Math.cos(bucketBaseRotX)
    const bucketSin = Math.sin(bucketBaseRotX)
    stickPivot.add(
      createHydraulic(
        [0, 0.4, 1.65],
        [
          0,
          bucketAnchor.y * bucketCos - bucketAnchor.z * bucketSin,
          bucketPivotZ + bucketAnchor.y * bucketSin + bucketAnchor.z * bucketCos,
        ],
        metal,
        chrome,
        {
          name: 'hyd_bucket',
          barrelRadius: 0.09,
          rodRadius: 0.042,
        },
      ),
    )

    tagSelectable(root, {
      objectId: 'excavator_01',
      objectType: SceneObjectType.Excavator,
      label: '挖掘机 EX-01',
      businessKey: 'machine:excavator-01',
    })
    tagAnimatable(root, 'excavator_01', {
      slew: 'joint_slew',
      boom: 'joint_boom',
      stick: 'joint_stick',
      bucket: 'joint_bucket',
      ...trackJoints,
    })
    return root
  }
}
