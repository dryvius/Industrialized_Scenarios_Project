import { Group } from 'three'
import type { Object3D } from 'three'
import type { SceneAnimator } from '@/scene/animation/types'
import { updateDynamicCable } from '@/scene/builders/vehicles/shared/dynamicCable'
import { resolveJoint } from '@/scene/utils/animatableMeta'

/**
 * 卷盘车：卷筒旋转 + 牵引头沿本地 +Z 缓移（与角速度粗同步）。
 */
export class SpoolActionController implements SceneAnimator {
  public readonly id: string

  private readonly spool: Object3D | null
  private readonly tractor: Object3D | null
  private readonly spoolSpeed: number
  private readonly tractorBaseZ: number
  private readonly tractorTravel: number
  private readonly cableRuns: Group[]

  private playing = false
  private spoolAngle = 0

  public constructor(
    id: string,
    root: Object3D,
    options?: { spoolSpeed?: number; tractorTravel?: number },
  ) {
    this.id = id
    this.spoolSpeed = options?.spoolSpeed ?? 0.7
    // 前探幅度宜小，避免牵引头探入邻近车辆包围盒
    this.tractorTravel = options?.tractorTravel ?? 0.28
    this.spool = resolveJoint(root, 'spool')
    this.tractor = resolveJoint(root, 'tractor')
    this.tractorBaseZ = this.tractor?.position.z ?? 3.2
    this.cableRuns = ['dynamic_cable_rear', 'dynamic_cable_front']
      .map((name: string) => root.getObjectByName(name))
      .filter((object): object is Group => object instanceof Group)
    this.syncCables()
  }

  public play(): void {
    this.playing = true
  }

  public stop(): void {
    this.playing = false
    this.spoolAngle = 0
    if (this.tractor) {
      this.tractor.position.z = this.tractorBaseZ
    }
    this.syncCables()
  }

  public isPlaying(): boolean {
    return this.playing
  }

  public update(delta: number): void {
    if (!this.playing) {
      return
    }
    this.spoolAngle += this.spoolSpeed * delta
    if (this.spool) {
      this.spool.rotation.x = this.spoolAngle
    }
    if (this.tractor) {
      // 放线时牵引头缓慢前探再回撤，相位与卷筒角速度同步
      const phase = this.spoolAngle * 0.45
      this.tractor.position.z = this.tractorBaseZ + Math.sin(phase) * this.tractorTravel
    }
    this.syncCables()
  }

  public dispose(): void {
    this.stop()
  }

  private syncCables(): void {
    this.cableRuns.forEach((cableRun: Group) => updateDynamicCable(cableRun))
  }
}
