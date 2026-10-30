import * as THREE from 'three'
import { SCENE_COLORS } from '@/constants/colors'
import { SCENE_LAYOUT } from '@/constants/scene'
import type { MaterialFactory } from '@/scene/MaterialFactory'

/**
 * 荒漠戈壁环境：沙砾地面、干燥远山、沙尘雾天空。
 */
export class EnvironmentBuilder {
  private readonly extraMaterials: THREE.Material[] = []
  private readonly extraTextures: THREE.Texture[] = []
  private readonly sharedGeometries: THREE.BufferGeometry[] = []

  public constructor(private readonly materials: MaterialFactory) {}

  public build(): THREE.Group {
    const group = new THREE.Group()
    group.name = 'EnvironmentSystem'

    const terrainMap = this.createTerrainTexture()
    this.addGround(group, terrainMap)
    this.addHills(group, terrainMap)
    this.addSkyDome(group)

    group.userData.extraMaterials = [...this.extraMaterials]
    group.userData.extraTextures = [...this.extraTextures]
    group.userData.sharedGeometries = [...this.sharedGeometries]
    return group
  }

  private addGround(group: THREE.Group, map: THREE.CanvasTexture): void {
    const size = SCENE_LAYOUT.groundSize
    const segments = 96
    const geometry = new THREE.PlaneGeometry(size * 1.6, size * 1.6, segments, segments)
    geometry.rotateX(-Math.PI / 2)

    // 戈壁微起伏；作业区中心压平
    const pos = geometry.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const base = new THREE.Color(SCENE_COLORS.ground)
    const warm = new THREE.Color(SCENE_COLORS.groundHighlight)
    const cool = new THREE.Color(SCENE_COLORS.groundAccent)
    const tmp = new THREE.Color()

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const dist = Math.hypot(x, z)
      const flatten = THREE.MathUtils.smoothstep(40, 75, dist)
      const n =
        Math.sin(x * 0.04) * Math.cos(z * 0.035) * 0.45 +
        Math.sin(x * 0.1 + z * 0.06) * 0.22 +
        Math.cos(x * 0.018 - z * 0.045) * 0.55
      pos.setY(i, n * flatten * 1.15)

      // 大尺度顶点色（世界坐标），打破贴图周期感
      const t =
        0.5 +
        0.22 * Math.sin(x * 0.012) * Math.cos(z * 0.01) +
        0.12 * Math.sin((x + z) * 0.008)
      tmp.copy(base).lerp(t > 0.5 ? warm : cool, Math.abs(t - 0.5) * 0.55)
      colors[i * 3] = tmp.r
      colors[i * 3 + 1] = tmp.g
      colors[i * 3 + 2] = tmp.b
    }
    pos.needsUpdate = true
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
    this.sharedGeometries.push(geometry)

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.02,
    })
    this.extraMaterials.push(material)

    const ground = new THREE.Mesh(geometry, material)
    ground.receiveShadow = true
    ground.name = 'GobiGround'
    group.add(ground)

    const markMat = this.materials.get('mark', SCENE_COLORS.marking, {
      roughness: 0.97,
      metalness: 0.01,
      transparent: true,
      opacity: 0.4,
    })
    for (let i = 0; i < 4; i += 1) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(16, 0.015, 0.1), markMat)
      line.position.set(-6 + i * 2.0, 0.03, 12)
      line.rotation.y = -0.18
      group.add(line)
    }
  }

  /**
   * 用连续起伏的山脊带替代半球「土坨」：
   * 远层低矮连绵、近层略高，颜色贴近沙地。
   */
  private addHills(group: THREE.Group, map: THREE.CanvasTexture): void {
    const nearMat = new THREE.MeshStandardMaterial({
      color: SCENE_COLORS.hill,
      map,
      roughness: 0.95,
      metalness: 0.01,
    })
    const farMat = new THREE.MeshStandardMaterial({
      color: SCENE_COLORS.hillFar,
      map,
      roughness: 0.96,
      metalness: 0.01,
    })
    this.extraMaterials.push(nearMat, farMat)

    // 后景主脊 + 更远淡脊 + 左右围合
    this.addRidgeBand(group, farMat, {
      centerZ: -118,
      width: 320,
      depth: 48,
      peakH: 14,
      segsX: 96,
      segsZ: 18,
      seed: 1.7,
      name: 'RidgeFar',
    })
    this.addRidgeBand(group, nearMat, {
      centerZ: -92,
      width: 280,
      depth: 36,
      peakH: 18,
      segsX: 88,
      segsZ: 16,
      seed: 3.1,
      name: 'RidgeNear',
    })
    this.addRidgeBand(group, farMat, {
      centerZ: -28,
      width: 40,
      depth: 140,
      peakH: 10,
      segsX: 14,
      segsZ: 48,
      seed: 5.4,
      name: 'RidgeLeft',
      offsetX: -118,
    })
    this.addRidgeBand(group, farMat, {
      centerZ: -22,
      width: 40,
      depth: 130,
      peakH: 9,
      segsX: 14,
      segsZ: 46,
      seed: 6.2,
      name: 'RidgeRight',
      offsetX: 118,
    })
  }

  private addRidgeBand(
    group: THREE.Group,
    material: THREE.MeshStandardMaterial,
    opts: {
      centerZ: number
      width: number
      depth: number
      peakH: number
      segsX: number
      segsZ: number
      seed: number
      name: string
      offsetX?: number
    },
  ): void {
    const geometry = new THREE.PlaneGeometry(
      opts.width,
      opts.depth,
      opts.segsX,
      opts.segsZ,
    )
    geometry.rotateX(-Math.PI / 2)

    const pos = geometry.attributes.position
    const halfW = opts.width * 0.5
    const halfD = opts.depth * 0.5
    const seed = opts.seed

    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const u = (x + halfW) / opts.width
      const v = (z + halfD) / opts.depth

      // 沿横向连绵主峰线 + 纵深衰减，前后缘贴地
      const ridge =
        0.55 +
        0.35 * Math.sin(u * Math.PI * 2.2 + seed) +
        0.22 * Math.sin(u * Math.PI * 5.1 - seed * 0.7) +
        0.12 * Math.sin(u * Math.PI * 9.3 + seed * 1.3)
      const depthFalloff = Math.sin(v * Math.PI)
      const edgeFade = Math.sin(u * Math.PI)
      const detail =
        Math.sin(x * 0.08 + seed) * Math.cos(z * 0.11) * 0.18 +
        Math.sin(x * 0.17 - z * 0.09) * 0.1

      const h = Math.max(0, opts.peakH * ridge * depthFalloff * edgeFade * (0.85 + detail))
      pos.setY(i, h)
    }

    pos.needsUpdate = true
    geometry.computeVertexNormals()
    this.sharedGeometries.push(geometry)

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(opts.offsetX ?? 0, -0.15, opts.centerZ)
    mesh.receiveShadow = true
    // 远山只承担纵深轮廓，不占用主光阴影贴图。
    mesh.castShadow = false
    mesh.name = opts.name
    group.add(mesh)
  }

  private addSkyDome(group: THREE.Group): void {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    // 上蓝下暖的戈壁天空，降低地平线黄雾对主体的染色。
    const gradient = ctx.createLinearGradient(0, 0, 0, 256)
    gradient.addColorStop(0, '#83a9c5')
    gradient.addColorStop(0.42, '#c6d8e4')
    gradient.addColorStop(0.74, '#e9e2d5')
    gradient.addColorStop(1, '#f0e5d3')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 2, 256)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    this.extraTextures.push(texture)

    const skyMat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
    this.extraMaterials.push(skyMat)

    const sky = new THREE.Mesh(new THREE.SphereGeometry(260, 32, 16), skyMat)
    sky.name = 'SkyDome'
    group.add(sky)
  }

  /**
   * 无缝沙砾贴图：笔触按四边环绕绘制，平铺时不出现裁剪接缝。
   */
  private createTerrainTexture(): THREE.CanvasTexture {
    const size = 512
    const random = this.createSeededRandom(0x5a17c9e3)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      const fallback = new THREE.CanvasTexture(document.createElement('canvas'))
      this.extraTextures.push(fallback)
      return fallback
    }

    ctx.fillStyle = '#e5d6ba'
    ctx.fillRect(0, 0, size, size)

    const offsets = [0, -size, size]

    const fillWrappedCircle = (x: number, y: number, r: number): void => {
      for (const ox of offsets) {
        for (const oy of offsets) {
          ctx.beginPath()
          ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const fillWrappedSoftBlob = (x: number, y: number, r: number, rgba: string): void => {
      for (const ox of offsets) {
        for (const oy of offsets) {
          const cx = x + ox
          const cy = y + oy
          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
          grad.addColorStop(0, rgba)
          grad.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const layers: Array<{ count: number; min: number; max: number; colors: string[]; alpha: number }> =
      [
        {
          count: 4200,
          min: 1.2,
          max: 3.2,
          colors: ['#d8c9a8', '#ebe2d0', '#d0c09a', '#e4d8c0'],
          alpha: 0.22,
        },
        {
          count: 1800,
          min: 2,
          max: 5,
          colors: ['#cfc0a0', '#f0e8d8', '#d6c8ac', '#c4b492'],
          alpha: 0.18,
        },
        {
          count: 600,
          min: 2.5,
          max: 6,
          colors: ['#c8b898', '#ece4d2', '#d2c4a8'],
          alpha: 0.14,
        },
      ]

    layers.forEach((layer) => {
      for (let i = 0; i < layer.count; i += 1) {
        const x = random() * size
        const y = random() * size
        const r = layer.min + random() * (layer.max - layer.min)
        ctx.fillStyle = layer.colors[Math.floor(random() * layer.colors.length)]
        ctx.globalAlpha = layer.alpha + random() * 0.12
        fillWrappedCircle(x, y, r)
      }
    })
    ctx.globalAlpha = 1

    // 大块软色斑（同样环绕，避免块状接缝）
    for (let i = 0; i < 20; i += 1) {
      const x = random() * size
      const y = random() * size
      const r = 28 + random() * 48
      const rgba =
        random() > 0.5 ? 'rgba(245,238,224,0.28)' : 'rgba(190,172,140,0.18)'
      fillWrappedSoftBlob(x, y, r, rgba)
    }

    // 碎石点
    for (let i = 0; i < 320; i += 1) {
      const x = random() * size
      const y = random() * size
      ctx.fillStyle = random() > 0.5 ? '#c4b498' : '#f0e8dc'
      ctx.globalAlpha = 0.22
      for (const ox of offsets) {
        for (const oy of offsets) {
          ctx.fillRect(x + ox, y + oy, 1 + random() * 1.5, 1 + random() * 1.5)
        }
      }
    }
    ctx.globalAlpha = 1

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    // 镜像平铺进一步打散残留周期感
    texture.wrapS = THREE.MirroredRepeatWrapping
    texture.wrapT = THREE.MirroredRepeatWrapping
    texture.repeat.set(3.2, 3.2)
    texture.anisotropy = 8
    this.extraTextures.push(texture)
    return texture
  }

  /** 固定种子的快速随机数，确保地表纹理在刷新后保持稳定。 */
  private createSeededRandom(initialSeed: number): () => number {
    let seed = initialSeed >>> 0
    return (): number => {
      seed += 0x6d2b79f5
      let value = seed
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296
    }
  }
}
