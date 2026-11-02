---
name: scene-object-contract
description: 在当前三维场景中新增、改造或接入一个可点选、可动画、可被业务反查的实体。
  当任务涉及新建 Builder、给模型加关节、让对象支持点击详情、
  注册新的演示动作、接入业务 businessKey 时使用。
---

# 场景实体契约（可点选 / 可动画 / 可反查）

## 1. 目标

让一个场景实体从「能看见」走到「能点、能动、能被业务查到」，且六处落点一次齐全：

1. Builder 建模并暴露关节。
2. `userData` 标注可选与可动画身份。
3. 布局 SSOT 提供摆位与碰撞代理。
4. 动画注册表提供控制器。
5. 业务 Mock 提供 `businessKey`。
6. UI 面板能读到数据并单独启停动作。

漏掉任何一处，表现都是「模型在，但点不到 / 动不了 / 查不到」。

## 2. 执行前检查

1. `src/enums/SceneObjectType.ts` 是否已有该类型；没有则新增字符串常量与同名联合类型。
2. 是否已有同类 Builder 可复用：`src/scene/builders/vehicles/` 与 `shared/`（`addWheels`、`createHydraulic`、`dynamicCable`、`trackAnim`）。
3. `src/scene/MaterialFactory.ts` 是否已有语义材质方法；有就复用，没有才新增，避免等价材质。
4. `src/types/scene.ts` 的 `SceneObjectUserData` / `SceneSelectionPayload` 是否够用。
5. `src/scene/utils/objectMeta.ts` 与 `animatableMeta.ts` 的读写函数签名。
6. `src/scene/layout/sceneLayout.ts` 的 `SITE_LAYOUT` 是否已有该实体的摆位。
7. `src/api/constructionData.ts` 的 `register()` 与 `businessKey` 命名规则：
   `truck:*`、`machine:*`、`facility:*`、`equipment:*`、`worker:*`。
8. `src/scene/animation/bootstrapSceneAnimations.ts` 是否已有可参照的 `objectId` 分支。

## 3. 开发流程

### 步骤一：Builder 只负责建模与暴露关节

- `build()` 每次新建几何，不缓存；共享材质从 `MaterialFactory` 取。
- 会转动的结构必须拆成独立 `Group` 并命名，命名遵守稳定契约：

| 前缀 | 用途 | 示例 |
|---|---|---|
| `joint_` | 逻辑关节（被控制器写旋转） | `joint_slew`、`joint_boom`、`joint_drum` |
| `hyd_` | 液压件 | `hyd_boom` |
| `anchor_` | 锚点（缆线、绳索端点） | `anchor_spool_start` |
| `Wheel_` / `wheel*` | 车轮 | `wheel0`–`wheel5` |
| `dynamic_` | 每帧重建变换的动态件 | `dynamic_cable_front` |
| `trackL` / `trackR` | 履带 | `trackL` |

**这些名字是 Builder 与 Controller 的契约，改名等于让所有控制器失效。**

- 需要写入的静止姿态放在 `userData.idleRotation` / `userData.lockSwing`，供步态控制器读取。

### 步骤二：标注可选与可动画

```ts
tagSelectable(root, { objectId: spec.id, objectType: SceneObjectType.Worker, label: '电工 W-03', businessKey: 'worker:03' })
tagAnimatable(root, spec.id, {
  hips: 'joint_hips', spine: 'joint_spine',
  armL: 'joint_arm_L', armR: 'joint_arm_R',
  thighL: 'joint_thigh_L', thighR: 'joint_thigh_R',
  calfL: 'joint_calf_L', calfR: 'joint_calf_R',
  footL: 'joint_foot_L', footR: 'joint_foot_R',
})
```

- `userData` 的 key 必须走 `USER_DATA_KEYS`，禁止写字面量。
- `tagSelectable` 会把 `object.name` 改成 `objectId`，因此 **objectId 必须全局唯一**。
- 需要额外释放的共享几何 / 材质 / 纹理，写到 `root.userData.sharedGeometries`、`extraMaterials`、`extraTextures`，由 `SceneManager.buildWorld()` 统一登记。

### 步骤三：放进布局 SSOT

