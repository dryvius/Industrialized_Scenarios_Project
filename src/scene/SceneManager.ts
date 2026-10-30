import * as THREE from 'three'
import { MAX_FRAME_DELTA_SECONDS } from '@/constants/animation'
import { SCENE_COLORS } from '@/constants/colors'
import type { SceneInitOptions, SceneSelectionPayload } from '@/types/scene'
import { MaterialFactory } from '@/scene/MaterialFactory'
import { ResourceDisposer } from '@/scene/ResourceDisposer'
import { LightingSetup } from '@/scene/LightingSetup'
import { CameraController } from '@/scene/CameraController'
import { InteractionManager } from '@/scene/InteractionManager'
import { EnvironmentBuilder } from '@/scene/builders/EnvironmentBuilder'
import { VehicleSystemBuilder } from '@/scene/builders/vehicles'
import { FacilityBuilder } from '@/scene/builders/FacilityBuilder'
import { WorkerBuilder } from '@/scene/builders/WorkerBuilder'
import { MachineRunState } from '@/enums/MachineRunState'
import type { MachineRunState as MachineRunStateType } from '@/enums/MachineRunState'
import { AnimationRegistry, bootstrapSceneAnimations } from '@/scene/animation'
import { PhysicsWorld } from '@/scene/physics'
import { WorkerHealthHaloController } from '@/scene/health/WorkerHealthHaloController'
import type { VitalsLevel } from '@/types/vitals'

/**
 * 工业基建施工场景总控。
 */
