<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SiteHealthOverview, VitalsLevel, WorkerHealthCard } from '@/types/vitals'
import { formatVitalsClock, formatVitalsUpdatedAt, vitalsLevelLabel } from '@/utils/vitalsFormat'

const props = defineProps<{
  overview: SiteHealthOverview | null
  loading?: boolean
  errorMessage?: string
  selectedBusinessKey?: string
}>()

const emit = defineEmits<{
  selectWorker: [businessKey: string]
  exit: []
  openDemo: []
}>()

type StatusFilter = 'all' | VitalsLevel

const FILTER_ORDER: StatusFilter[] = ['all', 'warning', 'critical', 'normal']

const clockLabel = ref(formatVitalsClock())
const filter = ref<StatusFilter>('all')
const lockingKey = ref('')
let clockTimer = 0
let lockTimer = 0

const sourceLabel = computed((): string => {
  if (!props.overview) {
    return '—'
  }
  return props.overview.source === 'mock' ? '演示数据' : '设备实时'
})

const rosterWorkers = computed((): WorkerHealthCard[] => props.overview?.workers ?? [])

const filterCounts = computed((): Record<StatusFilter, number> => {
  const workers = rosterWorkers.value
  return {
    all: workers.length,
    warning: workers.filter((card) => card.overallStatus === 'warning').length,
    critical: workers.filter((card) => card.overallStatus === 'critical').length,
    normal: workers.filter((card) => card.overallStatus === 'normal').length,
  }
})

const filteredWorkers = computed((): WorkerHealthCard[] => {
  const workers = rosterWorkers.value
  if (filter.value === 'all') {
    return workers
  }
  return workers.filter((card) => card.overallStatus === filter.value)
})

const filterIndex = computed((): number => Math.max(0, FILTER_ORDER.indexOf(filter.value)))

onMounted((): void => {
  clockTimer = window.setInterval((): void => {
    clockLabel.value = formatVitalsClock()
  }, 1000)
})

onBeforeUnmount((): void => {
  window.clearInterval(clockTimer)
  window.clearTimeout(lockTimer)
})

function setFilter(next: StatusFilter): void {
  filter.value = next
}

function handleSelect(businessKey: string): void {
  lockingKey.value = businessKey
  window.clearTimeout(lockTimer)
  lockTimer = window.setTimeout((): void => {
    lockingKey.value = ''
  }, 700)
  emit('selectWorker', businessKey)
}

function pulseChip(event: MouseEvent): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) {
    return
  }
  target.classList.remove('is-pulse')
  void target.offsetWidth
  target.classList.add('is-pulse')
}

function handleOpenDemo(event: MouseEvent): void {
  pulseChip(event)
  emit('openDemo')
}

function handleExit(event: MouseEvent): void {
  pulseChip(event)
  emit('exit')
}

watch(
  () => props.selectedBusinessKey,
  (key, previous): void => {
    if (!key || key === previous) {
      return
    }
    lockingKey.value = key
    window.clearTimeout(lockTimer)
    lockTimer = window.setTimeout((): void => {
      lockingKey.value = ''
    }, 700)
  },
)
</script>

