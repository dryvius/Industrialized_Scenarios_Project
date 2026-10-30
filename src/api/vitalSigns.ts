import { constructionDataApi } from '@/api/constructionData'
import { VITALS_THRESHOLDS, levelByRange } from '@/constants/vitals'
import type {
  SiteHealthOverview,
  VitalAlert,
  VitalExpansionSlot,
  VitalHistoryPoint,
  VitalMetricKey,
  VitalTimelineEvent,
  VitalsLevel,
  WearableDevice,
  WorkerHealthCard,
  WorkerHealthDetail,
  WorkerVitals,
} from '@/types/vitals'
interface VitalsSeed {
  heartRateBpm: number
  spo2Percent: number
  bodyTempC: number
  respiratoryRate: number
  systolic: number
  diastolic: number
  fatigue: number
  gaitAvailable: boolean
}

/** 按工人给出略有差异的演示基线 */
const SEEDS: Record<string, VitalsSeed> = {
  'worker:01': {
    heartRateBpm: 72,
    spo2Percent: 98,
    bodyTempC: 36.6,
    respiratoryRate: 16,
    systolic: 118,
    diastolic: 76,
    fatigue: 28,
    gaitAvailable: false,
  },
  'worker:02': {
    heartRateBpm: 78,
    spo2Percent: 97,
    bodyTempC: 36.7,
    respiratoryRate: 17,
    systolic: 122,
    diastolic: 78,
    fatigue: 34,
    gaitAvailable: true,
  },
  'worker:03': {
    heartRateBpm: 108,
    spo2Percent: 95,
    bodyTempC: 37.6,
    respiratoryRate: 22,
    systolic: 142,
    diastolic: 88,
    fatigue: 64,
    gaitAvailable: false,
  },
  'worker:04': {
    heartRateBpm: 86,
    spo2Percent: 93,
    bodyTempC: 37.8,
    respiratoryRate: 19,
    systolic: 136,
    diastolic: 86,
    fatigue: 58,
    gaitAvailable: false,
  },
  'worker:05': {
    heartRateBpm: 70,
    spo2Percent: 99,
    bodyTempC: 36.4,
    respiratoryRate: 15,
    systolic: 115,
    diastolic: 74,
    fatigue: 22,
    gaitAvailable: true,
  },
  'worker:06': {
    heartRateBpm: 76,
    spo2Percent: 98,
    bodyTempC: 36.6,
    respiratoryRate: 16,
    systolic: 124,
    diastolic: 80,
    fatigue: 31,
    gaitAvailable: false,
  },
  'worker:07': {
    heartRateBpm: 132,
    spo2Percent: 87,
    bodyTempC: 38.9,
    respiratoryRate: 30,
    systolic: 168,
    diastolic: 104,
    fatigue: 86,
    gaitAvailable: false,
  },
}

const DEFAULT_SEED: VitalsSeed = SEEDS['worker:01']

function jitter(base: number, amplitude: number): number {
  return base + (Math.random() * 2 - 1) * amplitude
}

function delay<T>(value: T, ms = 80): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms)
  })
}

function workerBusinessKey(workerId: string): string {
  const suffix = workerId.replace('worker_', '')
  return `worker:${suffix}`
}

function resolveOverall(vitals: Omit<WorkerVitals, 'overallStatus'>, fatigue: number): VitalsLevel {
  const levels: VitalsLevel[] = [
    levelByRange(vitals.heartRateBpm, VITALS_THRESHOLDS.heartRateBpm),
    levelByRange(vitals.spo2Percent, {
      warningLow: VITALS_THRESHOLDS.spo2Percent.warningLow,
      criticalLow: VITALS_THRESHOLDS.spo2Percent.criticalLow,
    }),
    levelByRange(vitals.bodyTempC, VITALS_THRESHOLDS.bodyTempC),
    levelByRange(vitals.respiratoryRate, VITALS_THRESHOLDS.respiratoryRate),
    levelByRange(vitals.bloodPressure.systolic, VITALS_THRESHOLDS.bloodPressureSystolic),
    levelByRange(vitals.bloodPressure.diastolic, {
      warningHigh: 90,
      criticalHigh: 100,
      warningLow: 60,
      criticalLow: 50,
    }),
    levelByRange(fatigue, VITALS_THRESHOLDS.fatigueScore),
  ]
  if (levels.includes('critical')) {
    return 'critical'
  }
  if (levels.includes('warning')) {
    return 'warning'
  }
  return 'normal'
}

