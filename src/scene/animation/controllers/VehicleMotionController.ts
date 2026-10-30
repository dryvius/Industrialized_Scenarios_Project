import * as THREE from 'three'
import type { SceneAnimator, VehicleMotionState } from '@/scene/animation/types'
import { isTrackSprocket, readTrackShoe } from '@/scene/builders/vehicles/shared/trackAnim'
import type { TrackShoeMeta } from '@/scene/builders/vehicles/shared/trackAnim'
import type { RootPoseDriver } from '@/scene/physics'
import { resolveJoint } from '@/scene/utils/animatableMeta'

interface TrackShoeTarget {
  object: THREE.Object3D
  metadata: TrackShoeMeta
}

interface TrackAnimationTargets {
  sprockets: THREE.Object3D[]
  shoes: TrackShoeTarget[]
}

export interface VehicleMotionOptions {
  id: string
  root: THREE.Object3D
  /** 世界坐标路径点（y 忽略，贴地） */
  path: Array<{ x: number; z: number }>
  /** 巡航速度 m/s */
  cruiseSpeed?: number
  /** 车轮/链轮半径，用于滚动换算 */
  wheelRadius?: number
  /** 逻辑轮名列表 */
  wheelJointNames?: string[]
  /** 履带逻辑名（如 trackL / trackR） */
  trackJointNames?: string[]
  loop?: boolean
  /** 有物理时注入：逻辑位姿 → Kinematic 目标 */
  poseDriver?: RootPoseDriver | null
}

/**
 * 车辆沿折线路径启停行进；可选驱动车轮滚动或履带滚动。
 * 约定车辆本地 +Z 为车头朝向。
 * 位姿经 poseDriver 提交时，由物理角色控制器裁决后再回写 root。
 */
export class VehicleMotionController implements SceneAnimator {
  public readonly id: string

  private readonly root: THREE.Object3D
  private readonly path: THREE.Vector2[]
  private readonly cruiseSpeed: number
  private readonly wheelRadius: number
  private readonly wheels: THREE.Object3D[]
  private readonly trackTargets: TrackAnimationTargets[]
  private readonly loopPath: boolean
  private readonly poseDriver: RootPoseDriver | null
  private readonly turnRate: number

  private playing = false
  private state: VehicleMotionState = 'idle'
  private segmentIndex = 0
  private speed = 0
  private readonly accel = 2.2
  private readonly brake = 3.5
  private readonly tmpDir = new THREE.Vector2()
  private readonly tmpPos = new THREE.Vector2()
  private readonly lastActualPosition = new THREE.Vector2()
  private hasActualPosition = false

  public constructor(options: VehicleMotionOptions) {
    this.id = options.id
    this.root = options.root
    this.path = options.path.map((p) => new THREE.Vector2(p.x, p.z))
    this.cruiseSpeed = options.cruiseSpeed ?? 4.5
    this.wheelRadius = options.wheelRadius ?? 0.55
    this.loopPath = options.loop ?? true
    this.poseDriver = options.poseDriver ?? null
    this.turnRate = 5.5

    const wheelNames = options.wheelJointNames ?? []
    this.wheels = wheelNames
      .map((name: string) => resolveJoint(this.root, name))
      .filter((obj): obj is THREE.Object3D => obj !== null)

    const trackNames = options.trackJointNames ?? []
    const tracks = trackNames
      .map((name: string) => resolveJoint(this.root, name))
      .filter((obj): obj is THREE.Object3D => obj !== null)
    this.trackTargets = tracks.map(
      (track: THREE.Object3D): TrackAnimationTargets => this.collectTrackTargets(track),
    )

    if (this.path.length >= 1) {
      this.teleportTo(this.path[0].x, this.path[0].y, this.root.rotation.y)
    }
  }

  public play(_action?: string, _options?: { loop?: boolean }): void {
    if (this.path.length < 2) {
      return
    }
    this.playing = true
    this.state = 'accelerating'
    if (this.segmentIndex >= this.path.length - 1) {
      this.segmentIndex = 0
      this.teleportTo(this.path[0].x, this.path[0].y, this.root.rotation.y)
    }
  }

  public stop(): void {
    this.playing = false
    this.state = 'idle'
    this.speed = 0
  }

  public requestStop(): void {
    if (!this.playing || this.state === 'idle') {
      return
    }
    this.state = 'braking'
  }

  public hasStopped(): boolean {
    return this.state === 'idle' && this.speed <= 0.01
  }

  public getCurrentSpeed(): number {
    return this.speed
  }

  public isPlaying(): boolean {
    return this.playing
  }

