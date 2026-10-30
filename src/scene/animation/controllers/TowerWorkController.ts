import * as THREE from 'three'
import { FACILITY_LAYOUT, PYLON_CLIMB } from '@/constants/scale'
import type { AnimatorPlayOptions, SceneAnimator } from '@/scene/animation/types'
import {
  TOWER_DEMO_ANCHOR_ORDER,
  buildClimbPath,
  buildDescendPath,
  getPylonAnchorWorld,
  getPylonClimbBaseWorld,
} from '@/scene/layout/pylonAnchors'
import type { TowerAnchorKind, TowerWorkPose, XyzPoint } from '@/scene/layout/types'
import { resolveJoints } from '@/scene/utils/animatableMeta'

type TowerMode = 'idle' | 'climb' | 'straddle' | 'work' | 'descend'

interface DemoStep {
  kind: 'climb' | 'work' | 'descend' | 'wait'
  target?: string
  duration?: number
}

/** 每档横栏移动耗时 */
const SECONDS_PER_RUNG = 0.52
const CLIMB_SPEED = PYLON_CLIMB.rungSpacing / SECONDS_PER_RUNG
const DESCEND_SPEED = CLIMB_SPEED * 1.1
/** 横担夹架挪移：每步距离与耗时（撑—推—落，非匀速滑动） */
const SCOOT_LENGTH = 0.4
const SECONDS_PER_SCOOT = 0.72
const WORK_HOLD_SECONDS = 4.2
const WAIT_AT_BASE_SECONDS = 1.6

/**
 * 杆塔高空作业：
 * - 竖直：贴塔攀爬（非走路）
 * - 横担：骑跨挪移
 * - 塔身作业：面朝塔心
 */
export class TowerWorkController implements SceneAnimator {
  public readonly id: string

  private readonly root: THREE.Object3D
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

  private readonly armLIdle: THREE.Euler
  private readonly armRIdle: THREE.Euler
  private readonly elbowLIdle: THREE.Euler
  private readonly elbowRIdle: THREE.Euler
  private readonly hipsBaseY: number

  private playing = false
  private mode: TowerMode = 'idle'
  private path: XyzPoint[] = []
  private segmentIndex = 0
  private phase = 0
  private workElapsed = 0
  private workPose: TowerWorkPose = 'inspect'
  private anchorKind: TowerAnchorKind = 'mast'
  private facingYaw = 0

  private demoMode = false
  private demoSteps: DemoStep[] = []
  private demoStepIndex = 0
  private waitElapsed = 0
  private rungStepsCompleted = 0
  private rungSegmentT = 0
  /** 当前路径段内第几步夹架挪移 */
  private scootIndex = 0
  /** 单步挪移相位 [0,1] */
  private scootT = 0
  /** 横担挪移中（驱动撑推落姿态） */
  private straddleMoving = false

