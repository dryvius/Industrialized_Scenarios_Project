<script setup lang="ts">
import { computed } from "vue";
import type { HologramBodyScreenAnchor } from "@/scene/hologram/HologramPointCloudPreview";
import type { VitalMetricKey, VitalsLevel, WorkerHealthDetail } from "@/types/vitals";
import { buildHoneycombMetricViews } from "@/utils/vitalsFormat";

const props = defineProps<{
    vitals: WorkerHealthDetail | null;
    selectedKey: VitalMetricKey;
    anchors: HologramBodyScreenAnchor[];
    orbiting: boolean;
    yaw: number;
    reprojecting?: boolean;
}>();

const emit = defineEmits<{
    select: [key: VitalMetricKey];
}>();

interface PlacedAnchor {
    id: string;
    metricKey: VitalMetricKey;
    label: string;
    value: string;
    level: VitalsLevel;
    active: boolean;
    side: "left" | "right";
    bodyX: number;
    bodyY: number;
    elbowX: number;
    elbowY: number;
    tagX: number;
    tagY: number;
}

const faded = computed((): boolean => props.reprojecting || props.orbiting || Math.abs(props.yaw) > 0.7);

const placed = computed((): PlacedAnchor[] => {
    const metrics = props.vitals ? buildHoneycombMetricViews(props.vitals) : [];
    return props.anchors.map(anchor => {
        const metric = metrics.find(item => item.key === anchor.metricKey);
        const left = anchor.side === "left";
        const dir = left ? -1 : 1;
        const tagX = Math.max(10, Math.min(90, anchor.x + dir * 18));
        const elbowX = Math.max(10, Math.min(90, anchor.x + dir * 11));
        const tagY = Math.max(8, Math.min(82, anchor.y - 13));
        return {
            id: anchor.id,
            metricKey: anchor.metricKey,
            label: anchor.label,
            value: metric?.available ? `${metric.value} ${metric.unit}` : "—",
            level: metric?.level ?? "normal",
            active: props.selectedKey === anchor.metricKey,
            side: left ? "left" : "right",
            bodyX: anchor.x,
            bodyY: anchor.y,
            elbowX,
            elbowY: anchor.y,
            tagX,
            tagY,
        };
    });
});

const activeAnchor = computed((): PlacedAnchor | null => placed.value.find(item => item.active) ?? null);
</script>

<template>
    <div class="annot annot--focused" :class="{ 'annot--faded': faded }">
        <svg class="annot__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <g v-for="anchor in placed" :key="anchor.id">
                <path
                    class="annot__line"
                    :class="{ 'is-active': anchor.active, [`is-${anchor.level}`]: true }"
                    :d="`M ${anchor.bodyX} ${anchor.bodyY} L ${anchor.elbowX} ${anchor.elbowY} L ${anchor.tagX} ${anchor.tagY}`" />
            </g>
        </svg>
        <span
            v-for="anchor in placed"
            :key="`${anchor.id}-dot`"
            class="annot__dot"
            :class="{ 'is-active': anchor.active, [`is-${anchor.level}`]: true }"
            :style="{ left: `${anchor.bodyX}%`, top: `${anchor.bodyY}%` }" />
        <span
            v-if="activeAnchor"
            class="annot__lock"
            :class="`is-${activeAnchor.level}`"
            :style="{ left: `${activeAnchor.bodyX}%`, top: `${activeAnchor.bodyY}%` }" />
        <button
            v-for="anchor in placed"
            :key="`${anchor.id}-btn`"
            type="button"
            class="annot__tag"
            :class="{
                'is-active': anchor.active,
                [`is-${anchor.level}`]: true,
                'annot__tag--left': anchor.side === 'left',
                'annot__tag--right': anchor.side === 'right',
            }"
            :style="{ left: `${anchor.tagX}%`, top: `${anchor.tagY}%` }"
            @click="emit('select', anchor.metricKey)">
            <span>{{ anchor.label }}</span>
            <strong>{{ anchor.value }}</strong>
        </button>
    </div>
</template>

<style scoped lang="scss">
.annot {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    overflow: hidden;
    opacity: 1;
    transition: opacity 0.25s ease;
}

.annot--faded {
    opacity: 0.18;

    .annot__tag {
        pointer-events: none;
    }
}

.annot__svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
}

.annot__line {
    fill: none;
    stroke: rgba(150, 210, 240, 0.55);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
    transition:
        stroke 0.22s ease,
        opacity 0.22s ease;
}

.annot--focused .annot__line:not(.is-active) {
    opacity: 0.55;
}

.annot__line.is-active {
    stroke: rgba(210, 245, 255, 0.95);
    stroke-width: 1.4;
    opacity: 1;
}

.annot__line.is-warning.is-active {
    stroke: rgba(255, 210, 140, 0.95);
}

