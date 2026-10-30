import type * as RAPIER from '@dimforge/rapier3d-compat'
import type { Object3D, Scene } from 'three'
import { MAX_FRAME_DELTA_SECONDS } from '@/constants/animation'
import { USER_DATA_KEYS } from '@/constants/scene'
import { listMovablePlacements } from '@/scene/layout'
import { DynamicColliderFactory } from '@/scene/physics/colliders/DynamicColliderFactory'
import { StaticColliderFactory } from '@/scene/physics/colliders/StaticColliderFactory'
import { ColliderDebugHelper } from '@/scene/physics/debug/ColliderDebugHelper'
import type { RootPose, RootPoseDriver } from '@/scene/physics/RootPoseDriver'
import type {
  KinematicBinding,
  PhysicsBodyRecord,
  PhysicsWorldOptions,
  RapierModule,
} from '@/scene/physics/types'

/**
 * Rapier 物理世界门面：静态设施 + Kinematic 移动体 + 角色控制器避障。
 */
export class PhysicsWorld {
  private readonly RAPIER: RapierModule
  private readonly world: RAPIER.World
  private readonly characterController: RAPIER.KinematicCharacterController
  private readonly fixedTimeStep: number
  private readonly maxSubSteps: number
  private accumulator = 0
  private readonly bodies = new Map<string, PhysicsBodyRecord>()
  private readonly kinematics = new Map<string, KinematicBinding>()
  private readonly debugHelper: ColliderDebugHelper
  private disposed = false

  private constructor(RAPIER: RapierModule, options: PhysicsWorldOptions = {}) {
    this.RAPIER = RAPIER
    const gravityY = options.gravityY ?? -9.81
    this.world = new RAPIER.World({ x: 0, y: gravityY, z: 0 })
    this.fixedTimeStep = options.fixedTimeStep ?? 1 / 60
    this.maxSubSteps = options.maxSubSteps ?? 5
    this.characterController = this.world.createCharacterController(0.08)
    this.characterController.setSlideEnabled(true)
    this.characterController.setApplyImpulsesToDynamicBodies(false)
    this.characterController.disableAutostep()
    this.characterController.disableSnapToGround()
    // 几乎不允许爬坡，保持示意级贴地平移
    this.characterController.setMaxSlopeClimbAngle(0.2)
    this.characterController.setMinSlopeSlideAngle(Math.PI / 2)
    this.debugHelper = new ColliderDebugHelper()
  }

  public static async create(options?: PhysicsWorldOptions): Promise<PhysicsWorld> {
    const RAPIER = (await import('@dimforge/rapier3d-compat')).default
    await RAPIER.init()
    return new PhysicsWorld(RAPIER, options)
  }

  public get rapier(): RapierModule {
    return this.RAPIER
  }

  public get rawWorld(): RAPIER.World {
    return this.world
  }

  /**
   * 烘焙地面 + 铁塔 / 变电站静态碰撞体，并将调试组挂到场景。
   */
  public bootstrapStatic(scene: Scene): void {
    if (this.disposed) {
      return
    }
    const factory = new StaticColliderFactory(this.RAPIER, this.world)
    this.registerBody(factory.createGround())
    factory.createFacilities().forEach((record: PhysicsBodyRecord) => {
      this.registerBody(record)
    })
    scene.add(this.debugHelper.object)
  }

  /**
   * 为场景中全部车辆 / 工人创建 Kinematic 体并绑定 Object3D。
   */
  public bootstrapKinematics(worldRoot: Object3D): void {
    if (this.disposed) {
      return
    }
    const factory = new DynamicColliderFactory(this.RAPIER, this.world)
    const rootsById = new Map<string, Object3D>()
    worldRoot.traverse((obj: Object3D) => {
      const id = obj.userData[USER_DATA_KEYS.objectId]
      if (typeof id === 'string' && id.length > 0 && !rootsById.has(id)) {
        rootsById.set(id, obj)
      }
    })

    listMovablePlacements().forEach((placement) => {
      const object3d = rootsById.get(placement.id)
      if (!object3d) {
        return
      }
      const spawned = factory.createKinematic(placement, object3d)
      this.registerBody(spawned.record)
      this.kinematics.set(placement.id, {
        id: placement.id,
        rigidBody: spawned.record.rigidBody,
        primaryCollider: spawned.primaryCollider,
        object3d,
        placement,
        desired: null,
      })
      this.debugHelper.addKinematicProxy(placement.id, placement, object3d.rotation.y)
    })
  }

