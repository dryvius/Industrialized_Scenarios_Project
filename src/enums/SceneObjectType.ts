/** 场景可选对象类型 */
export const SceneObjectType = {
  Truck: 'truck',
  CraneTruck: 'crane_truck',
  Excavator: 'excavator',
  Mixer: 'mixer',
  CableSpool: 'cable_spool',
  Pylon: 'pylon',
  Substation: 'substation',
  Equipment: 'equipment',
  Worker: 'worker',
} as const

export type SceneObjectType = (typeof SceneObjectType)[keyof typeof SceneObjectType]
