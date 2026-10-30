import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import {
  HOLOGRAM_ASSEMBLE_DURATION,
  HOLOGRAM_ASSEMBLE_SWIRL_HOLD,
  HOLOGRAM_BLOOM_RADIUS,
  HOLOGRAM_BLOOM_STRENGTH,
  HOLOGRAM_BLOOM_THRESHOLD,
  HOLOGRAM_CAMERA_DISTANCE,
  HOLOGRAM_CAMERA_DISTANCE_MAX,
  HOLOGRAM_CAMERA_DISTANCE_MIN,
  HOLOGRAM_CAMERA_FOV,
  HOLOGRAM_CAMERA_Y_BUST,
  HOLOGRAM_CAMERA_Y_FULL,
  HOLOGRAM_COLORS,
  HOLOGRAM_FILAMENT_RATIO,
  HOLOGRAM_PERSON_MODEL_URL,
  HOLOGRAM_POINT_TARGET_COUNT,
  HOLOGRAM_SAMPLE_OVERSAMPLE,
  HOLOGRAM_SAND_RATIO,
  HOLOGRAM_LOOK_AT_Y_BUST,
  HOLOGRAM_LOOK_AT_Y_FULL,
  HOLOGRAM_PROFILE_YAW,
  HOLOGRAM_RESYNC_ASSEMBLE_SECONDS,
  HOLOGRAM_RESYNC_BURST,
  HOLOGRAM_RESYNC_DISSOLVE_SECONDS,
  HOLOGRAM_RESYNC_FLOOR,
  HOLOGRAM_RESYNC_HOLD_SECONDS,
  HOLOGRAM_SHELL_SCALE,
  HOLOGRAM_SPARKLE_RATIO,
  HOLOGRAM_TARGET_HEIGHT,
  HOLOGRAM_YAW_AMPLITUDE,
} from '@/constants/hologram'
import {
  createHologramPedestal,
  type HologramPedestalHandle,
} from '@/scene/hologram/createHologramPedestal'
import {
  createHologramScanRing,
  type HologramScanRingHandle,
} from '@/scene/hologram/createHologramScanRing'
import {
  createHologramSurface,
  type HologramSurfaceHandle,
} from '@/scene/hologram/createHologramSurface'
import { createSoftParticleTexture } from '@/scene/hologram/createSoftParticleTexture'
import { createGltfLoader } from '@/scene/loaders/createGltfLoader'
import type { VitalMetricKey, VitalsLevel } from '@/types/vitals'
import {
  biasPointCloudToRim,
  computeRimWeight,
  computeSilhouetteScore,
  computeTorsoFrontWeight,
  normalizePointCloud,
  sampleObjectToPointCloud,
  type SampledPointCloud,
} from '@/scene/hologram/sampleMeshToPoints'

export type HologramPreviewStatus = 'idle' | 'loading' | 'ready' | 'error'

export type HologramResyncPhase = 'idle' | 'dissolve' | 'hold' | 'assemble'

export interface HologramBodyScreenAnchor {
  id: string
  metricKey: VitalMetricKey
  label: string
  x: number
  y: number
  side: 'left' | 'right'
}

export interface HologramPreviewCallbacks {
  onStatus?: (status: HologramPreviewStatus, message?: string) => void
  onOrbit?: (yaw: number, locked: boolean) => void
  onAnchors?: (anchors: HologramBodyScreenAnchor[]) => void
  onResync?: (phase: HologramResyncPhase) => void
}

export interface HologramMountOptions {
  reducedMotion?: boolean
}

/**
 * 独立 WebGL 小视口：默认正面 3/4 全身 + 底座，可拖转 / 缩放。
 */
