import * as THREE from 'three'
import { SCENE_COLORS } from '@/constants/colors'
import { WORKER_SCALE } from '@/constants/scale'
import { SceneObjectType } from '@/enums/SceneObjectType'
import { WorkerHatRole } from '@/enums/WorkerHatRole'
import type { MaterialFactory } from '@/scene/MaterialFactory'
import { SITE_LAYOUT } from '@/scene/layout'
import { tagAnimatable } from '@/scene/utils/animatableMeta'
import { tagSelectable } from '@/scene/utils/objectMeta'

export type WorkerPose = 'idle' | 'point' | 'carry' | 'towerWork'

/** 工种配件：同帽色下用装备区分，不改关节名 */
type WorkerKit =
  | 'foreman'
  | 'inspector'
  | 'electrician'
  | 'linesman'
  | 'surveyor'
  | 'rigger'
  | 'climber'

interface WorkerSpec {
  id: string
  label: string
  businessKey: string
  x: number
  z: number
  rotationY: number
  hatRole: WorkerHatRole
  kit: WorkerKit
  /** 肤色表下标，避免七人同一张脸 */
  skinIndex: number
  /** 站立身高（头顶，不含安全帽），默认 1.8 m */
  height?: number
  /** 站姿变体：idle 时保留；walk 时部分手臂仍尊重姿态 */
  pose?: WorkerPose
}

interface SkinTone {
  skin: number
  shade: number
  hair: number
}

interface WorkerMaterials {
  pants: THREE.MeshStandardMaterial
  pantsDark: THREE.MeshStandardMaterial
  vest: THREE.MeshStandardMaterial
  vestDark: THREE.MeshStandardMaterial
  shirt: THREE.MeshStandardMaterial
  skin: THREE.MeshStandardMaterial
  shade: THREE.MeshStandardMaterial
  hair: THREE.MeshStandardMaterial
  boot: THREE.MeshStandardMaterial
  stripe: THREE.MeshStandardMaterial
  hat: THREE.MeshStandardMaterial
  glove: THREE.MeshStandardMaterial
  sclera: THREE.MeshStandardMaterial
  pupil: THREE.MeshStandardMaterial
  leather: THREE.MeshStandardMaterial
  knee: THREE.MeshStandardMaterial
  metal: THREE.MeshStandardMaterial
  metalDark: THREE.MeshStandardMaterial
  cable: THREE.MeshStandardMaterial
  harness: THREE.MeshStandardMaterial
  lamp: THREE.MeshStandardMaterial
  safetyGlass: THREE.MeshStandardMaterial
  badge: THREE.MeshStandardMaterial
  signal: THREE.MeshStandardMaterial
}

interface MeshPlacement {
  castShadow?: boolean
  scale?: readonly [number, number, number]
  rotation?: readonly [number, number, number]
}

interface WorkerGeometries {
  pelvis: THREE.BoxGeometry
  belt: THREE.BoxGeometry
  buckle: THREE.BoxGeometry
  hipPocket: THREE.BoxGeometry
  groin: THREE.BoxGeometry
  hipJoint: THREE.SphereGeometry
  thigh: THREE.CapsuleGeometry
  knee: THREE.SphereGeometry
  kneePad: THREE.BoxGeometry
  calf: THREE.CapsuleGeometry
  calfBand: THREE.TorusGeometry
  bootUpper: THREE.BoxGeometry
  bootToe: THREE.BoxGeometry
  bootSole: THREE.BoxGeometry
  bootHeel: THREE.BoxGeometry
  bootLace: THREE.BoxGeometry
  ankle: THREE.CylinderGeometry
  chest: THREE.BoxGeometry
  waist: THREE.BoxGeometry
  vestFront: THREE.BoxGeometry
  vestBack: THREE.BoxGeometry
  stripeFront: THREE.BoxGeometry
  stripeBack: THREE.BoxGeometry
  stripeSide: THREE.BoxGeometry
  shoulderStrap: THREE.BoxGeometry
  collar: THREE.BoxGeometry
  yoke: THREE.BoxGeometry
  vestSide: THREE.BoxGeometry
  shoulder: THREE.SphereGeometry
  upperArm: THREE.CapsuleGeometry
  armBand: THREE.TorusGeometry
  elbow: THREE.SphereGeometry
  forearm: THREE.CapsuleGeometry
  wrist: THREE.CylinderGeometry
  palm: THREE.BoxGeometry
  thumb: THREE.BoxGeometry
  fingers: THREE.BoxGeometry
  index: THREE.BoxGeometry
  pad: THREE.BoxGeometry
  cranium: THREE.SphereGeometry
  jaw: THREE.SphereGeometry
  ear: THREE.SphereGeometry
  eye: THREE.SphereGeometry
  pupil: THREE.SphereGeometry
  brow: THREE.BoxGeometry
  nose: THREE.BoxGeometry
  mouth: THREE.BoxGeometry
  hair: THREE.SphereGeometry
  neck: THREE.CapsuleGeometry
  neckBase: THREE.CylinderGeometry
  helmet: THREE.SphereGeometry
  peak: THREE.BoxGeometry
  ridge: THREE.BoxGeometry
  nape: THREE.BoxGeometry
  hatBand: THREE.TorusGeometry
  chinStrap: THREE.BoxGeometry
  hatBuckle: THREE.BoxGeometry
  badge: THREE.BoxGeometry
  rivet: THREE.SphereGeometry
  glassesBar: THREE.BoxGeometry
  glassesRim: THREE.BoxGeometry
  glassesLens: THREE.BoxGeometry
  glassesTemple: THREE.BoxGeometry
  radio: THREE.BoxGeometry
  antenna: THREE.CylinderGeometry
  grill: THREE.BoxGeometry
  bino: THREE.CylinderGeometry
  binoBridge: THREE.BoxGeometry
  pouch: THREE.BoxGeometry
  toolGrip: THREE.CylinderGeometry
  toolBit: THREE.CylinderGeometry
  coil: THREE.TorusGeometry
  coilTail: THREE.CylinderGeometry
  baton: THREE.CylinderGeometry
  batonTip: THREE.CylinderGeometry
  harnessStrap: THREE.BoxGeometry
  harnessBand: THREE.BoxGeometry
  dRing: THREE.TorusGeometry
  legLoop: THREE.TorusGeometry
  lampHouse: THREE.BoxGeometry
  lampLens: THREE.SphereGeometry
  flashlight: THREE.CylinderGeometry
}

