import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { MAX_FRAME_DELTA_SECONDS } from '@/constants/animation'
import {
  VIRUS_AURA_COUNT,
  VIRUS_AURA_INNER_RATIO,
  VIRUS_AURA_OPACITY,
  VIRUS_AURA_OUTER_RATIO,
  VIRUS_AURA_SIZE,
  VIRUS_AURA_SPARKLE_COUNT,
  VIRUS_AURA_SPARKLE_OPACITY,
  VIRUS_AURA_SPARKLE_SIZE,
  VIRUS_BLOOM_RADIUS,
  VIRUS_BLOOM_STRENGTH,
  VIRUS_BLOOM_THRESHOLD,
  VIRUS_CAMERA_DISTANCE,
  VIRUS_CAMERA_DISTANCE_MAX,
  VIRUS_CAMERA_DISTANCE_MIN,
  VIRUS_CAMERA_FOV,
  VIRUS_CAMERA_Y,
  VIRUS_CLOUD_OFFSET,
  VIRUS_CLOUD_SCALE,
  VIRUS_CLOUD_SPIN_RAD_PER_SEC,
  VIRUS_COLORS,
  VIRUS_DUST_COUNT,
  VIRUS_DUST_OPACITY,
  VIRUS_DUST_SIZE,
  VIRUS_FALLBACK_SPIN_RAD_PER_SEC,
  VIRUS_GOLD_OFFSET,
  VIRUS_GOLD_SCALE,
  VIRUS_GOLD_SPIN_RAD_PER_SEC,
  VIRUS_HUD_WIDTH_RATIO,
  VIRUS_LAYOUT_ASPECT,
  VIRUS_LOOK_AT_X,
  VIRUS_LOOK_AT_Y,
  VIRUS_MAIN_OFFSET,
  VIRUS_MIN_VISIBLE_WIDTH,
  VIRUS_MODEL_URL,
  VIRUS_PLEXUS_MEMBRANE,
  VIRUS_PLEXUS_MEMBRANE_RATIO,
  VIRUS_PLEXUS_POINT_COUNT,
  VIRUS_PLEXUS_SPIKE,
  VIRUS_SPIKE_INNER,
  VIRUS_SPIKE_OUTER,
  VIRUS_SPIKE_POWER,
  VIRUS_SPIKE_SELECT_RATIO,
  VIRUS_TARGET_SIZE,
  VIRUS_TONE_MAPPING_EXPOSURE,
  VIRUS_WIRE_COLOR,
} from '@/constants/virusMonitor'
import { createSoftParticleTexture } from '@/scene/hologram/createSoftParticleTexture'
import { createGltfLoader } from '@/scene/loaders/createGltfLoader'
import { createVirusAuraParticles } from '@/scene/virus/createVirusAuraParticles'
import {
  createVirusGoldMaterial,
  createVirusMainMaterial,
} from '@/scene/virus/createVirusMaterials'
import { createVirusStructurePlexus } from '@/scene/virus/createVirusPlexus'
import { createVirusStarField, type VirusStarFieldHandle } from '@/scene/virus/createVirusStarField'
import { sampleVirusVertices } from '@/scene/virus/sampleVirusPointCloud'
import { tagVirusSpikeAttribute } from '@/scene/virus/tagVirusSpikeAttribute'

export type VirusPreviewStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface VirusPreviewCallbacks {
  onStatus?: (status: VirusPreviewStatus, message?: string) => void
}

export interface VirusMountOptions {
  reducedMotion?: boolean
}

type VirusDragTarget = 'main' | 'gold' | 'cloud'

/**
 * 病毒监控独立 WebGL 视口：LOD 主球（自定义显微玻璃着色器）
 * + 金色对照 + 结构 plexus + 背景星尘 + 轻度 Bloom。
 * 拖转按射线命中单模型旋转；自转用连续角速度，不用会跳变的 GLTF clip。
 */
