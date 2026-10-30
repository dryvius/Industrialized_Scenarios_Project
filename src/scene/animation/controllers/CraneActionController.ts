import type { Object3D } from 'three'
import { Group, MathUtils } from 'three'
import type { SceneAnimator } from '@/scene/animation/types'
import { updateHydraulicFromAnchors } from '@/scene/builders/vehicles/shared/createHydraulic'
import { updateDynamicCable } from '@/scene/builders/vehicles/shared/dynamicCable'
import { resolveJoint, resolveJoints } from '@/scene/utils/animatableMeta'

const OUTRIGGER_RETRACT_Y = 0.48
/** 垫盘贴地，略抬避免与地面代理共面 */
const OUTRIGGER_DEPLOY_Y = 0.02
const OUTRIGGER_DEPLOY_SECONDS = 1.6

/** 伸缩上限（相对全伸略收，降低扫空风险） */
const MID_EXTEND_MAX = 1.05
const TIP_EXTEND_MAX = 0.85

/** 转台相对基姿的摆动半角（弧度），不再无限回转 */
const TURRET_YAW_HALF = 0.7
/** 吊臂俯仰：只允许小幅上扬，禁止压向支座（负向过大易穿模） */
const BOOM_PITCH_AMP = 0.04
const BOOM_PITCH_MIN = -0.02
const BOOM_PITCH_MAX = 0.1
const JOINT_DAMP_RATE = 4.5
const TELESCOPE_DAMP_RATE = 3.5

interface HydraulicLink {
  cylinder: Object3D
  from: Object3D
  to: Object3D
}

/**
 * 汽车吊：支腿落下 → 转台有限角域摆动 / 变幅 / 受限伸缩 / 吊钩；举升缸随臂角更新。
 */
export class CraneActionController implements SceneAnimator {
  public readonly id: string

  private readonly root: Object3D
  private readonly turret: Object3D | null
  private readonly boom: Object3D | null
  private readonly boomMid: Object3D | null
  private readonly boomTip: Object3D | null
  private readonly hook: Object3D | null
  private readonly outriggers: Object3D[]
  private readonly boomHydraulics: HydraulicLink[]
  private readonly hoistCable: Group | null

  private readonly baseTurretY: number
  private readonly baseBoomX: number
  private readonly baseHookY: number

  private playing = false
  private elapsed = 0
  private outriggerProgress = 0

  public constructor(id: string, root: Object3D) {
    this.id = id
    this.root = root
    const joints = resolveJoints(root, ['turret', 'boom', 'boomMid', 'boomTip', 'hook'])
    this.turret = joints.turret
    this.boom = joints.boom
    this.boomMid = joints.boomMid
    this.boomTip = joints.boomTip
    this.hook = joints.hook

    this.outriggers = [0, 1, 2, 3]
      .map((index: number) => resolveJoint(root, `outrigger${index}`))
      .filter((obj): obj is Object3D => obj !== null)

    this.baseTurretY = this.turret?.rotation.y ?? 0
    this.baseBoomX = this.boom?.rotation.x ?? 0
    this.baseHookY = this.hook?.position.y ?? 0
    this.boomHydraulics = this.collectBoomHydraulics()
    const hoistCable = root.getObjectByName('dynamic_crane_hoist_cable')
    this.hoistCable = hoistCable instanceof Group ? hoistCable : null

    this.applyOutriggerProgress(0)
    this.applyTelescope(0)
    this.syncBoomHydraulics()
    this.syncHoistCable()
  }

  public play(): void {
    this.playing = true
    this.elapsed = 0
    this.outriggerProgress = 0
    this.applyOutriggerProgress(0)
    this.applyTelescope(0)
  }

  public stop(): void {
    this.playing = false
    this.elapsed = 0
    this.outriggerProgress = 0
    this.restorePose()
    this.applyOutriggerProgress(0)
    this.applyTelescope(0)
    this.syncBoomHydraulics()
    this.syncHoistCable()
  }

  public isPlaying(): boolean {
    return this.playing
  }