const SKIN_TONES: readonly SkinTone[] = [
  { skin: 0xe4b48c, shade: 0xc4926a, hair: 0x3a2a22 },
  { skin: 0xc68642, shade: 0xa56b32, hair: 0x2a1810 },
  { skin: 0x8d5524, shade: 0x6e3f1c, hair: 0x1a100c },
  { skin: 0xf0c7a4, shade: 0xd0a484, hair: 0x5a4032 },
  { skin: 0xd49a6a, shade: 0xb47d52, hair: 0x2c1810 },
  { skin: 0x6f4e37, shade: 0x543c2a, hair: 0x1a120e },
  { skin: 0xa86b45, shade: 0x855236, hair: 0x24160f },
]

let geometries: WorkerGeometries | null = null

function createWorkerGeometries(): WorkerGeometries {
  return {
    pelvis: new THREE.BoxGeometry(0.52, 0.16, 0.3),
    belt: new THREE.BoxGeometry(0.52, 0.07, 0.3),
    buckle: new THREE.BoxGeometry(0.09, 0.06, 0.035),
    hipPocket: new THREE.BoxGeometry(0.08, 0.075, 0.02),
    groin: new THREE.BoxGeometry(0.056, 0.16, 0.12),
    hipJoint: new THREE.SphereGeometry(0.12, 12, 10),
    thigh: new THREE.CapsuleGeometry(0.09, 0.26, 4, 10),
    knee: new THREE.SphereGeometry(0.098, 12, 10),
    kneePad: new THREE.BoxGeometry(0.11, 0.09, 0.04),
    calf: new THREE.CapsuleGeometry(0.068, 0.3, 4, 10),
    calfBand: new THREE.TorusGeometry(0.052, 0.02, 8, 12),
    bootUpper: new THREE.BoxGeometry(0.16, 0.16, 0.2),
    bootToe: new THREE.BoxGeometry(0.145, 0.06, 0.12),
    bootSole: new THREE.BoxGeometry(0.168, 0.032, 0.34),
    bootHeel: new THREE.BoxGeometry(0.14, 0.042, 0.07),
    bootLace: new THREE.BoxGeometry(0.032, 0.062, 0.01),
    ankle: new THREE.CylinderGeometry(0.078, 0.086, 0.07, 10),
    chest: new THREE.BoxGeometry(0.48, 0.22, 0.26),
    waist: new THREE.BoxGeometry(0.44, 0.28, 0.26),
    vestFront: new THREE.BoxGeometry(0.4, 0.3, 0.05),
    vestBack: new THREE.BoxGeometry(0.44, 0.28, 0.05),
    vestSide: new THREE.BoxGeometry(0.05, 0.28, 0.22),
    stripeFront: new THREE.BoxGeometry(0.34, 0.038, 0.012),
    stripeBack: new THREE.BoxGeometry(0.38, 0.038, 0.012),
    stripeSide: new THREE.BoxGeometry(0.012, 0.038, 0.16),
    shoulderStrap: new THREE.BoxGeometry(0.09, 0.05, 0.32),
    collar: new THREE.BoxGeometry(0.3, 0.07, 0.22),
    yoke: new THREE.BoxGeometry(0.36, 0.12, 0.24),
    shoulder: new THREE.SphereGeometry(0.1, 12, 10),
    upperArm: new THREE.CapsuleGeometry(0.072, 0.28, 4, 10),
    armBand: new THREE.TorusGeometry(0.056, 0.02, 8, 12),
    elbow: new THREE.SphereGeometry(0.09, 12, 10),
    forearm: new THREE.CapsuleGeometry(0.058, 0.22, 4, 10),
    wrist: new THREE.CylinderGeometry(0.058, 0.06, 0.06, 10),
    palm: new THREE.BoxGeometry(0.095, 0.072, 0.09),
    thumb: new THREE.BoxGeometry(0.032, 0.055, 0.036),
    fingers: new THREE.BoxGeometry(0.07, 0.042, 0.042),
    index: new THREE.BoxGeometry(0.026, 0.086, 0.026),
    pad: new THREE.BoxGeometry(0.07, 0.05, 0.026),
    cranium: new THREE.SphereGeometry(0.15, 16, 12),
    jaw: new THREE.SphereGeometry(0.082, 12, 8),
    ear: new THREE.SphereGeometry(0.034, 8, 6),
    eye: new THREE.SphereGeometry(0.023, 8, 6),
    pupil: new THREE.SphereGeometry(0.011, 6, 5),
    brow: new THREE.BoxGeometry(0.145, 0.016, 0.022),
    nose: new THREE.BoxGeometry(0.036, 0.048, 0.042),
    mouth: new THREE.BoxGeometry(0.055, 0.01, 0.016),
    hair: new THREE.SphereGeometry(0.055, 8, 6),
    neck: new THREE.CapsuleGeometry(0.075, 0.12, 4, 10),
    neckBase: new THREE.CylinderGeometry(0.07, 0.14, 0.14, 12),
    helmet: new THREE.SphereGeometry(0.18, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    peak: new THREE.BoxGeometry(0.22, 0.018, 0.11),
    ridge: new THREE.BoxGeometry(0.045, 0.018, 0.16),
    nape: new THREE.BoxGeometry(0.18, 0.05, 0.065),
    hatBand: new THREE.TorusGeometry(0.162, 0.02, 6, 16),
    chinStrap: new THREE.BoxGeometry(0.014, 0.1, 0.014),
    hatBuckle: new THREE.BoxGeometry(0.048, 0.026, 0.018),
    badge: new THREE.BoxGeometry(0.055, 0.04, 0.012),
    rivet: new THREE.SphereGeometry(0.012, 6, 5),
    glassesBar: new THREE.BoxGeometry(0.1, 0.01, 0.01),
    glassesRim: new THREE.BoxGeometry(0.052, 0.022, 0.01),
    glassesLens: new THREE.BoxGeometry(0.042, 0.016, 0.006),
    glassesTemple: new THREE.BoxGeometry(0.012, 0.012, 0.15),
    radio: new THREE.BoxGeometry(0.052, 0.09, 0.024),
    antenna: new THREE.CylinderGeometry(0.0045, 0.0045, 0.075, 6),
    grill: new THREE.BoxGeometry(0.03, 0.02, 0.006),
    bino: new THREE.CylinderGeometry(0.028, 0.028, 0.062, 8),
    binoBridge: new THREE.BoxGeometry(0.086, 0.022, 0.022),
    pouch: new THREE.BoxGeometry(0.1, 0.085, 0.048),
    toolGrip: new THREE.CylinderGeometry(0.011, 0.011, 0.085, 6),
    toolBit: new THREE.CylinderGeometry(0.005, 0.005, 0.045, 6),
    coil: new THREE.TorusGeometry(0.095, 0.024, 6, 14),
    coilTail: new THREE.CylinderGeometry(0.011, 0.011, 0.14, 6),
    baton: new THREE.CylinderGeometry(0.015, 0.015, 0.28, 8),
    batonTip: new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8),
    harnessStrap: new THREE.BoxGeometry(0.038, 0.44, 0.022),
    harnessBand: new THREE.BoxGeometry(0.24, 0.032, 0.022),
    dRing: new THREE.TorusGeometry(0.032, 0.007, 6, 10),
    legLoop: new THREE.TorusGeometry(0.09, 0.012, 8, 14),
    lampHouse: new THREE.BoxGeometry(0.065, 0.038, 0.042),
    lampLens: new THREE.SphereGeometry(0.018, 8, 6),
    flashlight: new THREE.CylinderGeometry(0.016, 0.02, 0.11, 8),
  }
}

