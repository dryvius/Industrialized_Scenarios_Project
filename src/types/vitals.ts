/** 生命体征数据来源：mock 必须在 UI 标明演示 */
export type VitalsSource = 'mock' | 'device'

export type VitalsLevel = 'normal' | 'warning' | 'critical'

export type VitalMetricKey = 'hr' | 'spo2' | 'temp' | 'rr' | 'bp' | 'fatigue' | 'gait'

export interface BloodPressure {
  systolic: number
  diastolic: number
}

export interface WearableDevice {
  id: string
  name: string
  kind: 'band' | 'helmet'
  online: boolean
  batteryPercent: number
  lastHeartbeatAt: string
}

export interface VitalHistoryPoint {
  at: string
  value: number
}

export interface VitalAlert {
  id: string
  workerId: string
  businessKey: string
  workerName: string
  metricKey: VitalMetricKey
  level: VitalsLevel
  message: string
  at: string
}

export interface VitalTimelineEvent {
  id: string
  at: string
  label: string
  level: VitalsLevel
}

export interface VitalExpansionSlot {
  key: VitalMetricKey
  label: string
  available: boolean
  value?: string
  unit?: string
  level?: VitalsLevel
}

export interface WorkerVitals {
  workerId: string
  businessKey: string
  heartRateBpm: number
  spo2Percent: number
  bodyTempC: number
  respiratoryRate: number
  bloodPressure: BloodPressure
  updatedAt: string
  source: VitalsSource
  overallStatus: VitalsLevel
}

export interface WorkerHealthDetail extends WorkerVitals {
  workerName: string
  role: string
  dutyStatus: string
  devices: WearableDevice[]
  riskSummary: string
  history: Record<VitalMetricKey, VitalHistoryPoint[]>
  timeline: VitalTimelineEvent[]
  extraSlots: VitalExpansionSlot[]
}

export interface VitalMetricView {
  key: VitalMetricKey
  label: string
  value: string
  unit: string
  level: VitalsLevel
  available: boolean
}

export interface WorkerHealthCard {
  businessKey: string
  workerId: string
  name: string
  role: string
  status: string
  overallStatus: VitalsLevel
  heartRateBpm: number
  latestAlert: string | null
  source: VitalsSource
}

export interface SiteHealthCounts {
  onDuty: number
  warning: number
  critical: number
  deviceOnlineRate: number
}

export interface SiteHealthDistribution {
  highHeartRate: number
  lowSpo2: number
  fever: number
}

export interface SiteHealthOverview {
  updatedAt: string
  source: VitalsSource
  counts: SiteHealthCounts
  distribution: SiteHealthDistribution
  workers: WorkerHealthCard[]
  alerts: VitalAlert[]
}
