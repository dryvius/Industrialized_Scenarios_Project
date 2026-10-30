import type { SceneAnimator } from '@/scene/animation/types'
import { MAX_FRAME_DELTA_SECONDS } from '@/constants/animation'

/**
 * 按 objectId 注册可动画实体，主循环统一 update。
 */
export class AnimationRegistry {
  private readonly animators = new Map<string, SceneAnimator>()

  public register(animator: SceneAnimator): void {
    const existing = this.animators.get(animator.id)
    if (existing) {
      existing.dispose()
    }
    this.animators.set(animator.id, animator)
  }

  public get(id: string): SceneAnimator | undefined {
    return this.animators.get(id)
  }

  public has(id: string): boolean {
    return this.animators.has(id)
  }

  public ids(): string[] {
    return [...this.animators.keys()]
  }

  public play(id: string, action?: string): boolean {
    const animator = this.animators.get(id)
    if (!animator) {
      return false
    }
    animator.play(action)
    return true
  }

  public stop(id: string): boolean {
    const animator = this.animators.get(id)
    if (!animator) {
      return false
    }
    animator.stop()
    return true
  }

  public playAll(action?: string): void {
    this.animators.forEach((animator: SceneAnimator) => {
      animator.play(action)
    })
  }

  public stopAll(): void {
    this.animators.forEach((animator: SceneAnimator) => {
      animator.stop()
    })
  }

  public update(delta: number): void {
    const clamped = Math.min(Math.max(delta, 0), MAX_FRAME_DELTA_SECONDS)
    this.animators.forEach((animator: SceneAnimator) => {
      animator.update(clamped)
    })
  }

  public dispose(): void {
    this.animators.forEach((animator: SceneAnimator) => {
      animator.dispose()
    })
    this.animators.clear()
  }
}