function getWorkerGeometries(): WorkerGeometries {
  if (!geometries) {
    throw new Error('工人几何尚未创建')
  }
  return geometries
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: readonly [number, number, number],
  options?: MeshPlacement,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(position[0], position[1], position[2])
  if (options?.rotation) {
    mesh.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2])
  }
  if (options?.scale) {
    mesh.scale.set(options.scale[0], options.scale[1], options.scale[2])
  }
  mesh.castShadow = options?.castShadow === true
  parent.add(mesh)
  return mesh
}

function mirrorX(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  options?: MeshPlacement,
): void {
  addMesh(parent, geometry, material, [x, y, z], options)
  addMesh(parent, geometry, material, [-x, y, z], options)
}

function resolveWorkerHeight(height: number | undefined): number {
  const value = height ?? WORKER_SCALE.defaultHeight
  return THREE.MathUtils.clamp(value, WORKER_SCALE.minHeight, WORKER_SCALE.maxHeight)
}

function skinToneAt(index: number): SkinTone {
  return SKIN_TONES[index] ?? SKIN_TONES[0]
}

function shirtColor(kit: WorkerKit): number {
  switch (kit) {
    case 'foreman':
      return 0x3e5f86
    case 'inspector':
    case 'surveyor':
      return 0x5d86b0
    case 'electrician':
      return 0x3f6f9a
    default:
      return 0x4a7eb0
  }
}

