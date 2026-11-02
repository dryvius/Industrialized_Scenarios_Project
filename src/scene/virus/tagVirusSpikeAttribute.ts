import * as THREE from 'three'

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / Math.max(edge1 - edge0, 1e-5), 0, 1)
  return t * t * (3 - 2 * t)
}

function hash2(u: number, v: number): number {
  const n = Math.sin(u * 127.1 + v * 311.7) * 43758.5453
  return n - Math.floor(n)
}

export interface VirusSpikeTagOptions {
  inner?: number
  outer?: number
  /** 保留高亮刺突的比例（效果图为少量点缀） */
  selectRatio?: number
  /** 尖端收敛幂次，越大越只染最外端 */
  power?: number
}

interface MeshEntry {
  mesh: THREE.Mesh
  toRoot: THREE.Matrix4
}

/**
 * 按到「整体包围球心」的归一化半径写入：
 * - aRadial：全部顶点（0–1.2），供着色器区分球体 / 刺突
 * - aSpike：仅稀疏橙红刺尖，按球面方位挑选
 *
 * 注意：原实现按每个 mesh 自己的 boundingSphere 归一化，11 片切分网格
 * 半径基准不一致，刺突判定会漂移；这里统一用整体包围球。
 */
export function tagVirusSpikeAttribute(
  root: THREE.Object3D,
  options: VirusSpikeTagOptions = {},
): void {
  const inner = options.inner ?? 0.88
  const outer = options.outer ?? 0.985
  const selectRatio = THREE.MathUtils.clamp(options.selectRatio ?? 0.2, 0.02, 1)
  const power = Math.max(1, options.power ?? 2.4)

  root.updateMatrixWorld(true)

  const entries: MeshEntry[] = []
  root.traverse((obj: THREE.Object3D): void => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) {
      return
    }
    entries.push({
      mesh,
      toRoot: new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld),
    })
  })
  if (entries.length === 0) {
    return
  }

  const box = new THREE.Box3().setFromObject(root)
  const centerWorld = box.getCenter(new THREE.Vector3())
  const center = centerWorld.applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert())

  const vertex = new THREE.Vector3()
  let maxRadius = 1e-5
  for (const entry of entries) {
    const position = entry.mesh.geometry.getAttribute('position')
    if (!position) {
      continue
    }
    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(entry.toRoot)
      maxRadius = Math.max(maxRadius, vertex.distanceTo(center))
    }
  }

  for (const entry of entries) {
    const geometry = entry.mesh.geometry
    const position = geometry.getAttribute('position')
    if (!position || position.count === 0) {
      continue
    }

    const radial = new Float32Array(position.count)
    const spikes = new Float32Array(position.count)

    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(entry.toRoot)
      const dx = vertex.x - center.x
      const dy = vertex.y - center.y
      const dz = vertex.z - center.z
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const norm = len / maxRadius
      radial[i] = norm

      let weight = smoothstep(inner, outer, norm)
      if (weight <= 1e-4) {
        continue
      }

      const inv = 1 / Math.max(len, 1e-5)
      const nx = dx * inv
      const ny = dy * inv
      const nz = dz * inv
      const u = Math.floor(((Math.atan2(nz, nx) / Math.PI + 1) * 0.5) * 28)
      const v = Math.floor(((Math.asin(THREE.MathUtils.clamp(ny, -1, 1)) / Math.PI + 0.5) * 14))
      if (hash2(u, v) > selectRatio) {
        continue
      }

      spikes[i] = Math.pow(weight, power)
    }

    geometry.setAttribute('aRadial', new THREE.BufferAttribute(radial, 1))
    geometry.setAttribute('aSpike', new THREE.BufferAttribute(spikes, 1))
  }
}