export class HologramPointCloudPreview {
  private readonly callbacks: HologramPreviewCallbacks
  private container: HTMLElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private composer: EffectComposer | null = null
  private bodyRoot: THREE.Group | null = null
  private points: THREE.Points | null = null
  private pointMaterial: THREE.ShaderMaterial | null = null
  private particleTexture: THREE.CanvasTexture | null = null
  private surfaceHandle: HologramSurfaceHandle | null = null
  private pedestalHandle: HologramPedestalHandle | null = null
  private scanRingHandle: HologramScanRingHandle | null = null
  private clock = new THREE.Clock()
  private heartRateBpm = 72
  private alertHeart = 0
  private alertLung = 0
  private alertHead = 0
  private alertWrist = 0
  private scanEnabled = true
  private scanBurstAt = 0
  private reducedMotion = false
  private assembleStartedAt = 0
  private assembleValue = 0
  private resyncPhase: HologramResyncPhase = 'idle'
  private resyncStartedAt = 0
  private resyncFrom = 1
  private burstValue = 1
  private pendingReplay = false
  private rafId = 0
  private running = false
  private disposed = false
  private resizeObserver: ResizeObserver | null = null
  private userYaw = 0
  private cameraDistance = HOLOGRAM_CAMERA_DISTANCE
  private orbitLocked = false
  private pointerId: number | null = null
  private lastPointerX = 0
  private readonly lookTarget = new THREE.Vector3(0, HOLOGRAM_LOOK_AT_Y_BUST, 0)
  private readonly projectScratch = new THREE.Vector3()
  private readonly bodyAnchors: Array<{
    id: string
    metricKey: VitalMetricKey
    label: string
    side: 'left' | 'right'
    local: THREE.Vector3
  }> = [
    { id: 'head', metricKey: 'temp', label: '头部', side: 'right', local: new THREE.Vector3(0.0, 0.48, 0.03) },
    { id: 'chest', metricKey: 'hr', label: '胸部', side: 'right', local: new THREE.Vector3(0.078, 0.205, 0.085) },
    { id: 'breath', metricKey: 'rr', label: '呼吸', side: 'left', local: new THREE.Vector3(-0.06, 0.22, 0.06) },
    { id: 'arm', metricKey: 'spo2', label: '腕带', side: 'left', local: new THREE.Vector3(-0.155, 0.0, 0.09) },
  ]
  private readonly onPointerDown = (event: PointerEvent): void => {
    this.pointerId = event.pointerId
    this.lastPointerX = event.clientX
    this.orbitLocked = true
    if (this.bodyRoot) {
      this.bodyRoot.rotation.y = 0
    }
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }
  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) {
      return
    }
    const dx = event.clientX - this.lastPointerX
    this.lastPointerX = event.clientX
    this.userYaw -= dx * 0.005
    this.applyCamera()
    this.callbacks.onOrbit?.(this.userYaw, true)
  }
  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) {
      return
    }
    this.pointerId = null
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    this.callbacks.onOrbit?.(this.userYaw, false)
  }
  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    const next = this.cameraDistance + event.deltaY * 0.0024
    this.cameraDistance = THREE.MathUtils.clamp(
      next,
      HOLOGRAM_CAMERA_DISTANCE_MIN,
      HOLOGRAM_CAMERA_DISTANCE_MAX,
    )
    this.applyCamera()
  }

  public constructor(callbacks: HologramPreviewCallbacks = {}) {
    this.callbacks = callbacks
  }

  public async mount(container: HTMLElement, options: HologramMountOptions = {}): Promise<void> {
    this.disposed = false
    this.container = container
    this.reducedMotion = Boolean(options.reducedMotion)
    this.emitStatus('loading', '正在加载人体模型...')

    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)

    const scene = new THREE.Scene()
    scene.background = null
    this.scene = scene

    const camera = new THREE.PerspectiveCamera(HOLOGRAM_CAMERA_FOV, width / height, 0.08, 50)
    this.camera = camera
    this.userYaw = 0
    this.cameraDistance = HOLOGRAM_CAMERA_DISTANCE
    this.orbitLocked = false
    this.applyCamera()

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.72
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.style.cursor = 'grab'
    container.appendChild(renderer.domElement)
    this.renderer = renderer
    this.bindOrbit(renderer.domElement)

    const composer = new EffectComposer(renderer)
    const renderPass = new RenderPass(scene, camera)
    renderPass.clearColor = new THREE.Color(0x000000)
    renderPass.clearAlpha = 0
    composer.addPass(renderPass)
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      HOLOGRAM_BLOOM_STRENGTH,
      HOLOGRAM_BLOOM_RADIUS,
      HOLOGRAM_BLOOM_THRESHOLD,
    )
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
    this.composer = composer

    this.particleTexture = createSoftParticleTexture(64)

    try {
      const gltf = await createGltfLoader().loadAsync(HOLOGRAM_PERSON_MODEL_URL)
      if (this.disposed) {
        disposeObjectTree(gltf.scene)
        return
      }

      const oversample = Math.ceil(HOLOGRAM_POINT_TARGET_COUNT * HOLOGRAM_SAMPLE_OVERSAMPLE)
      const raw = sampleObjectToPointCloud(gltf.scene, oversample)
      const normalized = normalizePointCloud(raw, HOLOGRAM_TARGET_HEIGHT)
      const cloud = biasPointCloudToRim(normalized, HOLOGRAM_POINT_TARGET_COUNT)
      const shellSource = cloneObjectTreeWithGeometry(gltf.scene)
      disposeObjectTree(gltf.scene)

      if (cloud.positions.length < 3) {
        disposeObjectTree(shellSource)
        this.emitStatus('error', `模型采样结果为空，请检查 ${HOLOGRAM_PERSON_MODEL_URL}`)
        return
      }

      const footY = computePointCloudMinY(cloud.positions)
      this.pedestalHandle = createHologramPedestal(footY)
      scene.add(this.pedestalHandle.group)
      this.scanRingHandle = createHologramScanRing(footY, HOLOGRAM_TARGET_HEIGHT)
      scene.add(this.scanRingHandle.group)

      const wrist = estimateLeftWrist(cloud.positions)
      const armAnchor = this.bodyAnchors.find((anchor) => anchor.id === 'arm')
      if (armAnchor) {
        armAnchor.local.copy(wrist)
      }

      const bodyRoot = new THREE.Group()
      bodyRoot.name = 'hologram-body'
      this.bodyRoot = bodyRoot

      this.surfaceHandle = createHologramSurface(shellSource)
      this.surfaceHandle.root.scale.multiplyScalar(HOLOGRAM_SHELL_SCALE)
      bodyRoot.add(this.surfaceHandle.root)

      this.points = this.createPointCloud(cloud)
      this.points.renderOrder = 3
      bodyRoot.add(this.points)
      scene.add(bodyRoot)
      this.emitStatus('ready', `点云已就绪（${cloud.positions.length / 3} 点）`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '模型加载失败'
      this.emitStatus('error', message)
      return
    }

    this.resizeObserver = new ResizeObserver((): void => {
      this.handleResize()
    })
    this.resizeObserver.observe(container)

    this.running = true
    this.clock.start()
    // 用 performance 计时，避免 Clock / smoothstep 参数踩坑导致汇聚进度卡住
    this.assembleStartedAt = this.reducedMotion ? performance.now() - HOLOGRAM_ASSEMBLE_DURATION * 1000 : performance.now()
    this.tick()
    if (this.pendingReplay) {
      this.pendingReplay = false
      this.replayProjection()
    }
  }

  public setVitals(input: {
    heartRateBpm: number
    hr: VitalsLevel
    rr: VitalsLevel
    temp: VitalsLevel
    spo2: VitalsLevel
  }): void {
    this.heartRateBpm = Math.max(30, input.heartRateBpm)
    this.alertHeart = alertCode(input.hr)
    this.alertLung = alertCode(input.rr)
    this.alertHead = alertCode(input.temp)
    this.alertWrist = alertCode(input.spo2)
  }

  public setScanEnabled(enabled: boolean): void {
    this.scanEnabled = enabled
  }

  public pulseScan(): void {
    this.scanBurstAt = performance.now()
  }

  /** 打断并重放短版消散→聚合，不重新采样模型。 */
  public replayProjection(): void {
    if (this.reducedMotion || this.disposed) {
      return
    }
    if (!this.pointMaterial) {
      this.pendingReplay = true
      return
    }
    this.resyncFrom = Math.max(this.assembleValue, 0.35)
    this.resyncPhase = 'dissolve'
    this.resyncStartedAt = performance.now()
    this.burstValue = HOLOGRAM_RESYNC_BURST
    this.callbacks.onResync?.('dissolve')
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled
    if (enabled) {
      this.resyncPhase = 'idle'
      this.assembleValue = 1
      this.burstValue = 1
      this.pendingReplay = false
      this.assembleStartedAt = performance.now() - HOLOGRAM_ASSEMBLE_DURATION * 1000
      this.callbacks.onResync?.('idle')
    }
  }

  public setPaused(paused: boolean): void {
    if (paused) {
      this.running = false
      if (this.rafId) {
        cancelAnimationFrame(this.rafId)
        this.rafId = 0
      }
      return
    }
    if (!this.disposed && !this.running) {
      this.running = true
      this.clock.getDelta()
      this.tick()
    }
  }

  public resetView(): void {
    this.userYaw = 0
    this.cameraDistance = HOLOGRAM_CAMERA_DISTANCE
    this.orbitLocked = false
    this.applyCamera()
    this.callbacks.onOrbit?.(0, false)
  }

  public dispose(): void {
    this.disposed = true
    this.running = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }

    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.unbindOrbit()

    if (this.points) {
      this.points.geometry.dispose()
      this.points = null
    }

    if (this.surfaceHandle) {
      this.surfaceHandle.dispose()
      this.surfaceHandle = null
    }

    if (this.bodyRoot) {
      this.scene?.remove(this.bodyRoot)
      this.bodyRoot = null
    }

    if (this.pedestalHandle) {
      this.scene?.remove(this.pedestalHandle.group)
      this.pedestalHandle.dispose()
      this.pedestalHandle = null
    }

    if (this.scanRingHandle) {
      this.scene?.remove(this.scanRingHandle.group)
      this.scanRingHandle.dispose()
      this.scanRingHandle = null
    }

    this.pointMaterial?.dispose()
    this.pointMaterial = null
    this.particleTexture?.dispose()
    this.particleTexture = null

    if (this.camera) {
      this.scene?.remove(this.camera)
    }

    this.composer?.dispose()
    this.composer = null

    if (this.renderer) {
      this.renderer.dispose()
      this.renderer.domElement.remove()
      this.renderer = null
    }

    this.scene = null
    this.camera = null
    this.container = null
    this.emitStatus('idle')
  }

  private createPointCloud(cloud: SampledPointCloud): THREE.Points {
    const surfaceCount = cloud.positions.length / 3
    const extraSand = Math.round(surfaceCount * HOLOGRAM_SAND_RATIO)
    const extraFilament = Math.round(surfaceCount * HOLOGRAM_FILAMENT_RATIO)
    const count = surfaceCount + extraSand + extraFilament

    const positions = new Float32Array(count * 3)
    const normals = new Float32Array(count * 3)
    positions.set(cloud.positions)
    normals.set(cloud.normals)

    const seeds = new Float32Array(count)
    const silhouetteAttr = new Float32Array(count)
    const sand = new Float32Array(count)
    const sandTier = new Float32Array(count)
    const filament = new Float32Array(count)
    const sizeClass = new Float32Array(count)
    const scatter = new Float32Array(count * 3)
    const flow = new Float32Array(count * 3)

    const driftPool: number[] = []
    for (let i = 0; i < surfaceCount; i += 1) {
      fillSurfacePoint({
        index: i,
        positions,
        normals,
        seeds,
        silhouetteAttr,
        sand,
        sandTier,
        filament,
        sizeClass,
        scatter,
        flow,
        drift: 'none',
      })
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const nz = normals[i * 3 + 2]
      const rim = computeRimWeight(x, y, positions[i * 3 + 2])
      let copies = 1
      if (nz < 0.08) {
        copies += 5
      }
      if (y > 0.18 && nz < 0.1) {
        copies += 3
      }
      if (rim > 0.45) {
        copies += 1
      }
      for (let copy = 0; copy < copies; copy += 1) {
        driftPool.push(i)
      }
    }

    let write = surfaceCount
    write = spawnDriftCopies({
      start: write,
      amount: extraSand,
      kind: 'sand',
      pool: driftPool,
      surfaceCount,
      positions,
      normals,
      seeds,
      silhouetteAttr,
      sand,
      sandTier,
      filament,
      sizeClass,
      scatter,
      flow,
    })
    spawnDriftCopies({
      start: write,
      amount: extraFilament,
      kind: 'filament',
      pool: driftPool,
      surfaceCount,
      positions,
      normals,
      seeds,
      silhouetteAttr,
      sand,
      sandTier,
      filament,
      sizeClass,
      scatter,
      flow,
    })

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    // 勿用名 `normal`：Points 路径下可能未正确绑定，导致 Fresnel 全 NaN 变黑
    geometry.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    geometry.setAttribute('aSilhouette', new THREE.BufferAttribute(silhouetteAttr, 1))
    geometry.setAttribute('aSand', new THREE.BufferAttribute(sand, 1))
    geometry.setAttribute('aSandTier', new THREE.BufferAttribute(sandTier, 1))
    geometry.setAttribute('aFilament', new THREE.BufferAttribute(filament, 1))
    geometry.setAttribute('aSizeClass', new THREE.BufferAttribute(sizeClass, 1))
    geometry.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3))
    geometry.setAttribute('aFlow', new THREE.BufferAttribute(flow, 3))

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uAssemble: { value: 0 },
        uBurst: { value: 1 },
        uMap: { value: this.particleTexture },
        uColor: { value: new THREE.Color(HOLOGRAM_COLORS.pointCore) },
        uAccent: { value: new THREE.Color(HOLOGRAM_COLORS.pointAccent) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uWind: { value: new THREE.Vector3(0.08, 0.34, -0.95) },
        uPulse: { value: 0 },
        uAlertHeart: { value: 0 },
        uAlertLung: { value: 0 },
        uAlertHead: { value: 0 },
        uAlertWrist: { value: 0 },
        uPosHeart: { value: this.anchorLocal('chest', new THREE.Vector3(0.078, 0.205, 0.085)) },
        uPosLung: { value: this.anchorLocal('breath', new THREE.Vector3(-0.06, 0.22, 0.06)) },
        uPosHead: { value: this.anchorLocal('head', new THREE.Vector3(0.0, 0.48, 0.03)) },
        uPosWrist: { value: this.anchorLocal('arm', new THREE.Vector3(-0.17, 0.02, 0.05)) },
      },
      vertexShader: `
        attribute float aSeed;
        attribute float aSilhouette;
        attribute float aSand;
        attribute float aSandTier;
        attribute float aFilament;
        attribute float aSizeClass;
        attribute vec3 aNormal;
        attribute vec3 aScatter;
        attribute vec3 aFlow;
        uniform float uTime;
        uniform float uAssemble;
        uniform float uBurst;
        uniform float uPixelRatio;
        uniform vec3 uWind;
        uniform float uPulse;
        uniform vec3 uPosHeart;
        uniform vec3 uPosLung;
        uniform vec3 uPosHead;
        uniform vec3 uPosWrist;
        varying float vAlpha;
        varying float vRim;
        varying float vSparkle;
        varying float vDrift;
        varying float vTorso;
        varying float vHeart;
        varying float vLung;
        varying float vHead;
        varying float vWrist;

        float gauss3(vec3 p, vec3 c, vec3 k) {
          vec3 d = p - c;
          return exp(-dot(d * d, k));
        }

        void main() {
          float delay = (1.0 - aSilhouette) * 0.36 + aSeed * 0.12;
          float ease = smoothstep(delay, min(1.0, delay + 0.42), uAssemble);
          float fly = 1.0 - ease;

          float swirlSpeed = mix(0.95, 1.85, aSeed);
          float ang = uTime * swirlSpeed + aSeed * 6.2831853;
          float rr = length(aScatter.xz) * mix(1.0, uBurst, fly);
          float a0 = atan(aScatter.z, aScatter.x);
          vec3 swirl;
          swirl.x = cos(a0 + ang) * rr;
          swirl.z = sin(a0 + ang) * rr;
          swirl.y = aScatter.y * mix(1.0, uBurst, fly) + sin(uTime * 1.45 + aSeed * 9.0) * 0.28 * fly;
          swirl += vec3(
            sin(uTime * 1.9 + aSeed * 4.2) * 0.22,
            cos(uTime * 1.25 + aSeed * 5.6) * 0.18,
            sin(uTime * 1.55 + aSeed * 3.3) * 0.2
          ) * fly;
          swirl += vec3(-sin(a0 + ang), 0.0, cos(a0 + ang)) * (0.06 * fly);
          vec3 pos = mix(swirl, position, ease);

          float live = smoothstep(0.88, 1.0, uAssemble) * ease;
          float heart = max(
            gauss3(position, uPosHeart, vec3(220.0, 240.0, 140.0)),
            gauss3(position, uPosHeart, vec3(80.0, 95.0, 55.0)) * 0.62
          );
          float lung = max(
            gauss3(position, uPosLung, vec3(95.0, 78.0, 60.0)),
            gauss3(position, uPosLung, vec3(38.0, 32.0, 24.0)) * 0.55
          );
          float head = max(
            gauss3(position, uPosHead, vec3(160.0, 210.0, 160.0)),
            gauss3(position, uPosHead, vec3(70.0, 90.0, 70.0)) * 0.5
          );
          float wrist = max(
            gauss3(position, uPosWrist, vec3(210.0, 240.0, 180.0)),
            gauss3(position, uPosWrist, vec3(90.0, 110.0, 80.0)) * 0.55
          );
          vHeart = heart;
          vLung = lung;
          vHead = head;
          vWrist = wrist;
          pos += normalize(aNormal + 0.0001) * (uPulse * 0.0042 * heart * live);
          pos.x += sin(uTime * 1.6 + aSeed * 6.2831853) * 0.0024 * live;
          pos.y += cos(uTime * 1.15 + aSeed * 3.7) * 0.0014 * live;
          pos.z += sin(uTime * 1.35 + aSeed * 4.6) * 0.0020 * live;

          float drift = 0.0;
          float back = smoothstep(0.12, -0.22, aNormal.z);
          if (aSand > 0.5 && live > 0.01) {
            float speed = mix(0.07, 0.04, aSandTier) + aSeed * 0.03;
            speed *= mix(1.0, 0.78, back);
            float cycle = fract(uTime * speed + aSeed);
            drift = cycle;
            vec3 wind = normalize(uWind + 0.0001);
            wind.x += sin(uTime * 0.55 + aSeed * 9.0) * 0.35;
            wind.y += cos(uTime * 0.42 + aSeed * 6.5) * 0.18 + back * 0.55;
            wind.z += sin(uTime * 0.48 + aSeed * 4.0) * 0.22;
            wind.z *= mix(1.0, 0.52, back);
            wind = normalize(wind);
            float maxDist = mix(0.14, 0.38, aSandTier) + aSeed * 0.1;
            maxDist *= mix(1.0, 1.75, back);
            pos += wind * maxDist * cycle * live;
            pos.y += sin(cycle * 6.2831853 + aSeed * 8.0) * mix(0.014, 0.045, aSandTier) * cycle * live;
          }

          if (aFilament > 0.5 && live > 0.01) {
            float speed = mix(0.055, 0.12, aSeed);
            speed *= mix(1.0, 0.82, back);
            float cycle = fract(uTime * speed + aSeed * 0.73);
            drift = max(drift, cycle);
            vec3 ribbon = aFlow;
            ribbon.x += sin(uTime * 0.9 + aSeed * 5.0) * 0.05;
            ribbon.y += cos(uTime * 1.1 + aSeed * 3.4) * 0.04 + back * 0.08;
            ribbon *= mix(1.0, 1.5, back);
            pos += ribbon * cycle * live;
            pos += normalize(aNormal + 0.0001) * (mix(0.012, 0.028, back) * cycle * live);
          }

          vec3 worldNormal = normalize(mat3(modelMatrix) * aNormal);
          vec4 worldPos = modelMatrix * vec4(pos, 1.0);
          vec3 viewDir = normalize(cameraPosition - worldPos.xyz);
          float ndotv = dot(worldNormal, viewDir);
          float front = smoothstep(-0.35, 0.4, ndotv);
          float graze = pow(1.0 - abs(ndotv), 1.7);
          float rim = clamp(graze * 0.7 + aSilhouette * 0.45, 0.0, 1.0);
          float chestBand = smoothstep(0.1, 0.18, position.y) * (1.0 - smoothstep(0.28, 0.4, position.y));
          float absBand = smoothstep(-0.08, 0.02, position.y) * (1.0 - smoothstep(0.1, 0.18, position.y));
          float torsoCenter = 1.0 - smoothstep(0.06, 0.2, abs(position.x));
          float torsoFront = max(chestBand, absBand) * torsoCenter * smoothstep(0.04, 0.38, aNormal.z);
          vRim = rim;
          vSparkle = step(1.5, aSizeClass);
          vDrift = drift;
          vTorso = torsoFront;

          float body = mix(0.34, 0.58, front);
          float headFill = smoothstep(0.2, 0.58, position.y) * 0.1;
          float sparkleBoost = vSparkle * 0.12;
          float torsoBoost = torsoFront * 0.08;
          float baseAlpha = body + rim * 0.32 + headFill + sparkleBoost + torsoBoost + aSeed * 0.03;
          baseAlpha *= mix(1.0, 1.0 - drift * 0.88, max(step(0.5, aSand), step(0.5, aFilament)) * live);
          baseAlpha *= mix(0.55, 1.0, ease);
          vAlpha = clamp(baseAlpha, 0.06, 0.66);

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;

          float classSize = 1.32;
          if (aSizeClass < 0.5) {
            classSize = 1.08;
          } else if (aSizeClass > 1.5) {
            classSize = 1.72;
          }
          float size = mix(1.22, 1.58, rim) * classSize;
          size *= mix(1.0, 1.03, torsoFront);
          size *= mix(1.0, mix(1.38, 1.72, aSandTier) * (1.0 - drift * 0.22), step(0.5, aSand) * live);
          size *= mix(1.0, 1.58 * (1.0 - drift * 0.16), step(0.5, aFilament) * live);
          size *= mix(1.28, 1.0, ease);
          gl_PointSize = max(1.5, size * uPixelRatio * (5.6 / max(0.8, -mvPosition.z)));
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        uniform vec3 uAccent;
        uniform float uPulse;
        uniform float uTime;
        uniform float uAlertHeart;
        uniform float uAlertLung;
        uniform float uAlertHead;
        uniform float uAlertWrist;
        varying float vAlpha;
        varying float vRim;
        varying float vSparkle;
        varying float vDrift;
        varying float vTorso;
        varying float vHeart;
        varying float vLung;
        varying float vHead;
        varying float vWrist;

        float alertAmt(float level) {
          return mix(0.0, mix(0.78, 0.92, step(1.5, level)), step(0.5, level));
        }

        vec3 alertRgb(float level) {
          vec3 warn = vec3(0.78, 0.26, 0.02);
          vec3 crit = vec3(0.7, 0.05, 0.04);
          return mix(warn, crit, step(1.5, level));
        }

        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.08) discard;
          vec3 color = mix(uColor * 0.42, uAccent * 0.82, vRim);
          color = mix(color, vec3(0.42, 0.86, 0.94), vRim * 0.32);
          color = mix(color, vec3(0.62, 0.92, 0.98), vSparkle * 0.35);
          color = mix(color, uAccent * 0.9, vTorso * 0.1);
          color *= 0.52 + vRim * 0.38 + vTorso * 0.05;
          float breathe = 0.72 + 0.28 * sin(uTime * 2.1);
          float heartW = vHeart * alertAmt(uAlertHeart);
          float lungW = vLung * alertAmt(uAlertLung) * breathe;
          float headW = vHead * alertAmt(uAlertHead) * breathe;
          float wristW = vWrist * alertAmt(uAlertWrist) * breathe;
          color = mix(color, alertRgb(uAlertLung), lungW);
          color = mix(color, alertRgb(uAlertHead), headW);
          color = mix(color, alertRgb(uAlertWrist), wristW);
          color = mix(color, alertRgb(uAlertHeart), heartW);
          color += alertRgb(uAlertHeart) * vHeart * uPulse * 0.4;
          float interior = mix(mix(0.32, 0.55, vSparkle), 0.92, smoothstep(0.04, 0.32, vRim));
          interior = mix(interior, 0.42, vTorso);
          float alpha = tex.a * vAlpha * interior * mix(1.0, 0.38, vDrift * (1.0 - vSparkle));
          if (alpha < 0.018) discard;
          gl_FragColor = vec4(color, alpha);
        }
      `,
    })
    this.pointMaterial = material

    const points = new THREE.Points(geometry, material)
    points.frustumCulled = false
    return points
  }

  private advanceAssemble(now: number): number {
    if (this.resyncPhase === 'dissolve') {
      const t = THREE.MathUtils.clamp((now - this.resyncStartedAt) / (HOLOGRAM_RESYNC_DISSOLVE_SECONDS * 1000), 0, 1)
      this.assembleValue = THREE.MathUtils.lerp(this.resyncFrom, HOLOGRAM_RESYNC_FLOOR, THREE.MathUtils.smoothstep(t, 0, 1))
      if (t >= 1) {
        this.resyncPhase = 'hold'
        this.resyncStartedAt = now
        this.assembleValue = HOLOGRAM_RESYNC_FLOOR
        this.callbacks.onResync?.('hold')
      }
      return this.assembleValue
    }

    if (this.resyncPhase === 'hold') {
      this.assembleValue = HOLOGRAM_RESYNC_FLOOR
      if (now - this.resyncStartedAt >= HOLOGRAM_RESYNC_HOLD_SECONDS * 1000) {
        this.resyncPhase = 'assemble'
        this.resyncStartedAt = now
        this.callbacks.onResync?.('assemble')
      }
      return this.assembleValue
    }

    if (this.resyncPhase === 'assemble') {
      const t = THREE.MathUtils.clamp((now - this.resyncStartedAt) / (HOLOGRAM_RESYNC_ASSEMBLE_SECONDS * 1000), 0, 1)
      this.assembleValue = THREE.MathUtils.lerp(HOLOGRAM_RESYNC_FLOOR, 1, THREE.MathUtils.smoothstep(t, 0, 1))
      if (t >= 1) {
        this.resyncPhase = 'idle'
        this.assembleValue = 1
        this.burstValue = 1
        this.callbacks.onResync?.('idle')
      } else {
        this.burstValue = THREE.MathUtils.lerp(HOLOGRAM_RESYNC_BURST, 1, t)
      }
      return this.assembleValue
    }

    const elapsedSec = (now - this.assembleStartedAt) / 1000
    const assembleRaw = THREE.MathUtils.clamp(elapsedSec / HOLOGRAM_ASSEMBLE_DURATION, 0, 1)
    const swirlHold = HOLOGRAM_ASSEMBLE_SWIRL_HOLD / HOLOGRAM_ASSEMBLE_DURATION
    if (assembleRaw >= 1) {
      this.assembleValue = 1
    } else if (assembleRaw > swirlHold) {
      const x = (assembleRaw - swirlHold) / (1 - swirlHold)
      this.assembleValue = THREE.MathUtils.smoothstep(x, 0, 1)
    } else {
      this.assembleValue = 0
    }
    return this.assembleValue
  }

  private tick = (): void => {
    if (!this.running || !this.composer || !this.points || !this.pointMaterial) {
      return
    }

    const t = this.clock.getElapsedTime()
    const assemble = this.advanceAssemble(performance.now())
    this.pointMaterial.uniforms.uTime.value = t
    this.pointMaterial.uniforms.uAssemble.value = assemble
    this.pointMaterial.uniforms.uBurst.value = this.burstValue
    this.surfaceHandle?.setTime(t)
    this.surfaceHandle?.setAssemble(assemble)
    const period = 60 / this.heartRateBpm
    const beat = Math.pow(Math.max(0, Math.sin(((t % period) / period) * Math.PI * 2)), 14) * 0.65
    this.pointMaterial.uniforms.uPulse.value = this.reducedMotion ? 0 : beat
    this.pointMaterial.uniforms.uAlertHeart.value = this.alertHeart
    this.pointMaterial.uniforms.uAlertLung.value = this.alertLung
    this.pointMaterial.uniforms.uAlertHead.value = this.alertHead
    this.pointMaterial.uniforms.uAlertWrist.value = this.alertWrist
    const burstAge = (performance.now() - this.scanBurstAt) / 1000
    const bursting = this.scanBurstAt > 0 && burstAge < 0.9
    this.scanRingHandle?.update(
      bursting ? burstAge : t,
      this.scanEnabled && !this.reducedMotion,
      bursting,
    )

    if (!this.orbitLocked && this.bodyRoot) {
      this.bodyRoot.rotation.y =
        Math.sin(t * 0.22) *
        HOLOGRAM_YAW_AMPLITUDE *
        THREE.MathUtils.smoothstep(assemble, 0.75, 1)
    }

    this.pedestalHandle?.update(t)
    this.composer.render()
    this.emitAnchors()
    this.rafId = requestAnimationFrame(this.tick)
  }

  private emitAnchors(): void {
    if (!this.camera || !this.points || !this.callbacks.onAnchors) {
      return
    }
    this.points.updateMatrixWorld()
    const projected = this.bodyAnchors.map((anchor): HologramBodyScreenAnchor => {
      this.projectScratch.copy(anchor.local).applyMatrix4(this.points!.matrixWorld)
      this.projectScratch.project(this.camera!)
      return {
        id: anchor.id,
        metricKey: anchor.metricKey,
        label: anchor.label,
        side: anchor.side,
        x: (this.projectScratch.x * 0.5 + 0.5) * 100,
        y: (-this.projectScratch.y * 0.5 + 0.5) * 100,
      }
    })
    this.callbacks.onAnchors(projected)
  }

  private handleResize(): void {
    if (!this.container || !this.renderer || !this.camera || !this.composer) {
      return
    }
    const width = Math.max(this.container.clientWidth, 1)
    const height = Math.max(this.container.clientHeight, 1)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height, false)
    this.composer.setSize(width, height)
    this.applyCamera()
  }

  private applyCamera(): void {
    if (!this.camera) {
      return
    }
    const zoom = THREE.MathUtils.inverseLerp(
      HOLOGRAM_CAMERA_DISTANCE_MIN,
      HOLOGRAM_CAMERA_DISTANCE_MAX,
      this.cameraDistance,
    )
    const yaw = HOLOGRAM_PROFILE_YAW + this.userYaw
    const tallBoost =
      this.camera.aspect < 0.9
        ? THREE.MathUtils.lerp(1.42, 1, THREE.MathUtils.smoothstep(this.camera.aspect, 0.42, 0.9))
        : 1
    const distance = this.cameraDistance * tallBoost
    const camY = THREE.MathUtils.lerp(HOLOGRAM_CAMERA_Y_BUST, HOLOGRAM_CAMERA_Y_FULL, zoom)
    const lookY = THREE.MathUtils.lerp(HOLOGRAM_LOOK_AT_Y_BUST, HOLOGRAM_LOOK_AT_Y_FULL, zoom)
    this.camera.position.set(
      Math.sin(yaw) * distance,
      camY,
      Math.cos(yaw) * distance,
    )
    this.lookTarget.set(0, lookY, 0)
    this.camera.lookAt(this.lookTarget)
  }

  private bindOrbit(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  private unbindOrbit(): void {
    const canvas = this.renderer?.domElement
    if (!canvas) {
      return
    }
    canvas.removeEventListener('pointerdown', this.onPointerDown)
    canvas.removeEventListener('pointermove', this.onPointerMove)
    canvas.removeEventListener('pointerup', this.onPointerUp)
    canvas.removeEventListener('pointercancel', this.onPointerUp)
    canvas.removeEventListener('wheel', this.onWheel)
  }

  private emitStatus(status: HologramPreviewStatus, message?: string): void {
    this.callbacks.onStatus?.(status, message)
  }

  private anchorLocal(id: string, fallback: THREE.Vector3): THREE.Vector3 {
    const found = this.bodyAnchors.find((anchor) => anchor.id === id)
    return found ? found.local.clone() : fallback
  }
}

