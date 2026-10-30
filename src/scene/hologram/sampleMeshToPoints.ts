import * as THREE from 'three'

export interface SampledPointCloud {
  positions: Float32Array
  normals: Float32Array
}

/**
 * 按三角形面积加权表面采样，同时输出法线（供 Fresnel / 边缘起沙）。
 */
export function sampleObjectToPointCloud(
  root: THREE.Object3D,
  targetCount: number,
): SampledPointCloud {
  root.updateMatrixWorld(true)

  const meshes: THREE.Mesh[] = []
  root.traverse((obj: THREE.Object3D): void => {
    if ((obj as THREE.Mesh).isMesh) {
      meshes.push(obj as THREE.Mesh)
    }
  })

  const triangles = collectTriangles(meshes)
  if (triangles.length === 0) {
    return { positions: new Float32Array(0), normals: new Float32Array(0) }
  }

  const totalArea = triangles[triangles.length - 1].cumulative
  const positions = new Float32Array(targetCount * 3)
  const normals = new Float32Array(targetCount * 3)
  const point = new THREE.Vector3()
  const normal = new THREE.Vector3()

  for (let i = 0; i < targetCount; i += 1) {
    const tri = pickTriangleByArea(triangles, totalArea)
    sampleTriangle(tri, point, normal)
    positions[i * 3] = point.x
    positions[i * 3 + 1] = point.y
    positions[i * 3 + 2] = point.z
    normals[i * 3] = normal.x
    normals[i * 3 + 1] = normal.y
    normals[i * 3 + 2] = normal.z
  }

  return { positions, normals }
}

interface TriangleSample {
  a: THREE.Vector3
  b: THREE.Vector3
  c: THREE.Vector3
  normal: THREE.Vector3
  area: number
  cumulative: number
}

function collectTriangles(meshes: THREE.Mesh[]): TriangleSample[] {
  const triangles: TriangleSample[] = []
  let cumulative = 0

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const normal = new THREE.Vector3()

  for (const mesh of meshes) {
    const geometry = mesh.geometry
    const position = geometry.getAttribute('position')
    if (!position) {
      continue
    }

    const index = geometry.getIndex()
    const triangleCount = index ? index.count / 3 : Math.floor(position.count / 3)

    for (let t = 0; t < triangleCount; t += 1) {
      let ia: number
      let ib: number
      let ic: number
      if (index) {
        ia = index.getX(t * 3)
        ib = index.getX(t * 3 + 1)
        ic = index.getX(t * 3 + 2)
      } else {
        ia = t * 3
        ib = t * 3 + 1
        ic = t * 3 + 2
      }

      a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld)
      b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld)
      c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld)

      ab.subVectors(b, a)
      ac.subVectors(c, a)
      normal.crossVectors(ab, ac)
      const area = normal.length() * 0.5
      if (area < 1e-8) {
        continue
      }
      normal.normalize()

      cumulative += area
      triangles.push({
        a: a.clone(),
        b: b.clone(),
        c: c.clone(),
        normal: normal.clone(),
        area,
        cumulative,
      })
    }
  }

  return triangles
}

function pickTriangleByArea(triangles: TriangleSample[], totalArea: number): TriangleSample {
  const r = Math.random() * totalArea
  let lo = 0
  let hi = triangles.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (triangles[mid].cumulative < r) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return triangles[lo]
}

function sampleTriangle(
  tri: TriangleSample,
  outPoint: THREE.Vector3,
  outNormal: THREE.Vector3,
): void {
  let u = Math.random()
  let v = Math.random()
  if (u + v > 1) {
    u = 1 - u
    v = 1 - v
  }
  const w = 1 - u - v
  outPoint.set(
    tri.a.x * u + tri.b.x * v + tri.c.x * w,
    tri.a.y * u + tri.b.y * v + tri.c.y * w,
    tri.a.z * u + tri.b.z * v + tri.c.z * w,
  )
  outNormal.copy(tri.normal)
}

/**
 * 居中、扶正最长轴到 Y、缩放到目标身高；法线同步变换。
 */
export function normalizePointCloud(
  cloud: SampledPointCloud,
  targetHeight: number,
): SampledPointCloud {
  const { positions, normals } = cloud
  const box = new THREE.Box3()
  const vertex = new THREE.Vector3()
  for (let i = 0; i < positions.length; i += 3) {
    vertex.set(positions[i], positions[i + 1], positions[i + 2])
    box.expandByPoint(vertex)
  }

  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  let upAxis = 1
  if (size.x >= size.y && size.x >= size.z) {
    upAxis = 0
  } else if (size.z >= size.y && size.z >= size.x) {
    upAxis = 2
  }

  const extent = Math.max(size.x, size.y, size.z, 1e-5)
  const scale = targetHeight / extent
  const nextPositions = new Float32Array(positions.length)
  const nextNormals = new Float32Array(normals.length)

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] - center.x
    const y = positions[i + 1] - center.y
    const z = positions[i + 2] - center.z
    const nx = normals[i]
    const ny = normals[i + 1]
    const nz = normals[i + 2]

    let px = x
    let py = y
    let pz = z
    let nnx = nx
    let nny = ny
    let nnz = nz

    if (upAxis === 0) {
      px = -y
      py = x
      pz = z
      nnx = -ny
      nny = nx
      nnz = nz
    } else if (upAxis === 2) {
      px = x
      py = z
      pz = -y
      nnx = nx
      nny = nz
      nnz = -ny
    }

    nextPositions[i] = px * scale
    nextPositions[i + 1] = py * scale
    nextPositions[i + 2] = pz * scale

    const len = Math.hypot(nnx, nny, nnz) || 1
    nextNormals[i] = nnx / len
    nextNormals[i + 1] = nny / len
    nextNormals[i + 2] = nnz / len
  }

  return { positions: nextPositions, normals: nextNormals }
}