export class SceneManager {
  private container: HTMLElement | null = null
  private scene: THREE.Scene | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private cameraController: CameraController | null = null
  private lighting: LightingSetup | null = null
  private interaction: InteractionManager | null = null
  private materials: MaterialFactory | null = null
  private disposer: ResourceDisposer | null = null
  private worldRoot: THREE.Group | null = null
  private physicsWorld: PhysicsWorld | null = null
  private animationId = 0
  private readonly clock = new THREE.Clock()
  private readonly animationRegistry = new AnimationRegistry()
  private readonly machineRunStates = new Map<string, MachineRunStateType>()
  private demoEnabled = false
  private resizeObserver: ResizeObserver | null = null
  private onSelect: ((payload: SceneSelectionPayload | null) => void) | null = null
  private healthHalos: WorkerHealthHaloController | null = null
  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.stopLoop()
      return
    }
    this.cameraController?.resetTiming()
    this.startLoop()
  }

  public async init(options: SceneInitOptions): Promise<void> {
    this.container = options.container
    this.onSelect = options.onSelect ?? null
    this.disposer = new ResourceDisposer()
    this.materials = new MaterialFactory()

    this.scene = new THREE.Scene()
    this.scene.name = 'ConstructionSiteScene'
    this.scene.background = new THREE.Color(SCENE_COLORS.background)
    // 仅保留远景沙尘空气感，避免暖雾压低设备与天空对比
    this.scene.fog = new THREE.FogExp2(SCENE_COLORS.fog, 0.0027)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.container.appendChild(this.renderer.domElement)

    this.cameraController = new CameraController(this.container)
    this.lighting = new LightingSetup()
    this.lighting.setup(this.scene)

    this.worldRoot = new THREE.Group()
    this.worldRoot.name = 'WorldRoot'
    this.scene.add(this.worldRoot)

    this.buildWorld()

    this.physicsWorld = await PhysicsWorld.create()
    this.physicsWorld.bootstrapStatic(this.scene)
    if (this.worldRoot) {
      this.physicsWorld.bootstrapKinematics(this.worldRoot)
      bootstrapSceneAnimations(this.worldRoot, this.animationRegistry, this.physicsWorld)
    }

    if (this.worldRoot) {
      this.interaction = new InteractionManager(
        this.container,
        this.cameraController.camera,
        this.worldRoot,
        (payload: SceneSelectionPayload | null) => {
          this.onSelect?.(payload)
        },
        (info: { center: THREE.Vector3; size: THREE.Vector3 }): void => {
          this.cameraController?.focusOn(info.center, info.size)
        },
      )
      this.interaction.bind()
      this.healthHalos = new WorkerHealthHaloController(this.worldRoot)
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize()
    })
    this.resizeObserver.observe(this.container)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)

    this.startLoop()
    options.onReady?.()
  }

  public clearSelection(): void {
    this.interaction?.clearSelection()
  }

  public selectByBusinessKey(businessKey: string): boolean {
    return this.interaction?.selectByBusinessKey(businessKey) ?? false
  }

  public applyWorkerHealthLevels(levels: Map<string, VitalsLevel>): void {
    this.healthHalos?.apply(levels)
  }

  public setWorkerHealthHalosVisible(visible: boolean): void {
    this.healthHalos?.setVisible(visible)
  }

  public setDemoEnabled(enabled: boolean): void {
    this.demoEnabled = enabled
    if (enabled) {
      this.syncAnimationsToRunStates()
    } else {
      this.animationRegistry.stopAll()
    }
  }

  public isDemoEnabled(): boolean {
    return this.demoEnabled
  }

  /**
   * 按业务 Mock 的 runState（running / idle）驱动对应对象动画。
   * 演示总开关开启时立即生效；关闭时仅缓存状态。
   */
  public applyMachineRunStates(
    machines: Array<{ id: string; runState?: MachineRunStateType }>,
  ): void {
    this.machineRunStates.clear()
    machines.forEach((machine) => {
      if (machine.runState === MachineRunState.Running || machine.runState === MachineRunState.Idle) {
        this.machineRunStates.set(machine.id, machine.runState)
      }
    })
    if (this.demoEnabled) {
      this.syncAnimationsToRunStates()
    }
  }

  public hasAnimator(objectId: string): boolean {
    return this.animationRegistry.has(objectId)
  }

  public playObjectAnimation(objectId: string): boolean {
    return this.animationRegistry.play(objectId)
  }

  public stopObjectAnimation(objectId: string): boolean {
    return this.animationRegistry.stop(objectId)
  }

  public isObjectAnimating(objectId: string): boolean {
    return this.animationRegistry.get(objectId)?.isPlaying() ?? false
  }

  public setPhysicsDebugVisible(visible: boolean): void {
    this.physicsWorld?.setDebugVisible(visible)
  }

  public isPhysicsDebugVisible(): boolean {
    return this.physicsWorld?.isDebugVisible() ?? false
  }

  public hasPhysicsWorld(): boolean {
    return this.physicsWorld !== null
  }

  private syncAnimationsToRunStates(): void {
    if (this.machineRunStates.size === 0) {
      this.animationRegistry.playAll()
      return
    }
    this.animationRegistry.ids().forEach((id: string) => {
      const runState = this.machineRunStates.get(id)
      if (runState === MachineRunState.Idle) {
        this.animationRegistry.stop(id)
      } else {
        // running 或未标注的可动画对象：默认播放
        this.animationRegistry.play(id)
      }
    })
  }

  public dispose(): void {
    this.stopLoop()
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    this.animationRegistry.dispose()
    this.machineRunStates.clear()
    this.demoEnabled = false

    this.physicsWorld?.dispose(this.scene ?? undefined)
    this.physicsWorld = null

    this.healthHalos?.dispose()
    this.healthHalos = null

    this.interaction?.dispose()
    this.interaction = null

    this.cameraController?.dispose()
    this.cameraController = null

    if (this.scene && this.lighting) {
      this.lighting.dispose(this.scene)
    }
    this.lighting = null

    if (this.worldRoot) {
      this.scene?.remove(this.worldRoot)
    }
    this.worldRoot = null

    this.materials?.dispose()
    this.materials = null

    if (this.renderer && this.container?.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement)
    }
    this.disposer?.disposeAll(this.renderer ?? undefined)
    this.disposer = null
    this.renderer = null
    this.scene = null
    this.container = null
    this.onSelect = null
  }

  private buildWorld(): void {
    if (!this.worldRoot || !this.materials || !this.disposer) {
      return
    }

    const builders = [
      new EnvironmentBuilder(this.materials),
      new VehicleSystemBuilder(this.materials),
      new FacilityBuilder(this.materials),
      new WorkerBuilder(this.materials),
    ]

    builders.forEach((builder) => {
      const built = builder.build()
      this.worldRoot?.add(built)
      this.disposer?.trackObject3D(built, false)
      const shared = built.userData.sharedGeometries as THREE.BufferGeometry[] | undefined
      shared?.forEach((geometry: THREE.BufferGeometry) => {
        this.disposer?.trackGeometry(geometry)
      })
      const extraMaterials = built.userData.extraMaterials as THREE.Material[] | undefined
      extraMaterials?.forEach((material: THREE.Material) => {
        this.disposer?.trackMaterial(material)
      })
      const extraTextures = built.userData.extraTextures as THREE.Texture[] | undefined
      extraTextures?.forEach((texture: THREE.Texture) => {
        this.disposer?.trackTexture(texture)
      })
    })
  }

  private handleResize(): void {
    if (!this.container || !this.renderer || !this.cameraController) {
      return
    }
    this.cameraController.resize()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight)
  }

  private startLoop(): void {
    if (this.animationId !== 0 || document.hidden) {
      return
    }
    this.clock.start()
    const tick = (): void => {
      this.animationId = requestAnimationFrame(tick)
      const delta = Math.min(this.clock.getDelta(), MAX_FRAME_DELTA_SECONDS)
      // 动画提出期望位姿 → 物理角色控制器裁决并回写 Object3D
      this.animationRegistry.update(delta)
      this.physicsWorld?.step(delta)
      this.cameraController?.update()
      this.interaction?.update()
      this.healthHalos?.update(this.clock.elapsedTime)
      if (this.renderer && this.scene && this.cameraController) {
        this.renderer.render(this.scene, this.cameraController.camera)
      }
    }
    tick()
  }

  private stopLoop(): void {
    if (this.animationId !== 0) {
      cancelAnimationFrame(this.animationId)
      this.animationId = 0
    }
    this.clock.stop()
  }
}
