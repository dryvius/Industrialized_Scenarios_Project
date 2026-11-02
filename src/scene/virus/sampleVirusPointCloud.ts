import * as THREE from 'three'

interface TriangleSoup {
  /** 每个三角形 9 个坐标：ax,ay,az,bx,by,bz,cx,cy,cz（root 空间） */
  positions: Float32Array
  /** 面积前缀和，用于按面积加权采样 */
  cumulative: Float64Array
  totalArea: number
  count: number
}

/**
 * 按三角面积加权采样点云。
 * 病毒 LOD 的顶点密度在刺突处更高，按顶点抽样会让球壳变稀；
 * 这里改为「三角形面积前缀和 + 重心随机点」，让内膜壳均匀、可读。
 */
export function sampleVirusVertices(root: THREE.Object3D, targetCount: number): Float32Array {
  const count = Math.max(0, Math.floor(targetCount))
  if (count === 0) {
    return new Float32Array(0)
  }

  root.updateMatrixWorld(true)
  const soup = collectTriangles(root)
  if (soup.count === 0 || soup.totalArea <= 1e-9) {
    return new Float32Array(0)
  }

  const samples = new Float32Array(count * 3)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const point = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()

  for (let i = 0; i < count; i += 1) {
    const target = Math.random() * soup.totalArea
    const tri = findTriangle(soup.cumulative, target)
    const base = tri * 9
    a.set(soup.positions[base], soup.positions[base + 1], soup.positions[base + 2])
    b.set(soup.positions[base + 3], soup.positions[base + 4], soup.positions[base + 5])
    c.set(soup.positions[base + 6], soup.positions[base + 7], soup.positions[base + 8])

    let u = Math.random()
    let v = Math.random()
    if (u + v > 1) {
      u = 1 - u
      v = 1 - v
    }
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    point.copy(a).addScaledVector(ab, u).addScaledVector(ac, v)

    samples[i * 3] = point.x
    samples[i * 3 + 1] = point.y
    samples[i * 3 + 2] = point.z
  }

  return samples
}

function collectTriangles(root: THREE.Object3D): TriangleSoup {
  const meshes: Array<{ geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }> = []
  root.traverse((obj: THREE.Object3D): void => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) {
      return
    }
    const position = mesh.geometry.getAttribute('position')
    if (!position) {
      return
    }
    meshes.push({
      geometry: mesh.geometry,
      // 采样在「归一化后」的世界空间进行，与 plexus pivot 使用同一量纲
      matrix: mesh.matrixWorld.clone(),
    })
  })

  let triangleCount = 0
  for (const entry of meshes) {
    const index = entry.geometry.getIndex()
    const position = entry.geometry.getAttribute('position')
    triangleCount += index ? Math.floor(index.count / 3) : Math.floor(position.count / 3)
  }

  const positions = new Float32Array(triangleCount * 9)
  const cumulative = new Float64Array(triangleCount)
  const va = new THREE.Vector3()
  const vb = new THREE.Vector3()
  const vc = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const cross = new THREE.Vector3()

  let tri = 0
  let totalArea = 0
  const pushTriangle = (): void => {
    positions[tri * 9] = va.x
    positions[tri * 9 + 1] = va.y
    positions[tri * 9 + 2] = va.z
    positions[tri * 9 + 3] = vb.x
    positions[tri * 9 + 4] = vb.y
    positions[tri * 9 + 5] = vb.z
    positions[tri * 9 + 6] = vc.x
    positions[tri * 9 + 7] = vc.y
    positions[tri * 9 + 8] = vc.z
    ab.subVectors(vb, va)
    ac.subVectors(vc, va)
    const area = cross.crossVectors(ab, ac).length() * 0.5
    totalArea += area
    cumulative[tri] = totalArea
    tri += 1
  }

  for (const entry of meshes) {
    const { geometry, matrix } = entry
    const position = geometry.getAttribute('position')
    const index = geometry.getIndex()
    const vertexAt = (i: number, target: THREE.Vector3): void => {
      target.fromBufferAttribute(position, i).applyMatrix4(matrix)
    }
    const triangleTotal = index ? Math.floor(index.count / 3) : Math.floor(position.count / 3)
    for (let i = 0; i < triangleTotal; i += 1) {
      if (index) {
        vertexAt(index.getX(i * 3), va)
        vertexAt(index.getX(i * 3 + 1), vb)
        vertexAt(index.getX(i * 3 + 2), vc)
      } else {
        vertexAt(i * 3, va)
        vertexAt(i * 3 + 1, vb)
        vertexAt(i * 3 + 2, vc)
      }
      pushTriangle()
    }
  }

  return { positions, cumulative, totalArea, count: tri }
}

function findTriangle(cumulative: Float64Array, target: number): number {
  let low = 0
  let high = cumulative.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if (cumulative[mid] < target) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}
