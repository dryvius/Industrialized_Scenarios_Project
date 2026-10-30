<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import BodyAnnotationOverlay from "@/components/hologram/BodyAnnotationOverlay.vue";
import VitalMetricTrend from "@/components/hologram/VitalMetricTrend.vue";
import VitalSignsHoneycomb from "@/components/hologram/VitalSignsHoneycomb.vue";
import VitalSignsWaveform from "@/components/hologram/VitalSignsWaveform.vue";
import WorkerHealthTimeline from "@/components/hologram/WorkerHealthTimeline.vue";
import WorkerIdentityRail from "@/components/hologram/WorkerIdentityRail.vue";
import { usePrefersReducedMotion } from "@/composables/usePrefersReducedMotion";
import {
    HologramPointCloudPreview,
    type HologramBodyScreenAnchor,
    type HologramPreviewStatus,
    type HologramResyncPhase,
} from "@/scene/hologram/HologramPointCloudPreview";
import type { VitalMetricKey, VitalsLevel, WorkerHealthDetail } from "@/types/vitals";
import { buildHoneycombMetricViews, formatVitalsClock, historyForMetric } from "@/utils/vitalsFormat";

const props = defineProps<{
    workerName: string;
    workerId?: string;
    workerStatus?: string;
    vitals: WorkerHealthDetail | null;
    vitalsLoading?: boolean;
    vitalsError?: string;
    demoMode?: boolean;
}>();

const emit = defineEmits<{
    close: [];
}>();

const viewportRef = ref<HTMLElement | null>(null);
const hologramStatus = ref<HologramPreviewStatus>("idle");
const hologramMessage = ref("准备中...");
const selectedKey = ref<VitalMetricKey>("hr");
const scanPaused = ref(false);
const orbitYaw = ref(0);
const orbiting = ref(false);
const bodyAnchors = ref<HologramBodyScreenAnchor[]>([]);
const clockLabel = ref(formatVitalsClock());
const prefersReducedMotion = usePrefersReducedMotion();
const reprojecting = ref(false);
const hudHold = ref(false);
const displayedVitals = ref<WorkerHealthDetail | null>(props.vitals);
let preview: HologramPointCloudPreview | null = null;
let clockTimer = 0;

const liveVitals = computed((): WorkerHealthDetail | null => displayedVitals.value);

const identityName = computed((): string => {
    if (props.demoMode) {
        return liveVitals.value?.workerName || "点云全息演示";
    }
    return liveVitals.value?.workerName || props.workerName || "人员生命体征";
});

const identityId = computed((): string => liveVitals.value?.workerId || props.workerId || "—");
const identityRole = computed((): string => liveVitals.value?.role || "现场作业");
const identityDuty = computed((): string => liveVitals.value?.dutyStatus || props.workerStatus || "—");
const overallStatus = computed((): VitalsLevel => liveVitals.value?.overallStatus ?? "normal");
const trendPoints = computed(() => historyForMetric(liveVitals.value, selectedKey.value));
const showEcg = computed((): boolean => selectedKey.value === "hr");

function commitDisplayedVitals(): void {
    displayedVitals.value = props.vitals;
    syncPreviewVitals();
}

function handleResync(phase: HologramResyncPhase): void {
    if (phase === "hold") {
        commitDisplayedVitals();
    }
    reprojecting.value = phase !== "idle";
    hudHold.value = phase === "dissolve" || phase === "hold";
}

function syncPreviewVitals(): void {
    const source = displayedVitals.value;
    const views = source ? buildHoneycombMetricViews(source) : [];
    const levelOf = (key: VitalMetricKey): VitalsLevel => views.find(item => item.key === key)?.level ?? "normal";
    preview?.setVitals({
        heartRateBpm: source?.heartRateBpm ?? 72,
        hr: levelOf("hr"),
        rr: levelOf("rr"),
        temp: levelOf("temp"),
        spo2: levelOf("spo2"),
    });
}

