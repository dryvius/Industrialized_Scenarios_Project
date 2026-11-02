import * as THREE from 'three'

export interface VirusPlexusHandle {
  root: THREE.Group
  dispose: () => void
}

export interface VirusPlexusLayerOptions {
  positions: Float32Array
  color: number
  lineOpacity: number
  pointSize: number
  pointOpacity: number
  maxDegree: number
  linkRadiusRatio: number
  blending?: THREE.Blending
  /** 圆点柔边贴图，避免默认方形点 */
  pointTexture?: THREE.Texture | null
}

export interface VirusStructurePlexusOptions {
  positions: Float32Array
  color: number
  /** 归一化半径 ≤ 该值视为内膜（相对外包半径） */
  membraneRatio: number
  pointTexture?: THREE.Texture | null
  membrane: {
    maxDegree: number
    linkRadiusRatio: number
    lineOpacity: number
    pointSize: number
    pointOpacity: number
  }
  spike: {
    maxDegree: number
    linkRadiusRatio: number
    lineOpacity: number
    pointSize: number
    pointOpacity: number
  }
}

interface Bounds {
  cx: number
  cy: number
  cz: number
  maxR: number
}

/**
 * 效果图结构态：内膜密网 + 外层刺突线网（双层），电青叠加发光。
 */
export function createVirusStructurePlexus(
  options: VirusStructurePlexusOptions,
): VirusPlexusHandle {
  const root = new THREE.Group()
  root.name = 'virus-plexus-root'
  const disposers: Array<() => void> = []

  const bounds = computeBounds(options.positions)
  if (bounds.maxR <= 1e-6) {
    return {
      root,
      dispose: (): void => undefined,
    }
  }

  const membraneCutoff = bounds.maxR * options.membraneRatio
  const split = splitByRadius(options.positions, bounds, membraneCutoff)

  if (split.membrane.length >= 6) {
    const membrane = buildPlexusLayer({
      positions: split.membrane,
      color: options.color,
      lineOpacity: options.membrane.lineOpacity,
      pointSize: options.membrane.pointSize,
      pointOpacity: options.membrane.pointOpacity,
      maxDegree: options.membrane.maxDegree,
      linkRadiusRatio: options.membrane.linkRadiusRatio,
      blending: THREE.AdditiveBlending,
      pointTexture: options.pointTexture,
    })
    membrane.root.name = 'virus-plexus-membrane'
    root.add(membrane.root)
    disposers.push(membrane.dispose)
  }

  if (split.spike.length >= 6) {
    const spike = buildPlexusLayer({
      positions: split.spike,
      color: options.color,
      lineOpacity: options.spike.lineOpacity,
      pointSize: options.spike.pointSize,
      pointOpacity: options.spike.pointOpacity,
      maxDegree: options.spike.maxDegree,
      linkRadiusRatio: options.spike.linkRadiusRatio,
      blending: THREE.AdditiveBlending,
      pointTexture: options.pointTexture,
    })
    spike.root.name = 'virus-plexus-spikes'
    root.add(spike.root)
    disposers.push(spike.dispose)
  }

  return {
    root,
    dispose: (): void => {
      for (const dispose of disposers) {
        dispose()
      }
    },
  }
}