- 在 `SITE_LAYOUT.vehicles` / `.workers` / `.facilities` 增加 `EntityPlacement`：`id`、`x`、`z`、`rotationY`、`footprintRadius`、`colliders`。
- 有演示路径的实体，`x/z` 用 `...pathStart(DEMO_PATHS.xxx)` 展开，保证首点一致。
- 需要退出地面物理裁决的实体才加 `skipKinematic: true`，并在注释里写明理由。

### 步骤四：注册动画控制器

在 `bootstrapSceneAnimations` 中按 `objectId` 分支注册，按复杂度选型：

| 场景 | 选型 |
|---|---|
| 沿路径行进（可带轮/履带滚动） | `VehicleMotionController` |
| 地面走 / 跑 | `WorkerLocomotionController` |
| 单一机构循环 | 专用 Action 控制器 |
| 行进 + 机构同时需要 | `CompositeAnimator` 组合 |
| 多阶段互斥（行进 / 制动 / 作业） | 自定义状态机控制器，参考 `ExcavatorWorkCycleController` |

- 注册 key 必须等于 `objectId`；复合动画的子控制器用 `` `${objectId}__motion` `` 后缀避免冲突。
- 有物理时把 `poseDriver` 注入移动控制器；无物理时控制器直接写 `Object3D`。
- 状态切换必须等前一状态真正停止再进入下一状态（例如制动完成再开挖），不要用固定延时假装停稳。

### 步骤五：注册业务键

在 `src/api/constructionData.ts`：

1. 往 `machines` / `workers` / `facilities` 增加实体对象。
2. 调 `register(entity, 'machine:xxx-01')` 建立 businessKey → 实体映射。
3. 在 `metrics` 里放面板要展示的键值，并把 `runState` 设为 `running` / `idle`。

`businessKey` 必须同时满足：场景 `userData` 里存的是它、业务表里注册的是它、UI 点击时传的是它。三者不一致就会出现「点了没反应」。

### 步骤六：接入 UI

- 选中事件经 `InteractionManager` → `onSelect` → `siteStore.selectObject(payload)`。
- 面板按钮通过 `useConstructionScene()` 暴露的 `hasAnimator` / `playObjectAnimation` / `stopObjectAnimation` 控制单对象动作，不要在组件里直接碰 `SceneManager`。
- 若是人员，需要在 `selectObject` 中追加生命体征加载分支。

### 步骤七：验证

1. 点击模型的任意子网格，都能选中根节点并显示正确详情。
2. 用 `businessKey` 反查（大屏名册、面板跳转）能聚焦到同一对象。
3. 全局演示开关与单对象播放 / 停止互不干扰。
4. 关闭演示后动画真正停止，不是继续在后台跑。
5. 卸载场景后再进一次，选中与动画仍正常（验证资源未被提前释放）。
6. `npm run build` 通过。
7. 若未实机验证，明确说明。

## 4. 约束

- 不得在场景层 `import` Vue 或 Pinia；场景层只依赖 three 与自己的类型。
- 不得改写 `joint_*` / `hyd_*` / `anchor_*` / `Wheel_*` / `dynamic_*` 命名来「优化结构」。
- 不得用 `objectId` 以外的键注册动画；不得让两个实体共享同一 `objectId`。
- 不得在 Builder 内直接调用 store、API 或动画注册表。
- 不得把「未标注 `runState` 的可动画对象默认播放」当成通用默认行为，它只是当前演示的取舍。
- 不得只加 Builder 不加布局 / 业务键，然后声称「已接入」。
- 不得用 `any` 或类型断言绕过 `userData` 的读取校验。

## 5. 最终交付

完成任务后，说明：

1. 修改了哪些文件。
2. 六处落点清单：Builder / 标注 / 布局 / 动画注册 / businessKey / UI，逐项标注完成状态。
3. 新增或沿用的关节命名，以及是否触及既有契约。
4. 该实体的物理身份（Kinematic / 无 / skipKinematic）与理由。
5. 执行了哪些验证；未执行哪些、为什么。
6. 未接入的部分（例如还没有专属动作、还没有业务字段）及后续计划。