  public createPoseDriver(objectId: string, object3d: Object3D): RootPoseDriver | null {
    const binding = this.kinematics.get(objectId)
    if (!binding) {
      return null
    }
    return {
      getPose: (): RootPose => {
        const t = binding.rigidBody.translation()
        const r = binding.rigidBody.rotation()
        const yaw = Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.y * r.y + r.z * r.z))
        return { x: t.x, z: t.z, yaw }
      },
      setDesiredPose: (x: number, z: number, yaw: number): void => {
        binding.desired = { x, z, yaw, teleport: false }
      },
      teleport: (x: number, z: number, yaw?: number): void => {
        const nextYaw = yaw ?? object3d.rotation.y
        const half = nextYaw * 0.5
        binding.rigidBody.setTranslation({ x, y: 0, z }, true)
        binding.rigidBody.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) }, true)
        binding.desired = { x, z, yaw: nextYaw, teleport: true }
        object3d.position.x = x
        object3d.position.z = z
        object3d.rotation.y = nextYaw
        this.debugHelper.syncKinematic(objectId, x, z, nextYaw)
      },
    }
  }

  public hasKinematic(objectId: string): boolean {
    return this.kinematics.has(objectId)
  }

  /**
   * 应用本帧期望位姿（角色控制器避障）→ 固定步长步进 → 回写 Object3D。
   */
  public step(delta: number): void {
    if (this.disposed) {
      return
    }
    this.applyKinematicTargets()
    const clamped = Math.min(Math.max(delta, 0), MAX_FRAME_DELTA_SECONDS)
    this.accumulator += clamped
    let steps = 0
    while (this.accumulator >= this.fixedTimeStep && steps < this.maxSubSteps) {
      this.world.step()
      this.accumulator -= this.fixedTimeStep
      steps += 1
    }
    if (this.accumulator > this.fixedTimeStep * this.maxSubSteps) {
      this.accumulator = 0
    }
    this.syncKinematicsToThree()
  }

  public setDebugVisible(visible: boolean): void {
    this.debugHelper.setVisible(visible)
  }

  public isDebugVisible(): boolean {
    return this.debugHelper.isVisible()
  }

  public hasBody(id: string): boolean {
    return this.bodies.has(id)
  }

  public getBodyIds(): string[] {
    return [...this.bodies.keys()]
  }

  public dispose(scene?: Scene): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    if (scene) {
      scene.remove(this.debugHelper.object)
    }
    this.debugHelper.dispose()
    this.kinematics.clear()
    this.bodies.clear()
    this.world.removeCharacterController(this.characterController)
    this.world.free()
  }

  private applyKinematicTargets(): void {
    this.kinematics.forEach((binding: KinematicBinding) => {
      const desired = binding.desired
      if (!desired) {
        return
      }
      if (desired.teleport) {
        binding.desired = null
        return
      }

      const current = binding.rigidBody.translation()
      const dx = desired.x - current.x
      const dz = desired.z - current.z
      const desiredDelta = { x: dx, y: 0, z: dz }

      this.characterController.computeColliderMovement(binding.primaryCollider, desiredDelta)
      const movement = this.characterController.computedMovement()

      binding.rigidBody.setNextKinematicTranslation({
        x: current.x + movement.x,
        y: 0,
        z: current.z + movement.z,
      })

      const half = desired.yaw * 0.5
      binding.rigidBody.setNextKinematicRotation({
        x: 0,
        y: Math.sin(half),
        z: 0,
        w: Math.cos(half),
      })

      binding.desired = null
    })
  }

  private syncKinematicsToThree(): void {
    this.kinematics.forEach((binding: KinematicBinding) => {
      const t = binding.rigidBody.translation()
      const r = binding.rigidBody.rotation()
      const yaw = Math.atan2(2 * (r.w * r.y + r.x * r.z), 1 - 2 * (r.y * r.y + r.z * r.z))
      binding.object3d.position.x = t.x
      binding.object3d.position.y = 0
      binding.object3d.position.z = t.z
      binding.object3d.rotation.y = yaw
      this.debugHelper.syncKinematic(binding.id, t.x, t.z, yaw)
    })
  }

  private registerBody(record: PhysicsBodyRecord): void {
    this.bodies.set(record.id, record)
  }
}
