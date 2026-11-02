/** 病毒健康监控面板数据契约 */

export type VirusMonitorSource = 'mock' | 'device'

/** 右上主指标（大字号数值，如「历代基因 88.0」） */
export interface VirusPrimaryMetric {
  id: string
  label: string
  value: number
  /** 小数位，默认 1 */
  digits?: number
}

export interface VirusRingMetric {
  id: string
  label: string
  value: number
  max: number
  /** 环形进度色，缺省用面板强调青 */
  accent?: 'mint' | 'cyan'
  /** 装饰性环填充比例（0–1）；缺省用 value/max */
  arcProgress?: number
}

export interface VirusTrendSeries {
  id: string
  label: string
  unit: string
  percent: number
  /** 归一化到 0–1，供折线渲染 */
  points: number[]
  /** 纵轴上限，用于刻度与点位映射，默认 40 */
  axisMax?: number
  /** 纵轴刻度文案（从上到下），默认 [40, 30, 20, 0] */
  axisTicks?: number[]
}

export interface VirusFootnote {
  id: string
  label: string
  value: string
  hint?: string
  /** accent：数值用强调青显示（如 80.0） */
  tone?: 'default' | 'accent'
}

export interface VirusMonitorSnapshot {
  title: string
  location: string
  weatherLabel: string
  weatherTemp: string
  immuneSystemScore: number
  immuneSystemLabel: string
  primaryMetrics: VirusPrimaryMetric[]
  rings: VirusRingMetric[]
  trends: VirusTrendSeries[]
  footnotes: VirusFootnote[]
  source: VirusMonitorSource
  updatedAt: string
}

export interface VirusMonitorDataBinding {
  fetchDemoSnapshot: () => Promise<VirusMonitorSnapshot>
}
