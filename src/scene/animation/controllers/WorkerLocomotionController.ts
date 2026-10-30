import * as THREE from 'three'
import type { SceneAnimator } from '@/scene/animation/types'
import type { RootPoseDriver } from '@/scene/physics'
import { resolveJoints } from '@/scene/utils/animatableMeta'

export type WorkerGait = 'walk' | 'run'

export interface WorkerLocomotionOptions {
  id: string
  root: THREE.Object3D
  path: Array<{ x: number; z: number }>
  /** 默认步态；play() 无参时使用 */
  defaultGait?: WorkerGait
  /** 步行速度 m/s */
  walkSpeed?: number
  /** 跑步速度 m/s */
  runSpeed?: number
  /** 步行步幅（米）——单步支撑脚相对行程 */
  walkStrideLength?: number
  /** 跑步步幅（米） */
  runStrideLength?: number
  /** 兼容旧字段：等同 walkStrideLength */
  strideLength?: number
  loop?: boolean
  /** 有物理时注入：逻辑位姿 → Kinematic 目标 */
  poseDriver?: RootPoseDriver | null
}

const DEFAULT_WALK_SPEED = 0.95
/** 示意跑步：明显快于快走 */
const DEFAULT_RUN_SPEED = 2.85
const DEFAULT_WALK_STRIDE = 0.68
const DEFAULT_RUN_STRIDE = 0.95

/** 腿长近似（髋到脚底），用于支撑脚反滑移估算 */
const LEG_LENGTH = 0.82

type LocomotionMode = 'idle' | WorkerGait

interface GaitStyle {
  speed: number
  stride: number
  /** 支撑相占单步周期比例（走≈0.62，跑≈0.38） */
  dutyFactor: number
  thighAmp: number
  calfStance: number
  calfSwing: number
  armAmp: number
  elbowBend: number
  elbowPump: number
  bob: number
  lateral: number
  spineLean: number
  spineYaw: number
  spinePitchOsc: number
  footHeel: number
  footToe: number
  footSwing: number
  /** 骨盆纵向反滑移强度 0..1 */
  plantLock: number
}

const WALK_STYLE: Omit<GaitStyle, 'speed' | 'stride'> = {
  dutyFactor: 0.58,
  thighAmp: 0.38,
  calfStance: 0.08,
  calfSwing: 0.62,
  armAmp: 0.38,
  elbowBend: 0.16,
  elbowPump: 0.12,
  /** 整身挂在骨盆上，起伏过大会把支撑脚抬离地面 → 跛行感 */
  bob: 0.004,
  lateral: 0.01,
  spineLean: 0.03,
  spineYaw: 0.04,
  spinePitchOsc: 0.012,
  footHeel: 0.12,
  footToe: 0.14,
  footSwing: 0.1,
  /** 纵向钉脚适中，过大前后晃也会像一瘸一拐 */
  plantLock: 0.48,
}

const RUN_STYLE: Omit<GaitStyle, 'speed' | 'stride'> = {
  dutyFactor: 0.4,
  thighAmp: 0.68,
  calfStance: 0.16,
  calfSwing: 0.95,
  armAmp: 0.8,
  elbowBend: 1.1,
  elbowPump: 0.28,
  bob: 0.016,
  lateral: 0.018,
  spineLean: 0.18,
  spineYaw: 0.05,
  spinePitchOsc: 0.03,
  footHeel: 0.16,
  footToe: 0.2,
  footSwing: 0.14,
  plantLock: 0.42,
}

interface LegPose {
  thigh: number
  calf: number
  foot: number
}

/**
 * 工人移动：idle / walk / run。
 * 支撑相用骨盆纵向补偿钉住支撑脚，消除「人在挪、脚在滑」的滑步感。
 */
export class WorkerLocomotionController implements SceneAnimator {
  public readonly id: string

  private readonly root: THREE.Object3D
  private readonly path: THREE.Vector2[]
  private readonly defaultGait: WorkerGait
  private readonly walkSpeed: number
  private readonly runSpeed: number
  private readonly walkStride: number
  private readonly runStride: number
  private readonly loopPath: boolean
  private readonly poseDriver: RootPoseDriver | null

