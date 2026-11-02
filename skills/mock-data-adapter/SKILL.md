---
name: mock-data-adapter
description: 在本项目中新增或替换业务数据源、扩展 Pinia 状态、处理异步加载与错误展示时，
  用可替换的适配器契约加显式数据来源标记完成接入。
  当任务涉及无后端开发、Mock 演示数据、接入真实接口、
  新增 store 状态、补齐加载与失败态时使用。
---

# Mock 数据适配器与异步状态

## 1. 目标

在后端未就绪时也能完整开发 UI，并在接入真实数据时做到组件零改动：

1. 数据访问收敛到 `xxxApi` 适配器，对外只暴露 `Promise<T>` 的方法签名。
2. 演示数据必须可被识别（`source: 'mock'`），UI 明确标注，绝不伪装成真实读数。
3. 每个异步资源有独立的加载态与错误文案，互不覆盖。
4. 替换为真实接口时，只改适配器内部实现与 `source` 字段。

## 2. 执行前检查

1. 读 `src/types/business.ts` 的 `ConstructionDataBinding` 与 `SiteSummary` / `BusinessEntity`。
2. 读 `src/types/vitals.ts` 的 `VitalsSource`、`WorkerHealthDetail`、`SiteHealthOverview`。
3. 读 `src/api/constructionData.ts` 的 `register()`、`delay()`、`entityMap`。
4. 读 `src/api/vitalSigns.ts` 的 `SEEDS`、`sampleSnapshot`、`fetchOverview`。
5. 读 `src/stores/siteStore.ts` 的三组 `loading` / `error` 与对应 action。
6. 检查 `src/constants/vitals.ts`，确认阈值与分级只此一份。
7. 检查 UI 是否已有来源徽章位置（`WorkerIdentityRail` 的 `sourceLabel`、`HealthOpsHud` 的 `sourceLabel`）。
8. 确认新资源是否需要**独立**的加载态，而不是复用现有的 `loading`。

## 3. 开发流程

### 步骤一：先定义契约（接口），再写实现

```ts
export interface ConstructionDataBinding {
  fetchSummary: () => Promise<SiteSummary>
  fetchEntityByKey: (businessKey: string) => Promise<BusinessEntity | null>
  fetchMachines: () => Promise<BusinessEntity[]>
  fetchWorkers: () => Promise<BusinessEntity[]>
  fetchFacilities: () => Promise<BusinessEntity[]>
}
```

- 契约放在 `src/types/`，实现放在 `src/api/`。
- 方法名表达「取什么」，不表达「怎么取」；不把分页、重试、错误码塞进契约，除非真实后端已确定。
- 返回 `null` 表示「查无此项」，抛错表示「取数失败」。两者在 UI 上必须是不同文案。

### 步骤二：写 Mock 实现

- 静态种子放模块级常量（`SEEDS`、`machines`、`facilities`），返回时**浅拷贝**，避免调用方改到源数据。
- 需要模拟网络时延的，统一走一个可替换的 `delay`；不要在多处散落 `setTimeout`。
- 时间字段用 `now()` 动态生成，不要在模块加载时冻结成一个固定时间。
- 所有返回值显式带 `source: 'mock'`（生命体征类）或由适配器统一声明来源。
- 演示数据要有区分度：至少覆盖正常、关注、危急三档，否则 UI 的分级样式永远没被验证过。

```ts
const now = (): string => new Date().toISOString()

async function delay<T>(value: T, ms = 100): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
```

> 当前仓库的 `delay` 直接用 `window.setTimeout`，导致适配器只能在浏览器里跑。改造时应把定时器作为可注入依赖，或改为 `globalThis.setTimeout`，否则无法为基础逻辑补测试。

### 步骤三：在 store 中建立「每资源三态」

```ts
const overviewLoading = ref(false)
const overviewError = ref('')

async function loadHealthOverview(): Promise<void> {
  overviewLoading.value = true
  overviewError.value = ''
  try {
    healthOverview.value = await vitalSignsApi.fetchOverview()
  } catch (error) {
    // 保留异常用于排查，同时给用户固定可读文案
    console.error('[siteStore] loadHealthOverview failed', error)
    overviewError.value = '健康监测态势加载失败，请稍后重试'
  } finally {
    overviewLoading.value = false
  }
}
```

规则：

1. 一个资源一组 `loading` / `error` / 数据，不复用同一个布尔值。
2. 请求开始先清空旧错误，避免「上次失败」的文案残留。
3. `finally` 必须复位加载态。
4. 错误文案面向用户，不要直接把异常 `message` 抛到界面。
5. 派生数据用方法或 `computed`（如 `workerLevelMap()`），不落成可写状态。

### 步骤四：UI 层显示来源与状态

- 来源徽章三态：`mock → 演示数据`、`device → 设备实时`、无数据 `→ 未接入`。
- 列表为空显示「暂无数据」，不要用 `0` 或占位数字伪装成真实读数。
- 加载中、失败、空、有数据四种状态都要有对应分支，且失败时可重试。
- 来源判断集中在工具函数或组件 `computed` 里，不要在模板中散写字符串比较。

### 步骤五：预留真实接口替换点

接入真实后端时只做三件事：

1. 替换适配器内部实现（保留方法名与返回类型）。
2. 把 `source` 改为 `'device'`。
3. 如响应结构有差异，在适配器内部做映射，**不要把字段改名扩散到组件**。

需要新增字段时，先扩展 `src/types/` 的接口，再补 UI；不要在组件里用可选链猜字段。

### 步骤六：验证

1. 断网或强制抛错：界面显示可读文案，不白屏，不留旧数据。
2. 慢请求：加载态可见，且不会因为并发请求互相覆盖。
3. 空列表：显示空态而不是 `0`。
4. 三档演示数据：正常 / 关注 / 危急样式都能出现。
5. 替换一个适配器方法为「立即返回固定值」，确认组件无需改动。
6. `npm run build` 通过。
7. 若没有运行环境，明确说明未做运行时验证。

## 4. 约束

- 不得把 Mock 数据直接写进组件或 store。
- 不得让演示数据缺少来源标记；UI 不得把它展示成实时数据。
- 不得在 API 层复制业务阈值。当前血压舒张压阈值在 `vitalSigns.ts` 与 `vitalsFormat.ts` 各写了一份，属于已知缺陷，新增指标时不要再复制第三份。
- 不得使用依赖 `this` 的对象方法互相调用（现有 `fetchDemoProfile` 调用 `this.fetchByBusinessKey` 属反例），改用模块内函数或显式传参。
- 不得用空的 `catch {}` 静默吞掉异常。
- 不得为单个页面新增第二个 store 来绕开已有状态；先评估能否扩展现有 store。
- 不得声称「已接入真实数据」，除非适配器确实调用了真实接口并验证过。

## 5. 最终交付

完成任务后，说明：

1. 修改了哪些文件。
2. 契约定义（方法签名）与它所在的类型文件。
3. Mock 覆盖范围：哪些方法、哪些数据档位、哪些异常分支。
4. store 状态设计：新增了哪几组三态，是否与既有状态冲突。
5. 数据来源在 UI 上如何体现。
6. 真实接口的替换步骤，以及替换后组件是否真的零改动。
7. 执行了哪些验证；未执行哪些、为什么。
