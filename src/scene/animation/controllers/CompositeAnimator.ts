import type { SceneAnimator } from '@/scene/animation/types'

/**
 * 将多个控制器合并为同一 objectId 下的复合动画（如履带行进 + 机构动作）。
 */
export class CompositeAnimator implements SceneAnimator {
  public readonly id: string
  private readonly children: SceneAnimator[]

  public constructor(id: string, children: SceneAnimator[]) {
    this.id = id
    this.children = children
  }

  public play(action?: string, options?: { loop?: boolean }): void {
    this.children.forEach((child: SceneAnimator) => {
      child.play(action, options)
    })
  }

  public stop(): void {
    this.children.forEach((child: SceneAnimator) => {
      child.stop()
    })
  }

  public isPlaying(): boolean {
    return this.children.some((child: SceneAnimator) => child.isPlaying())
  }

  public update(delta: number): void {
    this.children.forEach((child: SceneAnimator) => {
      child.update(delta)
    })
  }

  public dispose(): void {
    this.children.forEach((child: SceneAnimator) => {
      child.dispose()
    })
  }
}