  public constructor(id: string, root: THREE.Object3D) {
    this.id = id
    this.root = root

    const joints = resolveJoints(root, [
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

    this.armLIdle = this.readIdleEuler(this.armL)
    this.armRIdle = this.readIdleEuler(this.armR)
    this.elbowLIdle = this.readIdleEuler(this.elbowL)
    this.elbowRIdle = this.readIdleEuler(this.elbowR)
    this.hipsBaseY = this.hips?.position.y ?? 0.88

    this.snapToBase()
    this.applyIdlePose()
  }

  public play(action?: string, options?: AnimatorPlayOptions): void {
    if (action === 'idle' || action === 'stop') {
      this.stop()
      return
    }

    this.playing = true

    if (action === 'climb' && options?.target) {
      this.demoMode = false
      this.beginClimb(options.target)
      return
    }
    if (action === 'work') {
      this.demoMode = false
      this.beginWork()
      return
    }
    if (action === 'descend') {
      this.demoMode = false
      this.beginDescend()
      return
    }

    this.demoMode = true
    this.demoSteps = this.buildDemoSteps()
    this.demoStepIndex = 0
    this.runDemoStep()
  }

  public stop(): void {
    this.playing = false
    this.mode = 'idle'
    this.demoMode = false
    this.path = []
    this.segmentIndex = 0
    this.phase = 0
    this.rungStepsCompleted = 0
    this.rungSegmentT = 0
    this.scootIndex = 0
    this.scootT = 0
    this.straddleMoving = false
    this.workElapsed = 0
    this.waitElapsed = 0
    this.snapToBase()
    this.applyIdlePose()
  }

  public isPlaying(): boolean {
    return this.playing
  }

  public update(delta: number): void {
    if (!this.playing) {
      return
    }

    if (this.mode === 'climb' || this.mode === 'descend' || this.mode === 'straddle') {
      const speed = this.mode === 'descend' ? DESCEND_SPEED : CLIMB_SPEED
      this.updateTraverse(delta, speed)
      return
    }

    if (this.mode === 'work') {
      this.workElapsed += delta
      this.applyWorkPose(this.workElapsed)
      if (this.demoMode && this.workElapsed >= WORK_HOLD_SECONDS) {
        this.advanceDemo()
      }
      return
    }

    if (this.demoMode && this.demoSteps[this.demoStepIndex]?.kind === 'wait') {
      this.waitElapsed += delta
      const need = this.demoSteps[this.demoStepIndex].duration ?? WAIT_AT_BASE_SECONDS
      if (this.waitElapsed >= need) {
        this.advanceDemo()
      }
    }
  }

  public dispose(): void {
    this.stop()
  }

  private buildDemoSteps(): DemoStep[] {
    const steps: DemoStep[] = []
    TOWER_DEMO_ANCHOR_ORDER.forEach((id: string) => {
      steps.push({ kind: 'climb', target: id })
      steps.push({ kind: 'work', duration: WORK_HOLD_SECONDS })
    })
    steps.push({ kind: 'descend' })
    steps.push({ kind: 'wait', duration: WAIT_AT_BASE_SECONDS })
    return steps
  }

  private runDemoStep(): void {
    const step = this.demoSteps[this.demoStepIndex]
    if (!step) {
      this.demoStepIndex = 0
      this.runDemoStep()
      return
    }
    if (step.kind === 'climb' && step.target) {
      this.beginClimb(step.target)
      return
    }
    if (step.kind === 'work') {
      this.beginWork()
      return
    }
    if (step.kind === 'descend') {
      this.beginDescend()
      return
    }
    this.mode = 'idle'
    this.waitElapsed = 0
    this.applyIdlePose()
  }

  private advanceDemo(): void {
    this.demoStepIndex += 1
    if (this.demoStepIndex >= this.demoSteps.length) {
      this.demoStepIndex = 0
    }
    this.runDemoStep()
  }

  private beginClimb(targetId: string): void {
    const anchor = getPylonAnchorWorld(targetId)
    if (!anchor) {
      if (this.demoMode) {
        this.advanceDemo()
      } else {
        this.mode = 'idle'
      }
      return
    }
    const from = this.currentPoint()
    this.path = buildClimbPath(from, targetId)
    this.segmentIndex = 0
    this.workPose = anchor.workPose
    this.anchorKind = anchor.kind
    this.facingYaw = anchor.facingYaw
    this.phase = 0
    this.rungStepsCompleted = 0
    this.rungSegmentT = 0
    this.scootIndex = 0
    this.scootT = 0
    this.straddleMoving = false
    this.mode = this.peekSegmentMode(0)
  }

  private beginWork(): void {
    this.mode = 'work'
    this.workElapsed = 0
    this.straddleMoving = false
    if (this.anchorKind === 'mast') {
      this.faceTowardPylon()
    } else {
      this.root.rotation.y = this.facingYaw
    }
    this.applyWorkPose(0)
  }

  private beginDescend(): void {
    const from = this.currentPoint()
    this.path = buildDescendPath(from)
    this.segmentIndex = 0
    this.phase = 0
    this.rungStepsCompleted = 0
    this.rungSegmentT = 0
    this.scootIndex = 0
    this.scootT = 0
    this.straddleMoving = false
    this.anchorKind = 'mast'
    this.mode = 'descend'
  }

  private peekSegmentMode(segIndex: number): TowerMode {
    if (this.mode === 'descend') {
      return 'descend'
    }
    if (segIndex >= this.path.length - 1) {
      return this.anchorKind === 'arm' ? 'straddle' : 'climb'
    }
    const from = this.path[segIndex]
    const to = this.path[segIndex + 1]
    return this.isHorizontalSegment(from, to) ? 'straddle' : 'climb'
  }

  private isHorizontalSegment(from: XyzPoint, to: XyzPoint): boolean {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dz = to.z - from.z
    const segLen = Math.hypot(dx, dy, dz)
    if (segLen < 1e-4) {
      return false
    }
    return Math.abs(dy) / segLen < 0.35 && Math.hypot(dx, dz) / segLen > 0.65
  }

  private isVerticalRungSegment(from: XyzPoint, to: XyzPoint): boolean {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dz = to.z - from.z
    const segLen = Math.hypot(dx, dy, dz)
    if (segLen < 1e-4) {
      return false
    }
    return (
      Math.abs(dy) > 0.2 &&
      Math.abs(dy) / segLen > 0.75 &&
      Math.abs(Math.abs(dy) - PYLON_CLIMB.rungSpacing) < 0.12
    )
  }

  private updateTraverse(delta: number, speed: number): void {
    if (this.path.length < 2) {
      this.onTraverseComplete()
      return
    }

    let remaining = speed * delta
    while (remaining > 0 && this.segmentIndex < this.path.length - 1) {
      const from = this.path[this.segmentIndex]
      const to = this.path[this.segmentIndex + 1]
      const dx = to.x - from.x
      const dy = to.y - from.y
      const dz = to.z - from.z
      const segLen = Math.hypot(dx, dy, dz)
      if (segLen < 1e-4) {
        this.segmentIndex += 1
        continue
      }

      const horizontal = this.isHorizontalSegment(from, to)
      const verticalRung = this.isVerticalRungSegment(from, to)

      // 段类型切换姿态模式（下降全程贴塔）
      if (this.mode !== 'descend') {
        this.mode = horizontal ? 'straddle' : 'climb'
      }

      if (verticalRung) {
        this.straddleMoving = false
        // 竖直档：先踩住下档再起身，避免脚悬空够不着横栏
        const stepSpeed = speed / Math.max(PYLON_CLIMB.rungSpacing, 0.2)
        this.rungSegmentT = Math.min(1, this.rungSegmentT + delta * stepSpeed)
        const t = this.rungSegmentT
        // 前 55% 脚仍踩在 from 档，仅手脚做够档；后 45% 再把身体抬到 to 档
        const liftT = t <= 0.55 ? 0 : this.smootherstep((t - 0.55) / 0.45)
        this.root.position.x = THREE.MathUtils.lerp(from.x, to.x, liftT)
        this.root.position.y = THREE.MathUtils.lerp(from.y, to.y, liftT)
        this.root.position.z = THREE.MathUtils.lerp(from.z, to.z, liftT)
        this.phase = (this.rungStepsCompleted + t) * Math.PI
        remaining = 0
        if (t >= 1) {
          this.root.position.set(to.x, to.y, to.z)
          this.segmentIndex += 1
          this.rungStepsCompleted += 1
          this.rungSegmentT = 0
        }
        continue
      }

      if (horizontal && this.mode !== 'descend') {
        // 横担：分步夹架挪移（撑杆→推胯→落稳），禁止匀速滑动
        this.advanceStraddleScoot(from, to, segLen, delta)
        remaining = 0
        continue
      }

      const pos = this.currentPoint()
      const toEnd = Math.hypot(to.x - pos.x, to.y - pos.y, to.z - pos.z)
      const ux = dx / segLen
      const uy = dy / segLen
      const uz = dz / segLen

      if (remaining >= toEnd) {
        this.root.position.set(to.x, to.y, to.z)
        remaining -= toEnd
        this.segmentIndex += 1
      } else {
        this.root.position.x += ux * remaining
        this.root.position.y += uy * remaining
        this.root.position.z += uz * remaining
        remaining = 0
      }
    }

    if (this.mode === 'straddle') {
      this.faceAlongCurrentSegment()
      this.applyStraddlePose(this.scootT, this.straddleMoving)
    } else {
      this.faceTowardPylon()
      this.straddleMoving = false
      // 竖直档相位已在段内更新；非档段保持当前 phase
      this.applyClimbPose(this.phase)
    }

    if (this.segmentIndex >= this.path.length - 1) {
      const last = this.path[this.path.length - 1]
      this.root.position.set(last.x, last.y, last.z)
      this.onTraverseComplete()
    }
  }

  private faceAlongCurrentSegment(): void {
    if (this.segmentIndex >= this.path.length - 1) {
      this.root.rotation.y = this.facingYaw
      return
    }
    const from = this.path[this.segmentIndex]
    const to = this.path[Math.min(this.segmentIndex + 1, this.path.length - 1)]
    const dx = to.x - from.x
    const dz = to.z - from.z
    if (dx * dx + dz * dz > 1e-6) {
      this.root.rotation.y = Math.atan2(dx, dz)
    } else {
      this.root.rotation.y = this.facingYaw
    }
  }

  private onTraverseComplete(): void {
    if (this.mode === 'climb' || this.mode === 'straddle') {
      if (this.anchorKind === 'mast') {
        this.faceTowardPylon()
      } else {
        this.root.rotation.y = this.facingYaw
      }
      if (this.demoMode) {
        this.advanceDemo()
      } else {
        this.beginWork()
      }
      return
    }
    if (this.mode === 'descend') {
      this.snapToBase()
      this.applyIdlePose()
      if (this.demoMode) {
        this.advanceDemo()
      } else {
        this.mode = 'idle'
        this.playing = false
      }
    }
  }

  /**
   * 贴塔攀爬：支撑脚踩当前档脚钉，摆动脚/手上抬够下一档。
   * 手臂抬高+屈肘，手落在脚钉外侧，避免前臂捅进主腿。
   * phase∈[nπ,(n+1)π] 为一步；sin>0 时左脚摆动、右脚支撑（反之亦然）。
   */
  private applyClimbPose(phase: number): void {
    const swing = Math.sin(phase)
    const plant = Math.abs(Math.cos(phase)) // 落档≈1
    // 哪一侧在摆动：swing>0 → 左摆右撑
    const leftSwing = Math.max(0, swing)
    const rightSwing = Math.max(0, -swing)

    if (this.hips) {
      this.hips.position.y = this.hipsBaseY - 0.02 * plant
      // 略后撤，肩到手与主腿留出抓钉空间
      this.hips.position.z = -0.03
      this.hips.rotation.set(0.1, 0, swing * 0.04)
    }
    if (this.spine) {
      this.spine.rotation.set(0.1 + (1 - plant) * 0.04, swing * 0.03, 0)
    }

    // 支撑脚：轻屈踩钉；摆动脚：膝上抬够上一档
    if (this.thighL) {
      this.thighL.rotation.set(-0.28 - leftSwing * 0.65, 0, 0.1)
    }
    if (this.thighR) {
      this.thighR.rotation.set(-0.28 - rightSwing * 0.65, 0, -0.1)
    }
    if (this.calfL) {
      this.calfL.rotation.x = 0.2 + leftSwing * 0.8
    }
    if (this.calfR) {
      this.calfR.rotation.x = 0.2 + rightSwing * 0.8
    }
    if (this.footL) {
      this.footL.rotation.x = -0.1 + leftSwing * 0.22
    }
    if (this.footR) {
      this.footR.rotation.x = -0.1 + rightSwing * 0.22
    }

    // 手抓脚钉：肩少前伸、肘多屈，手停在钉外沿而非捅进主腿
    if (this.armL) {
      this.armL.rotation.set(-0.88 - leftSwing * 0.22, 0.14, 0.34)
    }
    if (this.armR) {
      this.armR.rotation.set(-0.88 - rightSwing * 0.22, -0.14, -0.34)
    }
    if (this.elbowL) {
      this.elbowL.rotation.x = -(0.95 + leftSwing * 0.28)
    }
    if (this.elbowR) {
      this.elbowR.rotation.x = -(0.95 + rightSwing * 0.28)
    }
  }

  private smootherstep(t: number): number {
    const x = THREE.MathUtils.clamp(t, 0, 1)
    return x * x * x * (x * (x * 6 - 15) + 10)
  }

  /**
   * 横担一段内按 SCOOT_LENGTH 拆成多步：前段撑杆不动，中段推胯前进，末段落稳。
   */
  private advanceStraddleScoot(
    from: XyzPoint,
    to: XyzPoint,
    segLen: number,
    delta: number,
  ): void {
    this.straddleMoving = true
    const scootCount = Math.max(1, Math.ceil(segLen / SCOOT_LENGTH))
    const stepLen = segLen / scootCount

    this.scootT = Math.min(1, this.scootT + delta / SECONDS_PER_SCOOT)
    const t = this.scootT

    // 0~0.32 撑杆蓄力（根不动）；0.32~0.82 推胯前进；0.82~1 落稳
    let moveT = 0
    if (t > 0.32 && t < 0.82) {
      moveT = this.smootherstep((t - 0.32) / 0.5)
    } else if (t >= 0.82) {
      moveT = 1
    }

    const along = (this.scootIndex + moveT) * stepLen
    const u = THREE.MathUtils.clamp(along / segLen, 0, 1)
    this.root.position.x = THREE.MathUtils.lerp(from.x, to.x, u)
    this.root.position.y = THREE.MathUtils.lerp(from.y, to.y, u)
    this.root.position.z = THREE.MathUtils.lerp(from.z, to.z, u)
    this.phase = this.scootIndex + t

    if (t < 1) {
      return
    }

    this.scootIndex += 1
    this.scootT = 0
    if (this.scootIndex >= scootCount) {
      this.root.position.set(to.x, to.y, to.z)
      this.segmentIndex += 1
      this.scootIndex = 0
      this.straddleMoving = false
    }
  }

  /**
   * 横担骑跨：胯部坐弦杆、双腿外展下垂夹住（骑马姿）。
   * moving=true 时按单步相位做撑—推—落；否则为作业静坐微动。
   */
  private applyStraddlePose(scootT: number, moving = false): void {
    const t = THREE.MathUtils.clamp(scootT, 0, 1)

    // 基础骑马坐姿：膝屈夹架，外展适中（勿硬直劈叉）
    let hipY = -0.05
    let hipZ = 0.02
    let hipPitch = 0.1
    let spinePitch = 0.14
    let abduct = 0.46
    let thighPitch = -0.16
    let calfBend = 0.78
    let reach = 0
    let pull = 0
    let clampExtra = 0
    let sideBias = 0

    if (moving) {
      if (t < 0.32) {
        // 双手前伸撑杆、夹腿蓄力，身体尚未前进
        const u = t / 0.32
        reach = u
        spinePitch = 0.14 + u * 0.12
        hipPitch = 0.1 + u * 0.06
        clampExtra = u * 0.1
        hipY = -0.05 + u * 0.02
      } else if (t < 0.82) {
        // 撑杆回拉、胯部前送，完成一步挪移
        const u = (t - 0.32) / 0.5
        reach = 1 - u
        pull = u
        spinePitch = 0.26 - u * 0.1
        hipPitch = 0.16 - u * 0.05
        hipZ = 0.02 + Math.sin(u * Math.PI) * 0.05
        clampExtra = 0.1 * (1 - u * 0.6)
        sideBias = Math.sin(u * Math.PI) * 0.04
        hipY = -0.03 - u * 0.02
      } else {
        // 落稳回坐
        const u = (t - 0.82) / 0.18
        spinePitch = 0.16 * (1 - u) + 0.14 * u
        hipPitch = 0.11 * (1 - u) + 0.1 * u
        clampExtra = 0.04 * (1 - u)
        hipZ = 0.02
      }
    } else {
      // 作业静坐：轻微呼吸感
      const breathe = Math.sin(t)
      spinePitch = 0.14 + breathe * 0.015
      clampExtra = breathe * 0.015
      sideBias = breathe * 0.01
    }

    if (this.hips) {
      this.hips.position.y = hipY
      this.hips.position.z = hipZ
      this.hips.rotation.set(hipPitch, sideBias * 0.5, 0)
    }
    if (this.spine) {
      this.spine.rotation.set(spinePitch, sideBias * 0.35, 0)
    }

    // 左负 Z / 右正 Z = 外展成 A 字夹住弦杆
    if (this.thighL) {
      this.thighL.rotation.set(thighPitch + clampExtra * 0.3, 0, -(abduct + clampExtra))
    }
    if (this.thighR) {
      this.thighR.rotation.set(thighPitch + clampExtra * 0.3, 0, abduct + clampExtra)
    }
    if (this.calfL) {
      this.calfL.rotation.set(calfBend + clampExtra * 0.2, 0, 0)
    }
    if (this.calfR) {
      this.calfR.rotation.set(calfBend + clampExtra * 0.2, 0, 0)
    }
    if (this.footL) {
      this.footL.rotation.set(0.12, 0, 0)
    }
    if (this.footR) {
      this.footR.rotation.set(0.12, 0, 0)
    }

    // 双手：前伸撑杆 → 回拉带身；左右略交替
    const alt = moving ? Math.sin(t * Math.PI) * 0.08 : sideBias
    if (this.armL) {
      this.armL.rotation.set(-0.42 - reach * 0.35 + pull * 0.2 - alt, 0.08, 0.3)
    }
    if (this.armR) {
      this.armR.rotation.set(-0.42 - reach * 0.35 + pull * 0.2 + alt, -0.08, -0.3)
    }
    if (this.elbowL) {
      this.elbowL.rotation.x = -(0.7 + reach * 0.35 - pull * 0.15)
    }
    if (this.elbowR) {
      this.elbowR.rotation.x = -(0.7 + reach * 0.35 - pull * 0.15)
    }
  }

  private applyWorkPose(elapsed: number): void {
    const t = elapsed * 2.2
    const pump = Math.sin(t)

    if (this.anchorKind === 'arm') {
      // 横担作业：保持骑马夹架坐姿，上肢做工具循环
      this.applyStraddlePose(elapsed * 1.8, false)
      if (this.spine) {
        this.spine.rotation.x = 0.16 + pump * 0.03
      }
      if (this.armL) {
        this.armL.rotation.set(-0.5, 0.1, 0.34)
      }
      if (this.armR) {
        this.armR.rotation.set(-0.82 + pump * 0.16, -0.08, -0.22)
      }
      if (this.elbowL) {
        this.elbowL.rotation.x = -0.5
      }
      if (this.elbowR) {
        this.elbowR.rotation.x = -(0.8 + Math.max(0, pump) * 0.28)
      }
      return
    }

    // 塔身中段：面朝塔，站立扶塔作业（身体不前顶进塔）
    this.faceTowardPylon()
    if (this.hips) {
      this.hips.position.y = this.hipsBaseY
      this.hips.position.z = -0.02
      this.hips.rotation.set(0.08, 0, 0)
    }
    if (this.spine) {
      this.spine.rotation.set(0.12 + pump * 0.03, pump * 0.03, 0)
    }
    if (this.thighL) {
      this.thighL.rotation.set(-0.08, 0, 0.08)
    }
    if (this.thighR) {
      this.thighR.rotation.set(-0.05, 0, -0.08)
    }
    if (this.calfL) {
      this.calfL.rotation.set(0.12, 0, 0)
    }
    if (this.calfR) {
      this.calfR.rotation.set(0.1, 0, 0)
    }

    if (this.workPose === 'tool') {
      if (this.armL) {
        this.armL.rotation.set(-0.85, 0.1, 0.4)
      }
      if (this.armR) {
        this.armR.rotation.set(-1.05 + pump * 0.18, -0.05, -0.2)
      }
      if (this.elbowL) {
        this.elbowL.rotation.x = -0.5
      }
      if (this.elbowR) {
        this.elbowR.rotation.x = -(0.85 + Math.max(0, pump) * 0.3)
      }
    } else {
      if (this.armL) {
        this.armL.rotation.set(-0.75, 0.1, 0.35)
      }
      if (this.armR) {
        this.armR.rotation.set(-1.15 + pump * 0.1, 0, -0.12)
      }
      if (this.elbowL) {
        this.elbowL.rotation.x = -0.4
      }
      if (this.elbowR) {
        this.elbowR.rotation.x = -0.3
      }
    }
  }

  private applyIdlePose(): void {
    if (this.hips) {
      this.hips.position.set(0, this.hipsBaseY, 0)
      this.hips.rotation.set(0, 0, 0)
    }
    if (this.spine) {
      this.spine.rotation.set(0, 0, 0)
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

  private snapToBase(): void {
    const base = getPylonClimbBaseWorld()
    this.root.position.set(base.x, base.y, base.z)
    this.faceTowardPylon()
    this.mode = 'idle'
  }

  private currentPoint(): XyzPoint {
    return {
      x: this.root.position.x,
      y: this.root.position.y,
      z: this.root.position.z,
    }
  }

  private faceTowardPylon(): void {
    const dx = FACILITY_LAYOUT.pylonX - this.root.position.x
    const dz = FACILITY_LAYOUT.pylonZ - this.root.position.z
    if (dx * dx + dz * dz > 1e-6) {
      this.root.rotation.y = Math.atan2(dx, dz)
    }
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
