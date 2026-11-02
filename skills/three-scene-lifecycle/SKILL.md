---
name: three-scene-lifecycle
description: 在当前 Vue 3 + Three.js 项目中创建、修改或排查三维渲染资源时，
  统一处理渲染器、几何体、材质、纹理、RAF、监听器与观察者的创建、暂停和逆序销毁。
  当任务涉及新增三维视口、出现卡顿或内存增长、切换标签页异常、
  组件卸载不干净、画面恢复时跳变时使用。
---

# Three.js 场景资源与帧循环生命周期

## 1. 目标

让每一个 WebGL / Canvas / RAF 资源都有明确的归属、暂停条件和销毁时机，做到：

1. 反复挂载与卸载不增长内存，不残留 WebGL 上下文。
2. 页签隐藏时停止无意义渲染，恢复时不出现动画跳变或物理穿透。
3. 全项目只有一个 delta 上限、一种销毁顺序、一套暂停语义。
4. 尊重系统「减少动态效果」偏好，并提供可用的静态降级。

适用：主场景视口（`SceneManager`）、弹窗内独立视口（`HologramPointCloudPreview` / `VirusMonitorPreview`）、Canvas 波形（`VitalSignsWaveform`）。
人体全息与病毒监控面板必须互斥挂载，避免同时存在两套弹窗 RAF。

## 2. 执行前检查

1. 通读 `src/scene/SceneManager.ts` 的 `init` / `startLoop` / `stopLoop` / `dispose`，确认当前销毁顺序。
2. 通读 `src/scene/ResourceDisposer.ts`，确认几何 / 材质 / 纹理的登记与释放入口。
3. 通读 `src/scene/MaterialFactory.ts`，确认共享材质的归属（**材质不随网格释放**）。
4. 通读 `src/scene/hologram/HologramPointCloudPreview.ts` 的 `mount` / `setPaused` / `dispose`，确认独立视口的生命周期。
5. 检查 `src/constants/animation.ts` 的 `MAX_FRAME_DELTA_SECONDS`，确认没有第二份钳制值。
6. 列出本次涉及的资源清单：renderer、composer、scene、camera、geometry、material、texture、RAF id、`ResizeObserver`、`visibilitychange`、pointer / wheel / click 监听、物理世界。
7. 确认帧循环数量。当前只允许两个：主场景一个、弹窗预览一个（人体全息 **或** 病毒监控，互斥）。新增并行第三套前必须先说明理由。

## 3. 开发流程

### 步骤一：建立资源所有权表

先写表，再写代码。没有归属的资源一定会泄漏。

| 资源 | 创建点 | 持有者 | 释放点 |
|---|---|---|---|
| `WebGLRenderer` | `SceneManager.init` | `SceneManager` | `dispose` 末尾，`disposer.disposeAll(renderer)` |
| `BufferGeometry` | 各 `*Builder.build()` | `ResourceDisposer` | `disposeAll` 遍历 `geometries` |
| `MeshStandardMaterial` | `MaterialFactory` | `MaterialFactory` | `MaterialFactory.dispose()` |
| `CanvasTexture` | `createSoftParticleTexture` | 预览类字段 | 预览类 `dispose` |
| RAF | `startLoop` / `tick` | 场景 / 预览类 | 先取消 RAF，再拆对象 |
| `ResizeObserver` | `init` / `mount` | 场景 / 预览类 | `disconnect()` 并置 null |
| `visibilitychange` | `init` / 组件 `onMounted` | 场景 / 组件 | `removeEventListener` |

关键规则：**Builder 只负责创建，不负责释放；共享材质由工厂释放；渲染器由总控释放。**

### 步骤二：按固定顺序创建

```ts
// 1. renderer：抗锯齿 + 高性能；像素比必须夹住
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(container.clientWidth, container.clientHeight)
// 2. camera / controls
// 3. 光照
// 4. worldRoot 分组，再把 builder 产物挂上去
// 5. 物理世界（await，失败必须可降级）
// 6. 交互绑定
// 7. ResizeObserver + visibilitychange
// 8. startLoop()，最后才回调 onReady
```

`onReady` 必须在循环启动后触发，否则外部会在场景尚未渲染时读取状态。

### 步骤三：登记几何、材质、纹理

```ts
const built = builder.build()
this.worldRoot.add(built)
this.disposer.trackObject3D(built, false)          // 只收几何
built.userData.sharedGeometries?.forEach(g => this.disposer.trackGeometry(g))
built.userData.extraMaterials?.forEach(m => this.disposer.trackMaterial(m))
built.userData.extraTextures?.forEach(t => this.disposer.trackTexture(t))
```