function buildHistory(key: VitalMetricKey, current: number, minutes = 15): VitalHistoryPoint[] {
  const points: VitalHistoryPoint[] = []
  const now = Date.now()
  const stepMs = (minutes * 60 * 1000) / 90
  const amplitude = key === 'temp' ? 0.12 : key === 'spo2' ? 0.8 : current * 0.045
  for (let i = 0; i < 90; i += 1) {
    const t = 1 - i / 89
    const wander = Math.sin(i * 0.33) * amplitude + Math.sin(i * 0.11) * amplitude * 0.4
    const value = current - wander * t
    points.push({
      at: new Date(now - (89 - i) * stepMs).toISOString(),
      value: Number(value.toFixed(2)),
    })
  }
  return points
}

function buildBpHistory(systolic: number): VitalHistoryPoint[] {
  return buildHistory('bp', systolic)
}

function buildDevices(businessKey: string, updatedAt: string): WearableDevice[] {
  const helmetOnline = businessKey !== 'worker:05'
  return [
    {
      id: `${businessKey}-band`,
      name: '腕带监测',
      kind: 'band',
      online: true,
      batteryPercent: businessKey === 'worker:07' ? 28 : 76,
      lastHeartbeatAt: updatedAt,
    },
    {
      id: `${businessKey}-helmet`,
      name: '安全帽传感',
      kind: 'helmet',
      online: helmetOnline,
      batteryPercent: helmetOnline ? 61 : 4,
      lastHeartbeatAt: helmetOnline ? updatedAt : new Date(Date.now() - 18 * 60 * 1000).toISOString(),
    },
  ]
}

function buildRiskSummary(overall: VitalsLevel, hr: number, fatigue: number): string {
  if (overall === 'critical') {
    return '综合状态危急，请立即复核现场人员'
  }
  if (hr >= 100) {
    return `心率偏高已持续约 12 分钟（${Math.round(hr)} bpm）`
  }
  if (fatigue >= 60) {
    return `疲劳指数偏高（${Math.round(fatigue)} 分），建议轮换休息`
  }
  if (overall === 'warning') {
    return '存在关注级指标，持续监测中'
  }
  return '各项体征处于演示参考范围内'
}

function buildTimeline(overall: VitalsLevel, hr: number): VitalTimelineEvent[] {
  const now = Date.now()
  const events: VitalTimelineEvent[] = [
    {
      id: 'boot',
      at: new Date(now - 28 * 60 * 1000).toISOString(),
      label: '穿戴设备上线',
      level: 'normal',
    },
    {
      id: 'scan',
      at: new Date(now - 16 * 60 * 1000).toISOString(),
      label: '完成全身扫描校准',
      level: 'normal',
    },
  ]
  if (hr >= 100) {
    events.push({
      id: 'hr-up',
      at: new Date(now - 12 * 60 * 1000).toISOString(),
      label: '心率越过关注阈值',
      level: 'warning',
    })
  }
  if (overall !== 'normal') {
    events.push({
      id: 'watch',
      at: new Date(now - 4 * 60 * 1000).toISOString(),
      label: '进入重点监测窗口',
      level: overall,
    })
  } else {
    events.push({
      id: 'stable',
      at: new Date(now - 3 * 60 * 1000).toISOString(),
      label: '体征稳定',
      level: 'normal',
    })
  }
  return events
}

