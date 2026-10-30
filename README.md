# 三维工业基建施工场景

基于 **Vue 3 + TypeScript + Three.js + Vite** 的等距轴测工业基建 / 电力施工可视化场景。

视觉风格：Isometric 3D + Stylized Low-poly + Soft PBR（白地、蓝天、橙色工程机械）。

> 需求基线见：`docs/工业基建施工场景-项目生成说明.md`

## 功能概览

- 正交相机等距轴测构图
- 程序化建模：吊车、挖机、搅拌车、卷盘车、铁塔、变电站、工人与小型设备
- OrbitControls 有限旋转 / 缩放 / 平移
- 点击对象以地面光圈 + 描边框高亮
- Mock 业务数据接口，可后续接入真实设备状态

## 运行命令

```bash
npm install
npm run dev
npm run build
npm run preview
```