function badgeColor(role: WorkerHatRole): number {
  switch (role) {
    case WorkerHatRole.Foreman:
      return 0xf0c14a
    case WorkerHatRole.Inspector:
      return 0x2f6fbf
    case WorkerHatRole.Operator:
      return 0xf7f8fa
    default:
      return 0xf7f8fa
  }
}

/**
 * 低多边形工人（关节链可驱动）：
 * 红帽=班组长，白帽=巡检，蓝帽=各工种作业人员。
 * 关节偏移是行走 / 爬塔的契约，网格只加在既有关节下。
 * 基准头顶（不含帽）为 1.84 m，对应 WORKER_SCALE.modeledCrownHeight。
 */
export class WorkerBuilder {
  public constructor(private readonly materials: MaterialFactory) {}

  public build(): THREE.Group {
    geometries = createWorkerGeometries()
    const group = new THREE.Group()
    group.name = 'WorkerSystem'

    const w = SITE_LAYOUT.workers
    const specs: WorkerSpec[] = [
      {
        id: w.worker_01.id,
        label: '班组长 W-01',
        businessKey: 'worker:01',
        x: w.worker_01.x,
        z: w.worker_01.z,
        rotationY: w.worker_01.rotationY,
        hatRole: WorkerHatRole.Foreman,
        kit: 'foreman',
        skinIndex: 0,
        height: 1.8,
        pose: 'point',
      },
      {
        id: w.worker_02.id,
        label: '巡检员 W-02',
        businessKey: 'worker:02',
        x: w.worker_02.x,
        z: w.worker_02.z,
        rotationY: w.worker_02.rotationY,
        hatRole: WorkerHatRole.Inspector,
        kit: 'inspector',
        skinIndex: 1,
        height: 1.72,
        pose: 'idle',
      },
      {
        id: w.worker_03.id,
        label: '电工 W-03',
        businessKey: 'worker:03',
        x: w.worker_03.x,
        z: w.worker_03.z,
        rotationY: w.worker_03.rotationY,
        hatRole: WorkerHatRole.Operator,
        kit: 'electrician',
        skinIndex: 2,
        height: 1.78,
        pose: 'idle',
      },
      {
        id: w.worker_04.id,
        label: '放线工 W-04',
        businessKey: 'worker:04',
        x: w.worker_04.x,
        z: w.worker_04.z,
        rotationY: w.worker_04.rotationY,
        hatRole: WorkerHatRole.Operator,
        kit: 'linesman',
        skinIndex: 3,
        height: 1.75,
        pose: 'carry',
      },
      {
        id: w.worker_05.id,
        label: '巡检员 W-05',
        businessKey: 'worker:05',
        x: w.worker_05.x,
        z: w.worker_05.z,
        rotationY: w.worker_05.rotationY,
        hatRole: WorkerHatRole.Inspector,
        kit: 'surveyor',
        skinIndex: 4,
        height: 1.68,
        pose: 'point',
      },
      {
        id: w.worker_06.id,
        label: '起重工 W-06',
        businessKey: 'worker:06',
        x: w.worker_06.x,
        z: w.worker_06.z,
        rotationY: w.worker_06.rotationY,
        hatRole: WorkerHatRole.Operator,
        kit: 'rigger',
        skinIndex: 5,
        height: 1.85,
        pose: 'idle',
      },
      {
        id: w.worker_07.id,
        label: '高空作业 W-07',
        businessKey: 'worker:07',
        x: w.worker_07.x,
        z: w.worker_07.z,
        rotationY: w.worker_07.rotationY,
        hatRole: WorkerHatRole.Operator,
        kit: 'climber',
        skinIndex: 6,
        height: 1.76,
        pose: 'towerWork',
      },
    ]

    specs.forEach((spec: WorkerSpec): void => {
      group.add(this.createWorker(spec))
    })

    return group
  }

  private createWorker(spec: WorkerSpec): THREE.Group {
    const root = new THREE.Group()
    root.name = spec.id
    root.position.set(spec.x, 0, spec.z)
    root.rotation.y = spec.rotationY

    const height = resolveWorkerHeight(spec.height)
    root.scale.setScalar(height / WORKER_SCALE.modeledCrownHeight)
    root.userData.height = height
    root.userData.workerPose = spec.pose ?? 'idle'

    const mats = this.createMaterials(spec)
    const pose = spec.pose ?? 'idle'

    const hips = new THREE.Group()
    hips.name = 'joint_hips'
    hips.position.y = 0.88
    root.add(hips)
    this.addPelvis(hips, mats)

    const thighL = this.addLeg(hips, -1, mats)
    const thighR = this.addLeg(hips, 1, mats)

    const spine = new THREE.Group()
    spine.name = 'joint_spine'
    spine.position.y = 0.12
    hips.add(spine)
    this.addTorso(spine, mats)

    this.addArm(spine, -1, mats, pose)
    const elbowR = this.addArm(spine, 1, mats, pose)

    this.addHead(spine, mats)
    this.addHelmet(spine, mats, spec.kit === 'climber')
    this.addRoleKit(spec.kit, spine, hips, elbowR, thighL, thighR, mats)

    tagSelectable(root, {
      objectId: spec.id,
      objectType: SceneObjectType.Worker,
      label: spec.label,
      businessKey: spec.businessKey,
    })
    tagAnimatable(root, spec.id, {
      hips: 'joint_hips',
      spine: 'joint_spine',
      armL: 'joint_arm_L',
      armR: 'joint_arm_R',
      elbowL: 'joint_elbow_L',
      elbowR: 'joint_elbow_R',
      thighL: 'joint_thigh_L',
      thighR: 'joint_thigh_R',
      calfL: 'joint_calf_L',
      calfR: 'joint_calf_R',
      footL: 'joint_foot_L',
      footR: 'joint_foot_R',
    })

    return root
  }

