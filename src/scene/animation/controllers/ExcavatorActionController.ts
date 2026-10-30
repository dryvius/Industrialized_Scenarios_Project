import type { Object3D } from 'three'
import { MathUtils } from 'three'
import type { SceneAnimator } from '@/scene/animation/types'
import { updateHydraulicFromAnchors } from '@/scene/builders/vehicles/shared/createHydraulic'
import { resolveJoints } from '@/scene/utils/animatableMeta'

export type ExcavatorWorkMode = 'travel' | 'dig'

interface HydraulicLink {
  cylinder: Object3D
  from: Object3D
  to: Object3D
  space: Object3D
}

/** 相对建造基姿的关节偏置安全域（弧度） */
const JOINT_LIMITS = {
  slew: { min: -0.4, max: 0.4 },
  boom: { min: -0.1, max: 0.22 },
  stick: { min: -0.08, max: 0.2 },
  bucket: { min: -0.15, max: 0.28 },
} as const

/** 行进收臂目标（相对 base） */
const TRAVEL_POSE = {
  slew: 0,
  boom: 0.16,
  stick: 0.1,
  bucket: 0.18,
} as const

/** 作业示意振幅（相对 base，再经 clamp） */
const DIG_AMPLITUDE = {
  slew: 0.32,
  boom: 0.07,
  stick: 0.11,
  bucket: 0.2,
} as const

/**
 * 挖掘机机构：travel 收臂 / dig 作业循环；关节强制 clamp，减轻铲斗埋地。
 */
export class ExcavatorActionController implements SceneAnimator {
  public readonly id: string

  private readonly root: Object3D
  private readonly slew: Object3D | null
  private readonly boom: Object3D | null
  private readonly stick: Object3D | null
  private readonly bucket: Object3D | null
  private readonly hydraulics: HydraulicLink[]

  private readonly baseSlewY: number
  private readonly baseBoomX: number
  private readonly baseStickX: number
  private readonly baseBucketX: number

  private playing = false
  private elapsed = 0
  private mode: ExcavatorWorkMode = 'travel'
  private readonly blendSpeed = 3.2

  public constructor(id: string, root: Object3D) {
    this.id = id
    this.root = root
    const joints = resolveJoints(root, ['slew', 'boom', 'stick', 'bucket'])
    this.slew = joints.slew
    this.boom = joints.boom
    this.stick = joints.stick
    this.bucket = joints.bucket

    this.baseSlewY = this.slew?.rotation.y ?? 0
    this.baseBoomX = this.boom?.rotation.x ?? 0
    this.baseStickX = this.stick?.rotation.x ?? 0
    this.baseBucketX = this.bucket?.rotation.x ?? 0

    this.hydraulics = this.collectHydraulics()
    this.applyTravelImmediate()
    this.syncHydraulics()
  }

  public play(): void {
    this.playing = true
  }

  public stop(): void {
    this.playing = false
    this.elapsed = 0
    this.mode = 'travel'
    this.applyTravelImmediate()
    this.syncHydraulics()
  }

  public isPlaying(): boolean {
    return this.playing
  }

  public getWorkMode(): ExcavatorWorkMode {
    return this.mode
  }

  /** 由作业循环控制器切换：行走收臂 / 停车挖掘 */
  public setWorkMode(mode: ExcavatorWorkMode): void {
    if (this.mode === mode) {
      return
    }
    this.mode = mode
    if (mode === 'dig') {
      this.elapsed = 0
    }
  }

  public update(delta: number): void {
    if (!this.playing) {
      return
    }

    if (this.mode === 'travel') {
      this.blendToward(
        this.baseSlewY + TRAVEL_POSE.slew,
        this.baseBoomX + TRAVEL_POSE.boom,
        this.baseStickX + TRAVEL_POSE.stick,
        this.baseBucketX + TRAVEL_POSE.bucket,
        delta,
      )
    } else {
      this.elapsed += delta
      const t = this.elapsed
      const targetSlew = this.baseSlewY + Math.sin(t * 0.4) * DIG_AMPLITUDE.slew
      const targetBoom = this.baseBoomX + Math.sin(t * 0.5) * DIG_AMPLITUDE.boom
      const targetStick = this.baseStickX + Math.sin(t * 0.65 + 0.4) * DIG_AMPLITUDE.stick
      // 铲斗略抬，避免长时间低于地平面示意
      const targetBucket =
        this.baseBucketX + 0.06 + Math.sin(t * 0.85 + 1.0) * DIG_AMPLITUDE.bucket
      this.blendToward(targetSlew, targetBoom, targetStick, targetBucket, delta)
    }

    this.clampJoints()
    this.syncHydraulics()
  }

