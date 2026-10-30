import * as THREE from 'three'
import type { BoxColliderDesc, EntityPlacement } from '@/scene/layout'
import { getFacilityOrientations, listStaticFacilityPlacements, SITE_LAYOUT } from '@/scene/layout'

interface KinematicDebugEntry {
  group: THREE.Group
  placement: EntityPlacement
}

/**
 * 开发期碰撞体线框（与 SITE_LAYOUT 代理体对齐，不读 Rapier 内部形状）。
 */
export class ColliderDebugHelper {
  private readonly root = new THREE.Group()
  private readonly geometries: THREE.BufferGeometry[] = []
  private readonly materials: THREE.Material[] = []
  private readonly kinematicEntries = new Map<string, KinematicDebugEntry>()
  private kinematicMat: THREE.LineBasicMaterial | null = null
  private visible = false

  public constructor() {
    this.root.name = 'PhysicsColliderDebug'
    this.root.visible = false
    this.buildStatic()
  }

  public get object(): THREE.Group {
    return this.root
  }

  public setVisible(visible: boolean): void {
    this.visible = visible
    this.root.visible = visible
  }

  public isVisible(): boolean {
    return this.visible
  }

  public addKinematicProxy(id: string, placement: EntityPlacement, rotationY: number): void {
    if (this.kinematicEntries.has(id)) {
      return
    }
    if (!this.kinematicMat) {
      this.kinematicMat = this.createLineMaterial(0x66bb6a)
    }
    const group = new THREE.Group()
    group.name = `dbg_${id}`
    placement.colliders.forEach((desc: BoxColliderDesc) => {
      const offsetY = desc.offsetY ?? desc.halfY
      const offsetX = desc.offsetX ?? 0
      const offsetZ = desc.offsetZ ?? 0
      const lines = this.createBoxLines(
        desc.halfX * 2,
        desc.halfY * 2,
        desc.halfZ * 2,
        this.kinematicMat as THREE.LineBasicMaterial,
      )
      lines.position.set(offsetX, offsetY, offsetZ)
      group.add(lines)
    })
    group.position.set(placement.x, 0, placement.z)
    group.rotation.y = rotationY
    this.root.add(group)
    this.kinematicEntries.set(id, { group, placement })
  }

  public syncKinematic(id: string, x: number, z: number, yaw: number): void {
    const entry = this.kinematicEntries.get(id)
    if (!entry) {
      return
    }
    entry.group.position.set(x, 0, z)
    entry.group.rotation.y = yaw
  }

  public dispose(): void {
    this.root.clear()
    this.kinematicEntries.clear()
    this.geometries.forEach((g: THREE.BufferGeometry) => {
      g.dispose()
    })
    this.materials.forEach((m: THREE.Material) => {
      m.dispose()
    })
    this.geometries.length = 0
    this.materials.length = 0
    this.kinematicMat = null
  }

  private buildStatic(): void {
    const groundMat = this.createLineMaterial(0x4fc3f7)
    const facilityMat = this.createLineMaterial(0xff7043)

    const g = SITE_LAYOUT.ground
    const ground = this.createBoxLines(g.halfX * 2, g.halfY * 2, g.halfZ * 2, groundMat)
    ground.position.set(0, -g.halfY, 0)
    this.root.add(ground)

    const { pylonRotY, subRotY } = getFacilityOrientations()
    listStaticFacilityPlacements().forEach((placement: EntityPlacement) => {
      const rotY = placement.id === 'pylon_01' ? pylonRotY : subRotY
      placement.colliders.forEach((desc: BoxColliderDesc) => {
        const offsetY = desc.offsetY ?? desc.halfY
        const offsetX = desc.offsetX ?? 0
        const offsetZ = desc.offsetZ ?? 0
        const local = new THREE.Vector3(offsetX, offsetY, offsetZ)
        local.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
        const lines = this.createBoxLines(
          desc.halfX * 2,
          desc.halfY * 2,
          desc.halfZ * 2,
          facilityMat,
        )
        lines.position.set(placement.x + local.x, local.y, placement.z + local.z)
        lines.rotation.y = rotY
        this.root.add(lines)
      })
    })
  }

  private createLineMaterial(color: number): THREE.LineBasicMaterial {
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      depthTest: true,
    })
    this.materials.push(mat)
    return mat
  }

  private createBoxLines(
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    material: THREE.LineBasicMaterial,
  ): THREE.LineSegments {
    const box = new THREE.BoxGeometry(sizeX, sizeY, sizeZ)
    const geo = new THREE.EdgesGeometry(box)
    box.dispose()
    this.geometries.push(geo)
    return new THREE.LineSegments(geo, material)
  }
}