export class VirusMonitorPreview {
  private readonly callbacks: VirusPreviewCallbacks
  private container: HTMLElement | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private composer: EffectComposer | null = null
  private stageRoot: THREE.Group | null = null
  private mainPivot: THREE.Group | null = null
  private mainContent: THREE.Object3D | null = null
  private goldPivot: THREE.Group | null = null
  private cloudPivot: THREE.Group | null = null
  private starField: VirusStarFieldHandle | null = null
  private auraDisposers: Array<() => void> = []
  private plexusDisposer: (() => void) | null = null
  private virusMaterial: THREE.Material | null = null
  private goldMaterial: THREE.Material | null = null
  private particleTexture: THREE.CanvasTexture | null = null
  private clock = new THREE.Clock()
  private rafId = 0
  private running = false
  private disposed = false
  private userPaused = false
  private visibilityPaused = false
  private reducedMotion = false
  private resizeObserver: ResizeObserver | null = null
  private cameraDistance = VIRUS_CAMERA_DISTANCE
  private pointerId: number | null = null
  private lastPointerX = 0
  private lastPointerY = 0
  private dragTarget: VirusDragTarget | null = null
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointerNdc = new THREE.Vector2()
  private readonly lookTarget = new THREE.Vector3(VIRUS_LOOK_AT_X, VIRUS_LOOK_AT_Y, 0)

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.camera || !this.renderer) {
      return
    }
    this.pointerId = event.pointerId
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
    this.dragTarget = this.pickDragTarget(event)
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId || !this.dragTarget) {
      return
    }
    const dx = event.clientX - this.lastPointerX
    const dy = event.clientY - this.lastPointerY
    this.lastPointerX = event.clientX
    this.lastPointerY = event.clientY
    this.applyDragRotation(this.dragTarget, dx, dy)
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.pointerId !== event.pointerId) {
      return
    }
    this.pointerId = null
    this.dragTarget = null
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    const next = this.cameraDistance + event.deltaY * 0.0024
    this.cameraDistance = THREE.MathUtils.clamp(
      next,
      VIRUS_CAMERA_DISTANCE_MIN,
      VIRUS_CAMERA_DISTANCE_MAX,
    )
    this.applyCamera()
  }

  public constructor(callbacks: VirusPreviewCallbacks = {}) {
    this.callbacks = callbacks
  }

  public async mount(container: HTMLElement, options: VirusMountOptions = {}): Promise<void> {
    this.disposed = false
    this.userPaused = false
    this.visibilityPaused = false
    this.container = container
    this.reducedMotion = Boolean(options.reducedMotion)
    this.emitStatus('loading', '正在加载病毒模型...')

    const width = Math.max(container.clientWidth, 1)
    const height = Math.max(container.clientHeight, 1)

    const scene = new THREE.Scene()
    scene.background = null
    this.scene = scene

    const camera = new THREE.PerspectiveCamera(VIRUS_CAMERA_FOV, width / height, 0.08, 80)
    this.camera = camera
    this.cameraDistance = VIRUS_CAMERA_DISTANCE
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
    renderer.toneMappingExposure = VIRUS_TONE_MAPPING_EXPOSURE
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
    composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(width, height),
        VIRUS_BLOOM_STRENGTH,
        VIRUS_BLOOM_RADIUS,
        VIRUS_BLOOM_THRESHOLD,
      ),
    )
    composer.addPass(new OutputPass())
    this.composer = composer

    this.resizeObserver = new ResizeObserver((): void => {
      this.handleResize()
    })
    this.resizeObserver.observe(container)

    this.starField = createVirusStarField()
    scene.add(this.starField.root)

    try {
      const gltf = await createGltfLoader().loadAsync(VIRUS_MODEL_URL)
      if (this.disposed) {
        disposeOwnedGeometries(gltf.scene)
        return
      }

      const stage = new THREE.Group()
      stage.name = 'virus-stage'
      this.stageRoot = stage
      scene.add(stage)

      removeObjectByName(gltf.scene, 'Background')

      const mainContent = normalizeVirusContent(gltf.scene, VIRUS_TARGET_SIZE)
      mainContent.name = 'virus-main-content'
      this.mainContent = mainContent

      // 在挂到 mainPivot 前采样，避免带上主球位移
      const plexusPositions = sampleVirusVertices(mainContent, VIRUS_PLEXUS_POINT_COUNT)

      tagVirusSpikeAttribute(mainContent, {
        inner: VIRUS_SPIKE_INNER,
        outer: VIRUS_SPIKE_OUTER,
        selectRatio: VIRUS_SPIKE_SELECT_RATIO,
        power: VIRUS_SPIKE_POWER,
      })

      this.particleTexture = createSoftParticleTexture(64)

      this.virusMaterial = createVirusMainMaterial()
      applySharedMaterial(mainContent, this.virusMaterial)

      const mainPivot = new THREE.Group()
      mainPivot.name = 'virus-main-pivot'
      mainPivot.userData.virusTarget = 'main'
      mainPivot.add(mainContent)
      mainPivot.position.set(VIRUS_MAIN_OFFSET.x, VIRUS_MAIN_OFFSET.y, VIRUS_MAIN_OFFSET.z)
      stage.add(mainPivot)
      this.mainPivot = mainPivot

      const auraRadius = VIRUS_TARGET_SIZE * 0.58
      const aura = createVirusAuraParticles({
        radius: auraRadius,
        count: VIRUS_AURA_COUNT,
        texture: this.particleTexture,
        color: VIRUS_COLORS.accent,
        size: VIRUS_AURA_SIZE,
        opacity: VIRUS_AURA_OPACITY,
        innerRatio: VIRUS_AURA_INNER_RATIO,
        outerRatio: VIRUS_AURA_OUTER_RATIO,
      })
      mainPivot.add(aura.points)
      this.auraDisposers.push(aura.dispose)

      const sparkle = createVirusAuraParticles({
        radius: auraRadius,
        count: VIRUS_AURA_SPARKLE_COUNT,
        texture: this.particleTexture,
        color: 0xffffff,
        size: VIRUS_AURA_SPARKLE_SIZE,
        opacity: VIRUS_AURA_SPARKLE_OPACITY,
        innerRatio: 1.18,
        outerRatio: 2.15,
      })
      mainPivot.add(sparkle.points)
      this.auraDisposers.push(sparkle.dispose)

      const dust = createVirusAuraParticles({
        radius: auraRadius,
        count: VIRUS_DUST_COUNT,
        texture: this.particleTexture,
        color: VIRUS_COLORS.alert,
        size: VIRUS_DUST_SIZE,
        opacity: VIRUS_DUST_OPACITY,
        innerRatio: 1.1,
        outerRatio: 1.75,
      })
      mainPivot.add(dust.points)
      this.auraDisposers.push(dust.dispose)

      this.goldMaterial = createVirusGoldMaterial()
      const goldContent = cloneSharingGeometry(mainContent)
      goldContent.name = 'virus-gold-content'
      applySharedMaterial(goldContent, this.goldMaterial, { disposePrevious: false })

      const goldPivot = new THREE.Group()
      goldPivot.name = 'virus-gold-pivot'
      goldPivot.userData.virusTarget = 'gold'
      goldPivot.add(goldContent)
      goldPivot.scale.setScalar(VIRUS_GOLD_SCALE)
      goldPivot.position.set(VIRUS_GOLD_OFFSET.x, VIRUS_GOLD_OFFSET.y, VIRUS_GOLD_OFFSET.z)
      stage.add(goldPivot)
      this.goldPivot = goldPivot

      const plexus = createVirusStructurePlexus({
        positions: plexusPositions,
        color: VIRUS_WIRE_COLOR,
        membraneRatio: VIRUS_PLEXUS_MEMBRANE_RATIO,
        membrane: { ...VIRUS_PLEXUS_MEMBRANE },
        spike: { ...VIRUS_PLEXUS_SPIKE },
        pointTexture: this.particleTexture,
      })
      this.plexusDisposer = plexus.dispose

      const cloudPivot = new THREE.Group()
      cloudPivot.name = 'virus-cloud-pivot'
      cloudPivot.userData.virusTarget = 'cloud'
      cloudPivot.add(plexus.root)
      cloudPivot.scale.setScalar(VIRUS_CLOUD_SCALE)
      cloudPivot.position.set(VIRUS_CLOUD_OFFSET.x, VIRUS_CLOUD_OFFSET.y, VIRUS_CLOUD_OFFSET.z)
      stage.add(cloudPivot)
      this.cloudPivot = cloudPivot

      this.applyCamera()

      // 不使用 GLTF 旋转 clip：循环首尾不连续，会像动图跳变重置
      this.emitStatus('ready')
      this.syncLoop()
    } catch (error) {
      console.error('[VirusMonitorPreview] load failed', error)
      this.emitStatus('error', `模型加载失败，请检查 ${VIRUS_MODEL_URL}`)
    }
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled
  }

  public setPaused(paused: boolean): void {
    this.userPaused = paused
    this.syncLoop()
  }

  public setVisibilityPaused(paused: boolean): void {
    this.visibilityPaused = paused
    this.syncLoop()
  }

  public resetView(): void {
    this.cameraDistance = VIRUS_CAMERA_DISTANCE
    this.dragTarget = null
    if (this.mainPivot) {
      this.mainPivot.rotation.set(0, 0, 0)
    }
    if (this.goldPivot) {
      this.goldPivot.rotation.set(0, 0, 0)
    }
    if (this.cloudPivot) {
      this.cloudPivot.rotation.set(0, 0, 0)
    }
    this.applyCamera()
  }

  public dispose(): void {
    this.disposed = true
    this.stopLoop()

    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.unbindOrbit()
    this.dragTarget = null

    if (this.plexusDisposer) {
      this.plexusDisposer()
      this.plexusDisposer = null
    }

    for (const disposeAura of this.auraDisposers) {
      disposeAura()
    }
    this.auraDisposers = []

    if (this.starField) {
      this.starField.dispose()
      this.starField = null
    }

    if (this.particleTexture) {
      this.particleTexture.dispose()
      this.particleTexture = null
    }

    if (this.goldPivot && this.stageRoot) {
      this.stageRoot.remove(this.goldPivot)
      this.goldPivot = null
    }

    if (this.cloudPivot && this.stageRoot) {
      this.stageRoot.remove(this.cloudPivot)
      this.cloudPivot = null
    }

    if (this.mainPivot && this.stageRoot) {
      this.stageRoot.remove(this.mainPivot)
      this.mainPivot = null
    }

    if (this.mainContent) {
      disposeOwnedGeometries(this.mainContent)
      this.mainContent = null
    }

    if (this.stageRoot && this.scene) {
      this.scene.remove(this.stageRoot)
      this.stageRoot = null
    }

    if (this.virusMaterial) {
      this.virusMaterial.dispose()
      this.virusMaterial = null
    }

    if (this.goldMaterial) {
      this.goldMaterial.dispose()
      this.goldMaterial = null
    }

    if (this.composer) {
      this.composer.dispose()
      this.composer = null
    }

    if (this.renderer) {
      const canvas = this.renderer.domElement
      canvas.parentElement?.removeChild(canvas)
      this.renderer.dispose()
      this.renderer.forceContextLoss()
      this.renderer = null
    }

    this.scene = null
    this.camera = null
    this.container = null
  }

  private syncLoop(): void {
    if (this.disposed || this.userPaused || this.visibilityPaused || !this.composer || !this.mainPivot) {
      this.stopLoop()
      return
    }
    this.startLoop()
  }

  private startLoop(): void {
    if (this.running || this.disposed) {
      return
    }
    this.running = true
    this.clock.getDelta()
    this.tick()
  }

  private stopLoop(): void {
    this.running = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  private tick = (): void => {
    if (!this.running || !this.composer) {
      return
    }

    const delta = Math.min(this.clock.getDelta(), MAX_FRAME_DELTA_SECONDS)

    if (!this.reducedMotion) {
      if (this.mainPivot && this.dragTarget !== 'main') {
        this.mainPivot.rotation.y += delta * VIRUS_FALLBACK_SPIN_RAD_PER_SEC
      }
      if (this.goldPivot && this.dragTarget !== 'gold') {
        this.goldPivot.rotation.y += delta * VIRUS_GOLD_SPIN_RAD_PER_SEC
      }
      if (this.cloudPivot && this.dragTarget !== 'cloud') {
        this.cloudPivot.rotation.y += delta * VIRUS_CLOUD_SPIN_RAD_PER_SEC
      }
      if (this.starField) {
        this.starField.root.rotation.y += delta * 0.0035
      }
    }

    this.composer.render()
    this.rafId = requestAnimationFrame(this.tick)
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
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(VIRUS_CAMERA_FOV * 0.5)) * VIRUS_CAMERA_DISTANCE
    const widthAtBase = 2 * halfHeight * this.camera.aspect
    const fit = Math.max(1, VIRUS_MIN_VISIBLE_WIDTH / Math.max(widthAtBase, 1e-4))
    // 相机固定取景；模型旋转由各 pivot 独立承担
    this.camera.position.set(0, VIRUS_CAMERA_Y, this.cameraDistance * fit)
    this.lookTarget.set(VIRUS_LOOK_AT_X, VIRUS_LOOK_AT_Y, 0)
    this.camera.lookAt(this.lookTarget)
    this.layoutPivots(halfHeight)
  }

  /**
   * 按 16:9 设计值缩放 X，并把卫星体限制在右轨 HUD 左侧。
   */
  private layoutPivots(halfHeight: number): void {
    if (!this.camera) {
      return
    }
    const halfWidth = halfHeight * this.camera.aspect
    const scaleX = halfWidth / (halfHeight * VIRUS_LAYOUT_ASPECT)
    const hudLeftX = -halfWidth + (1 - this.hudWidthRatio()) * 2 * halfWidth

    if (this.mainPivot) {
      this.mainPivot.scale.setScalar(1)
      this.mainPivot.position.set(
        VIRUS_MAIN_OFFSET.x * scaleX,
        VIRUS_MAIN_OFFSET.y,
        VIRUS_MAIN_OFFSET.z,
      )
    }
    if (this.goldPivot) {
      const goldRadius = VIRUS_TARGET_SIZE * VIRUS_GOLD_SCALE * 0.4
      const x = Math.min(VIRUS_GOLD_OFFSET.x * scaleX, hudLeftX - goldRadius)
      this.goldPivot.position.set(x, VIRUS_GOLD_OFFSET.y, VIRUS_GOLD_OFFSET.z)
    }
    if (this.cloudPivot) {
      const cloudRadius = VIRUS_TARGET_SIZE * VIRUS_CLOUD_SCALE * 0.4
      const x = Math.min(VIRUS_CLOUD_OFFSET.x * scaleX, hudLeftX - cloudRadius)
      this.cloudPivot.position.set(x, VIRUS_CLOUD_OFFSET.y, VIRUS_CLOUD_OFFSET.z)
    }
  }

  private hudWidthRatio(): number {
    const width = this.container?.clientWidth ?? 0
    if (width <= 0) {
      return VIRUS_HUD_WIDTH_RATIO
    }
    const railPx = Math.min(440, Math.max(300, width * 0.27)) + 36
    return THREE.MathUtils.clamp(railPx / width, 0.2, 0.42)
  }

  private pickDragTarget(event: PointerEvent): VirusDragTarget | null {
    if (!this.camera || !this.renderer || !this.stageRoot) {
      return null
    }
    const rect = this.renderer.domElement.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      return null
    }
    this.pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    this.raycaster.params.Points = { threshold: 0.12 }

    const targets: THREE.Object3D[] = []
    if (this.mainPivot) {
      targets.push(this.mainPivot)
    }
    if (this.goldPivot) {
      targets.push(this.goldPivot)
    }
    if (this.cloudPivot) {
      targets.push(this.cloudPivot)
    }
    const hits = this.raycaster.intersectObjects(targets, true)
    if (hits.length === 0) {
      return null
    }

    let node: THREE.Object3D | null = hits[0].object
    while (node) {
      const tag = node.userData.virusTarget
      if (tag === 'main' || tag === 'gold' || tag === 'cloud') {
        return tag
      }
      node = node.parent
    }
    return null
  }

  private applyDragRotation(target: VirusDragTarget, dx: number, dy: number): void {
    const pivot =
      target === 'main' ? this.mainPivot : target === 'gold' ? this.goldPivot : this.cloudPivot
    if (!pivot) {
      return
    }
    pivot.rotation.y += dx * 0.008
    pivot.rotation.x = THREE.MathUtils.clamp(pivot.rotation.x + dy * 0.005, -0.85, 0.85)
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

  private emitStatus(status: VirusPreviewStatus, message?: string): void {
    this.callbacks.onStatus?.(status, message)
  }
}