function buildPlexusLayer(options: VirusPlexusLayerOptions): VirusPlexusHandle {
  const pointCount = Math.floor(options.positions.length / 3)
  const root = new THREE.Group()

  if (pointCount < 2) {
    return {
      root,
      dispose: (): void => undefined,
    }
  }

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (let i = 0; i < pointCount; i += 1) {
    const x = options.positions[i * 3]
    const y = options.positions[i * 3 + 1]
    const z = options.positions[i * 3 + 2]
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
    maxZ = Math.max(maxZ, z)
  }
  const radius =
    0.5 *
    Math.max(
      maxX - minX,
      maxY - minY,
      maxZ - minZ,
      1e-4,
    )
  const linkRadius = radius * options.linkRadiusRatio
  const linkRadiusSq = linkRadius * linkRadius
  const maxDegree = Math.max(1, options.maxDegree)

  const pairs: number[] = []
  const degree = new Int16Array(pointCount)
  const bestJ = new Int32Array(maxDegree)
  const bestD = new Float64Array(maxDegree)

  // 空间哈希：用 linkRadius 作为格子边长，把 O(n²) 邻域搜索降到近线性
  const cellSize = Math.max(linkRadius, 1e-5)
  const grid = new Map<string, number[]>()
  const cellKey = (x: number, y: number, z: number): string =>
    `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`
  for (let i = 0; i < pointCount; i += 1) {
    const key = cellKey(
      options.positions[i * 3],
      options.positions[i * 3 + 1],
      options.positions[i * 3 + 2],
    )
    const bucket = grid.get(key)
    if (bucket) {
      bucket.push(i)
    } else {
      grid.set(key, [i])
    }
  }

  for (let i = 0; i < pointCount; i += 1) {
    if (degree[i] >= maxDegree) {
      continue
    }
    const ix = options.positions[i * 3]
    const iy = options.positions[i * 3 + 1]
    const iz = options.positions[i * 3 + 2]
    const cx = Math.floor(ix / cellSize)
    const cy = Math.floor(iy / cellSize)
    const cz = Math.floor(iz / cellSize)
    bestJ.fill(-1)
    bestD.fill(Number.POSITIVE_INFINITY)

    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let oz = -1; oz <= 1; oz += 1) {
          const bucket = grid.get(`${cx + ox},${cy + oy},${cz + oz}`)
          if (!bucket) {
            continue
          }
          for (const j of bucket) {
            if (j <= i || degree[j] >= maxDegree) {
              continue
            }
            const dx = options.positions[j * 3] - ix
            const dy = options.positions[j * 3 + 1] - iy
            const dz = options.positions[j * 3 + 2] - iz
            const d = dx * dx + dy * dy + dz * dz
            if (d <= 1e-10 || d > linkRadiusSq) {
              continue
            }
            let insertAt = -1
            for (let k = 0; k < maxDegree; k += 1) {
              if (d < bestD[k]) {
                insertAt = k
                break
              }
            }
            if (insertAt < 0) {
              continue
            }
            for (let k = maxDegree - 1; k > insertAt; k -= 1) {
              bestD[k] = bestD[k - 1]
              bestJ[k] = bestJ[k - 1]
            }
            bestD[insertAt] = d
            bestJ[insertAt] = j
          }
        }
      }
    }

    for (let k = 0; k < maxDegree; k += 1) {
      const j = bestJ[k]
      if (j < 0 || degree[i] >= maxDegree) {
        break
      }
      if (degree[j] >= maxDegree) {
        continue
      }
      pairs.push(i, j)
      degree[i] += 1
      degree[j] += 1
    }
  }

  const blending = options.blending ?? THREE.NormalBlending
  const linePositions = new Float32Array(pairs.length * 3)
  for (let p = 0; p < pairs.length; p += 1) {
    const idx = pairs[p]
    linePositions[p * 3] = options.positions[idx * 3]
    linePositions[p * 3 + 1] = options.positions[idx * 3 + 1]
    linePositions[p * 3 + 2] = options.positions[idx * 3 + 2]
  }

  const lineGeometry = new THREE.BufferGeometry()
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  const lineMaterial = new THREE.LineBasicMaterial({
    color: options.color,
    transparent: true,
    opacity: options.lineOpacity,
    depthWrite: false,
    depthTest: true,
    blending,
  })
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial)
  lines.name = 'virus-plexus-lines'
  lines.frustumCulled = false
  root.add(lines)

  const pointGeometry = new THREE.BufferGeometry()
  pointGeometry.setAttribute('position', new THREE.BufferAttribute(options.positions.slice(), 3))
  const pointMaterial = new THREE.PointsMaterial({
    color: options.color,
    map: options.pointTexture ?? null,
    size: options.pointSize,
    transparent: true,
    opacity: options.pointOpacity,
    depthWrite: false,
    depthTest: true,
    sizeAttenuation: true,
    blending,
  })
  const points = new THREE.Points(pointGeometry, pointMaterial)
  points.name = 'virus-plexus-nodes'
  points.frustumCulled = false
  root.add(points)

  return {
    root,
    dispose: (): void => {
      lineGeometry.dispose()
      lineMaterial.dispose()
      pointGeometry.dispose()
      pointMaterial.dispose()
    },
  }
}

function computeBounds(positions: Float32Array): Bounds {
  const count = Math.floor(positions.length / 3)
  if (count === 0) {
    return { cx: 0, cy: 0, cz: 0, maxR: 0 }
  }
  let sx = 0
  let sy = 0
  let sz = 0
  for (let i = 0; i < count; i += 1) {
    sx += positions[i * 3]
    sy += positions[i * 3 + 1]
    sz += positions[i * 3 + 2]
  }
  const cx = sx / count
  const cy = sy / count
  const cz = sz / count
  let maxR = 0
  for (let i = 0; i < count; i += 1) {
    const dx = positions[i * 3] - cx
    const dy = positions[i * 3 + 1] - cy
    const dz = positions[i * 3 + 2] - cz
    maxR = Math.max(maxR, Math.sqrt(dx * dx + dy * dy + dz * dz))
  }
  return { cx, cy, cz, maxR }
}

function splitByRadius(
  positions: Float32Array,
  bounds: Bounds,
  membraneCutoff: number,
): { membrane: Float32Array; spike: Float32Array } {
  const count = Math.floor(positions.length / 3)
  const membrane: number[] = []
  const spike: number[] = []
  const cutoffSq = membraneCutoff * membraneCutoff

  for (let i = 0; i < count; i += 1) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    const dx = x - bounds.cx
    const dy = y - bounds.cy
    const dz = z - bounds.cz
    const dSq = dx * dx + dy * dy + dz * dz
    if (dSq <= cutoffSq) {
      membrane.push(x, y, z)
    } else {
      // 外刺略微收短，避免结构体像海胆一样拉长
      spike.push(bounds.cx + dx * 0.84, bounds.cy + dy * 0.84, bounds.cz + dz * 0.84)
    }
  }

  return {
    membrane: Float32Array.from(membrane),
    spike: Float32Array.from(spike),
  }
}
