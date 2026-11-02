---
name: scene-layout-ssot
description: 在当前三维施工场景中新增或移动实体、调整演示路径、修复穿模时，
  用布局与尺度的单一数据源约束位置、路径、占地和碰撞代理。
  当任务涉及新增车辆或人员、修改演示路线、出现车穿塔或人车对穿、
  开机瞬移、碰撞体与模型错位时使用。
---

# 场景布局 SSOT 与防穿模

## 1. 目标

把「实体在哪、走哪条路、占多大地方、用什么碰撞体」收敛到唯一数据源，做到：

1. 视觉网格、演示路径、物理碰撞三方共用同一组坐标，改一处全部生效。
2. 不开物理引擎时演示循环也不出现明显穿模。
3. 新增实体时不需要凭感觉写坐标，也不需要事后靠调参数救火。
4. 每条路径都能被验证：首点等于初始位、环线闭合、与关键设施保持净空。

## 2. 执行前检查

1. 读 `src/constants/scale.ts`：`WORKER_SCALE`、`PYLON_SCALE`、`PYLON_CLIMB`、`SUBSTATION_SCALE`、`VEHICLE_SCALE`、`FACILITY_LAYOUT`。
2. 读 `src/scene/layout/sceneLayout.ts`：`SITE_LAYOUT`、`DEMO_PATHS`、`vehicleBox`、`listMovablePlacements`、`findMovablePlacement`。
3. 读 `src/scene/layout/pylonAnchors.ts`：挂点本地坐标与世界坐标的转换入口。
4. 读 `src/scene/layout/types.ts`：`EntityPlacement`、`BoxColliderDesc`、`XzPoint`、`skipKinematic`。
5. 读 `docs/场景穿模与物理碰撞方案说明.md` 的「根因分类」与「验收 Checklist」。
6. 确认相机与地面尺寸在 `src/constants/scene.ts` 的 `SCENE_LAYOUT`，**不在** `SITE_LAYOUT`。
7. 读 `src/scene/physics/colliders/StaticColliderFactory.ts` 与 `DynamicColliderFactory.ts`，确认 `colliders` 字段如何被消费。

## 3. 开发流程

### 步骤一：先建表，再动坐标

| 实体 | 初始位 | 演示路径 | footprint 半径 | 碰撞代理 | 物理类型 | 是否 skipKinematic |
|---|---|---|---|---|---|---|
| `truck_02` | `DEMO_PATHS.truck_02[0]` | 东侧环线 | 车长 × 0.55 | 车体盒 ×0.92 | Kinematic | 否 |
| `worker_07` | 塔基外侧 | 控制器内部路径 | 0.45 | 胶囊代理盒 | 无 | **是** |

没有这张表就不要开始调坐标。表里任何一格出现两个来源，就是下一次穿模的种子。

### 步骤二：先分区，再画路径

沿用现有分区约定（写在 `sceneLayout.ts` 顶部注释里）：

- 铁塔 footprint 约 `(22, 4)`，净空半径 ≥ 7 m。
- 挖机西北带 `x∈[-12,-2], z∈[9,15]`。
- 卷盘东南带 `x∈[10,16], z∈[-12,-6]`，与挖机直线距离 ≥ 15 m。
- 卡车 T-02 / 搅拌走东侧 `x≥32`。
- 工人 W-02 在挖机正南，W-03 在北侧走廊。

新增实体时先划定独占区域，再在区域内画闭合环线。**不允许两个移动体共用同一条走廊。**

### 步骤三：写路径的四条硬规则

1. **首点等于初始摆位。** 路径首点与 `SITE_LAYOUT` 的 `x/z` 必须一致，否则启动第一帧会瞬移。
2. **环线闭合。** 最后一个点回到第一个点，避免循环时跳回。
3. **折点用最短角阻尼转向。** 朝向按 `atan2` 差值取最短弧，用指数阻尼逼近，不要瞬间赋值。
4. **路径只用于 XZ。** 高度一律贴地，`y` 由物理或动画单独负责。

```ts
export const DEMO_PATHS = {
  truck_02: [
    { x: 36, z: 16 }, { x: 42, z: 10 }, { x: 40, z: 2 },
    { x: 34, z: 8 },  { x: 36, z: 16 },
  ],
} as const satisfies Record<string, readonly XzPoint[]>
```

### 步骤四：碰撞代理从尺度推导

```ts
function vehicleBox(length: number, width: number, height: number, shrink = 0.92): BoxColliderDesc {
  return {
    kind: 'box',
    halfX: (width * shrink) / 2,
    halfY: (height * shrink) / 2,
    halfZ: (length * shrink) / 2,
    offsetY: (height * shrink) / 2,   // 底面贴 y=0
  }
}
```

- 只允许盒体 / 胶囊的简化代理，**禁止用渲染网格当 collider**。
- 体积缩小 5%–10%，避免与地面或其他体粘连。
- 有外伸结构（吊车支腿、卷盘牵引头）时，代理盒要包住外伸部分，并在注释里写清依据。
- `skipKinematic` 只给「需要自由写 Y」的实体（当前只有塔上作业人员）。加这个标记必须在注释里说明原因。

### 步骤五：挂点与设施对齐

- 设施内部坐标先按「本地坐标系」定义，再用 `getFacilityOrientations()` 的 `pylonRotY` 转到世界系，最后平移 `FACILITY_LAYOUT`。
- 高度类挂点要吸附到结构网格（例如 `snapToClimbRungY`），不要写一个「看起来差不多」的浮点数。
- 同一结构上的网格（脚钉、横栏、攀爬路径）必须共用同一个间距常量（`PYLON_CLIMB.rungSpacing`），否则手脚永远对不上。

### 步骤六：验证

1. 打开「显示碰撞体线框」，确认线框与模型轮廓对齐、底面贴地。
2. **关闭物理**再跑一遍演示：此时仍不应出现车穿塔、人车贴脸。物理不是脏路径的修理工。
3. 观察启动第一帧：不应有瞬移。
4. 观察环线接缝：不应有回跳或速度突变。
5. 检查新增实体是否出现在 `listMovablePlacements()` 的返回里（除 `skipKinematic`）。
6. 运行 `npm run build`。
7. 若无法运行浏览器，明确说明线框与目视验证未执行。

## 4. 约束

- 不得在 Builder 里写死世界坐标；Builder 只负责建模，摆位一律来自 `SITE_LAYOUT`。
- 不得为了绕开穿模而直接缩小模型或抬高 `y`；先改布局或路径。
- 不得给导线、细小零件注册碰撞体。
- 不得复制已知的局部硬编码（吊车 `5.8` 展宽、卷盘 `4.2` footprint）当作通用公式，它们是为特定轮廓服务的特例。
- 不得把 `skipKinematic` 当成「省事开关」批量使用；它意味着该实体退出地面裁决。
- 不得只改 `DEMO_PATHS` 而不改 `SITE_LAYOUT` 的初始位。
- 不得在未验证的情况下声称「已消除穿模」。

## 5. 最终交付

完成任务后，说明：

1. 修改了哪些文件。
2. 布局变更表：实体、初始位、路径、footprint、碰撞代理、物理类型。
3. 采用的净空约束，以及是否与既有分区冲突。
4. 路径首点 / 环线闭合 / 折点转向三项是否逐条核对。
5. 执行了哪些验证（线框、关物理目视、构建）；未执行哪些、为什么。
6. 仍存在的穿模风险点，以及计划用布局、软检测还是物理层解决。
