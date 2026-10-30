import type { Object3D } from 'three'
import { AnimationRegistry } from '@/scene/animation/AnimationRegistry'
import { CompositeAnimator } from '@/scene/animation/controllers/CompositeAnimator'
import { CraneActionController } from '@/scene/animation/controllers/CraneActionController'
import { ExcavatorActionController } from '@/scene/animation/controllers/ExcavatorActionController'
import { ExcavatorWorkCycleController } from '@/scene/animation/controllers/ExcavatorWorkCycleController'
import { MixerActionController } from '@/scene/animation/controllers/MixerActionController'
import { SpoolActionController } from '@/scene/animation/controllers/SpoolActionController'
import { VehicleMotionController } from '@/scene/animation/controllers/VehicleMotionController'
import { TowerWorkController } from '@/scene/animation/controllers/TowerWorkController'
import { WorkerLocomotionController } from '@/scene/animation/controllers/WorkerLocomotionController'
import { VEHICLE_SCALE } from '@/constants/scale'
import { DEMO_PATHS } from '@/scene/layout'
import type { PhysicsWorld, RootPoseDriver } from '@/scene/physics'
import { readAnimatableMeta } from '@/scene/utils/animatableMeta'

function pathOf(objectId: keyof typeof DEMO_PATHS): Array<{ x: number; z: number }> {
  return DEMO_PATHS[objectId].map((p) => ({ x: p.x, z: p.z }))
}

function poseDriverOf(
  physics: PhysicsWorld | null | undefined,
  objectId: string,
  root: Object3D,
): RootPoseDriver | null {
  return physics?.createPoseDriver(objectId, root) ?? null
}

/**
 * 遍历场景树，为带 animatable 元数据的车辆/人员注册默认演示控制器。
 * 路径一律取自 SITE_LAYOUT / DEMO_PATHS；位姿经 PhysicsWorld Kinematic 驱动（若已注入）。
 */
export function bootstrapSceneAnimations(
  worldRoot: Object3D,
  registry: AnimationRegistry,
  physics?: PhysicsWorld | null,
): void {
  const roots: Object3D[] = []
  worldRoot.traverse((obj: Object3D) => {
    if (readAnimatableMeta(obj)) {
      roots.push(obj)
    }
  })

  roots.forEach((root: Object3D) => {
    const meta = readAnimatableMeta(root)
    if (!meta) {
      return
    }
    const { objectId } = meta
    const poseDriver = poseDriverOf(physics, objectId, root)

    switch (objectId) {
      case 'truck_01':
        registry.register(
          new VehicleMotionController({
            id: objectId,
            root,
            path: pathOf('truck_01'),
            cruiseSpeed: 3.8,
            wheelRadius: VEHICLE_SCALE.truck.tireRadius,
            wheelJointNames: ['wheel0', 'wheel1', 'wheel2', 'wheel3', 'wheel4', 'wheel5'],
            loop: true,
            poseDriver,
          }),
        )
        break
      case 'truck_02':
        registry.register(
          new VehicleMotionController({
            id: objectId,
            root,
            path: pathOf('truck_02'),
            cruiseSpeed: 3.2,
            wheelRadius: VEHICLE_SCALE.truck.tireRadius,
            wheelJointNames: ['wheel0', 'wheel1', 'wheel2', 'wheel3', 'wheel4', 'wheel5'],
            loop: true,
            poseDriver,
          }),
        )
        break
      case 'excavator_01': {
        const excavatorMotion = new VehicleMotionController({
          id: `${objectId}__motion`,
          root,
          path: pathOf('excavator_01'),
          cruiseSpeed: 1.4,
          wheelRadius: 0.44,
          trackJointNames: ['trackL', 'trackR'],
          loop: true,
          poseDriver,
        })
        const excavatorAction = new ExcavatorActionController(`${objectId}__action`, root)
        registry.register(
          new ExcavatorWorkCycleController(objectId, excavatorMotion, excavatorAction),
        )
        break
      }
      case 'crane_truck_01':
        registry.register(new CraneActionController(objectId, root))
        break
      case 'mixer_01':
        registry.register(
          new CompositeAnimator(objectId, [
            new VehicleMotionController({
              id: `${objectId}__motion`,
              root,
              path: pathOf('mixer_01'),
              cruiseSpeed: 1.6,
              wheelRadius: 0.36,
              trackJointNames: ['trackL', 'trackR'],
              loop: true,
              poseDriver,
            }),
            new MixerActionController(objectId, root),
          ]),
        )
        break
      case 'cable_spool_01':
        registry.register(
          new CompositeAnimator(objectId, [
            new VehicleMotionController({
              id: `${objectId}__motion`,
              root,
              path: pathOf('cable_spool_01'),
              cruiseSpeed: 0.9,
              loop: true,
              poseDriver,
            }),
            new SpoolActionController(objectId, root),
          ]),
        )
        break
      case 'worker_02':
        registry.register(
          new WorkerLocomotionController({
            id: objectId,
            root,
            path: pathOf('worker_02'),
            defaultGait: 'walk',
            walkSpeed: 0.95,
            walkStrideLength: 0.68,
            loop: true,
            poseDriver,
          }),
        )
        break
      case 'worker_03':
        registry.register(
          new WorkerLocomotionController({
            id: objectId,
            root,
            path: pathOf('worker_03'),
            defaultGait: 'run',
            runSpeed: 2.85,
            runStrideLength: 0.95,
            loop: true,
            poseDriver,
          }),
        )
        break
      case 'worker_04':
        registry.register(
          new WorkerLocomotionController({
            id: objectId,
            root,
            path: pathOf('worker_04'),
            defaultGait: 'walk',
            walkSpeed: 0.85,
            walkStrideLength: 0.64,
            loop: true,
            poseDriver,
          }),
        )
        break
      case 'worker_07':
        // 塔上作业：不注入地面 poseDriver（需自由写 Y）
        registry.register(new TowerWorkController(objectId, root))
        break
      default:
        break
    }
  })
}