function alertCode(level: VitalsLevel): number {
  if (level === 'critical') {
    return 2
  }
  if (level === 'warning') {
    return 1
  }
  return 0
}

/** 先找左手指尖簇，再沿前臂向肘部回退到手腕。 */
interface PointCloudBuffers {
  positions: Float32Array
  normals: Float32Array
  seeds: Float32Array
  silhouetteAttr: Float32Array
  sand: Float32Array
  sandTier: Float32Array
  filament: Float32Array
  sizeClass: Float32Array
  scatter: Float32Array
  flow: Float32Array
}

function fillSurfacePoint(
  input: PointCloudBuffers & { index: number; drift: 'none' | 'sand' | 'filament' },
): void {
  const i = input.index
  const x = input.positions[i * 3]
  const y = input.positions[i * 3 + 1]
  const z = input.positions[i * 3 + 2]
  const nx = input.normals[i * 3]
  const ny = input.normals[i * 3 + 1]
  const nz = input.normals[i * 3 + 2]
  const rim = computeRimWeight(x, y, z)
  const silhouette = computeSilhouetteScore(x, y, z, nx, ny, nz)
  const seed = Math.random()
  input.seeds[i] = seed
  input.silhouetteAttr[i] = silhouette
  input.sand[i] = input.drift === 'sand' ? 1 : 0
  input.sandTier[i] = input.drift === 'sand' && Math.random() < 0.32 ? 1 : 0
  input.filament[i] = input.drift === 'filament' ? 1 : 0

  const sparkleChance = HOLOGRAM_SPARKLE_RATIO * (0.45 + silhouette * 1.4)
  const torsoFront = computeTorsoFrontWeight(x, y, z, nx, ny, nz)
  if (input.drift !== 'none') {
    input.sizeClass[i] = 2
  } else if (Math.random() < sparkleChance) {
    input.sizeClass[i] = 2
  } else if (torsoFront > 0.35) {
    input.sizeClass[i] = 1
  } else if (silhouette < 0.35 && seed < 0.55) {
    input.sizeClass[i] = 0
  } else {
    input.sizeClass[i] = 1
  }

  const radius = 0.55 + seed * 1.35
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(Math.random() * 2 - 1)
  input.scatter[i * 3] = Math.sin(phi) * Math.cos(theta) * radius
  input.scatter[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * radius * 1.15
  input.scatter[i * 3 + 2] = Math.cos(phi) * radius * 0.9

  const backFace = nz < 0.08
  const flowScale = 0.34 + seed * 0.85
  const backLift = backFace ? 1.35 : 1
  input.flow[i * 3] = (nx * 0.22 + (Math.random() - 0.5) * 0.2) * flowScale
  input.flow[i * 3 + 1] = (0.58 + ny * 0.2 + (Math.random() - 0.5) * 0.16) * flowScale * backLift
  input.flow[i * 3 + 2] = (-0.55 + nz * 0.18 + (Math.random() - 0.5) * 0.14) * flowScale
}

function spawnDriftCopies(
  input: PointCloudBuffers & {
    start: number
    amount: number
    kind: 'sand' | 'filament'
    pool: number[]
    surfaceCount: number
  },
): number {
  let write = input.start
  const poolLen = input.pool.length
  for (let k = 0; k < input.amount; k += 1) {
    const src =
      poolLen > 0
        ? input.pool[Math.floor(Math.random() * poolLen)]
        : Math.floor(Math.random() * input.surfaceCount)
    input.positions[write * 3] = input.positions[src * 3]
    input.positions[write * 3 + 1] = input.positions[src * 3 + 1]
    input.positions[write * 3 + 2] = input.positions[src * 3 + 2]
    input.normals[write * 3] = input.normals[src * 3]
    input.normals[write * 3 + 1] = input.normals[src * 3 + 1]
    input.normals[write * 3 + 2] = input.normals[src * 3 + 2]
    fillSurfacePoint({
      index: write,
      positions: input.positions,
      normals: input.normals,
      seeds: input.seeds,
      silhouetteAttr: input.silhouetteAttr,
      sand: input.sand,
      sandTier: input.sandTier,
      filament: input.filament,
      sizeClass: input.sizeClass,
      scatter: input.scatter,
      flow: input.flow,
      drift: input.kind,
    })
    write += 1
  }
  return write
}

function estimateLeftWrist(positions: Float32Array): THREE.Vector3 {
  const hand: Array<{ x: number; y: number; z: number; score: number }> = []
  let elbowX = 0
  let elbowY = 0
  let elbowZ = 0
  let elbowN = 0
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    const z = positions[i + 2]
    if (x >= -0.08) {
      continue
    }
    if (y <= 0.05 && y >= -0.3) {
      hand.push({ x, y, z, score: -x * 2.4 - y * 1.2 + z * 0.3 })
    }
    if (x > -0.2 && x < -0.08 && y > 0.02 && y < 0.2) {
      elbowX += x
      elbowY += y
      elbowZ += z
      elbowN += 1
    }
  }
  if (hand.length === 0) {
    return new THREE.Vector3(-0.17, 0.02, 0.05)
  }
  hand.sort((a, b) => b.score - a.score)
  const count = Math.min(hand.length, 40)
  let hx = 0
  let hy = 0
  let hz = 0
  for (let i = 0; i < count; i += 1) {
    hx += hand[i].x
    hy += hand[i].y
    hz += hand[i].z
  }
  hx /= count
  hy /= count
  hz /= count
  if (elbowN === 0) {
    return new THREE.Vector3(hx - 0.012, hy + 0.072, hz)
  }
  const ex = elbowX / elbowN
  const ey = elbowY / elbowN
  const ez = elbowZ / elbowN
  const t = 0.4
  return new THREE.Vector3(
    hx + (ex - hx) * t - 0.016,
    hy + (ey - hy) * t + 0.024,
    hz + (ez - hz) * t,
  )
}

function computePointCloudMinY(positions: Float32Array): number {
  let minY = Number.POSITIVE_INFINITY
  for (let i = 1; i < positions.length; i += 3) {
    const y = positions[i]
    if (y < minY) {
      minY = y
    }
  }
  if (!Number.isFinite(minY)) {
    return -HOLOGRAM_TARGET_HEIGHT * 0.5
  }
  return minY
}

function cloneObjectTreeWithGeometry(root: THREE.Object3D): THREE.Object3D {
  const cloned = root.clone(true)
  cloned.traverse((obj: THREE.Object3D): void => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh && mesh.geometry) {
      mesh.geometry = mesh.geometry.clone()
    }
  })
  return cloned
}

function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((obj: THREE.Object3D): void => {
    const mesh = obj as THREE.Mesh
    if (mesh.isMesh) {
      mesh.geometry?.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const material of materials) {
        material?.dispose()
      }
    }
  })
}