  public update(delta: number): void {
    if (!this.playing) {
      return
    }
    this.elapsed += delta

    if (this.outriggerProgress < 1) {
      this.outriggerProgress = Math.min(1, this.outriggerProgress + delta / OUTRIGGER_DEPLOY_SECONDS)
      this.applyOutriggerProgress(this.outriggerProgress)
    }

    const workT = Math.max(0, this.elapsed - OUTRIGGER_DEPLOY_SECONDS * 0.65)

    if (this.turret) {
      const yaw =
        this.baseTurretY + Math.sin(workT * 0.22) * TURRET_YAW_HALF
      const targetYaw = MathUtils.clamp(
        yaw,
        this.baseTurretY - TURRET_YAW_HALF,
        this.baseTurretY + TURRET_YAW_HALF,
      )
      this.turret.rotation.y = MathUtils.damp(
        this.turret.rotation.y,
        targetYaw,
        JOINT_DAMP_RATE,
        delta,
      )
    }

    if (this.boom) {
      const pitch = this.baseBoomX + Math.sin(workT * 0.4) * BOOM_PITCH_AMP
      const targetPitch = MathUtils.clamp(
        pitch,
        this.baseBoomX + BOOM_PITCH_MIN,
        this.baseBoomX + BOOM_PITCH_MAX,
      )
      this.boom.rotation.x = MathUtils.damp(
        this.boom.rotation.x,
        targetPitch,
        JOINT_DAMP_RATE,
        delta,
      )
      if (this.hook) {
        this.hook.rotation.x = -this.boom.rotation.x
      }
    }

    // 伸缩在 0.15–0.85 区间往复，避免顶满伸出
    const extend = 0.15 + 0.7 * (0.5 + 0.5 * Math.sin(workT * 0.32))
    this.applyTelescope(extend, delta)

    if (this.hook) {
      const targetY = this.baseHookY + Math.sin(workT * 0.7) * 0.06
      this.hook.position.y = MathUtils.damp(
        this.hook.position.y,
        targetY,
        JOINT_DAMP_RATE,
        delta,
      )
    }

    this.syncBoomHydraulics()
    this.syncHoistCable()
  }

  public dispose(): void {
    this.stop()
  }

  private restorePose(): void {
    if (this.turret) {
      this.turret.rotation.y = this.baseTurretY
    }
    if (this.boom) {
      this.boom.rotation.x = this.baseBoomX
    }
    if (this.hook) {
      this.hook.rotation.x = -this.baseBoomX
      this.hook.position.y = this.baseHookY
    }
  }

  private applyOutriggerProgress(t: number): void {
    const eased = t * t * (3 - 2 * t)
    const y = OUTRIGGER_RETRACT_Y + (OUTRIGGER_DEPLOY_Y - OUTRIGGER_RETRACT_Y) * eased
    this.outriggers.forEach((leg: Object3D) => {
      leg.position.y = y
    })
  }

  private applyTelescope(amount01: number, delta?: number): void {
    const a = MathUtils.clamp(amount01, 0, 1)
    if (this.boomMid) {
      const target = MID_EXTEND_MAX * a
      this.boomMid.position.z =
        delta === undefined
          ? target
          : MathUtils.damp(this.boomMid.position.z, target, TELESCOPE_DAMP_RATE, delta)
    }
    if (this.boomTip) {
      const target = TIP_EXTEND_MAX * a
      this.boomTip.position.z =
        delta === undefined
          ? target
          : MathUtils.damp(this.boomTip.position.z, target, TELESCOPE_DAMP_RATE, delta)
    }
  }

  private syncBoomHydraulics(): void {
    if (!this.turret) {
      return
    }
    this.boomHydraulics.forEach((link: HydraulicLink) => {
      updateHydraulicFromAnchors(link.cylinder, link.from, link.to, this.turret as Object3D)
    })
  }

  private collectBoomHydraulics(): HydraulicLink[] {
    const links: HydraulicLink[] = []
    ;(['L', 'R'] as const).forEach((side) => {
      const cylinder = this.root.getObjectByName(`hyd_crane_boom_${side}`)
      const from = this.root.getObjectByName(`anchor_crane_boom_from_${side}`)
      const to = this.root.getObjectByName(`anchor_crane_boom_to_${side}`)
      if (cylinder && from && to) {
        links.push({ cylinder, from, to })
      }
    })
    return links
  }

  private syncHoistCable(): void {
    if (this.hoistCable) {
      updateDynamicCable(this.hoistCable)
    }
  }
}