function buildExtraSlots(seed: VitalsSeed, fatigue: number): VitalExpansionSlot[] {
  const fatigueLevel = levelByRange(fatigue, VITALS_THRESHOLDS.fatigueScore)
  return [
    {
      key: 'fatigue',
      label: '疲劳指数',
      available: true,
      value: String(Math.round(fatigue)),
      unit: '分',
      level: fatigueLevel,
    },
    {
      key: 'gait',
      label: '步态',
      available: seed.gaitAvailable,
      value: seed.gaitAvailable ? '稳态' : undefined,
      unit: seed.gaitAvailable ? '' : undefined,
      level: 'normal',
    },
  ]
}

function sampleSnapshot(businessKey: string): {
  draft: Omit<WorkerVitals, 'overallStatus'>
  fatigue: number
  seed: VitalsSeed
} {
  const seed = SEEDS[businessKey] ?? DEFAULT_SEED
  const workerId = businessKey.replace(':', '_')
  const fatigue = Math.round(jitter(seed.fatigue, 3))
  const draft: Omit<WorkerVitals, 'overallStatus'> = {
    workerId,
    businessKey,
    heartRateBpm: Math.round(jitter(seed.heartRateBpm, 3)),
    spo2Percent: Math.round(jitter(seed.spo2Percent, 0.6)),
    bodyTempC: Number(jitter(seed.bodyTempC, 0.08).toFixed(1)),
    respiratoryRate: Math.round(jitter(seed.respiratoryRate, 1)),
    bloodPressure: {
      systolic: Math.round(jitter(seed.systolic, 3)),
      diastolic: Math.round(jitter(seed.diastolic, 2)),
    },
    updatedAt: new Date().toISOString(),
    source: 'mock',
  }
  return { draft, fatigue, seed }
}

function toDetail(
  draft: Omit<WorkerVitals, 'overallStatus'>,
  fatigue: number,
  seed: VitalsSeed,
  workerName: string,
  role: string,
  dutyStatus: string,
): WorkerHealthDetail {
  const overallStatus = resolveOverall(draft, fatigue)
  const history: WorkerHealthDetail['history'] = {
    hr: buildHistory('hr', draft.heartRateBpm),
    spo2: buildHistory('spo2', draft.spo2Percent),
    temp: buildHistory('temp', draft.bodyTempC),
    rr: buildHistory('rr', draft.respiratoryRate),
    bp: buildBpHistory(draft.bloodPressure.systolic),
    fatigue: buildHistory('fatigue', fatigue),
    gait: seed.gaitAvailable ? buildHistory('gait', 1) : [],
  }

  return {
    ...draft,
    overallStatus,
    workerName,
    role,
    dutyStatus,
    devices: buildDevices(draft.businessKey, draft.updatedAt),
    riskSummary: buildRiskSummary(overallStatus, draft.heartRateBpm, fatigue),
    history,
    timeline: buildTimeline(overallStatus, draft.heartRateBpm),
    extraSlots: buildExtraSlots(seed, fatigue),
  }
}

function alertMessage(detail: WorkerHealthDetail): VitalAlert | null {
  const hrLevel = levelByRange(detail.heartRateBpm, VITALS_THRESHOLDS.heartRateBpm)
  if (hrLevel !== 'normal') {
    return {
      id: `${detail.businessKey}-hr`,
      workerId: detail.workerId,
      businessKey: detail.businessKey,
      workerName: detail.workerName,
      metricKey: 'hr',
      level: hrLevel,
      message: `${detail.workerName} 心率 ${detail.heartRateBpm} bpm`,
      at: detail.updatedAt,
    }
  }
  const rrLevel = levelByRange(detail.respiratoryRate, VITALS_THRESHOLDS.respiratoryRate)
  if (rrLevel !== 'normal') {
    return {
      id: `${detail.businessKey}-rr`,
      workerId: detail.workerId,
      businessKey: detail.businessKey,
      workerName: detail.workerName,
      metricKey: 'rr',
      level: rrLevel,
      message: `${detail.workerName} 呼吸频率 ${detail.respiratoryRate} 次/分`,
      at: detail.updatedAt,
    }
  }
  const fatigueSlot = detail.extraSlots.find((slot) => slot.key === 'fatigue')
  if (fatigueSlot?.available && fatigueSlot.level && fatigueSlot.level !== 'normal') {
    return {
      id: `${detail.businessKey}-fatigue`,
      workerId: detail.workerId,
      businessKey: detail.businessKey,
      workerName: detail.workerName,
      metricKey: 'fatigue',
      level: fatigueSlot.level,
      message: `${detail.workerName} 疲劳指数 ${fatigueSlot.value} 分`,
      at: detail.updatedAt,
    }
  }
  return null
}