<template>
  <div class="ops" aria-label="人员健康监测大屏">
    <div class="ops__body-bg" aria-hidden="true" />
    <header class="ops__top">
      <div>
        <p class="ops__kicker">SITE HEALTH COMMAND</p>
        <h1>人员健康监测</h1>
      </div>
      <div class="ops__stats">
        <div>
          <span>在岗</span>
          <strong>{{ overview?.counts.onDuty ?? '—' }}</strong>
        </div>
        <div>
          <span>关注</span>
          <strong class="is-warn">{{ overview?.counts.warning ?? '—' }}</strong>
        </div>
        <div>
          <span>危急</span>
          <strong class="is-crit">{{ overview?.counts.critical ?? '—' }}</strong>
        </div>
        <div>
          <span>设备在线</span>
          <strong>{{ overview ? `${overview.counts.deviceOnlineRate}%` : '—' }}</strong>
        </div>
      </div>
      <div class="ops__meta">
        <span class="ops__badge">{{ sourceLabel }}</span>
        <strong>{{ clockLabel }}</strong>
        <button type="button" class="hud-chip" @click="handleOpenDemo">全息演示</button>
        <button type="button" class="hud-chip" @click="handleExit">退出大屏</button>
      </div>
    </header>

    <aside class="ops__roster">
      <div class="ops__filters" :style="{ '--filter-i': filterIndex }">
        <span class="ops__filter-pill" aria-hidden="true" />
        <button type="button" :class="{ 'is-on': filter === 'all' }" @click="setFilter('all')">
          全部 <em>{{ filterCounts.all }}</em>
        </button>
        <button type="button" :class="{ 'is-on': filter === 'warning' }" @click="setFilter('warning')">
          关注 <em>{{ filterCounts.warning }}</em>
        </button>
        <button type="button" :class="{ 'is-on': filter === 'critical' }" @click="setFilter('critical')">
          危急 <em>{{ filterCounts.critical }}</em>
        </button>
        <button type="button" :class="{ 'is-on': filter === 'normal' }" @click="setFilter('normal')">
          正常 <em>{{ filterCounts.normal }}</em>
        </button>
      </div>
      <p v-if="loading && !overview" class="ops__muted">态势同步中...</p>
      <p v-else-if="errorMessage && !overview" class="ops__error">{{ errorMessage }}</p>
      <ul v-else :key="filter">
        <li v-for="(card, index) in filteredWorkers" :key="card.businessKey" :style="{ '--i': index }">
          <button
            type="button"
            class="ops__card"
            :class="[
              `ops__card--${card.overallStatus}`,
              {
                'is-selected': card.businessKey === selectedBusinessKey,
                'is-locking': card.businessKey === lockingKey,
              },
            ]"
            @click="handleSelect(card.businessKey)">
            <span class="ops__lamp" />
            <span class="ops__card-name">{{ card.name }}</span>
            <span>{{ card.role }}</span>
            <strong>{{ card.heartRateBpm }} bpm</strong>
            <em>{{ card.latestAlert || vitalsLevelLabel(card.overallStatus) }}</em>
          </button>
        </li>
      </ul>
    </aside>

    <aside class="ops__feed">
      <h2>告警时间线</h2>
      <ul>
        <li v-for="alert in overview?.alerts ?? []" :key="alert.id" :class="`ops__alert--${alert.level}`">
          <span>{{ formatVitalsUpdatedAt(alert.at) }}</span>
          <strong>{{ alert.message }}</strong>
        </li>
        <li v-if="!overview?.alerts.length" class="ops__muted">当前无告警</li>
      </ul>
      <h2>体征分布</h2>
      <div class="ops__dist">
        <p>心率过高 {{ overview?.distribution.highHeartRate ?? 0 }}</p>
        <p>血氧偏低 {{ overview?.distribution.lowSpo2 ?? 0 }}</p>
        <p>体温偏高 {{ overview?.distribution.fever ?? 0 }}</p>
      </div>
    </aside>
  </div>
</template>

<style scoped lang="scss">
.ops {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  color: #d7f0ff;
}

.ops__body-bg {
  position: absolute;
  inset: 0;
  background: #081e32;
  pointer-events: none;
}

.ops__top,
.ops__roster,
.ops__feed {
  pointer-events: auto;
}

.ops__top {
  position: absolute;
  top: 16px;
  left: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 16px;
  border: 1px solid rgba(120, 200, 255, 0.28);
  background: linear-gradient(90deg, rgba(4, 16, 32, 0.78), rgba(6, 22, 40, 0.55));
  backdrop-filter: blur(14px);

  h1 {
    margin: 4px 0 0;
    font-size: 20px;
  }
}

.ops__kicker {
  margin: 0;
  font-size: 10px;
  letter-spacing: 0.16em;
  color: #4cc9ff;
}

.ops__stats {
  display: flex;
  gap: 18px;
  margin-left: auto;

  span {
    display: block;
    font-size: 11px;
    color: #8eb6d4;
  }

  strong {
    font-size: 20px;
    font-variant-numeric: tabular-nums;
  }
}

.is-warn {
  color: #ffe0a8;
}

.is-crit {
  color: #ffb0b0;
}

.ops__meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hud-chip {
  position: relative;
  border: 1px solid rgba(76, 201, 255, 0.45);
  background: linear-gradient(180deg, rgba(22, 56, 82, 0.72), rgba(8, 26, 42, 0.82));
  color: #d7f0ff;
  font-size: 12px;
  letter-spacing: 0.1em;
  padding: 6px 12px;
  cursor: pointer;
  clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
  overflow: hidden;
  transition:
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: rgba(160, 230, 255, 0.85);
    color: #ffffff;
    box-shadow: 0 0 12px rgba(80, 190, 255, 0.28);
  }
}

.ops__badge {
  padding: 2px 7px;
  border: 1px solid rgba(255, 186, 73, 0.45);
  color: #ffc86a;
  font-size: 11px;
}

.ops__roster,
.ops__feed {
  position: absolute;
  top: 88px;
  bottom: 16px;
  width: 268px;
  padding: 12px;
  border: 1px solid rgba(120, 200, 255, 0.22);
  background: #081e32;
  overflow: auto;
}

.ops__roster {
  left: 16px;
}

.ops__feed {
  right: 16px;
}

.ops__filters {
  --filter-i: 0;
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  gap: 0;
  margin-bottom: 12px;
  padding: 2px;
  border: 1px solid rgba(80, 160, 210, 0.28);
  background: rgba(6, 18, 32, 0.55);

  button {
    flex: 1;
    min-width: 0;
    z-index: 1;
    border: 0;
    background: transparent;
    color: #7ea3bd;
    font-size: 11px;
    letter-spacing: 0.06em;
    padding: 6px 4px;
    cursor: pointer;
    position: relative;
    overflow: hidden;

    em {
      font-style: normal;
      margin-left: 4px;
      font-variant-numeric: tabular-nums;
      color: #9ec4de;
    }
  }

  .is-on {
    color: #e8f6ff;

    em {
      color: #ffffff;
    }
  }
}

