<script setup lang="ts">
import { computed } from "vue";
import type { VitalsLevel, VitalsSource, WearableDevice } from "@/types/vitals";
import { formatVitalsUpdatedAt, vitalsLevelLabel } from "@/utils/vitalsFormat";

const props = defineProps<{
    workerName: string;
    workerId: string;
    role: string;
    dutyStatus: string;
    overallStatus: VitalsLevel;
    devices: WearableDevice[];
    riskSummary: string;
    source: VitalsSource | null;
    demoMode?: boolean;
}>();

const statusLabel = computed((): string => vitalsLevelLabel(props.overallStatus));

const sourceLabel = computed((): string => {
    if (props.demoMode) {
        return "演示数据";
    }
    if (props.source === "device") {
        return "设备实时";
    }
    if (props.source === "mock") {
        return "演示数据";
    }
    return "未接入";
});

function deviceStamp(iso: string): string {
    return formatVitalsUpdatedAt(iso);
}
</script>

<template>
    <section class="identity" aria-label="人员身份">
        <p class="identity__kicker">SUBJECT FILE</p>
        <h2 class="identity__name">{{ workerName || "未选择人员" }}</h2>
        <p class="identity__id">ID {{ workerId || "—" }}</p>

        <dl class="identity__meta">
            <div>
                <dt>岗位</dt>
                <dd>{{ role || "—" }}</dd>
            </div>
            <div>
                <dt>在岗</dt>
                <dd>{{ dutyStatus || "—" }}</dd>
            </div>
        </dl>

        <div class="identity__status" :class="`identity__status--${overallStatus}`">
            <span class="identity__lamp" />
            <strong>{{ statusLabel }}</strong>
            <span>{{ sourceLabel }}</span>
        </div>

        <p class="identity__risk">{{ riskSummary || "等待体征同步" }}</p>

        <ul class="identity__devices">
            <li v-for="device in devices" :key="device.id" :class="{ 'is-offline': !device.online }">
                <span class="identity__device-name">{{ device.name }}</span>
                <span>{{ device.online ? "在线" : "离线" }}</span>
                <span>{{ device.batteryPercent }}%</span>
                <span>{{ deviceStamp(device.lastHeartbeatAt) }}</span>
            </li>
            <li v-if="devices.length === 0" class="identity__empty">穿戴设备未登记</li>
        </ul>
    </section>
</template>

<style scoped lang="scss">
.identity {
    width: 100%;
    min-width: 0;
    height: 100%;
    overflow: auto;
    padding: 8px 14px 12px 14px;
    pointer-events: none;
    color: #cfe9ff;
}

.identity__kicker {
    margin: 0;
    font-size: 10px;
    letter-spacing: 0.18em;
    color: #4cc9ff;
}

.identity__name {
    margin: 8px 0 4px;
    font-size: 18px;
    font-weight: 600;
    color: #e8f6ff;
}

.identity__id {
    margin: 0;
    font-size: 11px;
    color: #6f91ab;
    font-variant-numeric: tabular-nums;
}

.identity__meta {
    display: grid;
    gap: 6px;
    margin: 12px 0 0;
    padding: 0;
    justify-items: start;

    div {
        display: grid;
        grid-template-columns: 36px 1fr;
        gap: 8px;
        font-size: 12px;
        padding: 4px 8px;
        border: 1px solid rgba(120, 200, 255, 0.14);
        background: rgba(6, 20, 36, 0.35);
    }

    dt {
        color: #6f91ab;
    }

    dd {
        margin: 0;
        color: #d7f0ff;
    }
}

.identity__status {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding: 8px 10px;
    border: 1px solid rgba(76, 201, 255, 0.28);
    background: rgba(8, 28, 48, 0.45);
    font-size: 12px;

    strong {
        font-weight: 600;
    }

    span:last-child {
        margin-left: auto;
        color: #8eb6d4;
    }

    &--warning {
        border-color: rgba(255, 200, 106, 0.45);
        color: #ffe0a8;
    }

    &--critical {
        border-color: rgba(255, 130, 130, 0.5);
        color: #ffb0b0;
    }
}

.identity__lamp {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #5ee0a0;
    box-shadow: 0 0 8px #5ee0a0;
}

.identity__status--warning .identity__lamp {
    background: #ffc86a;
    box-shadow: 0 0 8px #ffc86a;
}

.identity__status--critical .identity__lamp {
    background: #ff6b6b;
    box-shadow: 0 0 8px #ff6b6b;
}

.identity__risk {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: #9ec4de;
}

.identity__devices {
    margin: 16px 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 8px;
}

.identity__devices li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    grid-template-rows: auto auto;
    gap: 2px 8px;
    padding: 8px;
    border: 1px solid rgba(120, 200, 255, 0.16);
    background: rgba(6, 18, 32, 0.4);
    font-size: 11px;
    color: #8eb6d4;

    &.is-offline {
        opacity: 0.62;
    }
}

.identity__device-name {
    grid-column: 1 / -1;
    color: #d7f0ff;
}

.identity__empty {
    font-size: 12px;
    color: #6f91ab;
}
</style>
