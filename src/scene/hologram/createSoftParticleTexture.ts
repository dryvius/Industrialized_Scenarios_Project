import * as THREE from 'three'

/**
 * 程序化柔边圆形粒子贴图：中心实、边缘很快收束，避免点与点糊成一片。
 */
export function createSoftParticleTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法创建 2D canvas 上下文')
  }

  const half = size * 0.5
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(0.48, 'rgba(255,255,255,0.2)')
  gradient.addColorStop(0.78, 'rgba(255,255,255,0.04)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
