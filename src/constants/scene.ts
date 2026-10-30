/** 工业基建场景尺寸与相机常量（单位：米） */
export const SCENE_LAYOUT = {
  groundSize: 200,
  groundY: 0,

  camera: {
    // 保持完整场地入画，同时略收紧视场以强化铁塔与机械集群
    frustumSize: 76,
    near: 0.1,
    far: 1000,
    position: { x: 56, y: 50, z: 56 },
    target: { x: 1, y: 5, z: -7 },
    minZoom: 0.4,
    /**
     * 滚轮与点选共用的放大上限。
     * 视场高度约 1.9 m，站立人员按包围盒算出的近景低于该上限。
     */
    maxZoom: 40,
    /** 点选聚焦时，模型投影占视场短边的比例 */
    focusFill: 0.78,
    minPolarAngle: Math.PI / 5,
    maxPolarAngle: Math.PI / 2.55,
    /** 水平可完整环绕；上下仰角仍受限，保持俯视观感 */
    minAzimuthAngle: -Infinity,
    maxAzimuthAngle: Infinity,
  },
} as const

export const USER_DATA_KEYS = {
  objectId: 'objectId',
  objectType: 'objectType',
  selectable: 'selectable',
  label: 'label',
  businessKey: 'businessKey',
} as const