- 几何**必须**在 `build()` 内新建。禁止模块级几何缓存：场景销毁后缓存会变成已释放缓冲，二次进入直接黑屏或报错。
- 共享材质走 `MaterialFactory` 的语义方法（`orange()` / `metal()` / `chrome()`），不要为单个车型新建等价材质。
- 装饰件（反光条、软管、缆线、螺栓）不投射阴影，阴影交给主要体块。

### 步骤四：建立暂停与恢复

```ts
document.addEventListener('visibilitychange', this.handleVisibilityChange)

private handleVisibilityChange = (): void => {
  if (document.hidden) { this.stopLoop(); return }
  this.cameraController?.resetTiming()   // 丢弃隐藏期间的累计时间
  this.startLoop()
}
```

- 恢复时必须重置计时源，否则 `Clock.getDelta()` 返回巨大值。
- 弹窗内的视口用 `setPaused(true/false)`，不要销毁重建。
- 暂停语义要区分「用户暂停」（`scanPaused`）与「系统隐藏」：恢复时只恢复未被用户暂停的部分。

### 步骤五：按逆序销毁

顺序不可交换，先停表再拆对象：

1. `stopLoop()`：`cancelAnimationFrame` + `clock.stop()`，并把 `animationId` 置 0。
2. 移除全局监听：`visibilitychange`。
3. `resizeObserver.disconnect()` 并置 null。
4. 动画注册表 `dispose()`（停止全部控制器）。
5. 物理世界 `dispose(scene)`（摘调试组、释放 WASM 世界）。
6. 附加控制器（健康光圈等）`dispose()`。
7. 交互管理器 `dispose()`（解绑 click、移除光圈）。
8. 相机控制器 `dispose()`（`OrbitControls.dispose()`）。
9. 光照 `dispose(scene)`。
10. 从 scene 移除 `worldRoot`。
11. `MaterialFactory.dispose()`。
12. 移除 canvas DOM。
13. `ResourceDisposer.disposeAll(renderer)`：内部 `renderer.dispose()` + `forceContextLoss()`。
14. 所有字段置 null，避免二次 dispose。

每个 `dispose` 都要幂等：允许被调用两次而不抛错。

### 步骤六：处理减少动态效果

- 组件侧用 `usePrefersReducedMotion()` 拿到 `Ref<boolean>`，并在卸载时移除 `matchMedia` 监听。
- 预览类提供 `setReducedMotion(enabled)`：为真时直接跳到终态（例如 `assembleValue = 1`），不播放长动画。
- CSS 侧必须同时写 `@media (prefers-reduced-motion: reduce)`，关闭 scanline、脉冲、过渡。
- 动效是增强，不是功能依赖：关闭后所有数据仍必须可读。

### 步骤七：验证

1. 反复打开 / 关闭面板 10 次以上，观察内存与上下文数量是否稳定。
2. 切到其他标签页停留 30 秒再回来，画面不应跳变、角色不应瞬移。
3. 卸载后确认没有残留 RAF（可在 `dispose` 末尾打临时断点，验证后删除）。
4. 改变窗口大小，确认 canvas 尺寸与相机投影同步更新。
5. 运行 `npm run build`（内含 `vue-tsc --noEmit`）。
6. 若无法运行浏览器或构建，**必须明确说明未验证**，不得声称通过。

## 4. 约束

- 不得先拆对象再停 RAF。
- 不得在 `build()` 外缓存几何体给下一次复用。
- 不得由单个 Builder 释放 `MaterialFactory` 的共享材质。
- 不得新增第三套 delta 钳制值。统一用 `MAX_FRAME_DELTA_SECONDS`，禁止出现 `Math.min(delta, 0.05)` 这类第二份实现。
- 不得只 `addEventListener` 不 `removeEventListener`；注册与注销必须出现在同一个类或同一个组件的生命周期里。
- 不得把弹窗视口的「独立上下文」模型套到主场景，两者生命周期不同。
- 不得用「应该不会泄漏」代替验证结论。

## 5. 最终交付

完成任务后，说明：

1. 修改了哪些文件。
2. 资源所有权表（新增或变更的资源及其释放点）。
3. 暂停与恢复策略，以及是否覆盖了页签隐藏、用户暂停、reduced-motion 三种情况。
4. 销毁顺序是否与 `SceneManager.dispose` 一致，若有偏离说明原因。
5. 执行了哪些验证；未执行哪些、为什么。
6. 仍存在的泄漏风险或未接入的降级路径。
