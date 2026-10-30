import * as THREE from 'three'
import { SCENE_COLORS } from '@/constants/colors'
import { listPylonClimbRungYs, PYLON_CLIMB, PYLON_SCALE } from '@/constants/scale'
import { SceneObjectType } from '@/enums/SceneObjectType'
import type { MaterialFactory } from '@/scene/MaterialFactory'
import { tagSelectable } from '@/scene/utils/objectMeta'

/**
 * 输电铁塔：
 * 白色密格构塔身 + 双层导线横担 + 顶部 T 形宽格构横担；
 * 顶层为悬垂绝缘子串，导线沿线路方向（±Z）出线。
 */
export class PylonBuilder {
  public constructor(private readonly materials: MaterialFactory) {}

  public build(x: number, z: number): THREE.Group {
    const root = new THREE.Group()
    root.name = 'pylon_01'
    root.position.set(x, 0, z)

    const white = this.materials.get('pylonWhite', 0xf2f5f8, {
      roughness: 0.72,
      metalness: 0.18,
    })
    const insulatorMat = this.materials.get('pylonInsulator', 0xc45a32, {
      roughness: 0.48,
      metalness: 0.08,
    })
    const conductorMat = this.materials.cable()
    const footingMat = this.materials.get('pylonFooting', SCENE_COLORS.buildingWhite, {
      roughness: 0.88,
      metalness: 0.04,
    })

    const height = PYLON_SCALE.height
    const baseHalf = PYLON_SCALE.baseHalf
    const topHalf = PYLON_SCALE.topHalf
    const segments = 10
    const corners: Array<[number, number]> = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]

    // ========== 格构塔身：四角主腿 + 层间横杆 + 四面 X 斜撑 ==========
    for (let s = 0; s < segments; s += 1) {
      const t0 = s / segments
      const t1 = (s + 1) / segments
      const y0 = height * t0
      const y1 = height * t1
      const w0 = THREE.MathUtils.lerp(baseHalf, topHalf, t0)
      const w1 = THREE.MathUtils.lerp(baseHalf, topHalf, t1)
      const legT = THREE.MathUtils.lerp(0.13, 0.08, t1)
      const braceT = THREE.MathUtils.lerp(0.065, 0.045, t1)
      const ringT = THREE.MathUtils.lerp(0.07, 0.05, t1)

      corners.forEach(([cx, cz], index: number) => {
        root.add(
          this.createBeam(
            new THREE.Vector3(cx * w0, y0, cz * w0),
            new THREE.Vector3(cx * w1, y1, cz * w1),
            legT,
            white,
            `Leg_${s}_${index}`,
          ),
        )
      })

      // 层顶水平框
      const ring: Array<[THREE.Vector3, THREE.Vector3]> = [
        [new THREE.Vector3(-w1, y1, -w1), new THREE.Vector3(w1, y1, -w1)],
        [new THREE.Vector3(w1, y1, -w1), new THREE.Vector3(w1, y1, w1)],
        [new THREE.Vector3(w1, y1, w1), new THREE.Vector3(-w1, y1, w1)],
        [new THREE.Vector3(-w1, y1, w1), new THREE.Vector3(-w1, y1, -w1)],
      ]
      ring.forEach(([a, b], i: number) => {
        root.add(this.createBeam(a, b, ringT, white, `Ring_${s}_${i}`))
      })

      // 四面 X 斜撑（参考图密格构）
      const faces: Array<[[number, number], [number, number]]> = [
        [
          [-1, -1],
          [1, -1],
        ],
        [
          [1, -1],
          [1, 1],
        ],
        [
          [1, 1],
          [-1, 1],
        ],
        [
          [-1, 1],
          [-1, -1],
        ],
      ]
      faces.forEach(([cA, cB], fi: number) => {
        const a0 = new THREE.Vector3(cA[0] * w0, y0, cA[1] * w0)
        const b0 = new THREE.Vector3(cB[0] * w0, y0, cB[1] * w0)
        const a1 = new THREE.Vector3(cA[0] * w1, y1, cA[1] * w1)
        const b1 = new THREE.Vector3(cB[0] * w1, y1, cB[1] * w1)
        root.add(this.createBeam(a0, b1, braceT, white, `BraceX_${s}_${fi}a`))
        root.add(this.createBeam(b0, a1, braceT, white, `BraceX_${s}_${fi}b`))
      })
    }

