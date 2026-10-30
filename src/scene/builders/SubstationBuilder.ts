import * as THREE from 'three'
import { SCENE_COLORS } from '@/constants/colors'
import { SUBSTATION_SCALE } from '@/constants/scale'
import { SceneObjectType } from '@/enums/SceneObjectType'
import type { MaterialFactory } from '@/scene/MaterialFactory'
import { tagSelectable } from '@/scene/utils/objectMeta'

/**
 * 变电站：
 * 白墙主控楼 + 附属小房 + 户外门架出线 + 站用变 / 开关柜 + 闭环围栏与地坪。
 */
export class SubstationBuilder {
  public constructor(private readonly materials: MaterialFactory) {}

  public build(x: number, z: number, rotY = 0): THREE.Group {
    const root = new THREE.Group()
    root.name = 'substation_01'
    root.position.set(x, 0, z)
    root.rotation.y = rotY

    const white = this.materials.building()
    const orange = this.materials.get('subTrim', SCENE_COLORS.trimOrange, {
      roughness: 0.6,
      metalness: 0.12,
    })
    const metal = this.materials.metal()
    const metalDark = this.materials.metalDark()
    const insulatorMat = this.materials.get('subInsulator', 0xb86a3a, {
      roughness: 0.5,
      metalness: 0.08,
    })
    const glass = this.materials.glass()
    const concrete = this.materials.get('subConcrete', 0xc8c4bc, {
      roughness: 0.92,
      metalness: 0.02,
    })
    const fenceMesh = this.materials.get('subFenceMesh', 0x6a7380, {
      roughness: 0.55,
      metalness: 0.35,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    })

    this.addPad(root, concrete)
    this.addMainBuilding(root, white, orange, metal, metalDark, insulatorMat, glass, concrete)
    this.addOutbuilding(root, white, orange, metalDark, concrete)
    this.addYardEquipment(root, metal, metalDark, insulatorMat, orange, concrete)
    this.addGantry(root, metal, insulatorMat, metalDark)
    this.addYardFence(root, metal, metalDark, fenceMesh)

    tagSelectable(root, {
      objectId: 'substation_01',
      objectType: SceneObjectType.Substation,
      label: '变电站 S-01',
      businessKey: 'facility:substation-01',
    })
    return root
  }

