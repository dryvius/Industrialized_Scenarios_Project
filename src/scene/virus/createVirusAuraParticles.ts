import * as THREE from 'three'

export interface VirusAuraHandle {
  points: THREE.Points
  dispose: () => void
}

export interface VirusAuraOptions {
  radius: number
  count: number
  texture: THREE.Texture
  color: number
  size: number
  opacity: number
  innerRatio: number
  outerRatio: number
}

/**
 * 主病毒外围柔边粒子点缀。挂到 mainPivot 下即可随主体同转。
 */
export function createVirusAuraParticles(options: VirusAuraOptions): VirusAuraHandle {
  const count = Math.max(0, Math.floor(options.count))
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)

  for (let i = 0; i < count; i += 1) {
    // 斐波那契球面 + 径向抖动，避免扎堆
    const t = (i + 0.5) / Math.max(count, 1)
    const y = 1 - 2 * t
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = Math.PI * (1 + Math.sqrt(5)) * i
    const x = Math.cos(theta) * radiusAtY
    const z = Math.sin(theta) * radiusAtY
    const jitter = options.innerRatio + Math.random() * (options.outerRatio - options.innerRatio)
    const r = options.radius * jitter
    positions[i * 3] = x * r
    positions[i * 3 + 1] = y * r
    positions[i * 3 + 2] = z * r
    seeds[i] = Math.random()
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))

  const material = new THREE.PointsMaterial({
    color: options.color,
    map: options.texture,
    size: options.size,
    transparent: true,
    opacity: options.opacity,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })

  const points = new THREE.Points(geometry, material)
  points.name = 'virus-main-aura'
  points.frustumCulled = false
  points.renderOrder = 2

  return {
    points,
    dispose: (): void => {
      geometry.dispose()
      material.dispose()
    },
  }
}