    // ========== 双层导线横担 + 顶部 T 形宽格构横担 ==========
    const lowerY = height * 0.58
    const upperY = height * 0.76
    const tHeadY = height + 0.15
    const lowerReach = PYLON_SCALE.lowerReach
    const upperReach = PYLON_SCALE.upperReach
    const tHeadReach = PYLON_SCALE.tHeadReach
    const tHeadHalfH = PYLON_SCALE.tHeadHalfH
    const tHeadHalfD = PYLON_SCALE.tHeadHalfD
    // 横担根部必须对齐该高度塔身外缘，避免穿入塔内
    const lowerMastHalf = THREE.MathUtils.lerp(baseHalf, topHalf, lowerY / height)
    const upperMastHalf = THREE.MathUtils.lerp(baseHalf, topHalf, upperY / height)

    this.addLatticeCrossArm(root, white, lowerY, lowerReach, lowerMastHalf, 'Lower')
    this.addLatticeCrossArm(root, white, upperY, upperReach, upperMastHalf, 'Upper')
    this.addTHeadCrossArm(root, white, tHeadY, tHeadReach, topHalf, tHeadHalfH, tHeadHalfD)

    /**
     * 下层 / 中层：耐张串 + U 跳线。
     * 本地 -Z 朝向变电站，由 FacilityBuilder 的 FeederSpans 接档；
     * 此处只画背离站侧（+Z）出线，避免两端叠半截示意线。
     */
    const armTips: Array<{ x: number; y: number }> = [
      { x: -lowerReach, y: lowerY },
      { x: lowerReach, y: lowerY },
      { x: -upperReach, y: upperY },
      { x: upperReach, y: upperY },
    ]
    armTips.forEach((tip, index: number) => {
      root.add(
        this.createInsulatorAssembly(
          tip.x,
          tip.y,
          insulatorMat,
          conductorMat,
          white,
          `Ins_${index}`,
          [1],
        ),
      )
    })

