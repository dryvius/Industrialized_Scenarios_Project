import type { VitalMetricKey, VitalsLevel } from '@/types/vitals'

/** 参考阈值（演示用，非医疗诊断标准） */
export const VITALS_THRESHOLDS = {
  heartRateBpm: { warningLow: 50, warningHigh: 100, criticalLow: 40, criticalHigh: 120 },
  spo2Percent: { warningLow: 94, criticalLow: 90 },
  bodyTempC: { warningLow: 36.0, warningHigh: 37.5, criticalLow: 35.0, criticalHigh: 38.5 },
  respiratoryRate: { warningLow: 12, warningHigh: 20, criticalLow: 8, criticalHigh: 28 },
  bloodPressureSystolic: { warningHigh: 140, criticalHigh: 160, warningLow: 90, criticalLow: 80 },
  fatigueScore: { warningHigh: 60, criticalHigh: 80 },
} as const

export const VITAL_METRIC_LABELS: Record<VitalMetricKey, string> = {
  hr: '心率',
  spo2: '血氧饱和度',
  temp: '体温',
  rr: '呼吸频率',
  bp: '血压',
  fatigue: '疲劳指数',
  gait: '步态',
}

export const VITALS_LEVEL_LABELS: Record<VitalsLevel, string> = {
  normal: '正常',
  warning: '关注',
  critical: '危急',
}

export function levelByRange(
  value: number,
  opts: {
    warningLow?: number
    warningHigh?: number
    criticalLow?: number
    criticalHigh?: number
  },
): VitalsLevel {
  if (
    (opts.criticalLow != null && value < opts.criticalLow) ||
    (opts.criticalHigh != null && value > opts.criticalHigh)
  ) {
    return 'critical'
  }
  if (
    (opts.warningLow != null && value < opts.warningLow) ||
    (opts.warningHigh != null && value > opts.warningHigh)
  ) {
    return 'warning'
  }
  return 'normal'
}
