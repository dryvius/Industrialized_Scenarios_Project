import { VITALS_LEVEL_LABELS, VITALS_THRESHOLDS, VITAL_METRIC_LABELS, levelByRange } from '@/constants/vitals'
import type {
  VitalHistoryPoint,
  VitalMetricKey,
  VitalMetricView,
  VitalsLevel,
  WorkerHealthDetail,
  WorkerVitals,
} from '@/types/vitals'

export function formatVitalsUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '—'
  }
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function formatVitalsClock(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function vitalsLevelLabel(level: VitalsLevel): string {
  return VITALS_LEVEL_LABELS[level]
}

export function maxLevel(a: VitalsLevel, b: VitalsLevel): VitalsLevel {
  const rank: Record<VitalsLevel, number> = { normal: 0, warning: 1, critical: 2 }
  return rank[a] >= rank[b] ? a : b
}

export function resolveBloodPressureLevel(vitals: WorkerVitals): VitalsLevel {
  return maxLevel(
    levelByRange(vitals.bloodPressure.systolic, VITALS_THRESHOLDS.bloodPressureSystolic),
    levelByRange(vitals.bloodPressure.diastolic, {
      warningHigh: 90,
      criticalHigh: 100,
      warningLow: 60,
      criticalLow: 50,
    }),
  )
}

export function buildVitalMetricViews(vitals: WorkerVitals): VitalMetricView[] {
  const hrLevel = levelByRange(vitals.heartRateBpm, VITALS_THRESHOLDS.heartRateBpm)
  const spo2Level = levelByRange(vitals.spo2Percent, {
    warningLow: VITALS_THRESHOLDS.spo2Percent.warningLow,
    criticalLow: VITALS_THRESHOLDS.spo2Percent.criticalLow,
  })
  const tempLevel = levelByRange(vitals.bodyTempC, VITALS_THRESHOLDS.bodyTempC)
  const rrLevel = levelByRange(vitals.respiratoryRate, VITALS_THRESHOLDS.respiratoryRate)
  const bpLevel = resolveBloodPressureLevel(vitals)

  return [
    {
      key: 'hr',
      label: VITAL_METRIC_LABELS.hr,
      value: String(Math.round(vitals.heartRateBpm)),
      unit: 'bpm',
      level: hrLevel,
      available: true,
    },
    {
      key: 'spo2',
      label: VITAL_METRIC_LABELS.spo2,
      value: String(Math.round(vitals.spo2Percent)),
      unit: 'SpO₂ %',
      level: spo2Level,
      available: true,
    },
    {
      key: 'temp',
      label: VITAL_METRIC_LABELS.temp,
      value: vitals.bodyTempC.toFixed(1),
      unit: '℃',
      level: tempLevel,
      available: true,
    },
    {
      key: 'rr',
      label: VITAL_METRIC_LABELS.rr,
      value: String(Math.round(vitals.respiratoryRate)),
      unit: '次/分',
      level: rrLevel,
      available: true,
    },
    {
      key: 'bp',
      label: VITAL_METRIC_LABELS.bp,
      value: `${Math.round(vitals.bloodPressure.systolic)}/${Math.round(vitals.bloodPressure.diastolic)}`,
      unit: 'mmHg',
      level: bpLevel,
      available: true,
    },
  ]
}

export function buildHoneycombMetricViews(detail: WorkerHealthDetail): VitalMetricView[] {
  const core = buildVitalMetricViews(detail)
  const extras = detail.extraSlots.map((slot): VitalMetricView => ({
    key: slot.key,
    label: slot.label,
    value: slot.available ? (slot.value ?? '—') : '未接入',
    unit: slot.available ? (slot.unit ?? '') : '',
    level: slot.level ?? 'normal',
    available: slot.available,
  }))
  return [...core, ...extras]
}

export function historyForMetric(
  detail: WorkerHealthDetail | null,
  key: VitalMetricKey,
): VitalHistoryPoint[] {
  if (!detail) {
    return []
  }
  return detail.history[key] ?? []
}

export function metricUnit(key: VitalMetricKey): string {
  const units: Record<VitalMetricKey, string> = {
    hr: 'bpm',
    spo2: '%',
    temp: '℃',
    rr: '次/分',
    bp: 'mmHg',
    fatigue: '分',
    gait: '',
  }
  return units[key]
}