/**
 * 轮廓权重：肩/袖/裤脚/头顶更高，躯干中心更低。用于边缘起沙。
 */
export function computeRimWeight(x: number, y: number, z: number): number {
  const radial = Math.hypot(x, z)
  const armRim = smoothstep(0.18, 0.48, radial)
  const headRim = smoothstep(0.4, 0.72, y)
  const footRim = smoothstep(-0.35, -0.72, y)
  const sideRim = smoothstep(0.12, 0.32, Math.abs(x))
  return Math.min(1, Math.max(armRim, headRim * 0.85, footRim * 0.75, sideRim * 0.6))
}

/**
 * 前胸 + 腹肌：正面、躯干中线一带，用来补点和提亮。
 */
export function computeTorsoFrontWeight(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
): number {
  const chest = smoothstep(0.1, 0.18, y) * (1 - smoothstep(0.28, 0.4, y))
  const abs = smoothstep(-0.08, 0.02, y) * (1 - smoothstep(0.1, 0.18, y))
  const band = Math.max(chest, abs)
  const center = 1 - smoothstep(0.06, 0.2, Math.abs(x))
  const front = smoothstep(0.04, 0.38, nz)
  return Math.min(1, band * center * front)
}

/**
 * 剪影密度分：轮廓略加强，头部和腿部补点，胸腹正面也保留一档。
 */
export function computeSilhouetteScore(
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
): number {
  const rim = computeRimWeight(x, y, z)
  const radial = Math.hypot(x, z)
  const nHoriz = Math.hypot(nx, nz)
  let graze = 0
  if (nHoriz > 1e-4 && radial > 1e-4) {
    graze = 1 - Math.abs((nx * x + nz * z) / (nHoriz * radial))
  }
  const headBoost = smoothstep(0.22, 0.58, y) * 0.38
  const crown = smoothstep(0.55, 0.95, ny) * 0.16
  const legBoost = smoothstep(0.02, -0.55, y) * 0.42
  const torsoBoost = computeTorsoFrontWeight(x, y, z, nx, ny, nz) * 0.14
  const score = Math.max(rim * 0.7, graze * 0.55) + headBoost + crown + legBoost + torsoBoost
  return Math.min(1, score)
}

/**
 * 过采样点云按剪影分做加权保留；轮廓仍密，胸腹正面额外加权。
 */
export function biasPointCloudToRim(
  cloud: SampledPointCloud,
  targetCount: number,
): SampledPointCloud {
  const sourceCount = cloud.positions.length / 3
  if (sourceCount === 0) {
    return cloud
  }
  if (sourceCount <= targetCount) {
    return cloud
  }

  const weights = new Float32Array(sourceCount)
  for (let i = 0; i < sourceCount; i += 1) {
    const x = cloud.positions[i * 3]
    const y = cloud.positions[i * 3 + 1]
    const z = cloud.positions[i * 3 + 2]
    const nx = cloud.normals[i * 3]
    const ny = cloud.normals[i * 3 + 1]
    const nz = cloud.normals[i * 3 + 2]
    weights[i] =
      0.58 +
      computeSilhouetteScore(x, y, z, nx, ny, nz) * 0.38 +
      computeTorsoFrontWeight(x, y, z, nx, ny, nz) * 0.16
  }

  const picked = weightedSampleIndices(weights, targetCount)
  const positions = new Float32Array(picked.length * 3)
  const normals = new Float32Array(picked.length * 3)
  for (let i = 0; i < picked.length; i += 1) {
    const src = picked[i]
    positions[i * 3] = cloud.positions[src * 3]
    positions[i * 3 + 1] = cloud.positions[src * 3 + 1]
    positions[i * 3 + 2] = cloud.positions[src * 3 + 2]
    normals[i * 3] = cloud.normals[src * 3]
    normals[i * 3 + 1] = cloud.normals[src * 3 + 1]
    normals[i * 3 + 2] = cloud.normals[src * 3 + 2]
  }
  return { positions, normals }
}

function weightedSampleIndices(weights: Float32Array, targetCount: number): number[] {
  const sourceCount = weights.length
  const picked = new Int32Array(targetCount)
  const filled = Math.min(targetCount, sourceCount)
  for (let i = 0; i < filled; i += 1) {
    picked[i] = i
  }
  if (sourceCount <= targetCount) {
    return Array.from(picked)
  }

  let running = 0
  for (let i = 0; i < filled; i += 1) {
    running += weights[i]
  }
  for (let i = filled; i < sourceCount; i += 1) {
    running += weights[i]
    const p = (weights[i] / Math.max(running, 1e-8)) * targetCount
    if (Math.random() < p) {
      picked[(Math.random() * targetCount) | 0] = i
    }
  }
  return Array.from(picked)
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