  public update(delta: number): void {
    if (!this.playing || this.path.length < 2) {
      return
    }

    if (this.state === 'accelerating') {
      this.speed = Math.min(this.cruiseSpeed, this.speed + this.accel * delta)
      if (this.speed >= this.cruiseSpeed - 0.01) {
        this.state = 'cruising'
        this.speed = this.cruiseSpeed
      }
    } else if (this.state === 'braking') {
      this.speed = Math.max(0, this.speed - this.brake * delta)
      if (this.speed <= 0.01) {
        this.speed = 0
        this.state = 'idle'
        this.playing = false
      }
    }

    const pose = this.readPose()
    const actualTravel = this.measureActualTravel(pose.x, pose.z)
    let logicalX = pose.x
    let logicalZ = pose.z
    let logicalYaw = pose.yaw
    let targetYaw = pose.yaw
    let teleported = false

    let remaining = this.speed * delta
    while (remaining > 0 && this.segmentIndex < this.path.length - 1) {
      const from = this.path[this.segmentIndex]
      const to = this.path[this.segmentIndex + 1]
      this.tmpPos.set(logicalX, logicalZ)
      this.tmpDir.copy(to).sub(from)
      const segLen = this.tmpDir.length()
      if (segLen < 1e-4) {
        this.segmentIndex += 1
        continue
      }
      this.tmpDir.multiplyScalar(1 / segLen)

      const distToEnd = this.tmpPos.distanceTo(to)
      if (remaining >= distToEnd) {
        logicalX = to.x
        logicalZ = to.y
        remaining -= distToEnd
        this.segmentIndex += 1
        targetYaw = this.yawFromDir(this.tmpDir)
        if (this.segmentIndex >= this.path.length - 1) {
          if (this.loopPath) {
            this.segmentIndex = 0
            logicalX = this.path[0].x
            logicalZ = this.path[0].y
            this.teleportTo(logicalX, logicalZ, targetYaw)
            teleported = true
          } else {
            this.state = 'braking'
          }
        }
      } else {
        logicalX += this.tmpDir.x * remaining
        logicalZ += this.tmpDir.y * remaining
        targetYaw = this.yawFromDir(this.tmpDir)
        remaining = 0
      }
    }

    if (!teleported) {
      logicalYaw = this.dampAngle(logicalYaw, targetYaw, this.turnRate, delta)
      this.commitPose(logicalX, logicalZ, logicalYaw)
    }

    // 物理驱动时使用上一帧回写的真实位移，避免受阻后轮履带继续空转。
    const travel = this.poseDriver
      ? actualTravel
      : Math.hypot(logicalX - pose.x, logicalZ - pose.z)
    const roll = travel / this.wheelRadius
    this.wheels.forEach((wheel: THREE.Object3D) => {
      wheel.rotation.x += roll
    })
    this.updateTracks(travel, roll)
  }

  public dispose(): void {
    this.stop()
  }

  private readPose(): { x: number; z: number; yaw: number } {
    if (this.poseDriver) {
      return this.poseDriver.getPose()
    }
    return {
      x: this.root.position.x,
      z: this.root.position.z,
      yaw: this.root.rotation.y,
    }
  }

  private commitPose(x: number, z: number, yaw: number): void {
    if (this.poseDriver) {
      this.poseDriver.setDesiredPose(x, z, yaw)
      return
    }
    this.root.position.x = x
    this.root.position.z = z
    this.root.rotation.y = yaw
  }

  private teleportTo(x: number, z: number, yaw: number): void {
    this.lastActualPosition.set(x, z)
    this.hasActualPosition = true
    if (this.poseDriver) {
      this.poseDriver.teleport(x, z, yaw)
      return
    }
    this.root.position.x = x
    this.root.position.z = z
    this.root.rotation.y = yaw
  }

  private yawFromDir(dir: THREE.Vector2): number {
    if (dir.lengthSq() < 1e-8) {
      return this.readPose().yaw
    }
    return Math.atan2(dir.x, dir.y)
  }

  private dampAngle(current: number, target: number, rate: number, delta: number): number {
    const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current))
    return current + difference * (1 - Math.exp(-rate * delta))
  }

  private measureActualTravel(x: number, z: number): number {
    if (!this.hasActualPosition) {
      this.lastActualPosition.set(x, z)
      this.hasActualPosition = true
      return 0
    }
    const distance = Math.hypot(x - this.lastActualPosition.x, z - this.lastActualPosition.y)
    this.lastActualPosition.set(x, z)
    return distance
  }

  private collectTrackTargets(track: THREE.Object3D): TrackAnimationTargets {
    const targets: TrackAnimationTargets = { sprockets: [], shoes: [] }
    track.traverse((object: THREE.Object3D) => {
      if (isTrackSprocket(object)) {
        targets.sprockets.push(object)
      }
      const metadata = readTrackShoe(object)
      if (metadata) {
        targets.shoes.push({ object, metadata })
      }
    })
    return targets
  }

  /** 履带：链轮/支重轮旋转；上下履带板沿 Z 循环滚动 */
  private updateTracks(travel: number, roll: number): void {
    if (travel <= 0 || this.trackTargets.length === 0) {
      return
    }
    this.trackTargets.forEach((targets: TrackAnimationTargets) => {
      targets.sprockets.forEach((sprocket: THREE.Object3D) => {
        sprocket.rotation.x += roll
      })
      targets.shoes.forEach(({ object, metadata }: TrackShoeTarget) => {
        const dir = metadata.lane === 'bottom' ? -1 : 1
        object.position.z += dir * travel
        const span = metadata.zMax - metadata.zMin
        if (span <= 1e-4) {
          return
        }
        while (object.position.z > metadata.zMax) {
          object.position.z -= span
        }
        while (object.position.z < metadata.zMin) {
          object.position.z += span
        }
      })
    })
  }
}
