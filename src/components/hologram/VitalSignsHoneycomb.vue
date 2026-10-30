<script setup lang="ts">
import { computed } from "vue";
import type { VitalMetricKey, VitalMetricView, WorkerHealthDetail } from "@/types/vitals";
import { buildHoneycombMetricViews } from "@/utils/vitalsFormat";

const props = defineProps<{
    vitals: WorkerHealthDetail | null;
    loading?: boolean;
    selectedKey: VitalMetricKey;
}>();

const emit = defineEmits<{
    select: [key: VitalMetricKey];
}>();

interface HoneycombCell {
    id: string;
    kind: "metric" | "offline";
    metric?: VitalMetricView;
    col: number;
    row: number;
}

const cells = computed((): HoneycombCell[] => {
    const metrics = props.vitals ? buildHoneycombMetricViews(props.vitals) : [];
    const layout: Array<{ key: VitalMetricKey; col: number; row: number }> = [
        { key: "hr", col: 1, row: 0 },
        { key: "spo2", col: 0, row: 1 },
        { key: "temp", col: 2, row: 1 },
        { key: "rr", col: 1, row: 2 },
        { key: "bp", col: 0, row: 3 },
        { key: "fatigue", col: 2, row: 3 },
        { key: "gait", col: 1, row: 4 },
    ];

    return layout.map(slot => {
        const metric = metrics.find(item => item.key === slot.key);
        if (!metric) {
            return { id: slot.key, kind: "offline", col: slot.col, row: slot.row };
        }
        return {
            id: slot.key,
            kind: metric.available ? "metric" : "offline",
            metric,
            col: slot.col,
            row: slot.row,
        };
    });
});

function handleSelect(cell: HoneycombCell): void {
    if (!cell.metric?.available) {
        return;
    }
    emit("select", cell.metric.key);
}
</script>

<template>
    <div class="honeycomb" aria-label="生命体征蜂巢">
        <!-- <div class="honeycomb__meta">
            <span class="honeycomb__badge" :class="{ 'honeycomb__badge--mock': vitals?.source === 'mock' }">
                {{ loading ? "同步中" : sourceLabel || "—" }}
            </span>
            <span class="honeycomb__time">{{ updatedLabel || "—" }}</span>
        </div> -->

        <p v-if="!loading && !vitals" class="honeycomb__empty">暂无数据</p>

        <div v-else class="honeycomb__cluster honeycomb__cluster--linked" :key="vitals?.workerId ?? 'empty'">
            <div
                v-for="cell in cells"
                :key="cell.id"
                class="hex"
                :class="[
                    cell.kind === 'offline' ? 'hex--offline' : `hex--${cell.metric?.level ?? 'normal'}`,
                    cell.metric?.key === selectedKey ? 'hex--selected' : '',
                    cell.metric?.key === 'hr' ? 'hex--anchor' : '',
                ]"
                :style="{ '--col': cell.col, '--row': cell.row }"
                @click="handleSelect(cell)">
                <svg class="hex__shape" viewBox="0 0 100 115.47005" aria-hidden="true">
                    <defs>
                        <radialGradient :id="`hex-fill-${cell.id}`" cx="50%" cy="38%" r="68%">
                            <stop offset="0%" stop-color="rgba(86, 186, 230, 0.28)" />
                            <stop offset="42%" stop-color="rgba(28, 78, 110, 0.2)" />
                            <stop offset="100%" stop-color="rgba(8, 24, 38, 0.04)" />
                        </radialGradient>
                        <linearGradient :id="`hex-edge-${cell.id}`" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="rgba(170, 230, 255, 0.55)" />
                            <stop offset="48%" stop-color="rgba(80, 150, 190, 0.18)" />
                            <stop offset="100%" stop-color="rgba(150, 220, 255, 0.42)" />
                        </linearGradient>
                    </defs>
                    <polygon
                        class="hex__glow"
                        points="50,0 100,28.867513 100,86.602541 50,115.470054 0,86.602541 0,28.867513" />
                    <polygon
                        class="hex__face"
                        points="50,0 100,28.867513 100,86.602541 50,115.470054 0,86.602541 0,28.867513"
                        :fill="`url(#hex-fill-${cell.id})`"
                        :stroke="`url(#hex-edge-${cell.id})`" />
                    <polygon
                        class="hex__core"
                        points="50,16 86,36.8 86,78.4 50,99.2 14,78.4 14,36.8" />
                </svg>
                <div class="hex__inner">
                    <template v-if="cell.metric">
                        <span class="hex__label">{{ cell.metric.label }}</span>
                        <strong class="hex__value">{{ cell.metric.value }}</strong>
                        <span class="hex__unit">{{ cell.metric.unit }}</span>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss">
