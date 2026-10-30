<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useSiteStore } from '@/stores/siteStore'

const props = defineProps<{
  demoEnabled: boolean
  physicsDebugVisible: boolean
  selectedCanAnimate: boolean
  selectedAnimating: boolean
  hologramPreviewVisible: boolean
  healthOpsMode: boolean
}>()

const emit = defineEmits<{
  clear: []
  toggleDemo: []
  togglePhysicsDebug: []
  toggleSelectedAnimation: []
  toggleHologramPreview: []
  toggleHealthOps: []
}>()

const store = useSiteStore()
const { summary, selected, selectedEntity, loading, errorMessage } = storeToRefs(store)

const metricEntries = computed((): Array<{ key: string; value: string }> => {
  const metrics = selectedEntity.value?.metrics
  if (!metrics) {
    return []
  }
  return Object.entries(metrics).map(([key, value]) => ({
    key,
    value: String(value),
  }))
})

const demoLabel = computed((): string => (props.demoEnabled ? '关闭动态演示' : '开启动态演示'))

const physicsDebugLabel = computed((): string =>
  props.physicsDebugVisible ? '隐藏碰撞体线框' : '显示碰撞体线框',
)

const hologramPreviewLabel = computed((): string =>
  props.hologramPreviewVisible ? '关闭全息人体面板' : '打开全息人体演示',
)

const healthOpsLabel = computed((): string =>
  props.healthOpsMode ? '退出健康监测大屏' : '进入健康监测大屏',
)

const selectedAnimLabel = computed((): string =>
  props.selectedAnimating ? '停止该对象动作' : '播放该对象动作',
)

function handleClear(): void {
  emit('clear')
}

function handleToggleDemo(): void {
  emit('toggleDemo')
}

function handleTogglePhysicsDebug(): void {
  emit('togglePhysicsDebug')
}

function handleToggleSelectedAnimation(): void {
  emit('toggleSelectedAnimation')
}

function handleToggleHologramPreview(): void {
  emit('toggleHologramPreview')
}

function handleToggleHealthOps(): void {
  emit('toggleHealthOps')
}
</script>

<template>
  <aside class="info-panel">
    <header class="info-panel__header">
      <p class="info-panel__eyebrow">Industrial Construction Twin</p>
      <h1 class="info-panel__title">工业基建施工场景</h1>
      <p class="info-panel__desc">等距轴测 · 荒漠戈壁 · 工业橙机械</p>
    </header>

    <section class="info-panel__section">
      <h2>现场概况</h2>
      <div v-if="summary" class="stat-grid">
        <div class="stat">
          <span class="stat__label">工程机械</span>
          <strong>{{ summary.machineCount }}</strong>
        </div>
        <div class="stat">
          <span class="stat__label">现场人员</span>
          <strong>{{ summary.workerCount }}</strong>
        </div>
        <div class="stat">
          <span class="stat__label">进行任务</span>
          <strong>{{ summary.activeTasks }}</strong>
        </div>
        <div class="stat">
          <span class="stat__label">安全评分</span>
          <strong>{{ summary.safetyScore }}</strong>
        </div>
      </div>
      <p v-else class="muted">概况数据加载中...</p>
      <button type="button" class="action-btn" @click="handleToggleDemo">{{ demoLabel }}</button>
      <button
        type="button"
        class="action-btn action-btn--secondary"
        @click="handleTogglePhysicsDebug"
      >
        {{ physicsDebugLabel }}
      </button>
      <button
        type="button"
        class="action-btn action-btn--secondary"
        @click="handleToggleHologramPreview"
      >
        {{ hologramPreviewLabel }}
      </button>
      <button
        type="button"
        class="action-btn action-btn--secondary"
        @click="handleToggleHealthOps"
      >
        {{ healthOpsLabel }}
      </button>
    </section>

    <section class="info-panel__section">
      <div class="section-head">
        <h2>对象详情</h2>
        <button v-if="selected" type="button" class="link-btn" @click="handleClear">清除选中</button>
      </div>

      <p v-if="loading" class="muted">正在同步业务数据...</p>
      <p v-else-if="errorMessage" class="error">{{ errorMessage }}</p>
      <template v-else-if="selectedEntity">
        <p class="entity-name">{{ selectedEntity.name }}</p>
        <p class="entity-status">状态：{{ selectedEntity.status }}</p>
        <ul class="metric-list">
          <li v-for="item in metricEntries" :key="item.key">
            <span>{{ item.key }}</span>
            <strong>{{ item.value }}</strong>
          </li>
        </ul>
        <p v-if="selected" class="muted tiny">ID: {{ selected.objectId }}</p>
        <button
          v-if="selectedCanAnimate"
          type="button"
          class="action-btn action-btn--secondary"
          @click="handleToggleSelectedAnimation"
        >
          {{ selectedAnimLabel }}
        </button>
      </template>
      <p v-else class="muted">点击卡车、工程机械、铁塔、变电站查看详情；点击人员查看生命体征</p>
    </section>

    <footer class="info-panel__footer">
      <p>拖拽旋转 · 滚轮缩放 · 右键平移</p>
      <p class="tiny">演示按业务 runState（running/idle）启停；碰撞线框为物理调试</p>
    </footer>
  </aside>