  private createMaterials(spec: WorkerSpec): WorkerMaterials {
    const tone = skinToneAt(spec.skinIndex)
    const cloth = { roughness: 0.84, metalness: 0.04 }
    return {
      pants: this.materials.get('pants', SCENE_COLORS.workerBlue, cloth),
      pantsDark: this.materials.get('pantsDark', 0x2c5588, cloth),
      vest: this.materials.orange(),
      vestDark: this.materials.orangeDark(),
      shirt: this.materials.get(`shirt_${shirtColor(spec.kit)}`, shirtColor(spec.kit), cloth),
      skin: this.materials.get(`skin_${tone.skin}`, tone.skin, { roughness: 0.72, metalness: 0.02 }),
      shade: this.materials.get(`shade_${tone.shade}`, tone.shade, {
        roughness: 0.78,
        metalness: 0.02,
      }),
      hair: this.materials.get(`hair_${tone.hair}`, tone.hair, { roughness: 0.88, metalness: 0.02 }),
      boot: this.materials.get('boot', 0x2a2e33, { roughness: 0.9, metalness: 0.06 }),
      stripe: this.materials.get('vestStripe', 0xf2f5f8, { roughness: 0.45, metalness: 0.18 }),
      hat: this.materials.get(`hat_${spec.hatRole}`, this.hatColor(spec.hatRole), {
        roughness: 0.58,
        metalness: 0.1,
      }),
      glove: this.materials.get('glove', 0xf0c040, { roughness: 0.78, metalness: 0.04 }),
      sclera: this.materials.get('sclera', 0xf4f1ea, { roughness: 0.4, metalness: 0.02 }),
      pupil: this.materials.get('pupil', 0x1a1c1f, { roughness: 0.32, metalness: 0.05 }),
      leather: this.materials.get('leather', 0x4a3428, { roughness: 0.82, metalness: 0.04 }),
      knee: this.materials.get('kneePad', 0x2c3138, { roughness: 0.7, metalness: 0.12 }),
      metal: this.materials.metal(),
      metalDark: this.materials.metalDark(),
      cable: this.materials.cable(),
      harness: this.materials.get('harness', 0xe0a020, { roughness: 0.68, metalness: 0.06 }),
      lamp: this.materials.get('headlampLens', 0xfff6d0, {
        roughness: 0.22,
        metalness: 0.06,
        emissive: 0xffe7a0,
        emissiveIntensity: 0.55,
      }),
      safetyGlass: this.materials.get('safetyGlass', 0x9eb4c4, {
        roughness: 0.12,
        metalness: 0.1,
        transparent: true,
        opacity: 0.48,
      }),
      badge: this.materials.get(`hatBadge_${spec.hatRole}`, badgeColor(spec.hatRole), {
        roughness: 0.45,
        metalness: 0.2,
      }),
      signal: this.materials.get('signalRed', 0xd24a3a, { roughness: 0.48, metalness: 0.08 }),
    }
  }

  private hatColor(role: WorkerHatRole): number {
    switch (role) {
      case WorkerHatRole.Foreman:
        return SCENE_COLORS.workerHatRed
      case WorkerHatRole.Inspector:
        return SCENE_COLORS.workerHatWhite
      case WorkerHatRole.Operator:
        return SCENE_COLORS.workerHatBlue
      default:
        return SCENE_COLORS.workerHatBlue
    }
  }

  private addPelvis(hips: THREE.Group, mats: WorkerMaterials): void {
    const geo = getWorkerGeometries()
    // 裤身只到髋折。裆部收在两腿中间，避免走跑时大腿从裤管里穿出。
    addMesh(hips, geo.pelvis, mats.pants, [0, 0.02, 0], { castShadow: true })
    addMesh(hips, geo.groin, mats.pants, [0, -0.13, 0.01], { castShadow: true })
    addMesh(hips, geo.belt, mats.leather, [0, 0.1, 0], { castShadow: true })
    addMesh(hips, geo.buckle, mats.glove, [0, 0.1, 0.16])
    mirrorX(hips, geo.hipPocket, mats.pantsDark, 0.16, 0, -0.16)
  }

