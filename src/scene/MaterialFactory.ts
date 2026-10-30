import * as THREE from 'three'
import { SCENE_COLORS } from '@/constants/colors'

/**
 * 共享材质工厂：统一 Soft PBR 参数。
 */
export class MaterialFactory {
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>()

  public get(
    key: string,
    color: number,
    overrides: Partial<THREE.MeshStandardMaterialParameters> = {},
  ): THREE.MeshStandardMaterial {
    const cacheKey = `${key}_${color}_${JSON.stringify(overrides)}`
    const cached = this.materials.get(cacheKey)
    if (cached) {
      return cached
    }

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.78,
      metalness: 0.08,
      ...overrides,
    })
    this.materials.set(cacheKey, material)
    return material
  }

  public ground(): THREE.MeshStandardMaterial {
    return this.get('ground', SCENE_COLORS.ground, { roughness: 0.96, metalness: 0.02 })
  }

  public vehicle(color: number): THREE.MeshStandardMaterial {
    return this.get(`vehicle_${color}`, color, { roughness: 0.55, metalness: 0.22 })
  }

  public orange(): THREE.MeshStandardMaterial {
    return this.get('orange', SCENE_COLORS.industrialOrange, { roughness: 0.62, metalness: 0.12 })
  }

  public orangeDark(): THREE.MeshStandardMaterial {
    return this.get('orangeDark', SCENE_COLORS.industrialOrangeDark, {
      roughness: 0.65,
      metalness: 0.12,
    })
  }

  public white(): THREE.MeshStandardMaterial {
    return this.get('white', SCENE_COLORS.cabinWhite, { roughness: 0.75, metalness: 0.08 })
  }

  public building(): THREE.MeshStandardMaterial {
    return this.get('building', SCENE_COLORS.buildingWhite, { roughness: 0.8, metalness: 0.06 })
  }

  public metal(): THREE.MeshStandardMaterial {
    return this.get('metal', SCENE_COLORS.metalGrey, { roughness: 0.55, metalness: 0.28 })
  }

  public metalDark(): THREE.MeshStandardMaterial {
    return this.get('metalDark', SCENE_COLORS.metalDark, { roughness: 0.6, metalness: 0.25 })
  }

  public tire(): THREE.MeshStandardMaterial {
    return this.get('tire', SCENE_COLORS.tireBlack, { roughness: 0.92, metalness: 0.04 })
  }

  public rim(): THREE.MeshStandardMaterial {
    return this.get('rim', SCENE_COLORS.rimGrey, { roughness: 0.55, metalness: 0.22 })
  }

  public cable(): THREE.MeshStandardMaterial {
    return this.get('cable', SCENE_COLORS.cableBlack, { roughness: 0.88, metalness: 0.05 })
  }

  public chrome(): THREE.MeshStandardMaterial {
    return this.get('vehicleChrome', 0xb8c2cc, { roughness: 0.35, metalness: 0.45 })
  }

  public workLamp(): THREE.MeshStandardMaterial {
    return this.get('vehicleWorkLamp', 0xf8fafc, {
      roughness: 0.35,
      metalness: 0.1,
      emissive: 0xf8fafc,
      emissiveIntensity: 0.22,
    })
  }

  public hose(): THREE.MeshStandardMaterial {
    return this.get('vehicleHose', 0x1a1a1a, { roughness: 0.85, metalness: 0.05 })
  }

  public glass(): THREE.MeshStandardMaterial {
    return this.get('glass', SCENE_COLORS.glassDark, {
      roughness: 0.22,
      metalness: 0.06,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    })
  }

  public hill(): THREE.MeshStandardMaterial {
    return this.get('hill', SCENE_COLORS.hill, { roughness: 0.95, metalness: 0.01 })
  }

  public dispose(): void {
    this.materials.forEach((material: THREE.MeshStandardMaterial) => {
      material.dispose()
    })
    this.materials.clear()
  }
}
