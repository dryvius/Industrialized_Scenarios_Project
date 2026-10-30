import * as THREE from 'three'
import type { SceneSelectionPayload } from '@/types/scene'
import { findSelectableRoot, readSelectableMeta } from '@/scene/utils/objectMeta'

export interface SelectionFocusInfo {
  center: THREE.Vector3
  size: THREE.Vector3
}

/**
 * 点击拾取与选中地面光圈；选中时回调聚焦信息。
 * 光圈按首次包围盒定位后挂在选中对象下，随对象层级自然移动。
 */
export class InteractionManager {
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly container: HTMLElement
  private readonly camera: THREE.Camera
  private readonly root: THREE.Object3D
  private readonly onSelect: (payload: SceneSelectionPayload | null) => void
  private readonly onFocus: ((info: SelectionFocusInfo) => void) | null

  private selected: THREE.Object3D | null = null
  private halo: THREE.Group | null = null
  private ringMaterials: THREE.MeshBasicMaterial[] = []
  private boundClick: ((event: MouseEvent) => void) | null = null
  private readonly clock = new THREE.Clock()
  private readonly tmpCenter = new THREE.Vector3()
  private readonly tmpSize = new THREE.Vector3()
  private readonly tmpBox = new THREE.Box3()

  public constructor(
    container: HTMLElement,
    camera: THREE.Camera,
    root: THREE.Object3D,
    onSelect: (payload: SceneSelectionPayload | null) => void,
    onFocus: ((info: SelectionFocusInfo) => void) | null = null,
  ) {
    this.container = container
    this.camera = camera
    this.root = root
    this.onSelect = onSelect
    this.onFocus = onFocus
  }

  public bind(): void {
    this.boundClick = (event: MouseEvent): void => {
      this.handleClick(event)
    }
    this.container.addEventListener('click', this.boundClick)
  }

  public update(): void {
    if (!this.halo || this.ringMaterials.length === 0) {
      return
    }
    const t = this.clock.getElapsedTime()
    const pulse = 0.45 + Math.sin(t * 2.6) * 0.18
    this.ringMaterials.forEach((material: THREE.MeshBasicMaterial, index: number) => {
      material.opacity = index === 0 ? pulse : pulse * 0.55
    })
  }

  public selectByBusinessKey(businessKey: string): boolean {
    let found: THREE.Object3D | null = null
    this.root.traverse((object: THREE.Object3D): void => {
      if (found) {
        return
      }
      const meta = readSelectableMeta(object)
      if (meta?.businessKey === businessKey) {
        found = object
      }
    })
    if (!found) {
      return false
    }
    this.applySelection(found)
    return true
  }

  public clearSelection(): void {
    this.removeHalo()
    this.selected = null
    this.onSelect(null)
  }

  public dispose(): void {
    if (this.boundClick) {
      this.container.removeEventListener('click', this.boundClick)
      this.boundClick = null
    }
    this.removeHalo()
    this.selected = null
  }

  private handleClick(event: MouseEvent): void {
    const rect = this.container.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.pointer, this.camera)
    const intersects = this.raycaster.intersectObjects(this.root.children, true)
    if (intersects.length === 0) {
      this.clearSelection()
      return
    }

    const selectable = findSelectableRoot(intersects[0].object)
    if (!selectable) {
      this.clearSelection()
      return
    }

    if (this.isHaloObject(intersects[0].object)) {
      return
    }

    this.applySelection(selectable)
  }

  private applySelection(selectable: THREE.Object3D): void {
    if (this.selected === selectable) {
      this.focusSelected(selectable)
      return
    }

    this.removeHalo()
    this.selected = selectable
    this.applyHalo(selectable)
    this.focusSelected(selectable)

    const meta = readSelectableMeta(selectable)
    if (!meta) {
      return
    }

    selectable.getWorldPosition(this.tmpCenter)
    this.onSelect({
      objectId: meta.objectId,
      objectType: meta.objectType,
      label: meta.label,
      businessKey: meta.businessKey,
      worldPosition: { x: this.tmpCenter.x, y: this.tmpCenter.y, z: this.tmpCenter.z },
    })
  }

  private focusSelected(object: THREE.Object3D): void {
    if (!this.onFocus) {
      return
    }
    if (!this.computeObjectBounds(object)) {
      return
    }
    this.onFocus({ center: this.tmpCenter.clone(), size: this.tmpSize.clone() })
  }

  /** 计算包围盒时临时摘掉光圈，避免光圈自身撑大范围 */
  private computeObjectBounds(object: THREE.Object3D): boolean {
    const haloParent = this.halo?.parent === object ? object : null
    if (haloParent && this.halo) {
      haloParent.remove(this.halo)
    }
    this.tmpBox.setFromObject(object)
    if (haloParent && this.halo) {
      haloParent.add(this.halo)
    }
    if (this.tmpBox.isEmpty()) {
      return false
    }
    this.tmpBox.getSize(this.tmpSize)
    this.tmpBox.getCenter(this.tmpCenter)
    return true
  }

  private isHaloObject(object: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object
    while (current) {
      if (current.name === 'SelectionHalo' || current.name === 'WorkerHealthHalo') {
        return true
      }
      current = current.parent
    }
    return false
  }

  private applyHalo(object: THREE.Object3D): void {
    if (!this.computeObjectBounds(object)) {
      return
    }
    // 转到选中对象本地，使光圈随对象移动/转向
    object.worldToLocal(this.tmpCenter)

    const halo = new THREE.Group()
    halo.name = 'SelectionHalo'

    const baseRadius = Math.max(this.tmpSize.x, this.tmpSize.z) * 0.55 + 0.6
    const innerRing = this.createGroundRing(baseRadius * 0.78, baseRadius, 0x5bbcff, 0.55)
    innerRing.position.set(this.tmpCenter.x, 0.06, this.tmpCenter.z)
    innerRing.name = 'SelectionRingInner'
    halo.add(innerRing)

    const outerRing = this.createGroundRing(baseRadius * 1.08, baseRadius * 1.22, 0x8fd0ff, 0.28)
    outerRing.position.set(this.tmpCenter.x, 0.05, this.tmpCenter.z)
    outerRing.name = 'SelectionRingOuter'
    halo.add(outerRing)

    object.add(halo)
    this.halo = halo
    this.clock.start()
  }

  private createGroundRing(
    innerRadius: number,
    outerRadius: number,
    color: number,
    opacity: number,
  ): THREE.Mesh {
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 72)
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    this.ringMaterials.push(material)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    return mesh
  }

  private removeHalo(): void {
    if (!this.halo) {
      this.ringMaterials = []
      return
    }

    this.halo.traverse((child: THREE.Object3D) => {
      if (!(child instanceof THREE.Mesh)) {
        return
      }
      child.geometry.dispose()
      const material = child.material
      if (Array.isArray(material)) {
        material.forEach((item: THREE.Material) => item.dispose())
        return
      }
      material.dispose()
    })

    this.halo.parent?.remove(this.halo)
    this.halo = null
    this.ringMaterials = []
  }
}
