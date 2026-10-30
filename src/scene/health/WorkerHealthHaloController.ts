import * as THREE from 'three'
import { SceneObjectType } from '@/enums/SceneObjectType'
import { readSelectableMeta } from '@/scene/utils/objectMeta'
import type { VitalsLevel } from '@/types/vitals'

interface HaloEntry {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  level: VitalsLevel
}

const LEVEL_COLOR: Record<VitalsLevel, number> = {
  normal: 0x4cc9ff,
  warning: 0xffc86a,
  critical: 0xff6b6b,
}

/**
 * 工地工人脚下的健康状态光圈，仅在监测大屏模式显示。
 */
export class WorkerHealthHaloController {
  private readonly root: THREE.Object3D
  private readonly entries = new Map<string, HaloEntry>()
  private visible = false

  public constructor(root: THREE.Object3D) {
    this.root = root
  }

  public apply(levels: Map<string, VitalsLevel>): void {
    this.root.traverse((object: THREE.Object3D): void => {
      const meta = readSelectableMeta(object)
      if (!meta || meta.objectType !== SceneObjectType.Worker || !meta.businessKey) {
        return
      }
      const level = levels.get(meta.businessKey) ?? 'normal'
      const existing = this.entries.get(meta.businessKey)
      if (existing) {
        existing.level = level
        existing.material.color.setHex(LEVEL_COLOR[level])
        existing.mesh.visible = this.visible
        return
      }
      const material = new THREE.MeshBasicMaterial({
        color: LEVEL_COLOR[level],
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.58, 48), material)
      mesh.name = 'WorkerHealthHalo'
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = 0.05
      mesh.visible = this.visible
      object.add(mesh)
      this.entries.set(meta.businessKey, { mesh, material, level })
    })
  }

  public setVisible(visible: boolean): void {
    this.visible = visible
    this.entries.forEach((entry) => {
      entry.mesh.visible = visible
    })
  }

  public update(elapsed: number): void {
    if (!this.visible) {
      return
    }
    this.entries.forEach((entry) => {
      const speed = entry.level === 'critical' ? 3.4 : entry.level === 'warning' ? 2.4 : 1.6
      const pulse = 0.28 + Math.sin(elapsed * speed) * 0.16
      entry.material.opacity = pulse
    })
  }

  public dispose(): void {
    this.entries.forEach((entry) => {
      entry.mesh.parent?.remove(entry.mesh)
      entry.mesh.geometry.dispose()
      entry.material.dispose()
    })
    this.entries.clear()
  }
}
