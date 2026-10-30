import type { SceneAnimator } from '@/scene/animation/types'
import type { ExcavatorActionController } from '@/scene/animation/controllers/ExcavatorActionController'
import type { VehicleMotionController } from '@/scene/animation/controllers/VehicleMotionController'

const TRAVEL_SECONDS = 7.5
const DIG_SECONDS = 5.5

/**
 * 挖机演示编排：行进（收臂）↔ 停车作业，避免边走边挖铲斗扫地/扫人。
 */
export class ExcavatorWorkCycleController implements SceneAnimator {
  public readonly id: string

  private readonly motion: VehicleMotionController
  private readonly action: ExcavatorActionController
  private playing = false
  private phase: 'travel' | 'braking' | 'dig' = 'travel'
  private phaseElapsed = 0

  public constructor(
    id: string,
    motion: VehicleMotionController,
    action: ExcavatorActionController,
  ) {
    this.id = id
    this.motion = motion
    this.action = action
  }

  public play(action?: string, options?: { loop?: boolean }): void {
    this.playing = true
    this.phase = 'travel'
    this.phaseElapsed = 0
    this.enterTravel(action, options)
  }

  public stop(): void {
    this.playing = false
    this.phaseElapsed = 0
    this.phase = 'travel'
    this.motion.stop()
    this.action.stop()
  }

  public isPlaying(): boolean {
    return this.playing
  }

  public update(delta: number): void {
    if (!this.playing) {
      return
    }

    this.phaseElapsed += delta
    if (this.phase === 'travel' && this.phaseElapsed >= TRAVEL_SECONDS) {
      this.phase = 'braking'
      this.phaseElapsed = 0
      this.motion.requestStop()
    } else if (this.phase === 'braking' && this.motion.hasStopped()) {
      this.phase = 'dig'
      this.phaseElapsed = 0
      this.enterDig()
    } else if (this.phase === 'dig' && this.phaseElapsed >= DIG_SECONDS) {
      this.phase = 'travel'
      this.phaseElapsed = 0
      this.enterTravel()
    }

    this.motion.update(delta)
    this.action.update(delta)
  }

  public dispose(): void {
    this.stop()
    this.motion.dispose()
    this.action.dispose()
  }

  private enterTravel(action?: string, options?: { loop?: boolean }): void {
    this.action.setWorkMode('travel')
    this.action.play()
    this.motion.play(action, options)
  }

  private enterDig(): void {
    this.action.setWorkMode('dig')
    this.action.play()
  }
}
