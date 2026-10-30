import * as THREE from 'three'
import { SCENE_COLORS } from '@/constants/colors'
import { VEHICLE_SCALE } from '@/constants/scale'
import { SceneObjectType } from '@/enums/SceneObjectType'
import type { MaterialFactory } from '@/scene/MaterialFactory'
import { SITE_LAYOUT } from '@/scene/layout'
import { tagAnimatable } from '@/scene/utils/animatableMeta'
import { tagSelectable } from '@/scene/utils/objectMeta'

interface TruckSpec {
  id: string
  label: string
  businessKey: string
  color: number
  plateNo: string
  x: number
  z: number
  rotationY: number
  showCargoInterior?: boolean
}

/**
 * 货运卡车建造器
 * 彩色驾驶室 + 白色剖切货厢 + 同色车床 + 黑胎灰毂 + 前后车牌
 */
export class TruckBuilder {
  private readonly plateMaterials: THREE.Material[] = []
  private readonly plateTextures: THREE.Texture[] = []

  public constructor(private readonly materials: MaterialFactory) {}

  public build(): THREE.Group {
    const group = new THREE.Group()
    group.name = 'TruckFleet'

    const t1 = SITE_LAYOUT.vehicles.truck_01
    const t2 = SITE_LAYOUT.vehicles.truck_02
    const t3 = SITE_LAYOUT.vehicles.truck_03
    const trucks: TruckSpec[] = [
      {
        id: t1.id,
        label: '货运卡车 T-01',
        businessKey: 'truck:T-01',
        color: SCENE_COLORS.vehicleBlue,
        plateNo: '沪A·D2108',
        x: t1.x,
        z: t1.z,
        rotationY: t1.rotationY,
        showCargoInterior: true,
      },
      {
        id: t2.id,
        label: '货运卡车 T-02',
        businessKey: 'truck:T-02',
        color: SCENE_COLORS.vehicleTeal,
        plateNo: '沪B·F8831',
        x: t2.x,
        z: t2.z,
        rotationY: t2.rotationY,
        showCargoInterior: true,
      },
      {
        id: t3.id,
        label: '货运卡车 T-03',
        businessKey: 'truck:T-03',
        color: SCENE_COLORS.vehicleOrange,
        plateNo: '苏E·C6612',
        x: t3.x,
        z: t3.z,
        rotationY: t3.rotationY,
        showCargoInterior: true,
      },
    ]

    trucks.forEach((spec: TruckSpec) => {
      group.add(this.createTruck(spec))
    })

    group.userData.extraMaterials = [...this.plateMaterials]
    group.userData.extraTextures = [...this.plateTextures]
    return group
  }

  private createTruck(spec: TruckSpec): THREE.Group {
    const truck = new THREE.Group()
    truck.name = spec.id
    truck.position.set(spec.x, 0, spec.z)
    truck.rotation.y = spec.rotationY

    const bodyMat = this.materials.vehicle(spec.color)
    const cargoMat = this.materials.get('truckCargoWhite', 0xf4f6f8, {
      roughness: 0.88,
      metalness: 0.06,
    })
    const greyMat = this.materials.get('truckGrey', 0xc5ccd3, {
      roughness: 0.7,
      metalness: 0.16,
    })
    const darkGreyMat = this.materials.get('truckDarkGrey', 0x5a626c, {
      roughness: 0.72,
      metalness: 0.18,
    })
    const trimMat = this.materials.get('truckAccent', 0xcfd4da, {
      roughness: 0.72,
      metalness: 0.18,
    })
    const glassMat = this.materials.glass()
    const lightMat = this.materials.get('truckHeadlight', 0xf7f8fa, {
      roughness: 0.4,
      metalness: 0.12,
      emissive: 0xf7f8fa,
      emissiveIntensity: 0.14,
    })
    const tireMat = this.materials.tire()
    const rimMat = this.materials.rim()

    const truckScale = VEHICLE_SCALE.truck
    const chassisLen = truckScale.chassisLength
    const chassisWid = truckScale.chassisWidth

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(chassisWid - 0.25, 0.24, chassisLen), bodyMat)
    chassis.position.set(0, 0.72, -0.2)
    chassis.castShadow = true
    chassis.receiveShadow = true
    truck.add(chassis)

    const cabWidth = chassisWid - 0.2
    const cabDepth = 1.7
    const cabCenterZ = chassisLen * 0.42
    const cabFrontZ = cabCenterZ + cabDepth / 2