.honeycomb {
    margin-left: auto;
    z-index: 2;
    pointer-events: none;
}

.honeycomb__meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 16px;
    font-size: 12px;
    color: #8eb6d4;
    transform: none;
}

.honeycomb__badge {
    padding: 2px 7px;
    border: 1px solid rgba(255, 186, 73, 0.45);
    background: rgba(20, 30, 40, 0.25);
    color: #ffc86a;
    backdrop-filter: blur(6px);
}

.honeycomb__empty {
    margin: 40px 12px 0;
    text-align: right;
    font-size: 12px;
    color: #6f91ab;
}

.honeycomb__cluster {
    --hex-w: 108px;
    --hex-h: calc(var(--hex-w) * 1.154700538);
    --hex-draw: 0.84;
    --hex-hover: 0.94;
    position: relative;
    width: calc(var(--hex-w) * 2);
    height: calc(var(--hex-h) * 0.75 * 4 + var(--hex-h));
    margin-left: auto;
    margin-right: 12px;
    transform-origin: right center;
}

.honeycomb__cluster--linked .hex:not(.hex--selected):not(.hex--offline) {
    opacity: 0.48;
}

.honeycomb__cluster--linked .hex--anchor:not(.hex--selected):not(.hex--offline) {
    opacity: 0.82;
}

.honeycomb__cluster--linked .hex--offline {
    opacity: 0.32;
}

.hex {
    --col: 0;
    --row: 0;
    position: absolute;
    left: calc(var(--col) * var(--hex-w) * 0.5);
    top: calc(var(--row) * var(--hex-h) * 0.75);
    width: var(--hex-w);
    height: var(--hex-h);
    display: grid;
    place-items: center;
    pointer-events: auto;
    cursor: pointer;
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
    animation: hex-uplink 0.42s ease;
    animation-delay: calc(var(--row) * 0.07s);
    transition: opacity 0.22s ease;
}

.hex--offline {
    cursor: default;
}

.hex__shape {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    transform: scale(var(--hex-draw));
    transform-origin: center;
    transition:
        transform 0.22s ease,
        filter 0.22s ease;
}

.hex__glow {
    fill: rgba(90, 210, 255, 0.22);
    stroke: none;
    opacity: 0;
    transition: opacity 0.22s ease;
}

.hex__face {
    stroke-width: 1.15;
    vector-effect: non-scaling-stroke;
    stroke-linejoin: miter;
    stroke-linecap: butt;
    transition:
        stroke 0.22s ease,
        filter 0.22s ease,
        stroke-width 0.22s ease;
    filter: drop-shadow(0 0 4px rgba(80, 180, 230, 0.16));
}

.hex__core {
    fill: none;
    stroke: rgba(150, 220, 255, 0.18);
    stroke-width: 0.7;
    vector-effect: non-scaling-stroke;
    opacity: 0.55;
    transition: opacity 0.22s ease, stroke 0.22s ease;
}

.hex--anchor .hex__shape {
    filter: drop-shadow(0 0 8px rgba(90, 210, 255, 0.28));
}

.hex--anchor .hex__value {
    font-size: 22px;
    text-shadow: 0 0 12px rgba(150, 230, 255, 0.55);
}

