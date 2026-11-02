import * as THREE from 'three'

export interface VirusWireframeHandle {
  root: THREE.Object3D
  dispose: () => void
}

/**
 * 将网格树转为线框树（WireframeGeometry），对齐效果图「线连结构」而非点云。
 */
export function createVirusWireframe(
  source: THREE.Object3D,
  material: THREE.LineBasicMaterial,
): VirusWireframeHandle {
  const ownedGeometries: THREE.BufferGeometry[] = []
  const root = cloneAsWireframe(source, material, ownedGeometries)
  root.name = 'virus-wireframe-root'

  return {
    root,
    dispose: (): void => {
      for (const geometry of ownedGeometries) {
        geometry.dispose()
      }
      ownedGeometries.length = 0
    },
  }
}

function cloneAsWireframe(
  source: THREE.Object3D,
  material: THREE.LineBasicMaterial,
  ownedGeometries: THREE.BufferGeometry[],
): THREE.Object3D {
  const sourceMesh = source as THREE.Mesh
  if (sourceMesh.isMesh && sourceMesh.geometry) {
    const wireGeometry = new THREE.WireframeGeometry(sourceMesh.geometry)
    ownedGeometries.push(wireGeometry)
    const lines = new THREE.LineSegments(wireGeometry, material)
    lines.name = `${source.name || 'mesh'}-wire`
    lines.frustumCulled = false
    lines.position.copy(source.position)
    lines.quaternion.copy(source.quaternion)
    lines.scale.copy(source.scale)
    for (const child of source.children) {
      lines.add(cloneAsWireframe(child, material, ownedGeometries))
    }
    return lines
  }

  const group = new THREE.Group()
  group.name = `${source.name || 'node'}-wire`
  group.position.copy(source.position)
  group.quaternion.copy(source.quaternion)
  group.scale.copy(source.scale)
  for (const child of source.children) {
    group.add(cloneAsWireframe(child, material, ownedGeometries))
  }
  return group
}