  private readonly hips: THREE.Object3D | null
  private readonly spine: THREE.Object3D | null
  private readonly armL: THREE.Object3D | null
  private readonly armR: THREE.Object3D | null
  private readonly elbowL: THREE.Object3D | null
  private readonly elbowR: THREE.Object3D | null
  private readonly thighL: THREE.Object3D | null
  private readonly thighR: THREE.Object3D | null
  private readonly calfL: THREE.Object3D | null
  private readonly calfR: THREE.Object3D | null
  private readonly footL: THREE.Object3D | null
  private readonly footR: THREE.Object3D | null

  private readonly hipsBase: THREE.Vector3
  private readonly spineBaseRot = new THREE.Euler()
  private readonly armLIdle: THREE.Euler
  private readonly armRIdle: THREE.Euler
  private readonly elbowLIdle: THREE.Euler
  private readonly elbowRIdle: THREE.Euler
  private readonly lockArmL: boolean
  private readonly lockArmR: boolean

  private playing = false
  private mode: LocomotionMode = 'idle'
  /** 完整复步相位 0..2π（左+右各一步） */
  private phase = 0
  /** 骨盆纵向偏移的帧间平滑，避免换支撑时突变 */
  private hipZSmoothed = 0
  private segmentIndex = 0
  private readonly tmpDir = new THREE.Vector2()
  private readonly tmpPos = new THREE.Vector2()
  private readonly lastActualPosition = new THREE.Vector2()
  private hasActualPosition = false
  private readonly turnRate = 7

  public constructor(options: WorkerLocomotionOptions) {
    this.id = options.id
    this.root = options.root
    this.path = options.path.map((p) => new THREE.Vector2(p.x, p.z))
    this.defaultGait = options.defaultGait ?? 'walk'
    this.walkSpeed = options.walkSpeed ?? DEFAULT_WALK_SPEED
    this.runSpeed = options.runSpeed ?? DEFAULT_RUN_SPEED
    this.walkStride = Math.max(
      0.4,
      options.walkStrideLength ?? options.strideLength ?? DEFAULT_WALK_STRIDE,
    )
    this.runStride = Math.max(0.55, options.runStrideLength ?? DEFAULT_RUN_STRIDE)
    this.loopPath = options.loop ?? true
    this.poseDriver = options.poseDriver ?? null

    const joints = resolveJoints(this.root, [
      'hips',
      'spine',
      'armL',
      'armR',
      'elbowL',
      'elbowR',
      'thighL',
      'thighR',
      'calfL',
      'calfR',
      'footL',
      'footR',
    ])
    this.hips = joints.hips
    this.spine = joints.spine
    this.armL = joints.armL
    this.armR = joints.armR
    this.elbowL = joints.elbowL
    this.elbowR = joints.elbowR
    this.thighL = joints.thighL
    this.thighR = joints.thighR
    this.calfL = joints.calfL
    this.calfR = joints.calfR
    this.footL = joints.footL
    this.footR = joints.footR

    this.hipsBase = this.hips
      ? this.hips.position.clone()
      : new THREE.Vector3(0, 0.88, 0)
    if (this.spine) {
      this.spineBaseRot.copy(this.spine.rotation)
    }

    this.armLIdle = this.readIdleEuler(this.armL)
    this.armRIdle = this.readIdleEuler(this.armR)
    this.elbowLIdle = this.readIdleEuler(this.elbowL)
    this.elbowRIdle = this.readIdleEuler(this.elbowR)
    this.lockArmL = Boolean(this.armL?.userData.lockSwing)
    this.lockArmR = Boolean(this.armR?.userData.lockSwing)

    if (this.path.length >= 1) {
      this.teleportTo(this.path[0].x, this.path[0].y, this.root.rotation.y)
    }
  }

  public play(action?: string): void {
    if (action === 'idle') {
      this.playing = true
      this.mode = 'idle'
      this.applyIdlePose()
      return
    }

    const gait: WorkerGait =
      action === 'run' || action === 'walk' ? action : this.defaultGait

    if (this.path.length < 2) {
      this.playing = true
      this.mode = 'idle'
      this.applyIdlePose()
      return
    }

    this.playing = true
    this.mode = gait
    if (this.segmentIndex >= this.path.length - 1) {
      this.segmentIndex = 0
      this.teleportTo(this.path[0].x, this.path[0].y, this.root.rotation.y)
    }
  }

  public stop(): void {
    this.playing = false
    this.mode = 'idle'
    this.phase = 0
    this.hipZSmoothed = 0
    this.applyIdlePose()
  }

