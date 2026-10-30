import * as THREE from 'three'
import { SCENE_COLORS } from '@/constants/colors'

/**
 * 荒漠戈壁光照：偏暖日照 + 沙色环境反射，保证设备清晰可读。
 */
export class LightingSetup {
  private ambient: THREE.AmbientLight | null = null
  private hemi: THREE.HemisphereLight | null = null
  private sun: THREE.DirectionalLight | null = null
  private fill: THREE.DirectionalLight | null = null

  public setup(scene: THREE.Scene): void {
    this.ambient = new THREE.AmbientLight(0xf8f3ea, 0.46)
    this.ambient.name = 'AmbientLight'
    scene.add(this.ambient)

    this.hemi = new THREE.HemisphereLight(0xdcebf5, SCENE_COLORS.groundAccent, 0.4)
    this.hemi.name = 'HemisphereLight'
    this.hemi.position.set(0, 60, 0)
    scene.add(this.hemi)

    this.sun = new THREE.DirectionalLight(0xffedcf, 1.48)
    this.sun.name = 'SunLight'
    this.sun.position.set(55, 72, 28)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1536, 1536)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 190
    this.sun.shadow.camera.left = -72
    this.sun.shadow.camera.right = 72
    this.sun.shadow.camera.top = 68
    this.sun.shadow.camera.bottom = -62
    this.sun.shadow.bias = -0.00025
    this.sun.shadow.normalBias = 0.03
    this.sun.shadow.radius = 1.8
    scene.add(this.sun)
    scene.add(this.sun.target)
    this.sun.target.position.set(0, 0, 0)

    this.fill = new THREE.DirectionalLight(0xd9e5ed, 0.16)
    this.fill.name = 'FillLight'
    this.fill.position.set(-38, 36, -22)
    this.fill.castShadow = false
    scene.add(this.fill)
  }

  public dispose(scene: THREE.Scene): void {
    if (this.ambient) {
      scene.remove(this.ambient)
      this.ambient.dispose()
      this.ambient = null
    }
    if (this.hemi) {
      scene.remove(this.hemi)
      this.hemi.dispose()
      this.hemi = null
    }
    if (this.sun) {
      scene.remove(this.sun)
      scene.remove(this.sun.target)
      this.sun.dispose()
      this.sun = null
    }
    if (this.fill) {
      scene.remove(this.fill)
      this.fill.dispose()
      this.fill = null
    }
  }
}
