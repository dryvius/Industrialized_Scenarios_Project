<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import HealthOpsHud from "@/components/health/HealthOpsHud.vue";
import SceneInfoPanel from "@/components/SceneInfoPanel.vue";
import WorkerHealthPanel from "@/components/hologram/WorkerHealthPanel.vue";
import VirusMonitorPanel from "@/components/virus/VirusMonitorPanel.vue";
import { useConstructionScene } from "@/composables/useConstructionScene";
import { SceneObjectType } from "@/enums/SceneObjectType";
import { useSiteStore } from "@/stores/siteStore";

const {
    isReady,
    demoEnabled,
    physicsDebugVisible,
    selectedCanAnimate,
    selectedAnimating,
    clearSelection,
    toggleDemo,
    togglePhysicsDebug,
    toggleSelectedAnimation,
    selectByBusinessKey,
    applyWorkerHealthLevels,
    setWorkerHealthHalosVisible,
} = useConstructionScene();

const store = useSiteStore();
const {
    selected,
    selectedEntity,
    selectedVitals,
    healthOverview,
    virusMonitorSnapshot,
    loading,
    vitalsLoading,
    overviewLoading,
    virusMonitorLoading,
    vitalsError,
    overviewError,
    virusMonitorError,
} = storeToRefs(store);

const virusMonitorVisible = ref(false);
const healthOpsMode = ref(false);
let overviewTimer = 0;

const isWorkerSelected = computed((): boolean => selected.value?.objectType === SceneObjectType.Worker);

watch(selected, (payload): void => {
    if (payload?.objectType === SceneObjectType.Worker) {
        closeVirusMonitor();
    }
});

watch(isReady, async (ready): Promise<void> => {
    if (!ready) {
        return;
    }
    await store.loadHealthOverview();
    applyWorkerHealthLevels(store.workerLevelMap());
});

watch(healthOpsMode, async (enabled): Promise<void> => {
    setWorkerHealthHalosVisible(enabled);
    window.clearInterval(overviewTimer);
    if (!enabled) {
        return;
    }
    await store.loadHealthOverview();
    applyWorkerHealthLevels(store.workerLevelMap());
    overviewTimer = window.setInterval((): void => {
        void refreshOverview();
    }, 10000);
});

onBeforeUnmount((): void => {
    window.clearInterval(overviewTimer);
});

async function refreshOverview(): Promise<void> {
    await store.loadHealthOverview();
    applyWorkerHealthLevels(store.workerLevelMap());
}

function closeVirusMonitor(): void {
    virusMonitorVisible.value = false;
    store.clearVirusMonitor();
}

function toggleVirusMonitor(): void {
    if (virusMonitorVisible.value) {
        closeVirusMonitor();
        return;
    }
    if (isWorkerSelected.value) {
        clearSelection();
    }
    virusMonitorVisible.value = true;
    void store.loadVirusMonitorDemo();
}

function toggleHealthOps(): void {
    healthOpsMode.value = !healthOpsMode.value;
    if (!healthOpsMode.value) {
        closeVirusMonitor();
    }
}

function closeHealthPanel(): void {
    if (isWorkerSelected.value) {
        clearSelection();
    }
}

function handleSelectWorker(businessKey: string): void {
    const focused = selectByBusinessKey(businessKey);
    if (!focused) {
        void store.selectObject({
            objectId: businessKey.replace(":", "_"),
            objectType: SceneObjectType.Worker,
            label: businessKey,
            businessKey,
            worldPosition: { x: 0, y: 0, z: 0 },
        });
    }
}

</script>

<template>
    <div class="construction-scene" :class="{ 'construction-scene--ops': healthOpsMode }">
        <div ref="sceneContainer" class="construction-scene__canvas" />

        <SceneInfoPanel
            v-show="!healthOpsMode"
            class="construction-scene__panel construction-scene__panel--info"
            :demo-enabled="demoEnabled"
            :physics-debug-visible="physicsDebugVisible"
            :selected-can-animate="selectedCanAnimate"
            :selected-animating="selectedAnimating"
            :virus-monitor-visible="virusMonitorVisible"
            :health-ops-mode="healthOpsMode"
            @clear="clearSelection"
            @toggle-demo="toggleDemo"
            @toggle-physics-debug="togglePhysicsDebug"
            @toggle-selected-animation="toggleSelectedAnimation"
            @toggle-virus-monitor="toggleVirusMonitor"
            @toggle-health-ops="toggleHealthOps" />

        <HealthOpsHud
            v-if="healthOpsMode"
            :overview="healthOverview"
            :loading="overviewLoading"
            :error-message="overviewError"
            :selected-business-key="selected?.businessKey"
            @select-worker="handleSelectWorker"
            @exit="toggleHealthOps" />

        <WorkerHealthPanel
            v-if="isWorkerSelected"
            class="construction-scene__panel construction-scene__panel--health"
            :class="{ 'construction-scene__panel--health-ops': healthOpsMode }"
            :worker-name="selectedEntity?.name ?? selected?.label ?? ''"
            :worker-id="selectedVitals?.workerId ?? selectedEntity?.id ?? selected?.objectId"
            :worker-status="selectedEntity?.status"
            :vitals="selectedVitals"
            :vitals-loading="vitalsLoading || loading"
            :vitals-error="vitalsError"
            :demo-mode="false"
            @close="closeHealthPanel" />

        <VirusMonitorPanel
            v-if="virusMonitorVisible"
            class="construction-scene__panel construction-scene__panel--virus"
            :snapshot="virusMonitorSnapshot"
            :loading="virusMonitorLoading"
            :error-message="virusMonitorError"
            @close="closeVirusMonitor" />

        <div v-if="!isReady" class="construction-scene__loading">
            <span>正在构建工业基建施工场景...</span>
        </div>
    </div>
</template>

<style scoped lang="scss">
.construction-scene {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: linear-gradient(180deg, #9bb6cc 0%, #ebe0cc 55%, #f2e8d6 100%);
}

.construction-scene--ops {
    background: #081e32;
}

.construction-scene__canvas {
    width: 100%;
    height: 100%;

    :deep(canvas) {
        display: block;
        width: 100%;
        height: 100%;
    }
}

.construction-scene__panel--info {
    position: absolute;
    top: 20px;
    left: 20px;
    z-index: 3;
    pointer-events: auto;
}

.construction-scene__panel--health {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 4;
    width: min(70vw, 1280px);
    height: calc(100vh - 40px);
    pointer-events: auto;
}

.construction-scene__panel--health-ops {
    top: 88px;
    left: 284px;
    right: 16px;
    bottom: 16px;
    width: auto;
    height: auto;
    z-index: 5;
}

.construction-scene__panel--virus {
    position: absolute;
    inset: 0;
    z-index: 6;
    width: 100%;
    height: 100%;
    pointer-events: auto;
}

.construction-scene__loading {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: grid;
    place-items: center;
    background: rgba(242, 232, 214, 0.78);
    color: #8a7a60;
    font-size: 14px;
    letter-spacing: 0.04em;
}
</style>
