import * as THREE from 'three'
import { HOLOGRAM_COLORS } from '@/constants/hologram'

export interface HologramPedestalHandle {
  group: THREE.Group
  update: (elapsed: number) => void
  dispose: () => void
}

const ACCENT = HOLOGRAM_COLORS.pedestal

/**
 * 贴地全息法阵：细环 + 雷达刻度 + 对向慢转弧，无金属台阶。
 * 不做穿身光柱，避免腿部被刷亮。
 */
export function createHologramPedestal(footY: number): HologramPedestalHandle {
  const group = new THREE.Group()
  group.position.set(0, footY - 0.012, 0)
  group.renderOrder = -2
  group.name = 'hologram-pedestal'

  const disposables: Array<{ dispose: () => void }> = []
  const spinNodes: Array<{ node: THREE.Object3D; speed: number }> = []
  const pulseMaterials: Array<{ material: THREE.MeshBasicMaterial; baseOpacity: number }> = []

  const gridMap = createDeckGridTexture(512)
  disposables.push(gridMap)
  const gridMat = new THREE.MeshBasicMaterial({
    map: gridMap,
    transparent: true,
    opacity: 0.38,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  disposables.push(gridMat)
  pulseMaterials.push({ material: gridMat, baseOpacity: 0.38 })
  const grid = new THREE.Mesh(new THREE.CircleGeometry(0.5, 80), gridMat)
  grid.rotation.x = -Math.PI / 2
  grid.position.y = 0.001
  grid.renderOrder = -4
  trackGeo(disposables, grid)
  group.add(grid)

  addFlatRing(group, disposables, pulseMaterials, 0.16, 0.172, 0.0016, 0.42)
  addFlatRing(group, disposables, pulseMaterials, 0.3, 0.312, 0.0018, 0.5)
  addFlatRing(group, disposables, pulseMaterials, 0.44, 0.458, 0.002, 0.58)
  addGlowRing(group, disposables, pulseMaterials, 0.5, 0.0045, 0.0024, 0.36)

  const outerSpin = createSegmentedArcRing(0.5, 0.528, 18, 0.78)
  outerSpin.group.position.y = 0.003
  spinNodes.push({ node: outerSpin.group, speed: 0.16 })
  group.add(outerSpin.group)
  disposables.push(...outerSpin.disposables)
  pulseMaterials.push({ material: outerSpin.material, baseOpacity: 0.78 })

  const midSpin = createSegmentedArcRing(0.34, 0.358, 12, 0.55)
  midSpin.group.position.y = 0.0026
  spinNodes.push({ node: midSpin.group, speed: -0.22 })
  group.add(midSpin.group)
  disposables.push(...midSpin.disposables)
  pulseMaterials.push({ material: midSpin.material, baseOpacity: 0.55 })

  const innerSpin = createSegmentedArcRing(0.18, 0.198, 10, 0.48)
  innerSpin.group.position.y = 0.0022
  spinNodes.push({ node: innerSpin.group, speed: 0.3 })
  group.add(innerSpin.group)
  disposables.push(...innerSpin.disposables)
  pulseMaterials.push({ material: innerSpin.material, baseOpacity: 0.48 })

  const tickSpin = createTickRing(0.39, 0.43, 48, 0.46)
  tickSpin.group.position.y = 0.0028
  spinNodes.push({ node: tickSpin.group, speed: 0.1 })
  group.add(tickSpin.group)
  disposables.push(...tickSpin.disposables)
  pulseMaterials.push({ material: tickSpin.material, baseOpacity: 0.46 })

  const haloMap = createAnnularFadeTexture(512)
  disposables.push(haloMap)
  const haloMat = new THREE.MeshBasicMaterial({
    map: haloMap,
    transparent: true,
    opacity: 0.34,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  disposables.push(haloMat)
  pulseMaterials.push({ material: haloMat, baseOpacity: 0.34 })
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.78, 80), haloMat)
  halo.rotation.x = -Math.PI / 2
  halo.position.y = 0.0004
  halo.renderOrder = -6
  trackGeo(disposables, halo)
  group.add(halo)

  return {
    group,
    update(elapsed: number): void {
      const breath = 0.92 + Math.sin(elapsed * 1.15) * 0.08
      for (const item of pulseMaterials) {
        item.material.opacity = item.baseOpacity * breath
      }
      for (const item of spinNodes) {
        item.node.rotation.y = elapsed * item.speed
      }
    },
    dispose(): void {
      for (const item of disposables) {
        item.dispose()
      }
    },
  }
}

function addFlatRing(
  parent: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  pulseMaterials: Array<{ material: THREE.MeshBasicMaterial; baseOpacity: number }>,
  inner: number,
  outer: number,
  y: number,
  opacity: number,
): void {
  const mat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  disposables.push(mat)
  pulseMaterials.push({ material: mat, baseOpacity: opacity })
  const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = y
  trackGeo(disposables, mesh)
  parent.add(mesh)
}

function addGlowRing(
  parent: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  pulseMaterials: Array<{ material: THREE.MeshBasicMaterial; baseOpacity: number }>,
  radius: number,
  tube: number,
  y: number,
  opacity: number,
): void {
  const mat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  disposables.push(mat)
  pulseMaterials.push({ material: mat, baseOpacity: opacity })
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 96), mat)
  mesh.rotation.x = Math.PI / 2
  mesh.position.y = y
  trackGeo(disposables, mesh)
  parent.add(mesh)
}