  public isPlaying(): boolean {
    return this.playing && (this.mode === 'walk' || this.mode === 'run')
  }

  public update(delta: number): void {
    if (!this.playing) {
      return
    }
    if ((this.mode !== 'walk' && this.mode !== 'run') || this.path.length < 2) {
      return
    }

    const style = this.resolveStyle(this.mode)
    const pose = this.readPose()
    const actualTravel = this.measureActualTravel(pose.x, pose.z)
    let logicalX = pose.x
    let logicalZ = pose.z
    let logicalYaw = pose.yaw
    let targetYaw = pose.yaw
    let teleported = false
    let traveled = 0

    let remaining = style.speed * delta
    while (remaining > 0 && this.segmentIndex < this.path.length - 1) {
      const from = this.path[this.segmentIndex]
      const to = this.path[this.segmentIndex + 1]
      this.tmpPos.set(logicalX, logicalZ)
      this.tmpDir.copy(to).sub(from)
      const segLen = this.tmpDir.length()
      if (segLen < 1e-4) {
        this.segmentIndex += 1
        continue
      }
      this.tmpDir.multiplyScalar(1 / segLen)

      const distToEnd = this.tmpPos.distanceTo(to)
      if (remaining >= distToEnd) {
        logicalX = to.x
        logicalZ = to.y
        traveled += distToEnd
        remaining -= distToEnd
        this.segmentIndex += 1
        targetYaw = this.yawFromDir(this.tmpDir, targetYaw)
        if (this.segmentIndex >= this.path.length - 1) {
          if (this.loopPath) {
            this.segmentIndex = 0
            logicalX = this.path[0].x
            logicalZ = this.path[0].y
            this.teleportTo(logicalX, logicalZ, targetYaw)
            teleported = true
          } else {
            this.mode = 'idle'
            this.playing = false
            this.applyIdlePose()
            return
          }
        }
      } else {
        logicalX += this.tmpDir.x * remaining
        logicalZ += this.tmpDir.y * remaining
        traveled += remaining
        targetYaw = this.yawFromDir(this.tmpDir, targetYaw)
        remaining = 0
      }
    }

    if (!teleported) {
      logicalYaw = this.dampAngle(logicalYaw, targetYaw, this.turnRate, delta)
      this.commitPose(logicalX, logicalZ, logicalYaw)
    }

    // 单步对应 π：步频 = speed / stride，与位移严格耦合
    const gaitTravel = this.poseDriver ? actualTravel : traveled
    this.phase += (gaitTravel / style.stride) * Math.PI
    if (this.phase > Math.PI * 2) {
      this.phase %= Math.PI * 2
    }
    this.applyGaitPose(this.phase, style, delta)
  }

  public dispose(): void {
    this.stop()
  }

  private resolveStyle(gait: WorkerGait): GaitStyle {
    if (gait === 'run') {
      return {
        speed: this.runSpeed,
        stride: this.runStride,
        ...RUN_STYLE,
      }
    }
    return {
      speed: this.walkSpeed,
      stride: this.walkStride,
      ...WALK_STYLE,
    }
  }

  private readPose(): { x: number; z: number; yaw: number } {
    if (this.poseDriver) {
      return this.poseDriver.getPose()
    }
    return {
      x: this.root.position.x,
      z: this.root.position.z,
      yaw: this.root.rotation.y,
    }
  }

  private commitPose(x: number, z: number, yaw: number): void {
    if (this.poseDriver) {
      this.poseDriver.setDesiredPose(x, z, yaw)
      return
    }
    this.root.position.x = x
    this.root.position.z = z
    this.root.rotation.y = yaw
  }

  private teleportTo(x: number, z: number, yaw: number): void {
    this.lastActualPosition.set(x, z)
    this.hasActualPosition = true
    if (this.poseDriver) {
      this.poseDriver.teleport(x, z, yaw)
      return
    }
    this.root.position.x = x
    this.root.position.z = z
    this.root.rotation.y = yaw
  }

