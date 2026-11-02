<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { VIRUS_MODEL_ATTRIBUTION } from '@/constants/virusMonitor'
import { usePrefersReducedMotion } from '@/composables/usePrefersReducedMotion'
import {
  VirusMonitorPreview,
  type VirusPreviewStatus,
} from '@/scene/virus/VirusMonitorPreview'
import type {
  VirusMonitorSnapshot,
  VirusTrendSeries,
  VirusPrimaryMetric,
} from '@/types/virusMonitor'

const props = defineProps<{
  snapshot: VirusMonitorSnapshot | null
  loading?: boolean
  errorMessage?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const viewportRef = ref<HTMLElement | null>(null)
const previewStatus = ref<VirusPreviewStatus>('idle')
const previewMessage = ref('准备中...')
const scanPaused = ref(false)
const prefersReducedMotion = usePrefersReducedMotion()
let preview: VirusMonitorPreview | null = null

const title = computed((): string => props.snapshot?.title ?? '新型冠状病毒 - 人体健康监控')

const TREND_WIDTH = 240
const TREND_HEIGHT = 62
const TREND_AXIS_LABELS = ['1/10', '2/10', '3/10', '4/10', '5/10', '6/10', '7/10'] as const
const DEFAULT_AXIS_TICKS = [40, 30, 20, 0] as const

function formatPrimary(metric: VirusPrimaryMetric): string {
  return metric.value.toFixed(metric.digits ?? 1)
}

function trendCoords(series: VirusTrendSeries): Array<{ x: number; y: number }> {
  const count = series.points.length
  if (count === 0) {
    return []
  }
  return series.points.map((point, index) => {
    const x = count === 1 ? 0 : (index / (count - 1)) * TREND_WIDTH
    const value = Math.max(0, Math.min(1, point))
    const y = TREND_HEIGHT - 5 - value * (TREND_HEIGHT - 12)
    return { x, y }
  })
}

function trendLinePath(series: VirusTrendSeries): string {
  return trendCoords(series)
    .map((point, index): string => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ')
}

function trendAreaPath(series: VirusTrendSeries): string {
  const coords = trendCoords(series)
  if (coords.length === 0) {
    return ''
  }
  const line = coords
    .map((point, index): string => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ')
  const last = coords[coords.length - 1]
  const first = coords[0]
  return `${line} L${last.x.toFixed(1)} ${TREND_HEIGHT} L${first.x.toFixed(1)} ${TREND_HEIGHT} Z`
}

function trendTicks(series: VirusTrendSeries): readonly number[] {
  return series.axisTicks ?? DEFAULT_AXIS_TICKS
}

/** 各趋势的强调色：效果图第一/三条薄荷青、第二条偏天空蓝 */
function trendTone(index: number): string {
  return index === 1 ? '#25c8f0' : '#2fe3cf'
}

const RING_RADIUS = 15.5
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function ringProgress(ring: { value: number; max: number; arcProgress?: number }): number {
  if (typeof ring.arcProgress === 'number') {
    return Math.max(0, Math.min(1, ring.arcProgress))
  }
  if (ring.max <= 0) {
    return 0
  }
  return Math.max(0, Math.min(1, ring.value / ring.max))
}

function ringDashOffset(ring: { value: number; max: number; arcProgress?: number }): number {
  return RING_CIRCUMFERENCE * (1 - ringProgress(ring))
}

function ringCap(ring: { value: number; max: number; arcProgress?: number }): { x: number; y: number } {
  const angle = -Math.PI / 2 + ringProgress(ring) * Math.PI * 2
  return {
    x: 22 + RING_RADIUS * Math.cos(angle),
    y: 22 + RING_RADIUS * Math.sin(angle),
  }
}

function handleClose(): void {
  emit('close')
}

function handleResetView(): void {
  preview?.resetView()
}

function handleToggleScan(): void {
  scanPaused.value = !scanPaused.value
  preview?.setPaused(scanPaused.value)
}

function handleVisibility(): void {
  preview?.setVisibilityPaused(document.hidden)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(async (): Promise<void> => {
  document.addEventListener('visibilitychange', handleVisibility)
  document.addEventListener('keydown', handleKeydown)

  const el = viewportRef.value
  if (!el) {
    return
  }

  preview = new VirusMonitorPreview({
    onStatus: (next: VirusPreviewStatus, message?: string): void => {
      previewStatus.value = next
      if (message) {
        previewMessage.value = message
      }
    },
  })

  await preview.mount(el, { reducedMotion: prefersReducedMotion.value })
})

onBeforeUnmount((): void => {
  document.removeEventListener('visibilitychange', handleVisibility)
  document.removeEventListener('keydown', handleKeydown)
  preview?.dispose()
  preview = null
})

watch(prefersReducedMotion, (reduced): void => {
  preview?.setReducedMotion(reduced)
})
</script>

<template>
  <aside class="virus-monitor" aria-label="病毒健康监控面板">
    <div class="virus-monitor__ambient" aria-hidden="true" />
    <div ref="viewportRef" class="virus-monitor__viewport">
      <p
        v-if="previewStatus === 'loading' || previewStatus === 'error'"
        class="virus-monitor__preview-status"
        :class="{ 'virus-monitor__preview-status--error': previewStatus === 'error' }"
      >
        {{ previewMessage }}
      </p>
    </div>
    <div class="virus-monitor__vignette" aria-hidden="true" />
    <div class="virus-monitor__scanlines" aria-hidden="true" />
    <div class="virus-monitor__noise" aria-hidden="true" />

    <p v-if="errorMessage" class="virus-monitor__error">{{ errorMessage }}</p>

    <aside v-if="snapshot" class="virus-monitor__rail">
      <header class="virus-monitor__rail-head">
        <h1 class="virus-monitor__title">{{ title }}</h1>
      </header>

      <section class="bio" aria-label="免疫指标">
        <div class="bio__primary">
          <div v-for="metric in snapshot.primaryMetrics" :key="metric.id" class="primary">
            <span class="primary__label">{{ metric.label }}</span>
            <strong class="primary__value">{{ formatPrimary(metric) }}</strong>
          </div>
        </div>

        <div class="bio__rings">
          <div v-for="ring in snapshot.rings" :key="ring.id" class="ring-line">
            <svg class="ring-line__dial" viewBox="0 0 44 44" role="presentation">
              <circle class="ring-line__orbit" cx="22" cy="22" r="20" />
              <circle class="ring-line__track" cx="22" cy="22" r="15.5" />
              <circle
                class="ring-line__arc"
                :class="`ring-line__arc--${ring.accent ?? 'mint'}`"
                cx="22"
                cy="22"
                r="15.5"
                :stroke-dasharray="RING_CIRCUMFERENCE"
                :stroke-dashoffset="ringDashOffset(ring)"
                transform="rotate(-90 22 22)"
              />
              <circle
                class="ring-line__cap"
                :cx="ringCap(ring).x"
                :cy="ringCap(ring).y"
                r="2.5"
              />
            </svg>
            <div class="ring-line__meta">
              <strong>{{ ring.value.toFixed(1) }}</strong>
              <span>{{ ring.label }}</span>
            </div>
          </div>
        </div>

        <div class="bio__kpi">
          <strong>{{ snapshot.immuneSystemScore }}</strong>
          <span>{{ snapshot.immuneSystemLabel }}</span>
        </div>
      </section>

      <div class="rail-rule" aria-hidden="true"><i /></div>

      <section class="trends" aria-label="健康趋势">
        <article
          v-for="(series, index) in snapshot.trends"
          :key="series.id"
          class="trend"
          :style="{ '--trend-tone': trendTone(index) }"
        >
          <div class="trend__value">
            <strong>{{ series.percent }}</strong>
            <span>{{ series.unit }}</span>
            <em>{{ series.label }}</em>
          </div>

          <div class="trend__chart">
            <div class="trend__scale" aria-hidden="true">
              <span v-for="tick in trendTicks(series)" :key="tick">{{ tick }}</span>
            </div>
            <div class="trend__plot">
              <svg
                class="trend__svg"
                :viewBox="`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient :id="`virusTrendArea-${series.id}`" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--trend-tone)" stop-opacity="0.34" />
                    <stop offset="100%" stop-color="var(--trend-tone)" stop-opacity="0" />
                  </linearGradient>
                  <filter :id="`virusTrendGlow-${series.id}`" x="-20%" y="-60%" width="140%" height="220%">
                    <feGaussianBlur stdDeviation="2.4" />
                  </filter>
                </defs>
                <path
                  class="trend__area"
                  :d="trendAreaPath(series)"
                  :fill="`url(#virusTrendArea-${series.id})`"
                />
                <path
                  class="trend__glow"
                  :d="trendLinePath(series)"
                  :filter="`url(#virusTrendGlow-${series.id})`"
                />
                <path class="trend__line" :d="trendLinePath(series)" />
                <circle
                  v-for="(point, pointIndex) in trendCoords(series)"
                  :key="`${series.id}-dot-${pointIndex}`"
                  class="trend__dot"
                  :cx="point.x"
                  :cy="point.y"
                  r="1.7"
                />
              </svg>
              <div class="trend__axis" aria-hidden="true">
                <span v-for="label in TREND_AXIS_LABELS" :key="`${series.id}-${label}`">{{ label }}</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <div class="rail-rule rail-rule--tight" aria-hidden="true"><i /></div>

      <section class="gene-strip" aria-label="基因与检测">
        <div
          v-for="item in snapshot.footnotes"
          :key="item.id"
          class="gene"
          :class="{ 'gene--accent': item.tone === 'accent' }"
        >
          <span class="gene__label">{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <em v-if="item.hint">{{ item.hint }}</em>
        </div>
      </section>
    </aside>

    <p v-else-if="loading" class="virus-monitor__muted">指标加载中...</p>
    <p v-else class="virus-monitor__muted">暂无监控数据</p>

    <footer class="virus-monitor__foot">
      <p class="virus-monitor__credit">{{ VIRUS_MODEL_ATTRIBUTION }} · 演示数据，不作诊断依据</p>
      <div class="virus-monitor__actions">
        <button type="button" class="hud-chip" @click="handleResetView">复位视角</button>
        <button type="button" class="hud-chip" @click="handleToggleScan">
          {{ scanPaused ? '恢复旋转' : '暂停旋转' }}
        </button>
        <button type="button" class="hud-chip hud-chip--close" @click="handleClose">关闭</button>
      </div>
    </footer>
  </aside>
</template>

<style scoped lang="scss">
.virus-monitor {
  --accent: #2fe3cf;
  --accent-blue: #25c8f0;
  --ink: #d9f2ef;
  --ink-dim: #8aa6a8;
  --ink-faint: #5f7d80;
  --hairline: rgba(124, 200, 202, 0.16);
  --rail-width: clamp(300px, 27vw, 440px);

  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--ink);
  background: #050d11;
  font-family: 'IBM Plex Sans', 'Noto Sans SC', sans-serif;
  font-variant-numeric: tabular-nums;
  user-select: none;
}

/* ---------- 背景层 ---------- */

.virus-monitor__ambient {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 58% 78% at 16% 46%, rgba(26, 76, 76, 0.4) 0%, transparent 62%),
    radial-gradient(ellipse 42% 54% at 40% 44%, rgba(14, 58, 66, 0.22) 0%, transparent 70%),
    radial-gradient(ellipse 30% 40% at 54% 21%, rgba(122, 86, 12, 0.14) 0%, transparent 70%),
    radial-gradient(ellipse 26% 30% at 57% 72%, rgba(18, 104, 112, 0.12) 0%, transparent 72%),
    linear-gradient(180deg, #061319 0%, #050d11 56%, #040a0e 100%);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(96, 176, 178, 0.038) 1px, transparent 1px),
      linear-gradient(90deg, rgba(96, 176, 178, 0.038) 1px, transparent 1px);
    background-size: 38px 38px;
    mask-image: radial-gradient(ellipse 82% 86% at 44% 48%, #000 20%, transparent 82%);
  }
}

.virus-monitor__viewport {
  position: absolute;
  inset: 0;
  z-index: 1;

  :deep(canvas) {
    display: block;
    width: 100%;
    height: 100%;
    background: transparent;
  }
}

.virus-monitor__preview-status {
  position: absolute;
  left: 32px;
  bottom: 58px;
  z-index: 1;
  margin: 0;
  padding: 6px 10px;
  border: 1px solid rgba(70, 150, 152, 0.22);
  background: rgba(4, 14, 17, 0.72);
  color: #86a9ab;
  font-size: 11px;
  letter-spacing: 0.08em;
  pointer-events: none;

  &--error {
    border-color: rgba(255, 120, 100, 0.35);
    color: #ffb3a6;
  }
}

.virus-monitor__vignette {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background:
    radial-gradient(ellipse 76% 88% at 40% 48%, transparent 48%, rgba(1, 7, 9, 0.52) 100%),
    linear-gradient(90deg, transparent 62%, rgba(2, 9, 12, 0.46) 100%);
}

.virus-monitor__scanlines {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.4;
  background: repeating-linear-gradient(
    180deg,
    transparent 0,
    transparent 3px,
    rgba(64, 140, 150, 0.028) 4px
  );
}

.virus-monitor__noise {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.05;
  background-image: radial-gradient(rgba(190, 240, 235, 0.4) 0.5px, transparent 0.6px);
  background-size: 3px 3px;
}

/* ---------- 右轨 ---------- */

.virus-monitor__rail {
  position: absolute;
  top: 18px;
  right: clamp(20px, 2.4vw, 40px);
  bottom: 14px;
  z-index: 4;
  width: var(--rail-width);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-left: 12px;
  pointer-events: auto;

  &::before {
    content: '';
    position: absolute;
    inset: -18px -26px -16px -26px;
    z-index: -1;
    pointer-events: none;
    background: linear-gradient(
      90deg,
      rgba(4, 12, 15, 0) 0%,
      rgba(4, 12, 15, 0.5) 10%,
      rgba(4, 12, 15, 0.72) 100%
    );
  }
}

.virus-monitor__rail-head {
  flex-shrink: 0;
  padding: 2px 0 4px;
}

.virus-monitor__title {
  margin: 0;
  font-size: clamp(17px, 1.55vw, 24px);
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: 0.08em;
  color: #e6fbf8;
  text-shadow:
    0 0 1px rgba(255, 255, 255, 0.6),
    0 0 18px rgba(84, 226, 216, 0.4),
    0 2px 10px rgba(0, 0, 0, 0.6);
}

.bio {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.12fr) minmax(0, 1.16fr);
  align-items: center;
  gap: 10px;
  min-height: clamp(168px, 24vh, 228px);
  padding-bottom: 6px;
}

.bio__primary {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.primary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  &__label {
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--ink-dim);
    white-space: nowrap;
  }

  &__value {
    font-size: clamp(22px, 1.92vw, 31px);
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0.01em;
    color: #eefdfa;
  }
}

.bio__rings {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.ring-line {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;

  &__dial {
    width: clamp(40px, 3.5vw, 56px);
    height: clamp(40px, 3.5vw, 56px);
    flex-shrink: 0;
    overflow: visible;
  }

  &__orbit {
    fill: none;
    stroke: rgba(90, 170, 172, 0.18);
    stroke-width: 0.8;
  }

  &__track {
    fill: none;
    stroke: #0b272b;
    stroke-width: 6.5;
  }

  &__arc {
    fill: none;
    stroke-width: 6.5;
    stroke-linecap: butt;
    transition: stroke-dashoffset 0.6s ease;

    &--mint {
      stroke: #17e0b2;
      filter: drop-shadow(0 0 4px rgba(23, 224, 178, 0.35));
    }

    &--cyan {
      stroke: #23c8f5;
      filter: drop-shadow(0 0 4px rgba(35, 200, 245, 0.35));
    }
  }

  &__cap {
    fill: #e8fffb;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    strong {
      font-size: clamp(17px, 1.42vw, 23px);
      font-weight: 500;
      line-height: 1.05;
      color: #eafdf9;
    }

    span {
      font-size: 11px;
      letter-spacing: 0.06em;
      color: #27c6c8;
      white-space: nowrap;
    }
  }
}

.bio__kpi {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  align-self: stretch;
  border-left: 1px solid rgba(140, 195, 196, 0.16);
  padding-left: 14px;
  min-width: 0;
  overflow: hidden;

  strong {
    font-size: clamp(44px, 4.9vw, 84px);
    font-weight: 500;
    line-height: 0.82;
    letter-spacing: 0.01em;
    color: #ffffff;
    text-shadow: 0 0 24px rgba(150, 240, 235, 0.22);
    white-space: nowrap;
  }

  span {
    font-size: 11px;
    letter-spacing: 0.2em;
    color: #a9c2c3;
    white-space: nowrap;
  }
}

/* 分隔线：左端高亮短段，其余淡出 */
.rail-rule {
  position: relative;
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(210, 245, 242, 0.28) 0%,
    rgba(150, 205, 205, 0.16) 24%,
    rgba(110, 160, 162, 0.08) 100%
  );

  i {
    position: absolute;
    left: 0;
    top: -0.5px;
    width: 34%;
    height: 2px;
    background: linear-gradient(90deg, #f2fffd 0%, rgba(150, 240, 235, 0.35) 55%, transparent 100%);
    box-shadow: 0 0 8px rgba(170, 250, 245, 0.4);
  }

  &--tight {
    margin-top: 2px;
  }
}

/* 趋势 */
.trends {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0 2px;
}

.trend {
  display: grid;
  grid-template-columns: clamp(72px, 6.6vw, 104px) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 0;
  flex: 1;
}

.trend__value {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  column-gap: 2px;
  row-gap: 4px;
  line-height: 1;

  strong {
    font-size: clamp(28px, 2.6vw, 44px);
    font-weight: 600;
    line-height: 0.9;
    letter-spacing: -0.01em;
    color: var(--trend-tone);
    text-shadow: 0 0 14px color-mix(in srgb, var(--trend-tone) 45%, transparent);
  }

  span {
    font-size: clamp(12px, 1vw, 16px);
    font-weight: 500;
    color: var(--ink-dim);
    transform: translateY(-2px);
  }

  em {
    flex-basis: 100%;
    font-style: normal;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--ink-dim);
  }
}

.trend__chart {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  align-items: stretch;
  gap: 4px;
  min-width: 0;
  height: 100%;
}

.trend__scale {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  align-self: center;
  height: calc(clamp(62px, 9.2vh, 90px) - 8px);
  padding: 0 2px 0 0;
  font-size: 9px;
  line-height: 1;
  color: #6e8f92;
}

.trend__plot {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  min-height: 0;
}

.trend__svg {
  display: block;
  width: 100%;
  flex: 0 0 auto;
  height: clamp(62px, 9.2vh, 90px);
  overflow: visible;
  border-bottom: 1px solid rgba(84, 186, 188, 0.18);
}

.trend__area {
  stroke: none;
}

.trend__glow {
  fill: none;
  stroke: var(--trend-tone);
  stroke-width: 4;
  opacity: 0.5;
}

.trend__line {
  fill: none;
  stroke: var(--trend-tone);
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
  filter: drop-shadow(0 0 3px color-mix(in srgb, var(--trend-tone) 60%, transparent));
}

.trend__dot {
  fill: #d8fffb;
  stroke: var(--trend-tone);
  stroke-width: 1;
}

.trend__axis {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
  font-size: 9px;
  letter-spacing: 0.02em;
  color: #6e8f92;
  white-space: nowrap;
}

/* 底栏基因 */
.gene-strip {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  align-items: start;
  padding-top: 4px;
  min-height: clamp(66px, 8.6vh, 94px);
}

.gene {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 2px 10px;
  min-width: 0;
  border-left: 1px solid rgba(140, 195, 196, 0.2);

  &:first-child {
    border-left: 0;
    padding-left: 2px;
  }

  &__label {
    font-size: 11px;
    letter-spacing: 0.1em;
    color: var(--ink-dim);
    white-space: nowrap;
  }

  strong {
    font-size: clamp(18px, 1.55vw, 28px);
    font-weight: 500;
    line-height: 1.05;
    color: #eefdfa;
    white-space: nowrap;
  }

  em {
    font-style: normal;
    font-size: 9px;
    letter-spacing: 0.03em;
    color: var(--ink-faint);
    white-space: normal;
    line-height: 1.3;
  }

  &--accent strong {
    color: var(--accent);
    text-shadow: 0 0 12px rgba(47, 227, 207, 0.35);
  }
}

/* ---------- 页脚 / 控件 ---------- */

.virus-monitor__muted {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 4;
  transform: translate(-50%, -50%);
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: #7f9fa2;
}

.virus-monitor__error {
  position: absolute;
  top: 20px;
  left: 32px;
  z-index: 5;
  margin: 0;
  padding: 8px 12px;
  border: 1px solid rgba(255, 130, 110, 0.4);
  background: rgba(58, 16, 14, 0.55);
  color: #ffb3a6;
  font-size: 12px;
}

.virus-monitor__foot {
  position: absolute;
  left: 26px;
  bottom: 8px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 14px;
  pointer-events: none;
}

.virus-monitor__credit {
  margin: 0;
  font-size: 9px;
  letter-spacing: 0.05em;
  color: rgba(140, 175, 177, 0.5);
}

.virus-monitor__actions {
  display: flex;
  gap: 6px;
  pointer-events: auto;
}

.hud-chip {
  height: 22px;
  padding: 0 10px;
  border: 1px solid rgba(90, 180, 182, 0.22);
  background: rgba(6, 22, 26, 0.6);
  color: rgba(168, 218, 216, 0.55);
  font-size: 10px;
  letter-spacing: 0.1em;
  cursor: pointer;
  opacity: 0.68;
  transition:
    opacity 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    background 0.2s ease;

  &:hover {
    opacity: 1;
    border-color: rgba(80, 225, 214, 0.55);
    background: rgba(10, 38, 42, 0.85);
    color: #d9fffb;
  }

  &--close:hover {
    border-color: rgba(255, 140, 110, 0.6);
    color: #ffd2c6;
  }
}

@media (max-width: 1180px) {
  .virus-monitor__rail {
    top: 16px;
  }

  .bio {
    grid-template-columns: 1fr 1.2fr 1fr;
  }

  .bio__kpi strong {
    font-size: clamp(42px, 5.6vw, 64px);
  }
}

@media (max-width: 900px) {
  .virus-monitor__title {
    font-size: 16px;
  }

  .virus-monitor__rail {
    top: auto;
    left: 14px;
    right: 14px;
    bottom: 40px;
    width: auto;
    height: 46%;
    padding-top: 8px;
    background: linear-gradient(0deg, rgba(4, 12, 15, 0.96) 0%, rgba(4, 12, 15, 0.82) 78%, transparent 100%);
  }

  .trends {
    gap: 4px;
  }

  .trend {
    grid-template-columns: 64px minmax(0, 1fr);
  }

  .trend__value strong {
    font-size: 26px;
  }

  .gene strong {
    font-size: 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ring-line__arc {
    transition: none;
  }
}
</style>
