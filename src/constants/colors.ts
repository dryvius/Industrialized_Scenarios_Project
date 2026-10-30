/** 工业基建施工场景配色（荒漠戈壁 + 工业橙设备） */
export const SCENE_COLORS = {
  /** 远景天空 / 雾色 */
  background: 0xd7e0e2,
  skyTop: 0x83a9c5,
  skyBottom: 0xf0e5d3,
  /** 戈壁沙地（保留暖色，提升与设备的明度分离） */
  ground: 0xe5d6ba,
  groundAccent: 0xcfbd96,
  groundHighlight: 0xf1e7d2,
  hill: 0xd7c6a5,
  hillFar: 0xe3d8c2,
  fog: 0xe2ddcf,
  industrialOrange: 0xee7d28,
  industrialOrangeDark: 0xc95f19,
  cabinWhite: 0xf4f6f8,
  vehicleBlue: 0x5b9fd8,
  vehicleOrange: 0xe0955c,
  vehicleTeal: 0x3f9a9c,
  metalGrey: 0xc5ccd4,
  metalDark: 0x5a6270,
  tireBlack: 0x1a1d21,
  rimGrey: 0x9aa3ad,
  cableBlack: 0x2a2e33,
  buildingWhite: 0xf5f7fa,
  trimOrange: 0xee7d28,
  glassDark: 0x3a424c,
  workerBlue: 0x3d6fa8,
  workerHat: 0xf0f2f4,
  /** 班组长红帽 */
  workerHatRed: 0xc83a32,
  /** 巡检白帽 */
  workerHatWhite: 0xf4f6f8,
  /** 作业蓝帽 */
  workerHatBlue: 0x3a7ec4,
  /** 作业区微弱压痕 */
  marking: 0xb8a77f,
  /** 站区地坪（沙土压实色） */
  pad: 0xd8c8a8,
} as const

export type SceneColorKey = keyof typeof SCENE_COLORS
