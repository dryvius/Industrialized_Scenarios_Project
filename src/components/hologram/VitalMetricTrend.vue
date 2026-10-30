<script setup lang="ts">
import { computed } from "vue";
import type { VitalHistoryPoint, VitalMetricKey } from "@/types/vitals";
import { VITAL_METRIC_LABELS } from "@/constants/vitals";
import { metricUnit } from "@/utils/vitalsFormat";

const props = defineProps<{
    metricKey: VitalMetricKey;
    points: VitalHistoryPoint[];
}>();

const pathD = computed((): string => {
    if (props.points.length < 2) {
        return "";
    }
    const values = props.points.map(point => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    return props.points
        .map((point, index) => {
            const x = (index / (props.points.length - 1)) * 100;
            const y = 28 - ((point.value - min) / span) * 24;
            return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");
});

const title = computed((): string => `${VITAL_METRIC_LABELS[props.metricKey]} · 近 15 分钟`);
const unit = computed((): string => metricUnit(props.metricKey));
</script>

<template>
    <div class="trend">
        <div class="trend__head">
            <span>{{ title }}</span>
            <span>{{ unit }}</span>
        </div>
        <svg v-if="pathD" class="trend__svg" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
            <path
                :d="pathD"
                fill="none"
                stroke="rgba(110, 230, 255, 0.9)"
                stroke-width="1.2"
                vector-effect="non-scaling-stroke" />
        </svg>
        <p v-else class="trend__empty">该指标暂无历史序列</p>
    </div>
</template>

<style scoped lang="scss">
.trend {
    box-sizing: border-box;
    height: 118px;
    padding: 8px 10px 6px;
    pointer-events: none;
}

.trend__head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: #6f91ab;
}

.trend__svg {
    display: block;
    width: 100%;
    height: 80px;
}

.trend__empty {
    margin: 0;
    font-size: 12px;
    color: #6f91ab;
}
</style>