  private addTorso(spine: THREE.Group, mats: WorkerMaterials): void {
    const geo = getWorkerGeometries()
    addMesh(spine, geo.chest, mats.shirt, [0, 0.4, 0], { castShadow: true })
    addMesh(spine, geo.waist, mats.shirt, [0, 0.15, 0], { castShadow: true })
    addMesh(spine, geo.yoke, mats.shirt, [0, 0.46, 0.02], { castShadow: true })
    mirrorX(spine, geo.shoulder, mats.shirt, 0.26, 0.46, 0, { castShadow: true })
    addMesh(spine, geo.vestFront, mats.vest, [0, 0.34, 0.125], { castShadow: true })
    addMesh(spine, geo.vestBack, mats.vest, [0, 0.34, -0.125], { castShadow: true })
    mirrorX(spine, geo.vestSide, mats.vest, 0.235, 0.34, 0)
    mirrorX(spine, geo.shoulderStrap, mats.vest, 0.14, 0.46, 0, { castShadow: true })
    addMesh(spine, geo.stripeFront, mats.stripe, [0, 0.4, 0.156])
    addMesh(spine, geo.stripeFront, mats.stripe, [0, 0.28, 0.156])
    addMesh(spine, geo.stripeBack, mats.stripe, [0, 0.4, -0.156])
    addMesh(spine, geo.stripeBack, mats.stripe, [0, 0.28, -0.156])
    mirrorX(spine, geo.stripeSide, mats.stripe, 0.266, 0.4, 0)
    mirrorX(spine, geo.stripeSide, mats.stripe, 0.266, 0.28, 0)
    addMesh(spine, geo.collar, mats.vestDark, [0, 0.46, 0.03])
  }

  private addLeg(hips: THREE.Group, side: -1 | 1, mats: WorkerMaterials): THREE.Group {
    const geo = getWorkerGeometries()
    const suffix = side < 0 ? 'L' : 'R'

    const thigh = new THREE.Group()
    thigh.name = `joint_thigh_${suffix}`
    thigh.position.set(side * 0.13, -0.03, 0.01)
    hips.add(thigh)
    addMesh(thigh, geo.hipJoint, mats.pants, [0, 0.02, 0])
    addMesh(thigh, geo.thigh, mats.pants, [0, -0.22, 0], { castShadow: true })
    addMesh(thigh, geo.hipPocket, mats.pantsDark, [side * 0.08, -0.16, 0.06])

    const calf = new THREE.Group()
    calf.name = `joint_calf_${suffix}`
    calf.position.set(0, -0.42, 0.01)
    thigh.add(calf)
    addMesh(calf, geo.knee, mats.pants, [0, 0.02, 0])
    addMesh(calf, geo.kneePad, mats.knee, [0, 0.02, 0.09], { castShadow: true })
    addMesh(calf, geo.calf, mats.pants, [0, -0.16, 0], { castShadow: true })
    addMesh(calf, geo.calfBand, mats.stripe, [0, -0.12, 0], {
      rotation: [Math.PI / 2, 0, 0],
    })

    const foot = new THREE.Group()
    foot.name = `joint_foot_${suffix}`
    foot.position.set(0, -0.38, 0.02)
    calf.add(foot)
    addMesh(foot, geo.ankle, mats.boot, [0, 0.12, 0.02], { castShadow: true })
    addMesh(foot, geo.bootUpper, mats.boot, [0, 0.07, 0.03], { castShadow: true })
    addMesh(foot, geo.bootToe, mats.boot, [0, 0.04, 0.14], { castShadow: true })
    addMesh(foot, geo.bootHeel, mats.metalDark, [0, 0.02, -0.06])
    addMesh(foot, geo.bootSole, mats.metalDark, [0, -0.028, 0.05])
    addMesh(foot, geo.bootLace, mats.leather, [0, 0.1, 0.13])

    return thigh
  }

  private restElbowX(pose: WorkerPose, side: -1 | 1): number {
    if (pose === 'point' && side === 1) {
      return -0.08
    }
    if (pose === 'carry') {
      return -0.78
    }
    if (pose === 'towerWork') {
      return -0.48
    }
    return -0.2
  }

