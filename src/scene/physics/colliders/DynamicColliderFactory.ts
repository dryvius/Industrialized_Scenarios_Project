import type RAPIER from '@dimforge/rapier3d-compat'
import type { Object3D } from 'three'
import type { BoxColliderDesc, EntityPlacement } from '@/scene/layout'
import type { PhysicsBodyRecord, RapierModule } from '@/scene/physics/types'

export interface KinematicSpawnResult {
  record: PhysicsBodyRecord
  /** 主碰撞体（角色控制器用） */
  primaryCollider: RAPIER.Collider
}

/**
 * 由 SITE_LAYOUT 代理描述创建 KinematicPositionBased 刚体。
 */
export class DynamicColliderFactory {
  public constructor(
    private readonly RAPIER: RapierModule,
    private readonly world: RAPIER.World,
  ) {}

  public createKinematic(placement: EntityPlacement, object3d: Object3D): KinematicSpawnResult {
    const x = object3d.position.x
    const z = object3d.position.z
    const yaw = object3d.rotation.y
    const halfYaw = yaw * 0.5

    const bodyDesc = this.RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(x, 0, z)
      .setRotation({ x: 0, y: Math.sin(halfYaw), z: 0, w: Math.cos(halfYaw) })
      .setCanSleep(false)
      .setCcdEnabled(true)

    const body = this.world.createRigidBody(bodyDesc)
    const colliders: RAPIER.Collider[] = []

    placement.colliders.forEach((desc: BoxColliderDesc) => {
      const offsetY = desc.offsetY ?? desc.halfY
      const offsetX = desc.offsetX ?? 0
      const offsetZ = desc.offsetZ ?? 0
      const colliderDesc = this.RAPIER.ColliderDesc.cuboid(desc.halfX, desc.halfY, desc.halfZ)
        .setTranslation(offsetX, offsetY, offsetZ)
        .setFriction(0.75)
        .setRestitution(0.02)
        .setDensity(0)
      colliders.push(this.world.createCollider(colliderDesc, body))
    })

    if (colliders.length === 0) {
      throw new Error(`Kinematic body ${placement.id} has no colliders`)
    }

    return {
      record: { id: placement.id, rigidBody: body, colliders },
      primaryCollider: colliders[0],
    }
  }
}