  public dispose(): void {
    this.stop()
  }

  private blendToward(
    slewY: number,
    boomX: number,
    stickX: number,
    bucketX: number,
    delta: number,
  ): void {
    if (this.slew) {
      this.slew.rotation.y = MathUtils.damp(
        this.slew.rotation.y,
        slewY,
        this.blendSpeed,
        delta,
      )
    }
    if (this.boom) {
      this.boom.rotation.x = MathUtils.damp(
        this.boom.rotation.x,
        boomX,
        this.blendSpeed,
        delta,
      )
    }
    if (this.stick) {
      this.stick.rotation.x = MathUtils.damp(
        this.stick.rotation.x,
        stickX,
        this.blendSpeed,
        delta,
      )
    }
    if (this.bucket) {
      this.bucket.rotation.x = MathUtils.damp(
        this.bucket.rotation.x,
        bucketX,
        this.blendSpeed,
        delta,
      )
    }
  }

  private clampJoints(): void {
    if (this.slew) {
      this.slew.rotation.y = MathUtils.clamp(
        this.slew.rotation.y,
        this.baseSlewY + JOINT_LIMITS.slew.min,
        this.baseSlewY + JOINT_LIMITS.slew.max,
      )
    }
    if (this.boom) {
      this.boom.rotation.x = MathUtils.clamp(
        this.boom.rotation.x,
        this.baseBoomX + JOINT_LIMITS.boom.min,
        this.baseBoomX + JOINT_LIMITS.boom.max,
      )
    }
    if (this.stick) {
      this.stick.rotation.x = MathUtils.clamp(
        this.stick.rotation.x,
        this.baseStickX + JOINT_LIMITS.stick.min,
        this.baseStickX + JOINT_LIMITS.stick.max,
      )
    }
    if (this.bucket) {
      this.bucket.rotation.x = MathUtils.clamp(
        this.bucket.rotation.x,
        this.baseBucketX + JOINT_LIMITS.bucket.min,
        this.baseBucketX + JOINT_LIMITS.bucket.max,
      )
    }
  }

  private applyTravelImmediate(): void {
    if (this.slew) {
      this.slew.rotation.y = this.baseSlewY + TRAVEL_POSE.slew
    }
    if (this.boom) {
      this.boom.rotation.x = this.baseBoomX + TRAVEL_POSE.boom
    }
    if (this.stick) {
      this.stick.rotation.x = this.baseStickX + TRAVEL_POSE.stick
    }
    if (this.bucket) {
      this.bucket.rotation.x = this.baseBucketX + TRAVEL_POSE.bucket
    }
    this.clampJoints()
  }

  private collectHydraulics(): HydraulicLink[] {
    const links: HydraulicLink[] = []
    const boomSpace = this.slew
    if (boomSpace) {
      ;(['L', 'R'] as const).forEach((side) => {
        const cylinder = this.root.getObjectByName(`hyd_boom_${side}`)
        const from = this.root.getObjectByName(`anchor_boom_from_${side}`)
        const to = this.root.getObjectByName(`anchor_boom_to_${side}`)
        if (cylinder && from && to) {
          links.push({ cylinder, from, to, space: boomSpace })
        }
      })
    }

    const stickSpace = this.stick?.parent ?? null
    const hydStick = this.root.getObjectByName('hyd_stick')
    const stickFrom = this.root.getObjectByName('anchor_stick_from')
    const stickTo = this.root.getObjectByName('anchor_stick_to')
    if (hydStick && stickFrom && stickTo && stickSpace) {
      links.push({ cylinder: hydStick, from: stickFrom, to: stickTo, space: stickSpace })
    }

    const bucketSpace = this.stick
    const hydBucket = this.root.getObjectByName('hyd_bucket')
    const bucketFrom = this.root.getObjectByName('anchor_bucket_from')
    const bucketTo = this.root.getObjectByName('anchor_bucket_to')
    if (hydBucket && bucketFrom && bucketTo && bucketSpace) {
      links.push({ cylinder: hydBucket, from: bucketFrom, to: bucketTo, space: bucketSpace })
    }

    return links
  }

  private syncHydraulics(): void {
    this.hydraulics.forEach((link: HydraulicLink) => {
      updateHydraulicFromAnchors(link.cylinder, link.from, link.to, link.space)
    })
  }
}
