import type { VirusMonitorDataBinding, VirusMonitorSnapshot } from '@/types/virusMonitor'

const now = (): string => new Date().toISOString()

async function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => {
    globalThis.setTimeout((): void => {
      resolve(value)
    }, ms)
  })
}

/**
 * 演示快照：数值对齐效果图信息架构（88.0 / 83.0 / 70.0 / 59.0 / 244），
 * 仅作视觉演示，不构成医疗或诊断依据。
 */
function buildDemoSnapshot(): VirusMonitorSnapshot {
  return {
    title: '新型冠状病毒 - 人体健康监控',
    location: '北京',
    weatherLabel: '晴',
    weatherTemp: '23°',
    immuneSystemScore: 244,
    immuneSystemLabel: '免疫系统',
    primaryMetrics: [
      { id: 'gene', label: '历代基因', value: 88.0, digits: 1 },
      { id: 'hbos', label: 'HbOS', value: 83.0, digits: 1 },
    ],
    rings: [
      { id: 'tvs-ii', label: 'TVS-II', value: 70.0, max: 100, accent: 'mint', arcProgress: 0.9 },
      { id: 'hbe', label: 'HbE型', value: 59.0, max: 100, accent: 'cyan', arcProgress: 0.84 },
    ],
    trends: [
      {
        id: 'muscle',
        label: '肌肉率',
        unit: '%',
        percent: 80,
        axisMax: 40,
        axisTicks: [40, 30, 20, 0],
        points: [0.72, 0.83, 0.76, 0.88, 0.8, 0.9, 0.78, 0.86, 0.74, 0.81],
      },
      {
        id: 'lung',
        label: '肺活量',
        unit: '%',
        percent: 51,
        axisMax: 40,
        axisTicks: [40, 30, 20, 0],
        points: [0.52, 0.61, 0.54, 0.59, 0.56, 0.64, 0.58, 0.62, 0.55, 0.6],
      },
      {
        id: 'water',
        label: '人体水分',
        unit: '%',
        percent: 96,
        axisMax: 40,
        axisTicks: [40, 30, 20, 0],
        points: [0.74, 0.82, 0.76, 0.86, 0.8, 0.9, 0.83, 0.88, 0.85, 0.92],
      },
    ],
    footnotes: [
      { id: 'mthfr', label: 'MTHFR', value: 'CC', hint: '(C677T)' },
      { id: 'hc2-status', label: 'HC2 DNA', value: '阴性', hint: '正常 · 阴性' },
      {
        id: 'hc2-value',
        label: 'HC2 DNA',
        value: '80.0',
        hint: '参考值 < 1.00',
        tone: 'accent',
      },
    ],
    source: 'mock',
    updatedAt: now(),
  }
}

async function fetchDemoSnapshot(): Promise<VirusMonitorSnapshot> {
  const snapshot = buildDemoSnapshot()
  return delay({
    ...snapshot,
    primaryMetrics: snapshot.primaryMetrics.map((metric) => ({ ...metric })),
    rings: snapshot.rings.map((ring) => ({ ...ring })),
    trends: snapshot.trends.map((series) => ({
      ...series,
      points: [...series.points],
    })),
    footnotes: snapshot.footnotes.map((item) => ({ ...item })),
  })
}

export const virusMonitorApi: VirusMonitorDataBinding = {
  fetchDemoSnapshot,
}