function applySharedMaterial(
  root: THREE.Object3D,
  material: THREE.Material,
  options: { disposePrevious?: boolean } = {},
): void {
  const disposePrevious = options.disposePrevious !== false
  const disposed = new Set<THREE.Material>()
  root.traverse((obj: THREE.Object3D): void => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) {
      return
    }
    if (disposePrevious) {
      const previous = mesh.material
      const list = Array.isArray(previous) ? previous : previous ? [previous] : []
      for (const item of list) {
        if (disposed.has(item)) {
          continue
        }
        item.dispose()
        disposed.add(item)
      }
    }
    mesh.material = material
    mesh.frustumCulled = true
  })
}

function cloneSharingGeometry(source: THREE.Object3D): THREE.Object3D {
  const cloned = source.clone(false)
  cloned.position.copy(source.position)
  cloned.quaternion.copy(source.quaternion)
  cloned.scale.copy(source.scale)

  const sourceMesh = source as THREE.Mesh
  if (sourceMesh.isMesh) {
    const mesh = cloned as THREE.Mesh
    mesh.geometry = sourceMesh.geometry
    mesh.material = sourceMesh.material
  }

  for (const child of source.children) {
    cloned.add(cloneSharingGeometry(child))
  }
  return cloned
}

function removeObjectByName(root: THREE.Object3D, name: string): void {
  const target = root.getObjectByName(name)
  target?.removeFromParent()
}

/**
 * 包一层 Group 再 fit，保证后续 pivot 位移不会覆盖居中校正。
 */
function normalizeVirusContent(sceneRoot: THREE.Object3D, targetSize: number): THREE.Group {
  const content = new THREE.Group()
  content.name = 'virus-normalized'
  content.add(sceneRoot)
  fitObjectToTargetSize(content, targetSize)
  return content
}

function fitObjectToTargetSize(root: THREE.Object3D, targetSize: number): void {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  if (box.isEmpty()) {
    return
  }
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 1e-4)
  const scale = targetSize / maxDim
  root.scale.multiplyScalar(scale)
  root.updateMatrixWorld(true)
  const fitted = new THREE.Box3().setFromObject(root)
  const center = fitted.getCenter(new THREE.Vector3())
  root.position.sub(center)
}

function disposeOwnedGeometries(root: THREE.Object3D): void {
  const seen = new Set<THREE.BufferGeometry>()
  root.traverse((obj: THREE.Object3D): void => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) {
      return
    }
    if (seen.has(mesh.geometry)) {
      return
    }
    seen.add(mesh.geometry)
    mesh.geometry.dispose()
  })
}
