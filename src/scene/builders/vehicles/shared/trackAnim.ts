import type { Object3D } from 'three'

export interface TrackShoeMeta {
  lane: 'bottom' | 'top'
  zMin: number
  zMax: number
}

const SHOE_KEY = 'trackShoe'
const SPROCKET_KEY = 'trackSprocket'

export function markTrackShoe(object: Object3D, meta: TrackShoeMeta): void {
  object.userData[SHOE_KEY] = meta
}

export function readTrackShoe(object: Object3D): TrackShoeMeta | null {
  const meta = object.userData[SHOE_KEY] as TrackShoeMeta | undefined
  return meta ?? null
}

export function markTrackSprocket(object: Object3D): void {
  object.userData[SPROCKET_KEY] = true
}

export function isTrackSprocket(object: Object3D): boolean {
  return Boolean(object.userData[SPROCKET_KEY])
}