  private addArm(
    spine: THREE.Group,
    side: -1 | 1,
    mats: WorkerMaterials,
    pose: WorkerPose,
  ): THREE.Group {
    const geo = getWorkerGeometries()
    const suffix = side < 0 ? 'L' : 'R'
    const armRoot = new THREE.Group()
    armRoot.name = `joint_arm_${suffix}`
    armRoot.position.set(side * 0.3, 0.48, 0)
    spine.add(armRoot)

    if (pose === 'point' && side === 1) {
      armRoot.rotation.x = -0.85
      armRoot.rotation.z = -0.15
    } else if (pose === 'carry') {
      armRoot.rotation.x = -0.55
      armRoot.rotation.z = side * 0.25
    } else if (pose === 'towerWork') {
      armRoot.rotation.x = -0.35
      armRoot.rotation.z = side * 0.12
    } else {
      armRoot.rotation.x = 0.12
      armRoot.rotation.z = side * 0.08
    }

    armRoot.userData.idleRotation = {
      x: armRoot.rotation.x,
      y: armRoot.rotation.y,
      z: armRoot.rotation.z,
    }
    armRoot.userData.lockSwing =
      (pose === 'point' && side === 1) || pose === 'carry' || pose === 'towerWork'

    addMesh(armRoot, geo.upperArm, mats.shirt, [0, -0.14, 0], { castShadow: true })
    addMesh(armRoot, geo.armBand, mats.stripe, [0, -0.14, 0], {
      rotation: [Math.PI / 2, 0, 0],
    })

    const elbow = new THREE.Group()
    elbow.name = `joint_elbow_${suffix}`
    elbow.position.set(0, -0.3, 0.02)
    armRoot.add(elbow)
    const elbowBend = this.restElbowX(pose, side)
    elbow.rotation.x = elbowBend
    elbow.userData.idleRotation = { x: elbowBend, y: 0, z: 0 }

    addMesh(elbow, geo.elbow, mats.shirt, [0, 0, 0])
    addMesh(elbow, geo.pad, mats.knee, [0, 0, -0.075])
    addMesh(elbow, geo.forearm, mats.shirt, [0, -0.12, 0], { castShadow: true })
    addMesh(elbow, geo.wrist, mats.leather, [0, -0.3, 0])
    addMesh(elbow, geo.palm, mats.glove, [0, -0.35, 0.01], { castShadow: true })
    addMesh(elbow, geo.thumb, mats.glove, [-side * 0.05, -0.33, 0.02])

    if (pose === 'point' && side === 1) {
      addMesh(elbow, geo.index, mats.glove, [0.01, -0.4, 0.02], { castShadow: true })
      addMesh(elbow, geo.fingers, mats.glove, [-0.02, -0.37, -0.01])
    } else {
      addMesh(elbow, geo.fingers, mats.glove, [0, -0.375, 0.015])
    }

    return elbow
  }

  /** 头顶本地 y=0.84，加骨盆与脊柱后等于 modeledCrownHeight */
  private addHead(spine: THREE.Group, mats: WorkerMaterials): void {
    const geo = getWorkerGeometries()
    addMesh(spine, geo.neckBase, mats.skin, [0, 0.44, 0.02], { castShadow: true })
    addMesh(spine, geo.neck, mats.skin, [0, 0.56, 0.02], { castShadow: true })
    addMesh(spine, geo.cranium, mats.skin, [0, 0.69, 0], {
      castShadow: true,
      scale: [1.02, 1, 1.05],
    })
    addMesh(spine, geo.jaw, mats.skin, [0, 0.62, 0.04], {
      scale: [1.08, 0.78, 1],
    })
    mirrorX(spine, geo.ear, mats.shade, 0.155, 0.67, 0, { scale: [0.62, 1, 0.72] })
    mirrorX(spine, geo.hair, mats.hair, 0.12, 0.66, -0.02, { scale: [0.5, 0.85, 0.6] })
    addMesh(spine, geo.hair, mats.hair, [0, 0.65, -0.1], { scale: [1.55, 0.5, 0.55] })
    mirrorX(spine, geo.eye, mats.sclera, 0.05, 0.685, 0.152)
    mirrorX(spine, geo.pupil, mats.pupil, 0.05, 0.685, 0.172)
    addMesh(spine, geo.brow, mats.shade, [0, 0.712, 0.162])
    addMesh(spine, geo.nose, mats.shade, [0, 0.645, 0.158])
    addMesh(spine, geo.mouth, mats.shade, [0, 0.6, 0.118])

    addMesh(spine, geo.glassesBar, mats.metalDark, [0, 0.7, 0.172])
    mirrorX(spine, geo.glassesRim, mats.metalDark, 0.048, 0.684, 0.174)
    mirrorX(spine, geo.glassesLens, mats.safetyGlass, 0.048, 0.684, 0.18)
    mirrorX(spine, geo.glassesTemple, mats.metalDark, 0.09, 0.686, 0.09)
  }

  private addHelmet(spine: THREE.Group, mats: WorkerMaterials, withLamp: boolean): void {
    const geo = getWorkerGeometries()
    addMesh(spine, geo.helmet, mats.hat, [0, 0.74, 0.01], {
      castShadow: true,
      scale: [1.06, 1.15, 1.1],
    })
    addMesh(spine, geo.hatBand, mats.leather, [0, 0.745, 0], {
      rotation: [Math.PI / 2, 0, 0],
    })
    addMesh(spine, geo.peak, mats.hat, [0, 0.755, 0.19], { castShadow: true })
    addMesh(spine, geo.ridge, mats.hat, [0, 0.93, 0])
    addMesh(spine, geo.nape, mats.hat, [0, 0.75, -0.14])
    addMesh(spine, geo.badge, mats.badge, [0, 0.84, 0.2])
    addMesh(spine, geo.chinStrap, mats.leather, [-0.065, 0.62, 0.1], {
      rotation: [0.65, 0, 0.08],
    })
    addMesh(spine, geo.chinStrap, mats.leather, [0.065, 0.62, 0.1], {
      rotation: [0.65, 0, -0.08],
    })
    addMesh(spine, geo.hatBuckle, mats.metal, [0, 0.555, 0.14])

    if (!withLamp) {
      return
    }
    addMesh(spine, geo.lampHouse, mats.metalDark, [0, 0.8, 0.2])
    addMesh(spine, geo.lampLens, mats.lamp, [0, 0.8, 0.222])
  }

