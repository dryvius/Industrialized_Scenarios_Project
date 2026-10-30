import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { SCENE_LAYOUT } from '@/constants/scene'

interface FocusState {
  startTarget: THREE.Vector3
  endTarget: THREE.Vector3
  startZoom: number
  endZoom: number
  elapsed: number
  duration: number
}

/**
 * 正交等距轴测相机与 OrbitControls；支持选中聚焦。
 */
export class CameraController {
  public readonly camera: THREE.OrthographicCamera
  public readonly controls: OrbitControls
  private readonly container: HTMLElement
  private readonly clock = new THREE.Clock()
  private focusState: FocusState | null = null
  private readonly fitCorner = new THREE.Vector3()
  private readonly fitCenter = new THREE.Vector3()

  public constructor(container: HTMLElement) {
    this.container = container
    const aspect = container.clientWidth / Math.max(container.clientHeight, 1)
    const { frustumSize, near, far, position, target } = SCENE_LAYOUT.camera

    this.camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      near,
      far,
    )
    this.camera.position.set(position.x, position.y, position.z)
    this.camera.lookAt(target.x, target.y, target.z)
    this.camera.name = 'IsometricCamera'

    this.controls = new OrbitControls(this.camera, container)
    this.controls.target.set(target.x, target.y, target.z)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = true
    this.controls.minZoom = SCENE_LAYOUT.camera.minZoom
    this.controls.maxZoom = SCENE_LAYOUT.camera.maxZoom
    this.controls.minPolarAngle = SCENE_LAYOUT.camera.minPolarAngle
    this.controls.maxPolarAngle = SCENE_LAYOUT.camera.maxPolarAngle
    this.controls.minAzimuthAngle = SCENE_LAYOUT.camera.minAzimuthAngle
    this.controls.maxAzimuthAngle = SCENE_LAYOUT.camera.maxAzimuthAngle
    this.controls.update()
  }

  /**
   * 平滑聚焦到世界坐标中心。
   * 缩放按包围盒在当前相机下的投影计算，使模型占满视场短边的固定比例。
   * 只插值 OrbitControls.target，相机方位由控制器保持。
   */
  public focusOn(center: THREE.Vector3, size: THREE.Vector3): void {
    const endZoom = this.resolveFocusZoom(center, size)

    this.focusState = {
      startTarget: this.controls.target.clone(),
      endTarget: center.clone(),
      startZoom: this.camera.zoom,
      endZoom,
      elapsed: 0,
      duration: 0.55,
    }
  }

  /** 正交相机下，让包围盒投影落在视场内并留出边距 */
  private resolveFocusZoom(center: THREE.Vector3, size: THREE.Vector3): number {
    this.camera.updateMatrixWorld()
    const view = this.camera.matrixWorldInverse
    this.fitCenter.copy(center).applyMatrix4(view)

    const halfX = Math.max(size.x, 0) * 0.5
    const halfY = Math.max(size.y, 0) * 0.5
    const halfZ = Math.max(size.z, 0) * 0.5
    let maxX = 0
    let maxY = 0

    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          this.fitCorner
            .set(center.x + sx * halfX, center.y + sy * halfY, center.z + sz * halfZ)
            .applyMatrix4(view)
          maxX = Math.max(maxX, Math.abs(this.fitCorner.x - this.fitCenter.x))
          maxY = Math.max(maxY, Math.abs(this.fitCorner.y - this.fitCenter.y))
        }
      }
    }

    const { frustumSize, minZoom, maxZoom, focusFill } = SCENE_LAYOUT.camera
    if (maxX < 1e-4 && maxY < 1e-4) {
      return maxZoom
    }

    const aspect = this.container.clientWidth / Math.max(this.container.clientHeight, 1)
    const halfHeight = frustumSize * 0.5
    const halfWidth = halfHeight * aspect
    const zoomY = maxY > 1e-4 ? (halfHeight * focusFill) / maxY : maxZoom
    const zoomX = maxX > 1e-4 ? (halfWidth * focusFill) / maxX : maxZoom
    return THREE.MathUtils.clamp(Math.min(zoomX, zoomY), minZoom, maxZoom)
  }

  public resize(): void {
    const width = this.container.clientWidth
    const height = Math.max(this.container.clientHeight, 1)
    const aspect = width / height
    const frustumSize = SCENE_LAYOUT.camera.frustumSize
    this.camera.left = (-frustumSize * aspect) / 2
    this.camera.right = (frustumSize * aspect) / 2
    this.camera.top = frustumSize / 2
    this.camera.bottom = -frustumSize / 2
    this.camera.updateProjectionMatrix()
  }

  public resetTiming(): void {
    this.clock.start()
  }

  public update(): void {
    const delta = this.clock.getDelta()
    if (this.focusState) {
      this.focusState.elapsed += delta
      const t = Math.min(1, this.focusState.elapsed / this.focusState.duration)
      const eased = 1 - (1 - t) ** 3
      this.controls.target.lerpVectors(
        this.focusState.startTarget,
        this.focusState.endTarget,
        eased,
      )
      this.camera.zoom = THREE.MathUtils.lerp(
        this.focusState.startZoom,
        this.focusState.endZoom,
        eased,
      )
      this.camera.updateProjectionMatrix()
      if (t >= 1) {
        this.focusState = null
      }
    }
    this.controls.update()
  }

  public dispose(): void {
    this.focusState = null
    this.controls.dispose()
  }
}
