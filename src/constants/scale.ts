/**
 * 场景现实尺度常量（单位：米）
 * 锚点：工人默认站立身高 1.8 m（头顶，不含安全帽）
 */

export const WORKER_SCALE = {
  /** 默认站立身高（头顶，不含帽） */
  defaultHeight: 1.8,
  /** 允许范围 */
  minHeight: 1.55,
  maxHeight: 1.95,
  /**
   * WorkerBuilder 基准骨架头顶高度（不含帽），当前为 1.84。
   * 运行时按 height / modeledCrownHeight 等比缩放。
   */
  modeledCrownHeight: 1.84,
  /** 安全帽相对头顶附加（随骨架缩放后约 0.12） */
  helmetExtra: 0.12,
} as const

export const PYLON_SCALE = {
  height: 30,
  baseHalf: 3.2,
  topHalf: 0.78,
  lowerReach: 6.5,
  upperReach: 5.5,
  tHeadReach: 7.5,
  tHeadHalfH: 0.6,
  tHeadHalfD: 0.52,
} as const

/**
 * 攀爬脚钉 / 横栏 SSOT：
 * 间距与路径折点、手脚相位共用，保证每步落在横栏上。
 */
export const PYLON_CLIMB = {
  /** 相邻横栏垂直间距（米）≈ 一步一档 */
  rungSpacing: 0.42,
  /** 最低一档高度 */
  firstRungY: 0.42,
  /** 脚钉覆盖高度占塔高比例 */
  maxHeightRatio: 0.84,
  /**
   * 脚钉中心相对主腿轴线（half）的外偏。
   * ≈ 主腿半厚 + 钉半厚，钉贴在主腿外缘，不可再加大否则会“悬空分离”。
   */
  pegOutward: 0.12,
  /**
   * 攀爬人员根节点相对主腿轴线外偏。
   * 与脚钉间距约 0.36 m：脚踩钉；手臂屈肘抓钉，不靠加大 pegOutward 迁就。
   */
  bodyOutward: 0.48,
  /** 横担骑跨：坐点相对横担中心高度上抬（坐在弦杆上） */
  armSitLift: 0.32,
  /** 横担骑跨：相对横担中线向前外偏，避开格构腹杆 */
  armRideZ: 0.62,
} as const

/** 攀爬主腿全部横栏本地 Y（升序） */
export function listPylonClimbRungYs(): number[] {
  const maxY = PYLON_SCALE.height * PYLON_CLIMB.maxHeightRatio
  const ys: number[] = []
  for (
    let y = PYLON_CLIMB.firstRungY;
    y <= maxY + 1e-6;
    y += PYLON_CLIMB.rungSpacing
  ) {
    ys.push(Math.round(y * 1000) / 1000)
  }
  return ys
}

/** 将高度吸附到最近横栏 */
export function snapToClimbRungY(y: number): number {
  const ys = listPylonClimbRungYs()
  if (ys.length === 0) {
    return y
  }
  let best = ys[0]
  let bestD = Math.abs(y - best)
  for (let i = 1; i < ys.length; i += 1) {
    const d = Math.abs(y - ys[i])
    if (d < bestD) {
      bestD = d
      best = ys[i]
    }
  }
  return best
}

export const SUBSTATION_SCALE = {
  mainW: 10,
  mainD: 6.2,
  mainH: 3.6,
  doorH: 2.1,
  outbuildingH: 2.8,
  outbuildingDoorH: 2.0,
  gantryPostH: 9.5,
  gantrySpan: 10,
  padW: 36,
  padD: 24,
} as const

export const VEHICLE_SCALE = {
  truck: {
    chassisLength: 7.2,
    chassisWidth: 2.4,
    cargoRoofY: 3.2,
    tireRadius: 0.5,
  },
  crane: {
    chassisLength: 10.5,
    chassisWidth: 2.55,
    cabRoofY: 3.0,
    boomSections: [7.5, 5.5, 5.0] as const,
    boomReach: 18,
  },
  excavator: {
    trackLength: 4.2,
    trackSpread: 1.4,
    cabinRoofApprox: 3.0,
    bucketWidth: 1.4,
  },
  mixer: {
    trackLength: 7.5,
    trackSpread: 1.35,
    drumRadius: 1.2,
    drumLength: 4.2,
    overallHeightApprox: 3.6,
  },
  spool: {
    flangeRadius: 1.8,
    axleY: 2.0,
    frameWidth: 2.4,
    cablePackRadius: 1.5,
  },
} as const

/** 设施摆位：塔–站示意档距约 60 m */
export const FACILITY_LAYOUT = {
  pylonX: 22,
  pylonZ: 4,
  subX: -24,
  subZ: -42,
} as const
