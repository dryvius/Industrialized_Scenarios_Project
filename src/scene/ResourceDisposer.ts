import type * as THREE from 'three'

/**
 * 统一释放几何体、材质、纹理与渲染器资源。
 */
export class ResourceDisposer {
  private readonly geometries = new Set<THREE.BufferGeometry>()
  private readonly materials = new Set<THREE.Material>()
  private readonly textures = new Set<THREE.Texture>()

  public trackGeometry(geometry: THREE.BufferGeometry): void {
    this.geometries.add(geometry)
  }

  public trackMaterial(material: THREE.Material | THREE.Material[]): void {
    if (Array.isArray(material)) {
      material.forEach((item: THREE.Material) => this.materials.add(item))
      return
    }
    this.materials.add(material)
  }

  public trackTexture(texture: THREE.Texture): void {
    this.textures.add(texture)
  }

  /** 仅收集几何体与非共享材质（跳过已被 MaterialFactory 管理的材质可在外部处理） */
  public trackObject3D(root: THREE.Object3D, trackMaterials = false): void {
    root.traverse((object: THREE.Object3D) => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) {
        return
      }
      if (mesh.geometry) {
        this.geometries.add(mesh.geometry)
      }
      if (trackMaterials && mesh.material) {
        this.trackMaterial(mesh.material)
      }
    })
  }

  public disposeAll(renderer?: THREE.WebGLRenderer): void {
    this.geometries.forEach((geometry: THREE.BufferGeometry) => geometry.dispose())
    this.materials.forEach((material: THREE.Material) => material.dispose())
    this.textures.forEach((texture: THREE.Texture) => texture.dispose())
    this.geometries.clear()
    this.materials.clear()
    this.textures.clear()

    if (renderer) {
      renderer.dispose()
      renderer.forceContextLoss()
    }
  }
}