  private addRoleKit(
    kit: WorkerKit,
    spine: THREE.Group,
    hips: THREE.Group,
    elbowR: THREE.Group,
    thighL: THREE.Group,
    thighR: THREE.Group,
    mats: WorkerMaterials,
  ): void {
    switch (kit) {
      case 'foreman':
        this.addRadio(spine, mats)
        return
      case 'inspector':
        this.addBinoculars(spine, mats)
        return
      case 'surveyor':
        this.addFlashlight(hips, mats)
        return
      case 'electrician':
        this.addToolPouch(hips, mats)
        return
      case 'linesman':
        this.addCableCoil(elbowR, mats)
        return
      case 'rigger':
        this.addBaton(elbowR, mats)
        return
      case 'climber':
        this.addHarness(spine, hips, thighL, thighR, mats)
        return
      default:
        return
    }
  }

  private addRadio(spine: THREE.Group, mats: WorkerMaterials): void {
    const geo = getWorkerGeometries()
    addMesh(spine, geo.radio, mats.metalDark, [-0.14, 0.32, 0.19], { castShadow: true })
    addMesh(spine, geo.grill, mats.knee, [-0.14, 0.305, 0.206])
    addMesh(spine, geo.antenna, mats.metal, [-0.125, 0.39, 0.19])
  }

  private addBinoculars(spine: THREE.Group, mats: WorkerMaterials): void {
    const geo = getWorkerGeometries()
    const tilt: MeshPlacement = { rotation: [Math.PI / 2, 0, 0], castShadow: true }
    addMesh(spine, geo.bino, mats.metalDark, [-0.036, 0.32, 0.21], tilt)
    addMesh(spine, geo.bino, mats.metalDark, [0.036, 0.32, 0.21], tilt)
    addMesh(spine, geo.binoBridge, mats.metal, [0, 0.32, 0.195])
  }

  private addFlashlight(hips: THREE.Group, mats: WorkerMaterials): void {
    const geo = getWorkerGeometries()
    const rig = new THREE.Group()
    rig.position.set(-0.18, 0.06, 0.12)
    rig.rotation.set(1.15, 0.15, 0.35)
    hips.add(rig)
    addMesh(rig, geo.flashlight, mats.metalDark, [0, 0, 0], { castShadow: true })
    addMesh(rig, geo.lampLens, mats.lamp, [0, 0.06, 0])
  }

  private addToolPouch(hips: THREE.Group, mats: WorkerMaterials): void {
    const geo = getWorkerGeometries()
    addMesh(hips, geo.pouch, mats.leather, [0.16, -0.02, 0.08], { castShadow: true })
    addMesh(hips, geo.toolGrip, mats.glove, [0.14, 0.06, 0.09])
    addMesh(hips, geo.toolBit, mats.metal, [0.14, 0.11, 0.09])
    addMesh(hips, geo.toolGrip, mats.knee, [0.19, 0.05, 0.07])
  }

  private addCableCoil(elbowR: THREE.Group, mats: WorkerMaterials): void {
    const geo = getWorkerGeometries()
    const coil = new THREE.Group()
    coil.position.set(0.05, -0.4, 0.06)
    coil.rotation.set(0.35, Math.PI / 2, 0.2)
    elbowR.add(coil)
    addMesh(coil, geo.coil, mats.cable, [0, 0, 0], { castShadow: true })
    addMesh(coil, geo.coilTail, mats.cable, [0.1, -0.02, 0], { rotation: [0, 0, 0.7] })
  }

  private addBaton(elbowR: THREE.Group, mats: WorkerMaterials): void {
    const geo = getWorkerGeometries()
    addMesh(elbowR, geo.baton, mats.glove, [0, -0.5, 0.02], { castShadow: true })
    addMesh(elbowR, geo.batonTip, mats.signal, [0, -0.66, 0.02], { castShadow: true })
  }

  private addHarness(
    spine: THREE.Group,
    hips: THREE.Group,
    thighL: THREE.Group,
    thighR: THREE.Group,
    mats: WorkerMaterials,
  ): void {
    const geo = getWorkerGeometries()
    mirrorX(spine, geo.harnessStrap, mats.harness, 0.09, 0.28, 0.182, { castShadow: true })
    mirrorX(spine, geo.harnessStrap, mats.harness, 0.09, 0.28, -0.155)
    addMesh(spine, geo.harnessBand, mats.harness, [0, 0.36, 0.185])
    addMesh(spine, geo.dRing, mats.metal, [0, 0.36, 0.21], { castShadow: true })
    addMesh(hips, geo.dRing, mats.metal, [0.22, 0.08, 0.08], {
      rotation: [0, Math.PI / 2, 0],
      castShadow: true,
    })
    const loopTilt: MeshPlacement = { rotation: [Math.PI / 2, 0, 0] }
    addMesh(thighL, geo.legLoop, mats.harness, [0, -0.12, 0], loopTilt)
    addMesh(thighR, geo.legLoop, mats.harness, [0, -0.12, 0], loopTilt)
  }
}
