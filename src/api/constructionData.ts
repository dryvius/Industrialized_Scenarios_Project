import { MachineRunState } from '@/enums/MachineRunState'
import { SceneObjectType } from '@/enums/SceneObjectType'
import type { BusinessEntity, ConstructionDataBinding, SiteSummary } from '@/types/business'

const now = (): string => new Date().toISOString()

const summary: SiteSummary = {
  id: 'site_main',
  name: '东区电力基建施工现场',
  status: '作业中',
  updatedAt: now(),
  machineCount: 7,
  workerCount: 6,
  activeTasks: 3,
  safetyScore: 96,
  temperature: 12.4,
  metrics: {
    天气: '晴',
    班次: '白班',
  },
}

const machines: BusinessEntity[] = [
  {
    id: 'truck_01',
    type: SceneObjectType.Truck,
    name: '货运卡车 T-01',
    status: '物资转运',
    runState: MachineRunState.Running,
    updatedAt: now(),
    metrics: { 车牌: '沪A·D2108', 载货: '电缆附件', 运行态: 'running' },
  },
  {
    id: 'truck_02',
    type: SceneObjectType.Truck,
    name: '货运卡车 T-02',
    status: '待命',
    runState: MachineRunState.Idle,
    updatedAt: now(),
    metrics: { 车牌: '沪B·F8831', 载货: '工器具', 运行态: 'idle' },
  },
  {
    id: 'truck_03',
    type: SceneObjectType.Truck,
    name: '货运卡车 T-03',
    status: '进场',
    runState: MachineRunState.Idle,
    updatedAt: now(),
    metrics: { 车牌: '苏E·C6612', 载货: '金具', 运行态: 'idle' },
  },
  {
    id: 'crane_truck_01',
    type: SceneObjectType.CraneTruck,
    name: '随车吊 CT-01',
    status: '吊装作业',
    runState: MachineRunState.Running,
    updatedAt: now(),
    metrics: { 臂展: '18m', 操作员: '周凯', 运行态: 'running' },
  },
  {
    id: 'excavator_01',
    type: SceneObjectType.Excavator,
    name: '挖掘机 EX-01',
    status: '土方作业',
    runState: MachineRunState.Running,
    updatedAt: now(),
    metrics: { 斗容: '1.0m³', 操作员: '王强', 运行态: 'running' },
  },
  {
    id: 'mixer_01',
    type: SceneObjectType.Mixer,
    name: '履带搅拌车 MX-01',
    status: '待命',
    runState: MachineRunState.Idle,
    updatedAt: now(),
    metrics: { 容量: '6m³', 油位: '72%', 运行态: 'idle' },
  },
  {
    id: 'cable_spool_01',
    type: SceneObjectType.CableSpool,
    name: '电缆卷盘车 CS-01',
    status: '放线中',
    runState: MachineRunState.Running,
    updatedAt: now(),
    metrics: { 余缆: '420m', 线径: '110kV', 运行态: 'running' },
  },
]

const facilities: BusinessEntity[] = [
  {
    id: 'pylon_01',
    type: SceneObjectType.Pylon,
    name: '输电铁塔 T-01',
    status: '组立完成',
    updatedAt: now(),
    metrics: { 高度: '30m', 电压等级: '110kV' },
  },
  {
    id: 'substation_01',
    type: SceneObjectType.Substation,
    name: '变电站 S-01',
    status: '调试中',
    updatedAt: now(),
    metrics: { 间隔: 3, 值班: '刘洋' },
  },
  {
    id: 'equipment_01',
    type: SceneObjectType.Equipment,
    name: '发电机组 EG-01',
    status: '运行',
    updatedAt: now(),
    metrics: { 功率: '50kW', 燃油: '68%' },
  },
  {
    id: 'equipment_02',
    type: SceneObjectType.Equipment,
    name: '工具车 TL-02',
    status: '就位',
    updatedAt: now(),
  },
  {
    id: 'equipment_03',
    type: SceneObjectType.Equipment,
    name: '配电箱 PD-03',
    status: '通电',
    updatedAt: now(),
  },
]

