export {
  DEMO_PATHS,
  SITE_LAYOUT,
  findMovablePlacement,
  getDemoPath,
  getFacilityOrientations,
  getVehiclePose,
  listMovablePlacements,
  listStaticFacilityPlacements,
} from '@/scene/layout/sceneLayout'
export {
  TOWER_DEMO_ANCHOR_ORDER,
  buildClimbPath,
  buildDescendPath,
  getPylonAnchorWorld,
  getPylonClimbBaseWorld,
  listPylonAnchorsWorld,
  PYLON_ANCHOR_DEFS,
} from '@/scene/layout/pylonAnchors'
export type { PylonAnchorId, WorldAnchor } from '@/scene/layout/pylonAnchors'
export type {
  BoxColliderDesc,
  EntityPlacement,
  PathDemoSpec,
  PoseXZ,
  PylonAnchorDef,
  TowerAnchorKind,
  TowerWorkPose,
  XyzPoint,
  XzPoint,
} from '@/scene/layout/types'
