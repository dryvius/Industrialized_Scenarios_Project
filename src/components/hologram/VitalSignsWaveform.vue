<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { usePrefersReducedMotion } from "@/composables/usePrefersReducedMotion";
import type { VitalsLevel } from "@/types/vitals";

const props = defineProps<{
    bpm: number;
    level?: VitalsLevel;
    paused?: boolean;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const prefersReducedMotion = usePrefersReducedMotion();
let rafId = 0;
let running = false;
let phase = 0;
let lastStamp = 0;
const samples: number[] = [];

function ecgSample(t: number): number {
    const p = t % 1;
    if (p < 0.08) {
        return Math.sin((p / 0.08) * Math.PI) * 0.18;
    }
    if (p < 0.16) {
        return 0;
    }
    if (p < 0.2) {
        return (-(p - 0.16) / 0.04) * 0.22;
    }
    if (p < 0.24) {
        return ((p - 0.2) / 0.04) * 1.15 - 0.22;
    }
    if (p < 0.28) {
        return 0.93 - ((p - 0.24) / 0.04) * 1.2;
    }
    if (p < 0.36) {
        return Math.sin(((p - 0.28) / 0.08) * Math.PI) * 0.28;
    }
    return 0;
}

function traceColor(): { trail: string; mid: string; head: string; glow: string } {
    if (props.level === "critical") {
        return {
            trail: "rgba(255, 130, 130, 0.18)",
            mid: "rgba(255, 170, 170, 0.55)",
            head: "rgba(255, 210, 210, 0.95)",
            glow: "rgba(255, 90, 90, 0.55)",
        };
    }
    if (props.level === "warning") {
        return {
            trail: "rgba(255, 200, 120, 0.18)",
            mid: "rgba(255, 214, 150, 0.55)",
            head: "rgba(255, 236, 200, 0.95)",
            glow: "rgba(255, 186, 73, 0.45)",
        };
    }
    return {
        trail: "rgba(80, 190, 230, 0.2)",
        mid: "rgba(110, 230, 255, 0.55)",
        head: "rgba(200, 250, 255, 0.95)",
        glow: "rgba(80, 210, 255, 0.55)",
    };
}

function samplePoint(index: number, width: number, height: number): { x: number; y: number } {
    const x = (index / Math.max(samples.length - 1, 1)) * width;
    const y = height * 0.55 - samples[index] * height * 0.38;
    return { x, y };
}

function strokeRange(
    ctx: CanvasRenderingContext2D,
    from: number,
    to: number,
    width: number,
    height: number,
    color: string,
    lineWidth: number,
    blur: number,
): void {
    if (to - from < 2) {
        return;
    }
    ctx.beginPath();
    for (let i = from; i < to; i += 1) {
        const point = samplePoint(i, width, height);
        if (i === from) {
            ctx.moveTo(point.x, point.y);
        } else {
            ctx.lineTo(point.x, point.y);
        }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function draw(): void {
    const canvas = canvasRef.value;
    if (!canvas) {
        return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return;
    }
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(76, 201, 255, 0.08)";
    ctx.lineWidth = 1;
    const gridY = height / 4;
    for (let i = 1; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(0, gridY * i);
        ctx.lineTo(width, gridY * i);
        ctx.stroke();
    }
    const gridX = width / 8;
    for (let i = 1; i < 8; i += 1) {
        ctx.beginPath();
        ctx.moveTo(gridX * i, 0);
        ctx.lineTo(gridX * i, height);
        ctx.stroke();
    }

    ctx.strokeStyle = "rgba(76, 201, 255, 0.2)";
    ctx.beginPath();
    ctx.moveTo(0, height * 0.55);
    ctx.lineTo(width, height * 0.55);
    ctx.stroke();

    const palette = traceColor();
    const count = samples.length;
    strokeRange(ctx, 0, count, width, height, palette.trail, 1.2, 0);
    strokeRange(ctx, Math.max(0, count - 70), count, width, height, palette.mid, 1.5, 4);
    strokeRange(ctx, Math.max(0, count - 18), count, width, height, palette.head, 1.8, 10);

    if (count > 0) {
        const head = samplePoint(count - 1, width, height);
        ctx.beginPath();
        ctx.arc(head.x, head.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = palette.head;
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

function tick(now: number): void {
    if (!running) {
        return;
    }
    const dt = lastStamp === 0 ? 0.016 : Math.min((now - lastStamp) / 1000, 0.05);
    lastStamp = now;
    const bpm = Math.max(40, props.bpm || 72);
    if (!props.paused && !prefersReducedMotion.value) {
        phase += dt * (bpm / 60);
        samples.push(ecgSample(phase));
        if (samples.length > 220) {
            samples.shift();
        }
    }
    draw();
    rafId = requestAnimationFrame(tick);
}

function start(): void {
    if (running) {
        return;
    }
    running = true;
    lastStamp = 0;
    rafId = requestAnimationFrame(tick);
}

function stop(): void {
    running = false;
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
    }
}

function fitCanvas(): void {
    const canvas = canvasRef.value;
    if (!canvas) {
        return;
    }
    const ratio = Math.min(window.devicePixelRatio, 2);
    const width = Math.max(canvas.clientWidth, 1);
    const height = Math.max(canvas.clientHeight, 1);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    draw();
}

onMounted((): void => {
    for (let i = 0; i < 180; i += 1) {
        samples.push(ecgSample(i / 40));
    }
    fitCanvas();
    start();
    window.addEventListener("resize", fitCanvas);
});

onBeforeUnmount((): void => {
    stop();
    window.removeEventListener("resize", fitCanvas);
});

watch(
    () => props.paused,
    (paused): void => {
        if (paused) {
            return;
        }
        lastStamp = 0;
    },
);
</script>

<template>
    <div class="wave" :class="`wave--${level ?? 'normal'}`">
        <div class="wave__head">
            <span>ECG TRACE</span>
            <strong>{{ Math.round(bpm || 0) }} bpm</strong>
        </div>
        <canvas ref="canvasRef" class="wave__canvas" aria-hidden="true" />
    </div>
</template>

<style scoped lang="scss">
.wave {
    box-sizing: border-box;
    height: 118px;
    padding: 8px 10px 8px;
    pointer-events: none;
}

.wave__head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: #6f91ab;

    strong {
        font-size: 13px;
        letter-spacing: 0;
        color: #d7f0ff;
        font-variant-numeric: tabular-nums;
    }
}

.wave--warning .wave__head strong {
    color: #ffe0a8;
}

.wave--critical .wave__head strong {
    color: #ffb0b0;
}

.wave__canvas {
    display: block;
    width: 100%;
    height: 80px;
}
</style>