/**
 * 生命体征适配器：当前为明确标记的 Mock，后续可替换为真实设备接口。
 */
export const vitalSignsApi = {
  async fetchByBusinessKey(businessKey: string): Promise<WorkerHealthDetail | null> {
    const entity = await constructionDataApi.fetchEntityByKey(businessKey)
    const { draft, fatigue, seed } = sampleSnapshot(businessKey)
    const detail = toDetail(
      draft,
      fatigue,
      seed,
      entity?.name ?? '未知人员',
      String(entity?.metrics?.['岗位'] ?? '现场作业'),
      entity?.status ?? '在岗',
    )
    return delay(detail)
  },

  async fetchDemoProfile(): Promise<WorkerHealthDetail> {
    const detail = await this.fetchByBusinessKey('worker:01')
    if (!detail) {
      throw new Error('演示生命体征不可用')
    }
    return {
      ...detail,
      workerName: '全息演示对象',
      role: '扫描校准',
      dutyStatus: '演示',
      riskSummary: '当前为演示数据，未接入真实穿戴设备',
    }
  },

  async fetchOverview(): Promise<SiteHealthOverview> {
    const workers = await constructionDataApi.fetchWorkers()
    const cards: WorkerHealthCard[] = []
    const alerts: VitalAlert[] = []
    let warning = 0
    let critical = 0
    let onlineDevices = 0
    let totalDevices = 0
    let highHeartRate = 0
    let lowSpo2 = 0
    let fever = 0

    for (const worker of workers) {
      const businessKey = workerBusinessKey(worker.id)
      const { draft, fatigue, seed } = sampleSnapshot(businessKey)
      const detail = toDetail(
        draft,
        fatigue,
        seed,
        worker.name,
        String(worker.metrics?.['岗位'] ?? '现场作业'),
        worker.status,
      )
      cards.push({
        businessKey,
        workerId: worker.id,
        name: worker.name,
        role: detail.role,
        status: worker.status,
        overallStatus: detail.overallStatus,
        heartRateBpm: detail.heartRateBpm,
        latestAlert: alertMessage(detail)?.message ?? null,
        source: 'mock',
      })
      if (detail.overallStatus === 'warning') {
        warning += 1
      }
      if (detail.overallStatus === 'critical') {
        critical += 1
      }
      if (detail.heartRateBpm >= VITALS_THRESHOLDS.heartRateBpm.warningHigh) {
        highHeartRate += 1
      }
      if (detail.spo2Percent <= VITALS_THRESHOLDS.spo2Percent.warningLow) {
        lowSpo2 += 1
      }
      if (detail.bodyTempC >= VITALS_THRESHOLDS.bodyTempC.warningHigh) {
        fever += 1
      }
      detail.devices.forEach((device) => {
        totalDevices += 1
        if (device.online) {
          onlineDevices += 1
        }
      })
      const alert = alertMessage(detail)
      if (alert) {
        alerts.push(alert)
      }
    }

    alerts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

    const overview: SiteHealthOverview = {
      updatedAt: new Date().toISOString(),
      source: 'mock',
      counts: {
        onDuty: workers.length,
        warning,
        critical,
        deviceOnlineRate: totalDevices === 0 ? 0 : Math.round((onlineDevices / totalDevices) * 100),
      },
      distribution: {
        highHeartRate,
        lowSpo2,
        fever,
      },
      workers: cards,
      alerts,
    }
    return delay(overview, 120)
  },
}
