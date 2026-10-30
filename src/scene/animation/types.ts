/** 建造器写入 root.userData 的可动画元数据 */
export interface AnimatableMeta {
  animatable: true
  objectId: string
  /** 逻辑关节名 → Object3D.name */
  joints: Record<string, string>
}

/** play 可选参数；塔上作业可用 target 指定挂点 */
export interface AnimatorPlayOptions {
  loop?: boolean
  /** 杆塔挂点 id，如 mast_mid / arm_lower / arm_upper */
  target?: string
}

/** 场景动画控制器统一接口 */
export interface SceneAnimator {
  readonly id: string
  update(delta: number): void
  play(action?: string, options?: AnimatorPlayOptions): void
  stop(): void
  isPlaying(): boolean
  dispose(): void
}

export type VehicleMotionState = 'idle' | 'accelerating' | 'cruising' | 'braking'
