import * as THREE from 'three'
import type { MaterialFactory } from '@/scene/MaterialFactory'

export interface AddWheelsOptions {
  /** 轮胎半径（米），默认 0.48；紧凑车型应传入更小值 */
  tireRadius?: number
  /** 轮胎宽度（米） */
  tireWidth?: number
}

/** 工程车通用车轮（黑胎灰毂） */
export function addWheels(
  materials: MaterialFactory,
  parent: THREE.Group,
  positions: Array<[number, number, number]>,
  options?: AddWheelsOptions,
): void {
  const tireRadius = options?.tireRadius ?? 0.48
  const tireWidth = options?.tireWidth ?? Math.max(0.22, tireRadius * 0.75)
  const rimRadius = tireRadius * 0.54
  const tire = materials.tire()
  const rim = materials.rim()
  const tireGeometry = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 16)
  const rimGeometry = new THREE.CylinderGeometry(rimRadius, rimRadius, tireWidth + 0.02, 14)
  positions.forEach(([wx, wy, wz], index: number) => {
    const wheel = new THREE.Group()
    wheel.position.set(wx, wy, wz)
    const tireMesh = new THREE.Mesh(tireGeometry, tire)
    tireMesh.rotation.z = Math.PI / 2
    tireMesh.castShadow = true
    wheel.add(tireMesh)
    const rimMesh = new THREE.Mesh(rimGeometry, rim)
    rimMesh.rotation.z = Math.PI / 2
    wheel.add(rimMesh)
    wheel.name = `Wheel_${index}`
    parent.add(wheel)
  })
}