onMounted(async (): Promise<void> => {
    clockTimer = window.setInterval((): void => {
        clockLabel.value = formatVitalsClock();
    }, 1000);

    const el = viewportRef.value;
    if (!el) {
        return;
    }

    preview = new HologramPointCloudPreview({
        onStatus: (next: HologramPreviewStatus, message?: string): void => {
            hologramStatus.value = next;
            if (message) {
                hologramMessage.value = message;
            }
        },
        onOrbit: (yaw: number, locked: boolean): void => {
            orbitYaw.value = yaw;
            orbiting.value = locked;
        },
        onAnchors: (anchors: HologramBodyScreenAnchor[]): void => {
            bodyAnchors.value = anchors;
        },
        onResync: (phase: HologramResyncPhase): void => {
            handleResync(phase);
        },
    });

    await preview.mount(el, { reducedMotion: prefersReducedMotion.value });
    preview.setScanEnabled(!prefersReducedMotion.value && !scanPaused.value);
    syncPreviewVitals();
});

onBeforeUnmount((): void => {
    window.clearInterval(clockTimer);
    preview?.dispose();
    preview = null;
});

watch(
    () =>
        [
            props.vitals?.heartRateBpm,
            props.vitals?.spo2Percent,
            props.vitals?.bodyTempC,
            props.vitals?.respiratoryRate,
            props.vitals?.overallStatus,
        ] as const,
    (): void => {
        if (hudHold.value) {
            return;
        }
        displayedVitals.value = props.vitals;
        syncPreviewVitals();
    },
);

watch(prefersReducedMotion, (reduced): void => {
    preview?.setReducedMotion(reduced);
    preview?.setScanEnabled(!reduced && !scanPaused.value);
});

watch(
    () => props.workerId ?? props.vitals?.workerId ?? "",
    (workerId, previousId): void => {
        if (!workerId || workerId === previousId) {
            return;
        }
        selectedKey.value = "hr";
        if (!previousId) {
            commitDisplayedVitals();
            return;
        }
        if (prefersReducedMotion.value) {
            commitDisplayedVitals();
            return;
        }
        reprojecting.value = true;
        hudHold.value = true;
        preview?.replayProjection();
    },
);

function handleSelectMetric(key: VitalMetricKey): void {
    selectedKey.value = key;
}

function handleClose(): void {
    emit("close");
}

function handleResetView(): void {
    preview?.resetView();
    orbitYaw.value = 0;
    orbiting.value = false;
}

function handleToggleScan(): void {
    scanPaused.value = !scanPaused.value;
    preview?.setPaused(scanPaused.value);
    preview?.setScanEnabled(!scanPaused.value && !prefersReducedMotion.value);
}

function handleVisibility(): void {
    if (document.hidden) {
        preview?.setPaused(true);
        return;
    }
    if (!scanPaused.value) {
        preview?.setPaused(false);
    }
}

onMounted((): void => {
    document.addEventListener("visibilitychange", handleVisibility);
});

onBeforeUnmount((): void => {
    document.removeEventListener("visibilitychange", handleVisibility);
});
</script>

