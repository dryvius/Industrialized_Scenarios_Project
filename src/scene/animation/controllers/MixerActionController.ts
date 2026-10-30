import type { Object3D } from 'three'
import type { SceneAnimator } from '@/scene/animation/types'
import { resolveJoints } from '@/scene/utils/animatableMeta'

/**
 * 搅拌车：滚筒绕筒轴持续旋转 + 出料槽小幅摆动。
 */
export class MixerActionController implements SceneAnimator {
  public readonly id: string

  private readonly drum: Object3D | null
  private readonly chute: Object3D | null
  private readonly pinion: Object3D | null

  private readonly baseChuteY: number
  private readonly drumSpeed: number

  private playing = false
  private elapsed = 0

  public constructor(id: string, root: Object3D, drumSpeed = 0.9) {
    this.id = id
    this.drumSpeed = drumSpeed
    const joints = resolveJoints(root, ['drum', 'chute'])
    this.drum = joints.drum
    this.chute = joints.chute
    this.pinion = root.getObjectByName('joint_mixer_pinion') ?? null
    this.baseChuteY = this.chute?.rotation.y ?? 0
  }

  public play(): void {
    this.playing = true
  }

  public stop(): void {
    this.playing = false
    this.elapsed = 0
    if (this.chute) {
      this.chute.rotation.y = this.baseChuteY
    }
  }

  public isPlaying(): boolean {
    return this.playing
  }

  public update(delta: number): void {
    if (!this.playing) {
      return
    }
    this.elapsed += delta
    if (this.drum) {
      // 筒轴沿 drumGroup 本地 Z（子网格已绕 X 躺倒）
      this.drum.rotation.z += this.drumSpeed * delta
    }
    if (this.pinion) {
      this.pinion.rotation.x -= this.drumSpeed * 1.8 * delta
    }
    if (this.chute) {
      this.chute.rotation.y = this.baseChuteY + Math.sin(this.elapsed * 0.6) * 0.12
    }
  }

  public dispose(): void {
    this.stop()
  }
}