function createSegmentedArcRing(
  inner: number,
  outer: number,
  segments: number,
  opacity: number,
): {
  group: THREE.Group
  material: THREE.MeshBasicMaterial
  disposables: Array<{ dispose: () => void }>
} {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const disposables: Array<{ dispose: () => void }> = [material]
  const step = (Math.PI * 2) / segments
  const arc = step * 0.62
  for (let i = 0; i < segments; i += 1) {
    if (i % 2 === 0) {
      continue
    }
    const geo = new THREE.RingGeometry(inner, outer, 24, 1, i * step, arc)
    disposables.push(geo)
    const mesh = new THREE.Mesh(geo, material)
    mesh.rotation.x = -Math.PI / 2
    group.add(mesh)
  }
  return { group, material, disposables }
}

function createTickRing(
  inner: number,
  outer: number,
  ticks: number,
  opacity: number,
): {
  group: THREE.Group
  material: THREE.MeshBasicMaterial
  disposables: Array<{ dispose: () => void }>
} {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const disposables: Array<{ dispose: () => void }> = [material]
  const mid = (inner + outer) * 0.5
  const len = outer - inner
  for (let i = 0; i < ticks; i += 1) {
    const angle = (i / ticks) * Math.PI * 2
    const major = i % 6 === 0
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(major ? 0.007 : 0.0035, 0.002, major ? len : len * 0.55),
      material,
    )
    tick.position.set(Math.cos(angle) * mid, 0, Math.sin(angle) * mid)
    tick.rotation.y = -angle
    trackGeo(disposables, tick)
    group.add(tick)
  }
  return { group, material, disposables }
}

function trackGeo(disposables: Array<{ dispose: () => void }>, mesh: THREE.Mesh): void {
  disposables.push(mesh.geometry)
}

function createDeckGridTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法创建台面网格 Canvas')
  }
  const cx = size / 2
  const cy = size / 2
  const maxR = size * 0.48
  ctx.clearRect(0, 0, size, size)
  ctx.strokeStyle = 'rgba(120, 210, 255, 0.42)'
  ctx.lineWidth = 1.1
  for (let i = 1; i <= 5; i += 1) {
    ctx.beginPath()
    ctx.arc(cx, cy, (maxR * i) / 5, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(110, 200, 255, 0.22)'
  ctx.lineWidth = 1
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2
    const inner = i % 4 === 0 ? maxR * 0.08 : maxR * 0.22
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner)
    ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR)
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** 环形渐隐：中心全透，环带弱亮，外缘迅速收掉 */
function createAnnularFadeTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法创建环形渐隐 Canvas')
  }

  const cx = size / 2
  const cy = size / 2
  const maxR = size / 2
  const g = ctx.createRadialGradient(cx, cy, maxR * 0.28, cx, cy, maxR)
  g.addColorStop(0, 'rgba(80, 170, 255, 0)')
  g.addColorStop(0.28, 'rgba(90, 190, 255, 0.04)')
  g.addColorStop(0.52, 'rgba(120, 210, 255, 0.28)')
  g.addColorStop(0.72, 'rgba(80, 170, 230, 0.08)')
  g.addColorStop(1, 'rgba(20, 60, 120, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