.hex:hover:not(.hex--offline) .hex__shape,
.hex--selected .hex__shape {
    transform: scale(var(--hex-hover));
    filter: drop-shadow(0 0 14px rgba(110, 220, 255, 0.55));
}

.hex:hover:not(.hex--offline) .hex__glow,
.hex--selected .hex__glow {
    opacity: 1;
}

.hex:hover:not(.hex--offline) .hex__face,
.hex--selected .hex__face {
    stroke: rgba(210, 245, 255, 0.95);
    stroke-width: 1.7;
    filter: drop-shadow(0 0 8px rgba(140, 230, 255, 0.75));
}

.hex:hover:not(.hex--offline) .hex__core,
.hex--selected .hex__core {
    opacity: 1;
    stroke: rgba(210, 245, 255, 0.7);
}

.hex:hover:not(.hex--offline) .hex__inner,
.hex--selected .hex__inner {
    transform: scale(var(--hex-hover));
}

.hex:hover:not(.hex--offline) .hex__value,
.hex--selected .hex__value {
    color: #ffffff;
    text-shadow: 0 0 16px rgba(180, 240, 255, 0.85);
}

.hex:hover:not(.hex--offline) .hex__label,
.hex--selected .hex__label {
    color: rgba(210, 240, 255, 0.95);
}

.hex--offline .hex__face {
    fill: rgba(40, 58, 78, 0.12) !important;
    stroke: rgba(140, 175, 205, 0.18) !important;
    stroke-dasharray: 4 3;
}

.hex--warning .hex__glow {
    fill: rgba(255, 186, 90, 0.22);
}

.hex--critical .hex__glow {
    fill: rgba(255, 110, 110, 0.24);
}

.hex--warning .hex__face {
    fill: rgba(70, 52, 28, 0.28) !important;
    stroke: rgba(255, 210, 140, 0.4) !important;
}

.hex--critical .hex__face {
    fill: rgba(70, 32, 36, 0.3) !important;
    stroke: rgba(255, 160, 160, 0.45) !important;
}

.hex--warning.hex--selected .hex__face,
.hex--warning:hover .hex__face {
    stroke: rgba(255, 230, 180, 0.95) !important;
}

.hex--critical.hex--selected .hex__face,
.hex--critical:hover .hex__face {
    stroke: rgba(255, 200, 200, 0.95) !important;
}

.hex--warning.hex--selected .hex__shape,
.hex--warning:hover .hex__shape {
    animation: hex-breathe 1.6s ease-in-out infinite;
}

.hex--critical.hex--selected .hex__shape,
.hex--critical:hover .hex__shape {
    animation: hex-breathe 1.1s ease-in-out infinite;
}

.hex__inner {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    padding: 12px 10px 10px;
    text-align: center;
    transform: scale(var(--hex-draw));
    transform-origin: center;
    transition:
        transform 0.22s ease,
        color 0.22s ease;
}

.hex__label {
    font-size: 12px;
    letter-spacing: 0.04em;
    color: rgba(168, 198, 222, 0.88);
}

.hex__value {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.1;
    color: #e8f6ff;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 8px rgba(120, 210, 255, 0.28);
}

.hex--warning .hex__value {
    color: #ffe0a8;
}

.hex--critical .hex__value {
    color: #ffb0b0;
}

.hex__unit {
    font-size: 12px;
    color: rgba(140, 165, 185, 0.85);
}

@keyframes hex-breathe {
    0%,
    100% {
        filter: drop-shadow(0 0 6px rgba(255, 180, 120, 0.25));
    }
    50% {
        filter: drop-shadow(0 0 14px rgba(255, 200, 140, 0.7));
    }
}

@keyframes hex-uplink {
    from {
        opacity: 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .hex--warning.hex--selected .hex__shape,
    .hex--critical.hex--selected .hex__shape,
    .hex {
        animation: none;
    }
}
</style>