  /** 主控楼：基座 + 白墙腰线 + 凹窗/门套 + 屋顶设备 */
  private addMainBuilding(
    root: THREE.Group,
    white: THREE.MeshStandardMaterial,
    orange: THREE.MeshStandardMaterial,
    metal: THREE.MeshStandardMaterial,
    metalDark: THREE.MeshStandardMaterial,
    insulatorMat: THREE.MeshStandardMaterial,
    glass: THREE.MeshStandardMaterial,
    concrete: THREE.MeshStandardMaterial,
  ): void {
    const w = SUBSTATION_SCALE.mainW
    const d = SUBSTATION_SCALE.mainD
    const h = SUBSTATION_SCALE.mainH
    const doorH = SUBSTATION_SCALE.doorH

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.55, 0.28, d + 0.55), concrete)
    plinth.position.y = 0.14
    plinth.receiveShadow = true
    plinth.castShadow = true
    root.add(plinth)

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), white)
    body.position.y = h * 0.5 + 0.12
    body.castShadow = true
    body.receiveShadow = true
    root.add(body)

    // 四角立柱饰条
    for (const sx of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.22, h + 0.1, 0.22), white)
        col.position.set(sx * (w * 0.5 - 0.05), h * 0.5 + 0.12, sz * (d * 0.5 - 0.05))
        col.castShadow = true
        root.add(col)
      }
    }

    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, 0.42, d + 0.18), orange)
    trim.position.y = h - 0.3
    root.add(trim)

    // 檐口 / 女儿墙
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.32, d + 0.5), white)
    parapet.position.y = h + 0.22
    parapet.castShadow = true
    root.add(parapet)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.12, d + 0.2), metal)
    roof.position.y = h + 0.38
    roof.castShadow = true
    root.add(roof)

    // 正面门套 + 门
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.7, doorH + 0.2, 0.12), metal)
    doorFrame.position.set(-1.6, doorH * 0.5 + 0.12, d * 0.5 + 0.04)
    root.add(doorFrame)
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.45, doorH, 0.08), orange)
    door.position.set(-1.6, doorH * 0.5 + 0.12, d * 0.5 + 0.1)
    root.add(door)
    const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.06), metalDark)
    doorHandle.position.set(-1.05, doorH * 0.48 + 0.12, d * 0.5 + 0.16)
    root.add(doorHandle)
    const doorStep = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.55), concrete)
    doorStep.position.set(-1.6, 0.18, d * 0.5 + 0.35)
    root.add(doorStep)

    // 正面窗：外框 + 玻璃 + 中梃
    for (const wx of [1.2, 3.2]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.25, 0.1), metal)
      frame.position.set(wx, 2.25, d * 0.5 + 0.02)
      root.add(frame)
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.05, 0.06), glass)
      win.position.set(wx, 2.25, d * 0.5 + 0.08)
      root.add(win)
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.04), metalDark)
      mullion.position.set(wx, 2.25, d * 0.5 + 0.12)
      root.add(mullion)
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.18), concrete)
      sill.position.set(wx, 1.58, d * 0.5 + 0.08)
      root.add(sill)
    }

    // 侧面窗
    for (const wz of [-1.4, 1.4]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 1.35), metal)
      frame.position.set(w * 0.5 + 0.02, 2.2, wz)
      root.add(frame)
      const sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 1.2), glass)
      sideWin.position.set(w * 0.5 + 0.08, 2.2, wz)
      root.add(sideWin)
    }

    // 屋顶 HVAC / 电气柜 + 棕红套管
    const roofItems: Array<[number, number]> = [
      [-3.2, -0.8],
      [-1.1, 0.6],
      [1.2, -0.5],
      [3.1, 0.7],
    ]
    roofItems.forEach(([rx, rz], index: number) => {
      const unit = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.85, 1.15), metal)
      unit.position.set(rx, h + 0.85, rz)
      unit.castShadow = true
      root.add(unit)
      const vent = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.85), metalDark)
      vent.position.set(rx, h + 1.3, rz)
      root.add(vent)
      for (let g = 0; g < 4; g += 1) {
        const louvre = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.04), metalDark)
        louvre.position.set(rx, h + 0.55 + g * 0.16, rz + 0.58)
        root.add(louvre)
      }

      const bushing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.16, 1.15, 8),
        insulatorMat,
      )
      bushing.position.set(rx + 0.35, h + 1.65, rz)
      bushing.castShadow = true
      root.add(bushing)
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6), metalDark)
      cap.position.set(rx + 0.35, h + 2.3, rz)
      root.add(cap)

      if (index % 2 === 0) {
        const bushing2 = bushing.clone()
        bushing2.position.set(rx - 0.35, h + 1.55, rz)
        root.add(bushing2)
      }
    })
  }

  /** 左侧附属小房 */
  private addOutbuilding(
    root: THREE.Group,
    white: THREE.MeshStandardMaterial,
    orange: THREE.MeshStandardMaterial,
    metalDark: THREE.MeshStandardMaterial,
    concrete: THREE.MeshStandardMaterial,
  ): void {
    const group = new THREE.Group()
    group.position.set(-8.2, 0, -0.4)
    root.add(group)

    const h = SUBSTATION_SCALE.outbuildingH
    const doorH = SUBSTATION_SCALE.outbuildingDoorH

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.22, 3.5), concrete)
    plinth.position.y = 0.11
    plinth.receiveShadow = true
    group.add(plinth)

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, h, 3.2), white)
    body.position.y = h * 0.5 + 0.1
    body.castShadow = true
    body.receiveShadow = true
    group.add(body)

    const trim = new THREE.Mesh(new THREE.BoxGeometry(3.72, 0.28, 3.32), orange)
    trim.position.y = h - 0.45
    group.add(trim)

    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.16, 3.45), white)
    roof.position.y = h + 0.18
    roof.castShadow = true
    group.add(roof)

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, doorH, 0.08), orange)
    door.position.set(0, doorH * 0.5 + 0.1, 1.65)
    group.add(door)

    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.06), metalDark)
    panel.position.set(0, doorH * 0.85 + 0.1, 1.66)
    group.add(panel)
  }

  /** 站内户外设备：箱变 / 开关柜 / 电缆沟盖板 */
  private addYardEquipment(
    root: THREE.Group,
    metal: THREE.MeshStandardMaterial,
    metalDark: THREE.MeshStandardMaterial,
    insulatorMat: THREE.MeshStandardMaterial,
    orange: THREE.MeshStandardMaterial,
    concrete: THREE.MeshStandardMaterial,
  ): void {
    const yard = new THREE.Group()
    yard.name = 'YardEquipment'
    root.add(yard)

    // 两台箱式站用变（主楼右侧）
    for (const [tx, tz] of [
      [6.8, 1.2],
      [6.8, -2.4],
    ] as const) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 2.0), concrete)
      pad.position.set(tx, 0.1, tz)
      pad.receiveShadow = true
      yard.add(pad)

      const tank = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.55, 1.45), metal)
      tank.position.set(tx, 0.95, tz)
      tank.castShadow = true
      yard.add(tank)

      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 1.3), metalDark)
      fin.position.set(tx + 1.15, 0.95, tz)
      yard.add(fin)

      const bushing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 0.7, 8),
        insulatorMat,
      )
      bushing.position.set(tx - 0.4, 1.95, tz)
      yard.add(bushing)
      const bushing2 = bushing.clone()
      bushing2.position.set(tx + 0.4, 1.95, tz)
      yard.add(bushing2)

      const label = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.04), orange)
      label.position.set(tx, 1.2, tz + 0.75)
      yard.add(label)
    }

    // 一排户外开关柜（主楼后方）
    for (let i = 0; i < 3; i += 1) {
      const cx = -2.5 + i * 1.7
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.9, 0.95), metalDark)
      cabinet.position.set(cx, 1.05, -3.6)
      cabinet.castShadow = true
      yard.add(cabinet)
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.55, 0.06), metal)
      door.position.set(cx, 1.05, -3.1)
      yard.add(door)
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.06), orange)
      handle.position.set(cx + 0.4, 1.05, -3.05)
      yard.add(handle)
    }

    // 电缆沟盖板（门架方向）
    for (let i = 0; i < 5; i += 1) {
      const cover = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.85), concrete)
      cover.position.set(-2 + i * 1.55, 0.08, -4.6)
      cover.receiveShadow = true
      yard.add(cover)
    }
  }

  /** 户外出线门架：白钢构 + 垂直绝缘子（不再画半截出线 stub） */
  private addGantry(
    root: THREE.Group,
    metal: THREE.MeshStandardMaterial,
    insulatorMat: THREE.MeshStandardMaterial,
    metalDark: THREE.MeshStandardMaterial,
  ): void {
    const group = new THREE.Group()
    group.position.set(1.5, 0, -5.8)
    root.add(group)

    const postH = SUBSTATION_SCALE.gantryPostH
    const span = SUBSTATION_SCALE.gantrySpan
    const postT = 0.16
    const halfSpan = span * 0.5

    for (const px of [-halfSpan, halfSpan]) {
      for (const pz of [-0.35, 0.35]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(postT, postH, postT), metal)
        post.position.set(px, postH * 0.5, pz)
        post.castShadow = true
        group.add(post)
      }
      for (let i = 0; i < 5; i += 1) {
        const y = 1.2 + i * 1.45
        const lace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.8), metal)
        lace.position.set(px, y, 0)
        group.add(lace)
      }
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.9), metal)
      base.position.set(px, 0.12, 0)
      group.add(base)
    }

    for (const y of [postH - 0.35, postH - 1.15]) {
      for (const pz of [-0.35, 0.35]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 0.3, 0.14, 0.14), metal)
        beam.position.set(0, y, pz)
        beam.castShadow = true
        group.add(beam)
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(span + 0.2, 0.1, 0.8), metal)
      cross.position.set(0, y, 0)
      group.add(cross)
    }

    for (const side of [-1, 1] as const) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.2, 0.1), metal)
      brace.position.set(side * (halfSpan - 0.8), postH - 2.6, 0)
      brace.rotation.z = side * 0.55
      group.add(brace)
    }

    const hangYs = [postH - 1.5, postH - 1.5, postH - 1.5, postH - 1.5]
    const hangXs = [-3.4, -1.1, 1.1, 3.4]
    hangXs.forEach((hx, index: number) => {
      const clevis = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), metalDark)
      clevis.position.set(hx, hangYs[index], 0)
      group.add(clevis)

      for (let d = 0; d < 6; d += 1) {
        const r = d % 2 === 0 ? 0.12 : 0.1
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(r, r * 1.05, 0.055, 8),
          insulatorMat,
        )
        disc.position.set(hx, hangYs[index] - 0.2 - d * 0.16, 0)
        group.add(disc)
      }

      // 线夹挂点：跨档导线由 FacilityBuilder.FeederSpans 接入
      const clamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), metalDark)
      clamp.position.set(hx, hangYs[index] - 1.25, 0)
      group.add(clamp)
    })

    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, span - 1.2, 6), metalDark)
    bus.rotation.z = Math.PI / 2
    bus.position.set(0, postH - 1.55, 0.15)
    group.add(bus)
  }

  /**
   * 站区闭环围栏：立柱 + 上下横梁 + 菱形网片，+Z 侧留双开门。
   * 匹配放大后的地坪（padW × padD，中心偏置与 addPad 一致）。
   */
  private addYardFence(
    root: THREE.Group,
    metal: THREE.MeshStandardMaterial,
    metalDark: THREE.MeshStandardMaterial,
    meshMat: THREE.MeshStandardMaterial,
  ): void {
    const fence = new THREE.Group()
    fence.name = 'YardFence'
    fence.position.set(-1, 0, -1)
    root.add(fence)

    const halfW = SUBSTATION_SCALE.padW * 0.5 - 1.2
    const halfD = SUBSTATION_SCALE.padD * 0.5 - 1.2
    const postH = 2.05
    const gateHalf = 2.4
    const spacing = 2.4
    const placedPosts = new Set<string>()

    const edges: Array<{
      from: THREE.Vector3
      to: THREE.Vector3
      skipCenter?: number
    }> = [
      {
        from: new THREE.Vector3(-halfW, 0, halfD),
        to: new THREE.Vector3(halfW, 0, halfD),
        skipCenter: gateHalf,
      },
      {
        from: new THREE.Vector3(halfW, 0, halfD),
        to: new THREE.Vector3(halfW, 0, -halfD),
      },
      {
        from: new THREE.Vector3(halfW, 0, -halfD),
        to: new THREE.Vector3(-halfW, 0, -halfD),
      },
      {
        from: new THREE.Vector3(-halfW, 0, -halfD),
        to: new THREE.Vector3(-halfW, 0, halfD),
      },
    ]

    edges.forEach((edge) => {
      this.buildFenceRun(
        fence,
        edge.from,
        edge.to,
        spacing,
        postH,
        metal,
        metalDark,
        meshMat,
        placedPosts,
        edge.skipCenter,
      )
    })

    // +Z 侧双开门（向内微开）
    this.addGateLeaf(fence, -gateHalf * 0.55, halfD, postH, -0.35, metal, metalDark, meshMat)
    this.addGateLeaf(fence, gateHalf * 0.55, halfD, postH, 0.35, metal, metalDark, meshMat)

    // 门柱加强
    for (const gx of [-gateHalf, gateHalf]) {
      const gatePost = new THREE.Mesh(new THREE.BoxGeometry(0.14, postH + 0.15, 0.14), metalDark)
      gatePost.position.set(gx, (postH + 0.15) * 0.5, halfD)
      gatePost.castShadow = true
      fence.add(gatePost)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.2), metal)
      cap.position.set(gx, postH + 0.12, halfD)
      fence.add(cap)
    }
  }

  private buildFenceRun(
    parent: THREE.Group,
    from: THREE.Vector3,
    to: THREE.Vector3,
    spacing: number,
    postH: number,
    metal: THREE.MeshStandardMaterial,
    metalDark: THREE.MeshStandardMaterial,
    meshMat: THREE.MeshStandardMaterial,
    placedPosts: Set<string>,
    skipCenter = 0,
  ): void {
    const dir = new THREE.Vector3().subVectors(to, from)
    const length = dir.length()
    if (length < 0.2) {
      return
    }
    dir.normalize()
    const count = Math.max(1, Math.round(length / spacing))
    const step = length / count
    const midSkip = skipCenter > 0
    const postKey = (p: THREE.Vector3): string => `${p.x.toFixed(2)},${p.z.toFixed(2)}`

    const posts: THREE.Vector3[] = []
    for (let i = 0; i <= count; i += 1) {
      const p = from.clone().addScaledVector(dir, i * step)
      const distToMid = Math.abs(i * step - length * 0.5)
      if (midSkip && distToMid < skipCenter) {
        continue
      }
      posts.push(p)
    }

    if (midSkip) {
      posts.push(
        from.clone().addScaledVector(dir, length * 0.5 - skipCenter),
        from.clone().addScaledVector(dir, length * 0.5 + skipCenter),
      )
      posts.sort((a, b) => a.distanceTo(from) - b.distanceTo(from))
    }

    // 去重相邻重合点
    const unique: THREE.Vector3[] = []
    posts.forEach((p) => {
      const prev = unique[unique.length - 1]
      if (prev && prev.distanceTo(p) < 0.15) {
        return
      }
      unique.push(p)
    })

    unique.forEach((p) => {
      const key = postKey(p)
      if (!placedPosts.has(key)) {
        placedPosts.add(key)
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, postH, 0.1), metal)
        post.position.set(p.x, postH * 0.5, p.z)
        post.castShadow = true
        parent.add(post)
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), metalDark)
        tip.position.set(p.x, postH + 0.08, p.z)
        parent.add(tip)
      }
    })

    for (let i = 0; i < unique.length - 1; i += 1) {
      const a = unique[i]
      const b = unique[i + 1]
      const segLen = a.distanceTo(b)
      if (segLen < 0.35 || segLen > spacing * 1.4) {
        continue
      }
      const mid = a.clone().lerp(b, 0.5)
      const yaw = -Math.atan2(b.z - a.z, b.x - a.x)

      for (const y of [0.55, 1.15, 1.85]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.045, 0.045), metal)
        rail.position.set(mid.x, y, mid.z)
        rail.rotation.y = yaw
        parent.add(rail)
      }

      const panel = new THREE.Mesh(new THREE.PlaneGeometry(segLen - 0.08, 1.2), meshMat)
      panel.position.set(mid.x, 1.15, mid.z)
      panel.rotation.y = yaw
      parent.add(panel)

      const diagCount = Math.max(2, Math.floor(segLen / 0.55))
      for (let d = 0; d < diagCount; d += 1) {
        const t = (d + 0.5) / diagCount
        const px = THREE.MathUtils.lerp(a.x, b.x, t)
        const pz = THREE.MathUtils.lerp(a.z, b.z, t)
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.15, 0.025), metalDark)
        bar.position.set(px, 1.15, pz)
        bar.rotation.y = yaw
        bar.rotation.z = d % 2 === 0 ? 0.4 : -0.4
        parent.add(bar)
      }
    }
  }

  private addGateLeaf(
    parent: THREE.Group,
    x: number,
    z: number,
    postH: number,
    yaw: number,
    metal: THREE.MeshStandardMaterial,
    metalDark: THREE.MeshStandardMaterial,
    meshMat: THREE.MeshStandardMaterial,
  ): void {
    const leaf = new THREE.Group()
    leaf.position.set(x, 0, z)
    leaf.rotation.y = yaw
    parent.add(leaf)

    const w = 2.15
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, postH - 0.15, 0.08), metal)
    frame.position.set(0, (postH - 0.15) * 0.5, 0)
    frame.castShadow = true
    leaf.add(frame)

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.15, postH - 0.45), meshMat)
    mesh.position.set(0, postH * 0.5 - 0.05, 0.05)
    leaf.add(mesh)

    for (const y of [0.5, 1.1, 1.7]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.04, 0.04), metalDark)
      rail.position.set(0, y, 0.06)
      leaf.add(rail)
    }
  }

  /** 站区浅色地坪 + 外露路缘 */
  private addPad(root: THREE.Group, concrete: THREE.MeshStandardMaterial): void {
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(SUBSTATION_SCALE.padW + 0.4, 0.16, SUBSTATION_SCALE.padD + 0.4),
      concrete,
    )
    curb.position.set(-1, 0.08, -1)
    curb.receiveShadow = true
    root.add(curb)

    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(SUBSTATION_SCALE.padW, 0.1, SUBSTATION_SCALE.padD),
      this.materials.get('subPad', SCENE_COLORS.pad, { roughness: 0.94, metalness: 0.02 }),
    )
    pad.position.set(-1, 0.14, -1)
    pad.receiveShadow = true
    root.add(pad)
  }
}