</template>

<style scoped lang="scss">
.info-panel {
  width: min(340px, 92vw);
  padding: 22px 22px 18px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: linear-gradient(
    160deg,
    rgba(255, 255, 255, 0.55) 0%,
    rgba(245, 248, 252, 0.38) 45%,
    rgba(230, 238, 246, 0.28) 100%
  );
  backdrop-filter: blur(18px) saturate(1.25);
  -webkit-backdrop-filter: blur(18px) saturate(1.25);
  box-shadow:
    0 12px 40px rgba(40, 60, 80, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.55);
  color: #2c3a47;
  pointer-events: auto;
}

.info-panel__eyebrow {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #e67a2e;
}

.info-panel__title {
  margin: 8px 0 6px;
  font-size: 22px;
  font-weight: 600;
  color: #1f2d3a;
}

.info-panel__desc {
  margin: 0;
  font-size: 12px;
  color: #6b7c8c;
}

.info-panel__section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid rgba(120, 140, 160, 0.16);

  h2 {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #e67a2e;
  }
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  h2 {
    margin-bottom: 0;
  }
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.stat {
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(238, 242, 246, 0.28) 100%);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  strong {
    display: block;
    margin-top: 4px;
    font-size: 20px;
    color: #243443;
  }
}

.stat__label {
  font-size: 12px;
  color: #708091;
}

.entity-name {
  margin: 10px 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.entity-status {
  margin: 0 0 10px;
  font-size: 13px;
  color: #e67a2e;
}

.metric-list {
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px dashed rgba(120, 140, 160, 0.2);
    font-size: 13px;

    span {
      color: #708091;
    }

    strong {
      color: #243443;
      font-weight: 600;
    }
  }
}

.muted {
  margin: 0;
  font-size: 13px;
  color: #8494a3;
}

.tiny {
  margin-top: 10px;
  font-size: 11px;
}

.error {
  margin: 0;
  font-size: 13px;
  color: #c45c4a;
}

.link-btn {
  border: 0;
  background: transparent;
  color: #e67a2e;
  font-size: 12px;
  cursor: pointer;
}

.action-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 9px 12px;
  border: 1px solid rgba(230, 122, 46, 0.45);
  background: rgba(230, 122, 46, 0.1);
  color: #c45f1a;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(230, 122, 46, 0.18);
  }

  &--secondary {
    border-color: rgba(120, 140, 160, 0.35);
    background: rgba(120, 140, 160, 0.08);
    color: #4a5d6e;

    &:hover {
      background: rgba(120, 140, 160, 0.14);
    }
  }
}

.info-panel__footer {
  margin-top: 18px;

  p {
    margin: 0;
    font-size: 11px;
    color: #90a0ae;
  }

  .tiny {
    margin-top: 6px;
  }
}
</style>