  private dampAngle(current: number, target: number, rate: number, delta: number): number {
    const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current))
    return current + difference * (1 - Math.exp(-rate * delta))
  }

  private measureActualTravel(x: number, z: number): number {
    if (!this.hasActualPosition) {
      this.lastActualPosition.set(x, z)
      this.hasActualPosition = true
      return 0
    }
    const distance = Math.hypot(x - this.lastActualPosition.x, z - this.lastActualPosition.y)
    this.lastActualPosition.set(x, z)
    return distance
  }

  private yawFromDir(dir: THREE.Vector2, fallback: number): number {
    if (dir.lengthSq() < 1e-8) {
      return fallback
    }
    return Math.atan2(dir.x, dir.y)
  }

  /**
   * 将 [0,1] 墙钟相位按 duty 扭曲：支撑占前半周期、摆动占后半，
   * 再用连续余弦驱动，避免分段 smootherstep 在着地/离地处速度归零造成「一顿」。
   */
  private warpLegPhase(phase01: number, duty: number): number {
    if (phase01 < duty) {
      return 0.5 * (phase01 / Math.max(duty, 1e-4))
    }
    return 0.5 + 0.5 * ((phase01 - duty) / Math.max(1 - duty, 1e-4))
  }

  /**
   * 单腿：u∈[0,1] 为扭曲后相位；着地 u=0 / 蹬地 u=0.5 / 再着地 u=1。
   * +thigh → 脚向本地 -Z；着地脚在身前 → thigh 为负。
   */
  private sampleLeg(phase01: number, style: GaitStyle): LegPose {
    const u = this.warpLegPhase(phase01, style.dutyFactor)
    const cycle = u * Math.PI * 2
    const thigh = -style.thighAmp * Math.cos(cycle)
    const sinC = Math.sin(cycle)
    const calf =
      Math.max(0, sinC) * style.calfStance + Math.max(0, -sinC) * style.calfSwing
    // 着地足跟 → 蹬地足尖 → 摆动期平滑回到足跟角，边界连续
    const foot =
      THREE.MathUtils.lerp(style.footHeel, -style.footToe, 0.5 - 0.5 * Math.cos(cycle)) +
      Math.max(0, -sinC) * style.footSwing * 0.35
    return { thigh, calf, foot }
  }

  /** 支撑权重：支撑段内平滑钟形，边界为 0，换脚时不硬切 */
  private stanceWeight(phase01: number, duty: number): number {
    if (phase01 >= duty || duty <= 1e-4) {
      return 0
    }
    const t = phase01 / duty
    return Math.sin(t * Math.PI)
  }

  private applyGaitPose(phase: number, style: GaitStyle, delta: number): void {
    const left01 = this.wrap01(phase / (Math.PI * 2))
    const right01 = this.wrap01(left01 + 0.5)
    const left = this.sampleLeg(left01, style)
    const right = this.sampleLeg(right01, style)

    const leftFootZ = -Math.sin(left.thigh) * LEG_LENGTH
    const rightFootZ = -Math.sin(right.thigh) * LEG_LENGTH
    const wL = this.stanceWeight(left01, style.dutyFactor)
    const wR = this.stanceWeight(right01, style.dutyFactor)
    const wSum = wL + wR

    // 连续加权钉脚；腾空期用双脚均值弱约束，避免权重归零时跳变
    const targetHipZ =
      wSum > 1e-4
        ? (-(wL * leftFootZ + wR * rightFootZ) / wSum) * style.plantLock
        : -0.5 * (leftFootZ + rightFootZ) * style.plantLock * 0.2

    // 指数平滑：换支撑时骨盆纵向不突变
    const smoothRate = this.mode === 'run' ? 18 : 14
    const alpha = 1 - Math.exp(-Math.max(delta, 0) * smoothRate)
    this.hipZSmoothed += (targetHipZ - this.hipZSmoothed) * alpha

    // 绕基准高度对称微起伏（勿只用上抬，否则像一步一蹦）
    const bob = Math.cos(phase * 2) * style.bob
    const lateral = Math.sin(phase) * style.lateral

    if (this.hips) {
      this.hips.position.set(
        this.hipsBase.x + lateral,
        this.hipsBase.y + bob,
        this.hipsBase.z + this.hipZSmoothed,
      )
      // 侧倾/俯仰保持很轻，避免重心左右砸地的跛行感
      this.hips.rotation.z = -lateral * 0.7
      this.hips.rotation.x = Math.sin(phase * 2) * 0.008
    }

    if (this.spine) {
      this.spine.rotation.x =
        this.spineBaseRot.x + style.spineLean + Math.sin(phase * 2) * style.spinePitchOsc
      this.spine.rotation.y = this.spineBaseRot.y + Math.sin(phase) * style.spineYaw
      this.spine.rotation.z = this.spineBaseRot.z - lateral * 0.35
    }

    if (this.thighL) {
      this.thighL.rotation.x = left.thigh
    }
    if (this.thighR) {
      this.thighR.rotation.x = right.thigh
    }
    if (this.calfL) {
      this.calfL.rotation.x = left.calf
    }
    if (this.calfR) {
      this.calfR.rotation.x = right.calf
    }
    if (this.footL) {
      this.footL.rotation.x = left.foot
    }
    if (this.footR) {
      this.footR.rotation.x = right.foot
    }

    const forceArmSwing = this.mode === 'run'
    // 对侧摆臂：左脚在前（phase 初段 sin>0）时右臂前、左臂后，避免顺拐
    const armPhase = Math.sin(phase)
    if (this.armL && (!this.lockArmL || forceArmSwing)) {
      const baseX = forceArmSwing && this.lockArmL ? -0.25 : this.armLIdle.x
      this.armL.rotation.x = baseX + armPhase * style.armAmp
      this.armL.rotation.z = this.lockArmL && forceArmSwing ? 0.12 : this.armLIdle.z
    }
    if (this.armR && (!this.lockArmR || forceArmSwing)) {
      const baseX = forceArmSwing && this.lockArmR ? -0.25 : this.armRIdle.x
      this.armR.rotation.x = baseX - armPhase * style.armAmp
      this.armR.rotation.z = this.lockArmR && forceArmSwing ? -0.12 : this.armRIdle.z
    }

    // 肘泵：前摆侧略加大弯曲。抱物 / 指向等锁臂姿态保留建造时的屈肘。
    this.applyElbowBend(
      this.elbowL,
      this.elbowLIdle.x,
      this.lockArmL,
      Math.max(0, armPhase) * style.elbowPump,
      style.elbowBend,
    )
    this.applyElbowBend(
      this.elbowR,
      this.elbowRIdle.x,
      this.lockArmR,
      Math.max(0, -armPhase) * style.elbowPump,
      style.elbowBend,
    )
  }

  private applyElbowBend(
    elbow: THREE.Object3D | null,
    idleX: number,
    locked: boolean,
    pump: number,
    bend: number,
  ): void {
    if (!elbow) {
      return
    }
    elbow.rotation.x = locked ? idleX - pump : -(bend + pump)
  }

  private applyIdlePose(): void {
    this.hipZSmoothed = 0
    if (this.hips) {
      this.hips.position.copy(this.hipsBase)
      this.hips.rotation.set(0, 0, 0)
    }
    if (this.spine) {
      this.spine.rotation.copy(this.spineBaseRot)
    }
    if (this.thighL) {
      this.thighL.rotation.set(0, 0, 0)
    }
    if (this.thighR) {
      this.thighR.rotation.set(0, 0, 0)
    }
    if (this.calfL) {
      this.calfL.rotation.set(0, 0, 0)
    }
    if (this.calfR) {
      this.calfR.rotation.set(0, 0, 0)
    }
    if (this.footL) {
      this.footL.rotation.set(0, 0, 0)
    }
    if (this.footR) {
      this.footR.rotation.set(0, 0, 0)
    }
    if (this.armL) {
      this.armL.rotation.set(this.armLIdle.x, this.armLIdle.y, this.armLIdle.z)
    }
    if (this.armR) {
      this.armR.rotation.set(this.armRIdle.x, this.armRIdle.y, this.armRIdle.z)
    }
    if (this.elbowL) {
      this.elbowL.rotation.set(this.elbowLIdle.x, this.elbowLIdle.y, this.elbowLIdle.z)
    }
    if (this.elbowR) {
      this.elbowR.rotation.set(this.elbowRIdle.x, this.elbowRIdle.y, this.elbowRIdle.z)
    }
  }

  private wrap01(value: number): number {
    const v = value % 1
    return v < 0 ? v + 1 : v
  }

  private readIdleEuler(arm: THREE.Object3D | null): THREE.Euler {
    if (!arm) {
      return new THREE.Euler()
    }
    const stored = arm.userData.idleRotation as { x: number; y: number; z: number } | undefined
    if (stored) {
      return new THREE.Euler(stored.x, stored.y, stored.z)
    }
    return new THREE.Euler(arm.rotation.x, arm.rotation.y, arm.rotation.z)
  }
}
