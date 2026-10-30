import type RAPIER from '@dimforge/rapier3d-compat'
import type { BoxColliderDesc, EntityPlacement } from '@/scene/layout'
import { getFacilityOrientations, listStaticFacilityPlacements, SITE_LAYOUT } from '@/scene/layout'
import type { PhysicsBodyRecord, RapierModule } from '@/scene/physics/types'

/**
 * 由 SITE_LAYOUT 生成地面与静态设施 Fixed 刚体。
 */
export class StaticColliderFactory {
  public constructor(
    private readonly RAPIER: RapierModule,
    private readonly world: RAPIER.World,
  ) {}

  public createGround(): PhysicsBodyRecord {
    const { halfX, halfY, halfZ } = SITE_LAYOUT.ground
    // 顶面略低于 y=0，避免与贴地 Kinematic 盒底面共面粘连
    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(0, -halfY - 0.05, 0)
    const body = this.world.createRigidBody(bodyDesc)
    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ)
      .setFriction(0.85)
      .setRestitution(0.05)
    const collider = this.world.createCollider(colliderDesc, body)
    return { id: 'ground', rigidBody: body, colliders: [collider] }
  }

  public createFacilities(): PhysicsBodyRecord[] {
    const { pylonRotY, subRotY } = getFacilityOrientations()
    return listStaticFacilityPlacements().map((placement: EntityPlacement) => {
      const rotY = placement.id === 'pylon_01' ? pylonRotY : subRotY
      return this.createFacilityBody(placement, rotY)
    })
  }

  private createFacilityBody(placement: EntityPlacement, rotationY: number): PhysicsBodyRecord {
    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(
      placement.x,
      0,
      placement.z,
    )
    // Rapier 四元数：绕 Y
    const half = rotationY * 0.5
    bodyDesc.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) })
    const body = this.world.createRigidBody(bodyDesc)

    const colliders = placement.colliders.map((desc: BoxColliderDesc) => {
      const offsetY = desc.offsetY ?? desc.halfY
      const offsetX = desc.offsetX ?? 0
      const offsetZ = desc.offsetZ ?? 0
      const colliderDesc = this.RAPIER.ColliderDesc.cuboid(desc.halfX, desc.halfY, desc.halfZ)
        .setTranslation(offsetX, offsetY, offsetZ)
        .setFriction(0.8)
        .setRestitution(0.02)
      return this.world.createCollider(colliderDesc, body)
    })

    return { id: placement.id, rigidBody: body, colliders }
  }
}