<template>
    <aside class="worker-health" aria-label="人员生命体征面板">
        <div class="worker-health__corners" aria-hidden="true" />
        <div class="worker-health__scanline" aria-hidden="true" />

        <header class="worker-health__chrome">
            <div>
                <p class="worker-health__eyebrow">BIOMETRIC SCAN / UPLINK</p>
                <p class="worker-health__clock">{{ clockLabel }}</p>
            </div>
            <button type="button" class="worker-health__close hud-chip" @click="handleClose">关闭</button>
        </header>

        <p v-if="vitalsError" class="worker-health__error">{{ vitalsError }}</p>

        <div class="worker-health__layout">
            <div class="worker-health__well" aria-hidden="true" />
            <div ref="viewportRef" class="worker-health__viewport">
                <p
                    v-if="hologramStatus === 'loading' || hologramStatus === 'error'"
                    class="worker-health__viewport-status"
                    :class="{ 'worker-health__viewport-status--error': hologramStatus === 'error' }">
                    {{ hologramMessage }}
                </p>
                <BodyAnnotationOverlay
                    v-if="hologramStatus === 'ready' && liveVitals"
                    :key="liveVitals.workerId"
                    :vitals="liveVitals"
                    :selected-key="selectedKey"
                    :anchors="bodyAnchors"
                    :yaw="orbitYaw"
                    :orbiting="orbiting"
                    :reprojecting="reprojecting"
                    @select="handleSelectMetric" />
            </div>

            <WorkerIdentityRail
                class="worker-health__rail worker-health__rail--left"
                :class="{ 'worker-health__rail--hold': hudHold }"
                :worker-name="identityName"
                :worker-id="identityId"
                :role="identityRole"
                :duty-status="identityDuty"
                :overall-status="overallStatus"
                :devices="liveVitals?.devices ?? []"
                :risk-summary="liveVitals?.riskSummary ?? ''"
                :source="liveVitals?.source ?? null"
                :demo-mode="demoMode" />

            <div class="worker-health__rail worker-health__rail--right" :class="{ 'worker-health__rail--hold': hudHold }">
                <VitalSignsHoneycomb
                    :vitals="liveVitals"
                    :loading="Boolean(vitalsLoading)"
                    :selected-key="selectedKey"
                    @select="handleSelectMetric" />
                <div class="worker-health__chart">
                    <VitalSignsWaveform
                        v-if="showEcg"
                        :bpm="liveVitals?.heartRateBpm ?? 0"
                        :level="overallStatus"
                        :paused="scanPaused" />
                    <VitalMetricTrend v-else :metric-key="selectedKey" :points="trendPoints" />
                </div>
            </div>
        </div>

        <footer class="worker-health__footer">
            <WorkerHealthTimeline :events="liveVitals?.timeline ?? []" />
            <div class="worker-health__actions">
                <button type="button" class="hud-chip" @click="handleResetView">复位视角</button>
                <button type="button" class="hud-chip" @click="handleToggleScan">
                    {{ scanPaused ? "恢复扫描" : "暂停扫描" }}
                </button>
            </div>
        </footer>
    </aside>
</template>

<style scoped lang="scss">
.worker-health {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    border: 1px solid rgba(120, 200, 255, 0.32);
    background: #081e32;
    box-shadow:
        0 16px 48px rgba(0, 20, 40, 0.28),
        inset 0 1px 0 rgba(160, 220, 255, 0.18);
    color: #cfe9ff;
    overflow: hidden;
}

.worker-health__corners {
    pointer-events: none;
    position: absolute;
    inset: 8px;
    border: 1px solid rgba(120, 200, 255, 0.12);
    &::before,
    &::after {
        content: "";
        position: absolute;
        width: 18px;
        height: 18px;
        border-color: rgba(110, 220, 255, 0.85);
        border-style: solid;
    }
    &::before {
        top: -1px;
        left: -1px;
        border-width: 2px 0 0 2px;
    }
    &::after {
        right: -1px;
        bottom: -1px;
        border-width: 0 2px 2px 0;
    }
}

.worker-health__scanline {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(180deg, transparent 0, transparent 3px, rgba(80, 160, 210, 0.035) 4px);
    animation: hud-scan 9s linear infinite;
}

.worker-health__chrome {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 18px 8px;
    position: relative;
    z-index: 2;
}

.worker-health__eyebrow {
    margin: 0;
    font-size: 10px;
    letter-spacing: 0.16em;
    color: #4cc9ff;
}

.worker-health__clock {
    margin: 4px 0 0;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
    color: #e8f6ff;
}