    const cabLower = new THREE.Mesh(new THREE.BoxGeometry(cabWidth, 0.95, cabDepth), bodyMat)
    cabLower.position.set(0, 1.2, cabCenterZ)
    cabLower.castShadow = true
    truck.add(cabLower)

    const cabUpper = new THREE.Mesh(new THREE.BoxGeometry(cabWidth, 0.78, 0.55), bodyMat)
    cabUpper.position.set(0, 2.05, cabCenterZ - 0.5)
    cabUpper.castShadow = true
    truck.add(cabUpper)

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, cabDepth - 0.15), bodyMat)
    pillarL.position.set(-(cabWidth / 2) + 0.08, 2.05, cabCenterZ + 0.02)
    pillarL.castShadow = true
    truck.add(pillarL)
    const pillarR = pillarL.clone()
    pillarR.position.x = cabWidth / 2 - 0.08
    truck.add(pillarR)

    const cabRoof = new THREE.Mesh(
      new THREE.BoxGeometry(cabWidth - 0.06, 0.14, cabDepth - 0.08),
      bodyMat,
    )
    cabRoof.position.set(0, 2.5, cabCenterZ - 0.02)
    cabRoof.castShadow = true
    truck.add(cabRoof)

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(cabWidth - 0.36, 0.7, 0.05), glassMat)
    windshield.position.set(0, 2.05, cabFrontZ - 0.01)
    truck.add(windshield)

    const sideGlassL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, cabDepth - 0.45), glassMat)
    sideGlassL.position.set(-(cabWidth / 2) + 0.02, 2.05, cabCenterZ + 0.12)
    truck.add(sideGlassL)
    const sideGlassR = sideGlassL.clone()
    sideGlassR.position.x = cabWidth / 2 - 0.02
    truck.add(sideGlassR)

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.4, 0.08), greyMat)
    grille.position.set(0, 1.15, cabFrontZ + 0.02)
    truck.add(grille)
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const cell = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.03), darkGreyMat)
        cell.position.set(-0.42 + col * 0.12, 1.02 + row * 0.09, cabFrontZ + 0.07)
        truck.add(cell)
      }
    }

    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.07), lightMat)
    headL.position.set(-0.82, 1.15, cabFrontZ + 0.05)
    truck.add(headL)
    const headR = headL.clone()
    headR.position.x = 0.82
    truck.add(headR)

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(cabWidth - 0.05, 0.16, 0.22), greyMat)
    bumper.position.set(0, 0.72, cabFrontZ - 0.02)
    bumper.castShadow = true
    truck.add(bumper)

    const plateMat = this.createPlateMaterial(spec.plateNo)
    const frontPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.22), plateMat)
    frontPlate.position.set(0, 0.72, cabFrontZ + 0.12)
    truck.add(frontPlate)
    const rearPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.22), plateMat)
    rearPlate.position.set(0, 1.15, -chassisLen * 0.48)
    rearPlate.rotation.y = Math.PI
    truck.add(rearPlate)

    this.addCargoBox(truck, cargoMat, trimMat, Boolean(spec.showCargoInterior), chassisWid)

    const tireR = truckScale.tireRadius
    const wheelSpecs: Array<[number, number, number]> = [
      [-1.2, tireR, chassisLen * 0.34],
      [1.2, tireR, chassisLen * 0.34],
      [-1.2, tireR, -chassisLen * 0.18],
      [1.2, tireR, -chassisLen * 0.18],
      [-1.2, tireR, -chassisLen * 0.4],
      [1.2, tireR, -chassisLen * 0.4],
    ]
    const wheelJoints: Record<string, string> = {}
    wheelSpecs.forEach(([wx, wy, wz], index: number) => {
      const wheel = this.createWheel(wx, wy, wz, index, tireMat, rimMat)
      truck.add(wheel)
      wheelJoints[`wheel${index}`] = wheel.name
    })

    tagSelectable(truck, {
      objectId: spec.id,
      objectType: SceneObjectType.Truck,
      label: spec.label,
      businessKey: spec.businessKey,
    })
    tagAnimatable(truck, spec.id, wheelJoints)
    return truck
  }

  private addCargoBox(
    truck: THREE.Group,
    cargoMat: THREE.MeshStandardMaterial,
    trimMat: THREE.MeshStandardMaterial,
    withInterior: boolean,
    chassisWid: number,
  ): void {
    const cargo = new THREE.Group()
    cargo.name = 'CargoBox'
    cargo.position.set(0, 0, -0.95)

    const cargoLen = 5.1
    const cargoW = chassisWid - 0.15
    const roofY = VEHICLE_SCALE.truck.cargoRoofY
    const sideH = roofY - 1.1

    const floor = new THREE.Mesh(new THREE.BoxGeometry(cargoW, 0.12, cargoLen), cargoMat)
    floor.position.y = 1.05
    floor.castShadow = true
    cargo.add(floor)

    const roof = new THREE.Mesh(new THREE.BoxGeometry(cargoW, 0.12, cargoLen), cargoMat)
    roof.position.y = roofY
    roof.castShadow = true
    cargo.add(roof)

    const sideClosed = new THREE.Mesh(new THREE.BoxGeometry(0.1, sideH, cargoLen), cargoMat)
    sideClosed.position.set(-(cargoW * 0.5 - 0.05), 1.05 + sideH * 0.5, 0)
    sideClosed.castShadow = true
    cargo.add(sideClosed)

    const rear = new THREE.Mesh(new THREE.BoxGeometry(cargoW, sideH, 0.1), cargoMat)
    rear.position.set(0, 1.05 + sideH * 0.5, -cargoLen * 0.5)
    rear.castShadow = true
    cargo.add(rear)

    const front = new THREE.Mesh(new THREE.BoxGeometry(cargoW, sideH, 0.1), cargoMat)
    front.position.set(0, 1.05 + sideH * 0.5, cargoLen * 0.5)
    front.castShadow = true
    cargo.add(front)

    const openX = cargoW * 0.5 - 0.05
    const openTopRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, cargoLen), trimMat)
    openTopRail.position.set(openX, roofY - 0.07, 0)
    cargo.add(openTopRail)
    const openBottomRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, cargoLen), trimMat)
    openBottomRail.position.set(openX, 1.12, 0)
    cargo.add(openBottomRail)
    const openFrontPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, sideH, 0.12), trimMat)
    openFrontPost.position.set(openX, 1.05 + sideH * 0.5, cargoLen * 0.48)
    cargo.add(openFrontPost)
    const openRearPost = openFrontPost.clone()
    openRearPost.position.z = -cargoLen * 0.48
    cargo.add(openRearPost)

    if (withInterior) {
      const palletMat = this.materials.get('palletWood', 0xc2a06a, {
        roughness: 0.85,
        metalness: 0.05,
      })
      const cartonMat = this.materials.get('carton', 0xc4a574, { roughness: 0.9, metalness: 0.02 })
      ;[
        [0.15, 0.85],
        [0.15, -0.85],
      ].forEach(([px, pz], index: number) => {
        const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.95), palletMat)
        pallet.position.set(px, 1.18, pz)
        pallet.castShadow = true
        cargo.add(pallet)
        for (let row = 0; row < 2; row += 1) {
          for (let col = 0; col < 2; col += 1) {
            const box = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.42), cartonMat)
            box.position.set(px - 0.26 + col * 0.52, 1.45 + row * 0.46, pz)
            box.castShadow = true
            box.name = `Box_${index}_${row}_${col}`
            cargo.add(box)
          }
        }
      })
    }

    truck.add(cargo)
  }

  private createPlateMaterial(plateNo: string): THREE.MeshStandardMaterial {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 160
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return this.materials.get('truckPlateFallback', 0x1f5fbf, { roughness: 0.55, metalness: 0.2 })
    }

    ctx.fillStyle = '#1f5fbf'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 10
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 72px "Microsoft YaHei", "Noto Sans SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(plateNo, canvas.width / 2, canvas.height / 2 + 2)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    this.plateTextures.push(texture)

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.55,
      metalness: 0.12,
      side: THREE.DoubleSide,
    })
    this.plateMaterials.push(material)
    return material
  }

  private createWheel(
    x: number,
    y: number,
    z: number,
    index: number,
    tireMat: THREE.MeshStandardMaterial,
    rimMat: THREE.MeshStandardMaterial,
  ): THREE.Group {
    const wheel = new THREE.Group()
    wheel.name = `Wheel_${index}`
    wheel.position.set(x, y, z)

    const tireR = VEHICLE_SCALE.truck.tireRadius
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(tireR, tireR, 0.38, 16), tireMat)
    tire.rotation.z = Math.PI / 2
    tire.castShadow = true
    wheel.add(tire)

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(tireR * 0.6, tireR * 0.6, 0.4, 14), rimMat)
    rim.rotation.z = Math.PI / 2
    wheel.add(rim)

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.42, 8),
      this.materials.get('truckHubCore', 0x7a838d, { roughness: 0.55, metalness: 0.25 }),
    )
    hub.rotation.z = Math.PI / 2
    wheel.add(hub)
    return wheel
  }
}
