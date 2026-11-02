import * as THREE from 'three'
import {
  VIRUS_STAR_COUNT,
  VIRUS_STAR_DISTANCE_MAX,
  VIRUS_STAR_DISTANCE_MIN,
  VIRUS_STAR_OPACITY,
  VIRUS_STAR_SIZE,
} from '@/constants/virusMonitor'
import { createSoftParticleTexture } from '@/scene/hologram/createSoftParticleTexture'

export interface VirusStarFieldHandle {
  root: THREE.Group
  dispose: () => void
}

interface StarLayerOptions {
  count: number
  size: number
  opacity: number
  texture: THREE.Texture
}

function buildStarLayer(options: StarLayerOptions): {
  points: THREE.Points
  dispose: () => void
} {
  const count = Math.max(1, Math.floor(options.count))
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  const cool = new THREE.Color('#c9f4f2')
  const cyan = new THREE.Color('#54e6de')
  const warm = new THREE.Color('#ffb27a')
  const color = new THREE.Color()

  // 直接铺在相机视锥体积内，保证满屏星点而不是挤在天球极点
  const cameraZ = 3.7
  const halfFovTan = Math.tan((28 * Math.PI) / 360)
  const aspect = 1.78

  for (let i = 0; i < count; i += 1) {
    const distance = VIRUS_STAR_DISTANCE_MIN + Math.random() * (VIRUS_STAR_DISTANCE_MAX - VIRUS_STAR_DISTANCE_MIN)
    const halfH = halfFovTan * distance * 1.25
    const halfW = halfH * aspect
    positions[i * 3] = (Math.random() * 2 - 1) * halfW
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * halfH
    positions[i * 3 + 2] = cameraZ - distance

    const roll = Math.random()
    if (roll > 0.92) {
      color.copy(warm)
    } else if (roll > 0.58) {
      color.copy(cyan)
    } else {
      color.copy(cool)
    }
    const intensity = 0.3 + Math.random() * 0.7
    colors[i * 3] = color.r * intensity
    colors[i * 3 + 1] = color.g * intensity
    colors[i * 3 + 2] = color.b * intensity
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    map: options.texture,
    size: options.size,
    transparent: true,
    opacity: options.opacity,
    depthWrite: false,
    depthTest: true,
    sizeAttenuation: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  })

  const points = new THREE.Points(geometry, material)
  points.name = 'virus-star-layer'
  points.frustumCulled = false

  return {
    points,
    dispose: (): void => {
      geometry.dispose()
      material.dispose()
    },
  }
}

/**
 * 背景星尘：固定在天球上的两层柔光点，随相机取景始终铺满暗部。
 * 位置在病毒主体之后，depthTest 保证被球体正确遮挡。
 */
export function createVirusStarField(): VirusStarFieldHandle {
  const root = new THREE.Group()
  root.name = 'virus-star-field'
  const texture = createSoftParticleTexture(32)
  const disposers: Array<() => void> = []

  const base = buildStarLayer({
    count: VIRUS_STAR_COUNT,
    size: VIRUS_STAR_SIZE,
    opacity: VIRUS_STAR_OPACITY,
    texture,
  })
  base.points.name = 'virus-star-base'
  root.add(base.points)
  disposers.push(base.dispose)

  const bright = buildStarLayer({
    count: Math.round(VIRUS_STAR_COUNT * 0.12),
    size: VIRUS_STAR_SIZE * 2.1,
    opacity: Math.min(1, VIRUS_STAR_OPACITY + 0.1),
    texture,
  })
  bright.points.name = 'virus-star-bright'
  root.add(bright.points)
  disposers.push(bright.dispose)

  return {
    root,
    dispose: (): void => {
      for (const dispose of disposers) {
        dispose()
      }
      texture.dispose()
    },
  }
}
