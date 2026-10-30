/** 工程机械运行态：驱动场景动画启停 */
export const MachineRunState = {
  Running: 'running',
  Idle: 'idle',
} as const

export type MachineRunState = (typeof MachineRunState)[keyof typeof MachineRunState]