.hud-chip {
    position: relative;
    min-width: 64px;
    height: 28px;
    padding: 0 12px;
    border: 1px solid rgba(76, 201, 255, 0.45);
    background: linear-gradient(180deg, rgba(22, 56, 82, 0.72), rgba(8, 26, 42, 0.82));
    color: #d7f0ff;
    cursor: pointer;
    clip-path: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
    letter-spacing: 0.1em;
    font-size: 12px;
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

.worker-health__close {
    min-width: 64px;
}

.worker-health__error {
    margin: 0 18px 8px;
    padding: 8px 10px;
    border: 1px solid rgba(255, 130, 130, 0.4);
    background: rgba(60, 16, 20, 0.45);
    color: #ffb0b0;
    font-size: 12px;
}

.worker-health__layout {
    position: relative;
    z-index: 1;
    min-height: 0;
    flex: 1;
    overflow: hidden;
    perspective: 1480px;
    perspective-origin: 50% 42%;
    transform-style: preserve-3d;
}

.worker-health__well {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: radial-gradient(
        ellipse 48% 62% at 50% 38%,
        #1a4c68 0%,
        #12384e 32%,
        #0a283c 58%,
        #081e32 82%,
        #061624 100%
    );
}

.worker-health__viewport {
    position: absolute;
    inset: 0;
    z-index: 2;
    min-height: 0;
    background: transparent;

    :deep(canvas) {
        display: block;
        width: 100%;
        height: 100%;
        background: transparent;
    }
}

.worker-health__viewport-status {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    place-items: center;
    margin: 0;
    padding: 16px;
    text-align: center;
    font-size: 13px;
    color: #8ec8ef;
    background: rgba(2, 6, 15, 0.72);
    pointer-events: none;
}

.worker-health__viewport-status--error {
    color: #ff8f8f;
}

.worker-health__rail {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 3;
    pointer-events: none;
    overflow: visible;
    transform-style: preserve-3d;
    backface-visibility: hidden;
    transition: opacity 0.22s ease;
}

.worker-health__rail--left {
    left: 0;
    width: min(280px, 22%);
    transform-origin: left center;
    transform: rotateY(0deg);

    &::after {
        content: "";
        position: absolute;
        top: 10%;
        bottom: 10%;
        right: 0;
        width: 1px;
        background: linear-gradient(180deg, transparent, rgba(150, 230, 255, 0.6), transparent);
        box-shadow: 0 0 10px rgba(80, 190, 255, 0.35);
    }
}

.worker-health__rail--right {
    right: 0;
    width: min(300px, 24%);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 12px 8px 10px;
    min-width: 0;
    transform-origin: right center;
    transform: rotateY(0deg);

    &::before {
        content: "";
        position: absolute;
        top: 10%;
        bottom: 10%;
        left: 0;
        width: 1px;
        background: linear-gradient(180deg, transparent, rgba(150, 230, 255, 0.6), transparent);
        box-shadow: 0 0 10px rgba(80, 190, 255, 0.35);
    }
}

.worker-health__rail :deep(button),
.worker-health__rail :deep(.hex),
.worker-health__rail :deep(.identity__status),
.worker-health__rail :deep(.identity__devices) {
    pointer-events: auto;
}

.worker-health__chart {
    margin-top: auto;
    flex-shrink: 0;
    height: 118px;
    min-height: 118px;
    max-height: 118px;
}

.worker-health__footer {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: stretch;
    gap: 12px;
    height: 88px;
    min-height: 88px;
    max-height: 88px;
    box-sizing: border-box;
    padding: 10px 16px;
    border-top: 1px solid rgba(120, 200, 255, 0.12);
    flex-shrink: 0;
    overflow: hidden;
}

.worker-health__rail--hold {
    opacity: 0.42;
    transition: opacity 0.22s ease;
}

.worker-health__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-shrink: 0;
}

@keyframes hud-scan {
    from {
        transform: translateY(-12%);
    }
    to {
        transform: translateY(12%);
    }
}

@media (prefers-reduced-motion: reduce) {
    .worker-health__scanline {
        animation: none;
    }

    .worker-health__rail--left,
    .worker-health__rail--right {
        transform: none;
    }
}

@media (max-width: 1200px) {
    .worker-health__rail--left,
    .worker-health__rail--right {
        width: min(240px, 32%);
    }
}
</style>