    // ========== 顶层 T 横担：垂直悬垂绝缘子 + 背离站侧出线 ==========
    for (const side of [-1, 1] as const) {
      root.add(
        this.createSuspensionAssembly(
          side * tHeadReach,
          tHeadY - tHeadHalfH,
          insulatorMat,
          conductorMat,
          white,
          `TopSusp_${side}`,
          [1],
        ),
      )

      // 地线挂点仅保留短柱示意，不再画悬空短档，避免塔顶多出两条半截线。
      const gndY = tHeadY + tHeadHalfH + 0.08
      const gndX = side * (tHeadReach - 0.15)
      const gndPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), white)
      gndPost.position.set(gndX, gndY, 0)
      root.add(gndPost)
    }

    // ========== 四角混凝土基座 ==========
    corners.forEach(([cx, cz], index: number) => {
      const footing = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.32, 1.05), footingMat)
      footing.position.set(cx * baseHalf, 0.16, cz * baseHalf)
      footing.receiveShadow = true
      footing.castShadow = true
      footing.name = `Footing_${index}`
      root.add(footing)
    })

    // 攀爬主腿脚钉示意（+X / -Z 腿，与 pylonAnchors 攀爬侧一致）
    this.addClimbPegs(root, white, height, baseHalf, topHalf)

    tagSelectable(root, {
      objectId: 'pylon_01',
      objectType: SceneObjectType.Pylon,
      label: '输电铁塔 T-01',
      businessKey: 'facility:pylon-01',
    })
    return root
  }

  /**
   * 双侧水平格构横担：弦杆自塔身该高度外缘四角向外延伸，
   * 在侧面形成衔接框，不进入塔身内部。
   */
  private addLatticeCrossArm(
    root: THREE.Group,
    mat: THREE.MeshStandardMaterial,
    y: number,
    reach: number,
    mastHalf: number,
    prefix: string,
  ): void {
    const tipHalf = 0.16
    const yTop = y + 0.28
    const yBot = y - 0.32
    const tipYTop = y + 0.06
    const tipYBot = y - 0.18

    for (const side of [-1, 1] as const) {
      const tipX = side * reach
      // 贴在塔身左右外立面，对齐前后主腿
      const rootX = side * mastHalf
      const rootZ = mastHalf

      // 侧面衔接框：只落在塔身外立面，连接前后主腿
      root.add(
        this.createBeam(
          new THREE.Vector3(rootX, yBot, -rootZ),
          new THREE.Vector3(rootX, yTop, -rootZ),
          0.07,
          mat,
          `${prefix}_FacePostF_${side}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(rootX, yBot, rootZ),
          new THREE.Vector3(rootX, yTop, rootZ),
          0.07,
          mat,
          `${prefix}_FacePostB_${side}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(rootX, yTop, -rootZ),
          new THREE.Vector3(rootX, yTop, rootZ),
          0.065,
          mat,
          `${prefix}_FaceTop_${side}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(rootX, yBot, -rootZ),
          new THREE.Vector3(rootX, yBot, rootZ),
          0.065,
          mat,
          `${prefix}_FaceBot_${side}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(rootX, yBot, -rootZ),
          new THREE.Vector3(rootX, yTop, rootZ),
          0.045,
          mat,
          `${prefix}_FaceX_${side}a`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(rootX, yTop, -rootZ),
          new THREE.Vector3(rootX, yBot, rootZ),
          0.045,
          mat,
          `${prefix}_FaceX_${side}b`,
        ),
      )

      // 上下弦杆：自外立面四角向外，深度由塔身半宽收至端部
      root.add(
        this.createBeam(
          new THREE.Vector3(rootX, yTop, -rootZ),
          new THREE.Vector3(tipX, tipYTop, -tipHalf),
          0.07,
          mat,
          `${prefix}_ChordU_${side}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(rootX, yTop, rootZ),
          new THREE.Vector3(tipX, tipYTop, tipHalf),
          0.07,
          mat,
          `${prefix}_ChordU2_${side}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(rootX, yBot, -rootZ),
          new THREE.Vector3(tipX, tipYBot, -tipHalf),
          0.065,
          mat,
          `${prefix}_ChordL_${side}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(rootX, yBot, rootZ),
          new THREE.Vector3(tipX, tipYBot, tipHalf),
          0.065,
          mat,
          `${prefix}_ChordL2_${side}`,
        ),
      )

      // 端部立柱
      root.add(
        this.createBeam(
          new THREE.Vector3(tipX, tipYBot, -tipHalf),
          new THREE.Vector3(tipX, tipYTop, -tipHalf),
          0.055,
          mat,
          `${prefix}_TipPostA_${side}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(tipX, tipYBot, tipHalf),
          new THREE.Vector3(tipX, tipYTop, tipHalf),
          0.055,
          mat,
          `${prefix}_TipPostB_${side}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(tipX, tipYTop, -tipHalf),
          new THREE.Vector3(tipX, tipYTop, tipHalf),
          0.05,
          mat,
          `${prefix}_TipBar_${side}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(tipX, tipYBot, -tipHalf),
          new THREE.Vector3(tipX, tipYBot, tipHalf),
          0.05,
          mat,
          `${prefix}_TipBarBot_${side}`,
        ),
      )

      const bayCount = 3
      for (let b = 0; b < bayCount; b += 1) {
        const tA = b / bayCount
        const tB = (b + 1) / bayCount
        const xA = THREE.MathUtils.lerp(rootX, tipX, tA)
        const xB = THREE.MathUtils.lerp(rootX, tipX, tB)
        const yUA = THREE.MathUtils.lerp(yTop, tipYTop, tA)
        const yUB = THREE.MathUtils.lerp(yTop, tipYTop, tB)
        const yLA = THREE.MathUtils.lerp(yBot, tipYBot, tA)
        const yLB = THREE.MathUtils.lerp(yBot, tipYBot, tB)
        const dA = THREE.MathUtils.lerp(rootZ, tipHalf, tA)
        const dB = THREE.MathUtils.lerp(rootZ, tipHalf, tB)

        root.add(
          this.createBeam(
            new THREE.Vector3(xA, yUA, -dA),
            new THREE.Vector3(xB, yLB, -dB),
            0.04,
            mat,
            `${prefix}_Web_${side}_${b}a`,
          ),
        )
        root.add(
          this.createBeam(
            new THREE.Vector3(xA, yLA, -dA),
            new THREE.Vector3(xB, yUB, -dB),
            0.04,
            mat,
            `${prefix}_Web_${side}_${b}b`,
          ),
        )
        root.add(
          this.createBeam(
            new THREE.Vector3(xA, yUA, dA),
            new THREE.Vector3(xB, yLB, dB),
            0.04,
            mat,
            `${prefix}_Web_${side}_${b}c`,
          ),
        )
        root.add(
          this.createBeam(
            new THREE.Vector3(xA, yLA, dA),
            new THREE.Vector3(xB, yUB, dB),
            0.04,
            mat,
            `${prefix}_Web_${side}_${b}d`,
          ),
        )
      }
    }
  }

  /**
   * 顶部 T 形宽格构横担（对照参考图）：
   * 等截面矩形箱型桁架，贯通塔顶左右，前后/上下面均有斜撑。
   */
  private addTHeadCrossArm(
    root: THREE.Group,
    mat: THREE.MeshStandardMaterial,
    centerY: number,
    reach: number,
    mastHalf: number,
    halfH: number,
    halfD: number,
  ): void {
    const yTop = centerY + halfH
    const yBot = centerY - halfH
    const chordT = 0.075
    const braceT = 0.045
    const bayCount = 10

    // 四根通长弦杆（前后 × 上下）
    for (const zSign of [-1, 1] as const) {
      root.add(
        this.createBeam(
          new THREE.Vector3(-reach, yTop, zSign * halfD),
          new THREE.Vector3(reach, yTop, zSign * halfD),
          chordT,
          mat,
          `THead_ChordU_${zSign}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(-reach, yBot, zSign * halfD),
          new THREE.Vector3(reach, yBot, zSign * halfD),
          chordT,
          mat,
          `THead_ChordL_${zSign}`,
        ),
      )
    }

    // 分节立柱 + 端面框 + X 斜撑（前/后面）与顶/底面交叉
    for (let b = 0; b <= bayCount; b += 1) {
      const t = b / bayCount
      const x = THREE.MathUtils.lerp(-reach, reach, t)

      for (const zSign of [-1, 1] as const) {
        root.add(
          this.createBeam(
            new THREE.Vector3(x, yBot, zSign * halfD),
            new THREE.Vector3(x, yTop, zSign * halfD),
            0.055,
            mat,
            `THead_Post_${b}_${zSign}`,
          ),
        )
      }
      root.add(
        this.createBeam(
          new THREE.Vector3(x, yTop, -halfD),
          new THREE.Vector3(x, yTop, halfD),
          0.05,
          mat,
          `THead_TopBar_${b}`,
        ),
      )
      root.add(
        this.createBeam(
          new THREE.Vector3(x, yBot, -halfD),
          new THREE.Vector3(x, yBot, halfD),
          0.05,
          mat,
          `THead_BotBar_${b}`,
        ),
      )

      if (b < bayCount) {
        const xNext = THREE.MathUtils.lerp(-reach, reach, (b + 1) / bayCount)
        for (const zSign of [-1, 1] as const) {
          root.add(
            this.createBeam(
              new THREE.Vector3(x, yBot, zSign * halfD),
              new THREE.Vector3(xNext, yTop, zSign * halfD),
              braceT,
              mat,
              `THead_FaceX_${b}_${zSign}a`,
            ),
          )
          root.add(
            this.createBeam(
              new THREE.Vector3(x, yTop, zSign * halfD),
              new THREE.Vector3(xNext, yBot, zSign * halfD),
              braceT,
              mat,
              `THead_FaceX_${b}_${zSign}b`,
            ),
          )
        }
        // 顶面 / 底面交叉
        root.add(
          this.createBeam(
            new THREE.Vector3(x, yTop, -halfD),
            new THREE.Vector3(xNext, yTop, halfD),
            braceT * 0.9,
            mat,
            `THead_TopX_${b}a`,
          ),
        )
        root.add(
          this.createBeam(
            new THREE.Vector3(x, yTop, halfD),
            new THREE.Vector3(xNext, yTop, -halfD),
            braceT * 0.9,
            mat,
            `THead_TopX_${b}b`,
          ),
        )
        root.add(
          this.createBeam(
            new THREE.Vector3(x, yBot, -halfD),
            new THREE.Vector3(xNext, yBot, halfD),
            braceT * 0.9,
            mat,
            `THead_BotX_${b}a`,
          ),
        )
        root.add(
          this.createBeam(
            new THREE.Vector3(x, yBot, halfD),
            new THREE.Vector3(xNext, yBot, -halfD),
            braceT * 0.9,
            mat,
            `THead_BotX_${b}b`,
          ),
        )
      }
    }

    // 与塔身顶部连接：斜撑落入塔顶四角
    for (const side of [-1, 1] as const) {
      for (const zSign of [-1, 1] as const) {
        root.add(
          this.createBeam(
            new THREE.Vector3(side * mastHalf, centerY - halfH - 0.35, zSign * mastHalf),
            new THREE.Vector3(side * mastHalf * 0.2, yBot, zSign * halfD),
            0.06,
            mat,
            `THead_MastBrace_${side}_${zSign}`,
          ),
        )
      }
    }
  }

  /** 顶层悬垂绝缘子串：垂直下挂；lineZSigns 控制哪些侧画短档出线 */
  private createSuspensionAssembly(
    tipX: number,
    tipY: number,
    insulatorMat: THREE.MeshStandardMaterial,
    conductorMat: THREE.MeshStandardMaterial,
    hardwareMat: THREE.MeshStandardMaterial,
    name: string,
    lineZSigns: ReadonlyArray<-1 | 1> = [-1, 1],
  ): THREE.Group {
    const group = new THREE.Group()
    group.name = name

    const hangY = tipY - 0.05
    const discCount = 8
    const discSpacing = 0.18
    const stringLen = discCount * discSpacing
    const bottomY = hangY - stringLen - 0.15

    const clevis = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.14), hardwareMat)
    clevis.position.set(tipX, hangY, 0)
    clevis.castShadow = true
    group.add(clevis)

    for (let i = 0; i < discCount; i += 1) {
      const r = i % 2 === 0 ? 0.13 : 0.11
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 1.06, 0.06, 10),
        insulatorMat,
      )
      disc.position.set(tipX, hangY - 0.12 - i * discSpacing, 0)
      disc.castShadow = true
      group.add(disc)
    }

    // 底部联板 / 分裂导线夹具（两侧夹具保留，便于 FeederSpans 对接）
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.55), hardwareMat)
    yoke.position.set(tipX, bottomY, 0)
    yoke.castShadow = true
    group.add(yoke)

    for (const zSign of [-1, 1] as const) {
      const clamp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), hardwareMat)
      clamp.position.set(tipX, bottomY, zSign * 0.22)
      group.add(clamp)
    }

    lineZSigns.forEach((zSign: -1 | 1) => {
      group.add(
        this.createSagConductor(
          tipX,
          bottomY,
          zSign * 0.22,
          zSign * 5.8,
          0.65,
          conductorMat,
          `${name}_Line_${zSign}`,
        ),
      )
    })

    return group
  }

  /**
   * 耐张挂点：绝缘子串沿线路方向（±Z），U 形跳线连接两侧；
   * lineZSigns 控制哪些侧画短档出线（朝站侧由 FeederSpans 接管）。
   */
  private createInsulatorAssembly(
    tipX: number,
    tipY: number,
    insulatorMat: THREE.MeshStandardMaterial,
    conductorMat: THREE.MeshStandardMaterial,
    hardwareMat: THREE.MeshStandardMaterial,
    name: string,
    lineZSigns: ReadonlyArray<-1 | 1> = [-1, 1],
  ): THREE.Group {
    const group = new THREE.Group()
    group.name = name

    const attachY = tipY - 0.08
    const discCount = 6
    const discSpacing = 0.15
    const stringLen = 0.18 + (discCount - 1) * discSpacing + 0.2

    // 横担端部挂点 / 联板
    const clevis = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.22), hardwareMat)
    clevis.position.set(tipX, attachY, 0)
    clevis.castShadow = true
    group.add(clevis)

    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.28), hardwareMat)
    yoke.position.set(tipX, attachY - 0.12, 0)
    group.add(yoke)

    for (const zSign of [-1, 1] as const) {
      // 绝缘子串沿 ±Z（线路方向）— 两侧金具保留
      for (let i = 0; i < discCount; i += 1) {
        const r = i % 2 === 0 ? 0.14 : 0.115
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(r, r * 1.08, 0.055, 10),
          insulatorMat,
        )
        disc.rotation.x = Math.PI / 2
        disc.position.set(tipX, attachY - 0.12, zSign * (0.22 + i * discSpacing))
        disc.castShadow = true
        group.add(disc)
      }

      const endZ = zSign * stringLen
      const clamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), hardwareMat)
      clamp.position.set(tipX, attachY - 0.12, endZ)
      clamp.castShadow = true
      group.add(clamp)
    }

    lineZSigns.forEach((zSign: -1 | 1) => {
      const endZ = zSign * stringLen
      group.add(
        this.createSagConductor(
          tipX,
          attachY - 0.12,
          endZ,
          zSign * (stringLen + 5.2),
          0.55,
          conductorMat,
          `${name}_Line_${zSign}`,
        ),
      )
    })

    // U 形跳线：在 YZ 平面连接两侧导线端
    const jumperHalf = stringLen
    const jumper = this.createJumperLoop(
      tipX,
      attachY - 0.12,
      jumperHalf,
      0.85,
      conductorMat,
      `${name}_Jumper`,
    )
    jumper.castShadow = true
    group.add(jumper)

    return group
  }

  /** YZ 平面下垂的 U 形跳线 */
  private createJumperLoop(
    x: number,
    y: number,
    halfSpan: number,
    depth: number,
    material: THREE.MeshStandardMaterial,
    name: string,
  ): THREE.Mesh {
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(x, y, -halfSpan),
      new THREE.Vector3(x, y - depth, -halfSpan * 0.35),
      new THREE.Vector3(x, y - depth, halfSpan * 0.35),
      new THREE.Vector3(x, y, halfSpan),
    )
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.032, 5, false), material)
    mesh.name = name
    return mesh
  }

  /** 沿 Z 方向、带弧垂的导线 */
  private createSagConductor(
    x: number,
    y: number,
    z0: number,
    z1: number,
    sag: number,
    material: THREE.MeshStandardMaterial,
    name: string,
  ): THREE.Mesh {
    const midZ = (z0 + z1) * 0.5
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x, y, z0),
      new THREE.Vector3(x, y - sag, midZ),
      new THREE.Vector3(x, y, z1),
    )
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.026, 5, false), material)
    mesh.name = name
    mesh.castShadow = false
    return mesh
  }

  /**
   * 主腿外侧横栏/脚钉：Y 与 PYLON_CLIMB / pylonAnchors 路径共用，
   * 保证攀爬每步落在横栏上（不参与碰撞）。
   */
  private addClimbPegs(
    root: THREE.Group,
    mat: THREE.MeshStandardMaterial,
    height: number,
    baseHalf: number,
    topHalf: number,
  ): void {
    const cx = 1
    const cz = -1
    const rungYs = listPylonClimbRungYs()
    // 钉厚 0.09：中心落在 half+pegOutward，内侧略压进主腿外缘，视觉连成一体
    const pegDepth = 0.09
    const pegLen = 0.55
    rungYs.forEach((y: number, index: number) => {
      const t = y / height
      const half = THREE.MathUtils.lerp(baseHalf, topHalf, t)
      const outward = half + PYLON_CLIMB.pegOutward
      const peg = new THREE.Mesh(new THREE.BoxGeometry(pegLen, 0.055, pegDepth), mat)
      peg.position.set(cx * outward, y, cz * outward)
      // 朝向切向：钉长沿塔面，钉厚沿径向贴腿
      peg.rotation.y = Math.atan2(cx, cz)
      peg.castShadow = false
      peg.name = `ClimbPeg_${index}`
      root.add(peg)
    })
  }

  private createBeam(
    start: THREE.Vector3,
    end: THREE.Vector3,
    thickness: number,
    material: THREE.MeshStandardMaterial,
    name: string,
  ): THREE.Mesh {
    const dir = new THREE.Vector3().subVectors(end, start)
    const length = Math.max(dir.length(), 0.01)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness, length), material)
    mesh.position.copy(start).addScaledVector(dir, 0.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize())
    // 仅主腿与横担弦杆投射阴影，避免数百根细斜撑重复进入 shadow pass。
    mesh.castShadow =
      name.startsWith('Leg_') ||
      name.includes('_Chord') ||
      name.startsWith('THead_MastBrace_')
    mesh.name = name
    return mesh
  }
}