.ops__filter-pill {
  position: absolute;
  z-index: 0;
  top: 2px;
  bottom: 2px;
  left: calc(2px + var(--filter-i) * 25%);
  width: calc(25% - 2px);
  background: linear-gradient(180deg, rgba(50, 130, 175, 0.45), rgba(16, 48, 72, 0.2));
  box-shadow: inset 0 -2px 0 #7ae7ff;
  transition: left 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

.ops__roster ul,
.ops__feed ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.ops__roster ul:has(.is-selected) .ops__card:not(.is-selected) {
  opacity: 0.58;
}

.ops__roster li {
  animation: roster-in 0.38s ease both;
  animation-delay: calc(var(--i, 0) * 0.05s);
}

.ops__card {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: 10px 1fr auto;
  grid-template-rows: auto auto;
  gap: 2px 8px;
  padding: 8px 10px;
  border: 1px solid rgba(120, 200, 255, 0.18);
  background: rgba(8, 22, 38, 0.55);
  color: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  transition:
    opacity 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease,
    transform 0.25s ease;

  &::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: #7ae7ff;
    transform: scaleY(0);
    transform-origin: top;
    transition: transform 0.28s ease;
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(150, 230, 255, 0.2) 50%,
      transparent 70%
    );
    transform: translateX(-130%);
  }
}

.ops__card.is-selected {
  opacity: 1;
  border-color: rgba(180, 240, 255, 0.85);
  background: linear-gradient(90deg, rgba(40, 110, 150, 0.38), rgba(8, 28, 48, 0.55));
  box-shadow: 0 0 16px rgba(80, 190, 255, 0.2);

  &::before {
    transform: scaleY(1);
  }

  &::after {
    animation: card-scan 2.2s ease-in-out infinite;
  }
}

.ops__card.is-locking {
  animation: card-lock 0.55s ease;
}

.ops__card--warning.is-selected {
  box-shadow: 0 0 16px rgba(255, 186, 73, 0.18);

  &::before {
    background: #ffc86a;
  }
}

.ops__card--critical.is-selected {
  box-shadow: 0 0 16px rgba(255, 90, 90, 0.2);

  &::before {
    background: #ff6b6b;
  }
}

.ops__lamp {
  grid-row: 1 / span 2;
  width: 8px;
  height: 8px;
  margin-top: 4px;
  border-radius: 50%;
  background: #5ee0a0;
  box-shadow: 0 0 8px #5ee0a0;
}

.ops__card--warning .ops__lamp {
  background: #ffc86a;
  box-shadow: 0 0 8px #ffc86a;
}

.ops__card--critical .ops__lamp {
  background: #ff6b6b;
  box-shadow: 0 0 8px #ff6b6b;
}

.ops__card-name {
  color: #e8f6ff;
  font-weight: 600;
}

.ops__card span,
.ops__card em {
  font-size: 11px;
  color: #8eb6d4;
  font-style: normal;
}

.ops__card strong {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.ops__feed h2 {
  margin: 0 0 10px;
  font-size: 13px;
  color: #4cc9ff;
}

.ops__feed h2 + .ops__dist,
.ops__dist {
  margin-top: 8px;
}

.ops__alert--warning {
  border-left: 2px solid #ffc86a;
  padding-left: 8px;
}

.ops__alert--critical {
  border-left: 2px solid #ff6b6b;
  padding-left: 8px;
}

.ops__alert--normal {
  border-left: 2px solid #4cc9ff;
  padding-left: 8px;
}

.ops__dist p {
  margin: 0 0 6px;
  font-size: 12px;
  color: #9ec4de;
}

.ops__muted {
  font-size: 12px;
  color: #6f91ab;
}

.ops__error {
  font-size: 12px;
  color: #ffb0b0;
}

.ops__card.is-selected .ops__lamp {
  animation: lamp-pulse 1.6s ease-in-out infinite;
}

@keyframes card-scan {
  from {
    transform: translateX(-130%);
  }
  to {
    transform: translateX(130%);
  }
}

@keyframes card-lock {
  0% {
    transform: translateX(-6px);
    box-shadow: 0 0 0 transparent;
  }
  45% {
    transform: translateX(0);
    box-shadow: 0 0 22px rgba(120, 220, 255, 0.45);
  }
  100% {
    transform: translateX(0);
    box-shadow: 0 0 16px rgba(80, 190, 255, 0.2);
  }
}

@keyframes roster-in {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes lamp-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.65;
    transform: scale(1.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ops__card.is-selected,
  .ops__card.is-selected .ops__lamp,
  .ops__card.is-selected::after,
  .ops__card.is-locking,
  .ops__roster li,
  .hud-chip:hover,
  .hud-chip.is-pulse,
  .ops__card.is-locking,
  .ops__filter-pill {
    animation: none;
    transition: none;
  }
}
</style>
