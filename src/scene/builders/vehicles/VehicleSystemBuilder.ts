import * as THREE from 'three'
import type { MaterialFactory } from '@/scene/MaterialFactory'
import { SITE_LAYOUT } from '@/scene/layout'
import { TruckBuilder } from '@/scene/builders/vehicles/TruckBuilder'
import { CraneTruckBuilder } from '@/scene/builders/vehicles/CraneTruckBuilder'
import { ExcavatorBuilder } from '@/scene/builders/vehicles/ExcavatorBuilder'
import { MixerBuilder } from '@/scene/builders/vehicles/MixerBuilder'
import { CableSpoolBuilder } from '@/scene/builders/vehicles/CableSpoolBuilder'

/**
 * 车辆系统聚合建造器：货运卡车 + 工程车辆摆位。
 * 摆位取自 SITE_LAYOUT，与演示路径首点对齐。
 */
export class VehicleSystemBuilder {
  public constructor(private readonly materials: MaterialFactory) {}

  public build(): THREE.Group {
    const group = new THREE.Group()
    group.name = 'VehicleSystem'

    const trucks = new TruckBuilder(this.materials).build()
    group.add(trucks)

    const { crane_truck_01, excavator_01, mixer_01, cable_spool_01 } = SITE_LAYOUT.vehicles
    group.add(
      new CraneTruckBuilder(this.materials).build(
        crane_truck_01.x,
        crane_truck_01.z,
        crane_truck_01.rotationY,
      ),
    )
    group.add(
      new ExcavatorBuilder(this.materials).build(
        excavator_01.x,
        excavator_01.z,
        excavator_01.rotationY,
      ),
    )
    group.add(new MixerBuilder(this.materials).build(mixer_01.x, mixer_01.z, mixer_01.rotationY))
    group.add(
      new CableSpoolBuilder(this.materials).build(
        cable_spool_01.x,
        cable_spool_01.z,
        cable_spool_01.rotationY,
      ),
    )

    // 透传卡车车牌材质/纹理，供 SceneManager 统一追踪释放
    const extraMaterials = trucks.userData.extraMaterials as THREE.Material[] | undefined
    const extraTextures = trucks.userData.extraTextures as THREE.Texture[] | undefined
    if (extraMaterials) {
      group.userData.extraMaterials = extraMaterials
    }
    if (extraTextures) {
      group.userData.extraTextures = extraTextures
    }

    return group
  }
}
