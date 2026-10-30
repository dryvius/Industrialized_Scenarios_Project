/**
 * 根节点 XZ/朝向的读写抽象。
 * 有物理时：期望位姿写入 PhysicsWorld，权威位姿由刚体回读；
 * 无物理时：直接读写 Object3D。
 */
export interface RootPose {
  x: number
  z: number
  yaw: number
}

export interface RootPoseDriver {
  getPose(): RootPose
  /** 提出本帧期望位姿（物理步进后裁决并回写） */
  setDesiredPose(x: number, z: number, yaw: number): void
  /** 瞬间传送（路径循环首点），立即生效 */
  teleport(x: number, z: number, yaw?: number): void
}
