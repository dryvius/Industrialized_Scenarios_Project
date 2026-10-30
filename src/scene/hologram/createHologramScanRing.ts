import * as THREE from 'three'
import { HOLOGRAM_COLORS } from '@/constants/hologram'

export interface HologramScanRingHandle {
  group: THREE.Group
  update: (elapsed: number, enabled: boolean, burst?: boolean) => void
  dispose: () => void
}

const CYCLE_SECONDS = 7.4

/**
 * 沿人体上下缓慢扫过的淡环，不穿透身体中心。
 */
export function createHologramScanRing(footY: number, height: number): HologramScanRingHandle {
  const group = new THREE.Group()
  group.name = 'hologram-scan-ring'
  group.renderOrder = 1

  const geometry = new THREE.RingGeometry(0.17, 0.228, 80)
  const material = new THREE.MeshBasicMaterial({
    color: HOLOGRAM_COLORS.pedestal,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  group.add(mesh)

  const innerMat = new THREE.MeshBasicMaterial({
    color: HOLOGRAM_COLORS.pedestal,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  const inner = new THREE.Mesh(new THREE.RingGeometry(0.132, 0.148, 64), innerMat)
  inner.rotation.x = -Math.PI / 2
  group.add(inner)

  const tickGeo = new THREE.BoxGeometry(0.006, 0.002, 0.03)
  const tickMat = new THREE.MeshBasicMaterial({
    color: HOLOGRAM_COLORS.pedestal,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
  for (let i = 0; i < 24; i += 1) {
    const tick = new THREE.Mesh(tickGeo, tickMat)
    const angle = (i / 24) * Math.PI * 2
    tick.position.set(Math.cos(angle) * 0.2, 0, Math.sin(angle) * 0.2)
    tick.rotation.y = -angle
    group.add(tick)
  }

  const minY = footY + 0.04
  const maxY = footY + height * 0.92

  const update = (elapsed: number, enabled: boolean, burst = false): void => {
    if (!enabled) {
      group.visible = false
      return
    }
    group.visible = true
    const cycleSeconds = burst ? 0.82 : CYCLE_SECONDS
    const cycle = burst ? Math.min(elapsed / cycleSeconds, 1) : (elapsed % CYCLE_SECONDS) / CYCLE_SECONDS
    const travel = burst ? cycle : cycle < 0.82 ? cycle / 0.82 : 0
    group.position.y = minY + (maxY - minY) * travel
    const peak = burst ? 0.55 : 0.32
    const fade = travel === 0 || (burst && travel >= 1) ? 0 : 0.12 + Math.sin(travel * Math.PI) * peak
    material.opacity = fade
    innerMat.opacity = fade * 0.55
    tickMat.opacity = fade * 0.9
  }

  const dispose = (): void => {
    geometry.dispose()
    material.dispose()
    inner.geometry.dispose()
    innerMat.dispose()
    tickGeo.dispose()
    tickMat.dispose()
  }

  return { group, update, dispose }
}
