<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import HealthOpsHud from "@/components/health/HealthOpsHud.vue";
import SceneInfoPanel from "@/components/SceneInfoPanel.vue";
import WorkerHealthPanel from "@/components/hologram/WorkerHealthPanel.vue";
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
    loading,
    vitalsLoading,
    overviewLoading,
    vitalsError,
    overviewError,
} = storeToRefs(store);

const demoHologramVisible = ref(false);
const healthOpsMode = ref(false);
let overviewTimer = 0;

const isWorkerSelected = computed((): boolean => selected.value?.objectType === SceneObjectType.Worker);

const healthPanelVisible = computed((): boolean => isWorkerSelected.value || demoHologramVisible.value);

const healthDemoMode = computed((): boolean => demoHologramVisible.value && !isWorkerSelected.value);

watch(selected, (payload): void => {
    if (payload?.objectType === SceneObjectType.Worker) {
        demoHologramVisible.value = false;
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

function toggleHologramPreview(): void {
    if (isWorkerSelected.value) {
        closeHealthPanel();
        return;
    }
    demoHologramVisible.value = !demoHologramVisible.value;
    if (demoHologramVisible.value) {
        void store.loadDemoVitals();
    }
}

function toggleHealthOps(): void {
    healthOpsMode.value = !healthOpsMode.value;
    if (!healthOpsMode.value) {
        demoHologramVisible.value = false;
    }
}

function closeHealthPanel(): void {
    demoHologramVisible.value = false;
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

function handleOpenDemo(): void {
    demoHologramVisible.value = true;
    clearSelection();
    void store.loadDemoVitals();
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
            :hologram-preview-visible="healthPanelVisible"
            :health-ops-mode="healthOpsMode"
            @clear="clearSelection"
            @toggle-demo="toggleDemo"
            @toggle-physics-debug="togglePhysicsDebug"
            @toggle-selected-animation="toggleSelectedAnimation"
            @toggle-hologram-preview="toggleHologramPreview"
            @toggle-health-ops="toggleHealthOps" />

        <HealthOpsHud
            v-if="healthOpsMode"
            :overview="healthOverview"
            :loading="overviewLoading"
            :error-message="overviewError"
            :selected-business-key="selected?.businessKey"
            @select-worker="handleSelectWorker"
            @exit="toggleHealthOps"
            @open-demo="handleOpenDemo" />

        <WorkerHealthPanel
            v-if="healthPanelVisible"
            class="construction-scene__panel construction-scene__panel--health"
            :class="{ 'construction-scene__panel--health-ops': healthOpsMode }"
            :worker-name="selectedEntity?.name ?? selected?.label ?? ''"
            :worker-id="selectedVitals?.workerId ?? selectedEntity?.id ?? selected?.objectId"
            :worker-status="selectedEntity?.status"
            :vitals="selectedVitals"
            :vitals-loading="vitalsLoading || (loading && isWorkerSelected)"
            :vitals-error="vitalsError"
            :demo-mode="healthDemoMode"
            @close="closeHealthPanel" />

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