.annot__line.is-critical.is-active {
    stroke: rgba(255, 150, 150, 0.95);
}

.annot__dot {
    position: absolute;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #9fe7ff;
    box-shadow: 0 0 6px rgba(159, 231, 255, 0.7);
    transform: translate(-50%, -50%);
    pointer-events: none;
    transition:
        opacity 0.22s ease,
        background 0.22s ease,
        box-shadow 0.22s ease;

    &.is-active {
        background: #ffffff;
        box-shadow: 0 0 10px rgba(200, 245, 255, 0.95);
    }
}

.annot--focused .annot__dot:not(.is-active) {
    opacity: 0.55;
}

.annot__dot.is-critical.is-active {
    background: #ffd0d0;
    box-shadow: 0 0 12px rgba(255, 120, 120, 0.9);
    animation: annot-dot-pulse 1.1s ease-in-out infinite;
}

.annot__lock {
    position: absolute;
    width: 18px;
    height: 18px;
    border: 1px solid rgba(210, 245, 255, 0.92);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    box-shadow: 0 0 8px rgba(120, 220, 255, 0.45);
    animation: annot-lock 1.6s ease-in-out infinite;

    &::before,
    &::after {
        content: "";
        position: absolute;
        background: rgba(220, 250, 255, 0.95);
    }

    &::before {
        left: 50%;
        top: -4px;
        width: 1px;
        height: 5px;
        transform: translateX(-50%);
        box-shadow: 0 16px 0 rgba(220, 250, 255, 0.95);
    }

    &::after {
        top: 50%;
        left: -4px;
        width: 5px;
        height: 1px;
        transform: translateY(-50%);
        box-shadow: 16px 0 0 rgba(220, 250, 255, 0.95);
    }

    &.is-warning {
        border-color: rgba(255, 214, 140, 0.95);
        box-shadow: 0 0 8px rgba(255, 186, 73, 0.45);
    }

    &.is-critical {
        border-color: rgba(255, 150, 150, 0.95);
        box-shadow: 0 0 8px rgba(255, 90, 90, 0.45);
    }
}

.annot__tag {
    position: absolute;
    transform: translate(-50%, -110%);
    display: grid;
    gap: 1px;
    min-width: 76px;
    padding: 5px 8px;
    border: 1px solid rgba(120, 200, 255, 0.22);
    background: rgba(8, 30, 50, 0.28);
    color: #9ec4de;
    font-size: 10px;
    text-align: left;
    cursor: pointer;
    pointer-events: auto;
    transition:
        opacity 0.22s ease,
        border-color 0.22s ease,
        color 0.22s ease;
    animation: annot-tag-in 0.45s ease;

    &--left {
        transform: translate(-100%, -50%);
    }

    &--right {
        transform: translate(0, -50%);
    }

    &::before,
    &::after {
        content: "";
        position: absolute;
        width: 7px;
        height: 7px;
        border-color: rgba(140, 220, 255, 0.85);
        border-style: solid;
        pointer-events: none;
    }

    &::before {
        top: -1px;
        left: -1px;
        border-width: 1px 0 0 1px;
    }

    &::after {
        right: -1px;
        bottom: -1px;
        border-width: 0 1px 1px 0;
    }

    strong {
        color: #e8f6ff;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
    }

    &.is-active {
        border-color: rgba(180, 230, 255, 0.72);
        color: #d7f0ff;
        background: rgba(10, 36, 58, 0.45);
    }
}

.annot--focused .annot__tag:not(.is-active) {
    opacity: 0.62;
}

.annot__tag.is-warning.is-active {
    border-color: rgba(255, 200, 120, 0.7);
    color: #ffe0a8;
}

.annot__tag.is-critical.is-active {
    border-color: rgba(255, 140, 140, 0.75);
    color: #ffb0b0;
    animation: annot-tag-alert 1.2s ease-in-out infinite;
}

@keyframes annot-tag-in {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes annot-lock {
    0%,
    100% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.85;
    }
    50% {
        transform: translate(-50%, -50%) scale(1.1);
        opacity: 1;
    }
}

@keyframes annot-dot-pulse {
    0%,
    100% {
        transform: translate(-50%, -50%) scale(1);
    }
    50% {
        transform: translate(-50%, -50%) scale(1.35);
    }
}

@keyframes annot-tag-alert {
    0%,
    100% {
        box-shadow: 0 0 0 rgba(255, 120, 120, 0);
    }
    50% {
        box-shadow: 0 0 12px rgba(255, 90, 90, 0.35);
    }
}

@media (prefers-reduced-motion: reduce) {
    .annot__tag,
    .annot__dot.is-critical.is-active,
    .annot__tag.is-critical.is-active,
    .annot__lock {
        animation: none;
    }
}
</style>