const workers: BusinessEntity[] = [
  {
    id: 'worker_01',
    type: SceneObjectType.Worker,
    name: '班组长 W-01',
    status: '在岗',
    runState: MachineRunState.Idle,
    updatedAt: now(),
    metrics: { 岗位: '班组指挥', 安全帽: '红', 身高: '1.80m', 运行态: 'idle' },
  },
  {
    id: 'worker_02',
    type: SceneObjectType.Worker,
    name: '巡检员 W-02',
    status: '巡检',
    runState: MachineRunState.Running,
    updatedAt: now(),
    metrics: { 岗位: '现场巡检', 安全帽: '白', 身高: '1.72m', 运行态: 'running' },
  },
  {
    id: 'worker_03',
    type: SceneObjectType.Worker,
    name: '电工 W-03',
    status: '在岗',
    runState: MachineRunState.Running,
    updatedAt: now(),
    metrics: { 岗位: '电气作业', 安全帽: '蓝', 身高: '1.78m', 运行态: 'running' },
  },
  {
    id: 'worker_04',
    type: SceneObjectType.Worker,
    name: '放线工 W-04',
    status: '在岗',
    runState: MachineRunState.Running,
    updatedAt: now(),
    metrics: { 岗位: '放线', 安全帽: '蓝', 身高: '1.75m', 运行态: 'running' },
  },
  {
    id: 'worker_05',
    type: SceneObjectType.Worker,
    name: '巡检员 W-05',
    status: '巡检',
    runState: MachineRunState.Idle,
    updatedAt: now(),
    metrics: { 岗位: '安全巡检', 安全帽: '白', 身高: '1.68m', 运行态: 'idle' },
  },
  {
    id: 'worker_06',
    type: SceneObjectType.Worker,
    name: '起重工 W-06',
    status: '在岗',
    runState: MachineRunState.Idle,
    updatedAt: now(),
    metrics: { 岗位: '起重辅助', 安全帽: '蓝', 身高: '1.85m', 运行态: 'idle' },
  },
  {
    id: 'worker_07',
    type: SceneObjectType.Worker,
    name: '高空作业 W-07',
    status: '登塔作业',
    runState: MachineRunState.Running,
    updatedAt: now(),
    metrics: {
      岗位: '杆塔高空',
      安全帽: '蓝',
      身高: '1.76m',
      运行态: 'running',
      挂点: 'mast→arm',
    },
  },
]

const entityMap = new Map<string, BusinessEntity>()

function register(entity: BusinessEntity, businessKey: string): void {
  entityMap.set(businessKey, entity)
  entityMap.set(entity.id, entity)
}

register(machines[0], 'truck:T-01')
register(machines[1], 'truck:T-02')
register(machines[2], 'truck:T-03')
register(machines[3], 'machine:crane-01')
register(machines[4], 'machine:excavator-01')
register(machines[5], 'machine:mixer-01')
register(machines[6], 'machine:spool-01')
register(facilities[0], 'facility:pylon-01')
register(facilities[1], 'facility:substation-01')
register(facilities[2], 'equipment:eg-01')
register(facilities[3], 'equipment:tl-02')
register(facilities[4], 'equipment:pd-03')
workers.forEach((item: BusinessEntity, index: number) => {
  register(item, `worker:0${index + 1}`)
})

async function delay<T>(value: T, ms = 100): Promise<T> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(value), ms)
  })
}

export const constructionDataApi: ConstructionDataBinding = {
  fetchSummary: async (): Promise<SiteSummary> => delay({ ...summary, updatedAt: now() }),
  fetchEntityByKey: async (businessKey: string): Promise<BusinessEntity | null> => {
    return delay(entityMap.get(businessKey) ?? null)
  },
  fetchMachines: async (): Promise<BusinessEntity[]> => delay(machines.map((item) => ({ ...item }))),
  fetchWorkers: async (): Promise<BusinessEntity[]> => delay(workers.map((item) => ({ ...item }))),
  fetchFacilities: async (): Promise<BusinessEntity[]> =>
    delay(facilities.map((item) => ({ ...item }))),
}
