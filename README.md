# 三维工业基建施工场景

基于 **Vue 3 + TypeScript + Three.js + Vite** 的等距轴测工业基建 / 电力施工可视化场景，并叠加人员健康监测（全息生命体征面板 + 监测大屏）。

视觉风格：Isometric 3D · Stylized Low-poly · Soft PBR（白地、蓝天、工业橙机械）。

## 功能概览

### 施工场景

- 正交相机等距轴测构图，OrbitControls 有限旋转 / 缩放 / 平移
- 程序化建模：吊车、挖机、搅拌车、卷盘车、卡车、铁塔、变电站、工人与场地环境
- 点击对象以地面光圈 + 描边高亮，左侧面板展示 Mock 业务详情
- 动态演示：车辆行进、机构动作（挖机 / 吊臂 / 滚筒 / 卷盘）、人员走动与杆塔高空作业
- Rapier 物理碰撞约束（可选显示碰撞体线框）

### 人员健康监测

- 点选工人或打开「全息人体演示」→ 全息点云人体 + 生命体征 HUD
- 「进入健康监测大屏」→ 现场汇总、名册筛选、告警与分布；工人脚下状态光圈
- 「打开病毒监控演示」→ **满屏**病毒三维监控：暗青主球 + 金色对照 + 电青结构 plexus，右轨主指标 / 环形图标 / 趋势 / 基因条；与人体全息互斥
- 数据为 Mock 适配器（`source: 'mock'`），可替换为真实设备 / 后端接口

详细说明见 [`docs/全息人体生命体征可视化模块.md`](./docs/全息人体生命体征可视化模块.md)。

## 技术栈

| 类别 | 选型 |
|------|------|
| 框架 | Vue 3（Composition API）+ TypeScript |
| 构建 | Vite 8 |
| 状态 | Pinia |
| 三维 | Three.js（含 GLTFLoader、EffectComposer / Bloom） |
| 物理 | `@dimforge/rapier3d-compat` |
| 样式 | Sass |

## 快速开始

环境要求：Node.js 18+（建议 LTS）。

```bash
npm install
npm run dev
```

默认开发地址：`http://localhost:5173`（见 `vite.config.ts`）。

```bash
npm run build    # vue-tsc 类型检查 + 生产构建
npm run preview  # 预览 dist
```

全息人体依赖 `public/model/man.glb`；病毒监控依赖 `public/model/corona_virus_lod.glb`。缺失时对应面板视口会报加载失败。

## 使用提示

左侧「工业基建施工场景」面板：

| 操作 | 说明 |
|------|------|
| 开启动态演示 | 启动场景级车辆 / 机构 / 人员动画 |
| 显示碰撞体线框 | 调试 Rapier 碰撞形状 |
| 打开全息人体演示 | 无选中工人时打开演示档案面板 |
| 打开病毒监控演示 | 打开满屏病毒三维监控 HUD（与人体全息互斥） |
| 进入健康监测大屏 | 切换运营 HUD；可从名册点人打开全息面板 |
| 点击场景对象 | 选中并查看业务指标；点工人同时加载生命体征 |
| 播放该对象动作 | 对可动画对象单独启停动作 |

## 目录结构

```
src/
  api/              # Mock 业务与生命体征接口
  components/       # ConstructionScene、SceneInfoPanel、health、hologram、virus
  composables/
  constants/        # 场景、动画、配色、全息、病毒监控、体征阈值
  enums/
  scene/            # SceneManager、builders、animation、physics、hologram、virus
  stores/           # siteStore
  types/
  utils/
public/
  model/man.glb                 # 全息人体采样源模型
  model/corona_virus_lod.glb    # 病毒监控运行时模型（CC-BY-4.0）
docs/               # 需求与专题实现说明
```

路径别名：`@` → `src/`。

## 文档索引

| 文档 | 内容 |
|------|------|
| [`docs/工业基建施工场景-项目生成说明.md`](./docs/工业基建施工场景-项目生成说明.md) | 需求基线与视觉规范（SSOT） |
| [`docs/场景动画与动作实现说明.md`](./docs/场景动画与动作实现说明.md) | 动画系统与动作扩展 |
| [`docs/场景穿模与物理碰撞方案说明.md`](./docs/场景穿模与物理碰撞方案说明.md) | Rapier 碰撞与穿模约束 |
| [`docs/杆塔高空作业实现说明.md`](./docs/杆塔高空作业实现说明.md) | 杆塔攀爬与挂点作业 |
| [`docs/人员模型优化方案说明.md`](./docs/人员模型优化方案说明.md) | 人员网格与比例 |
| [`docs/挖掘机模型优化方案说明.md`](./docs/挖掘机模型优化方案说明.md) | 挖机关节与液压外观 |
| [`docs/全息人体生命体征可视化模块.md`](./docs/全息人体生命体征可视化模块.md) | 健康监测 / 全息面板实现说明 |
| [`docs/病毒健康监控全息面板方案说明.md`](./docs/病毒健康监控全息面板方案说明.md) | 病毒三维监控面板实现说明（SSOT） |

## 数据说明

- 施工概况与对象详情：`src/api/constructionData.ts`
- 生命体征与大屏汇总：`src/api/vitalSigns.ts`（显式 Mock，UI 会标注演示来源）
- 接入真实数据时保持现有 API 方法签名与类型（`src/types/`），在适配层替换实现即可

## License

Private（见 `package.json`）。
