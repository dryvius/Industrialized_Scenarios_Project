import { DRACO_GLTF_CONFIG, DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

let sharedDracoLoader: DRACOLoader | null = null

function getDracoLoader(): DRACOLoader {
  if (sharedDracoLoader) {
    return sharedDracoLoader
  }

  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath(DRACO_GLTF_CONFIG)
  dracoLoader.preload()
  sharedDracoLoader = dracoLoader
  return dracoLoader
}

/**
 * 同时支持未压缩 glTF/GLB、Draco（KHR_draco_mesh_compression）
 * 与 Meshopt（EXT_meshopt_compression）。未压缩资源不会走解码器。
 */
export function createGltfLoader(): GLTFLoader {
  const loader = new GLTFLoader()
  loader.setDRACOLoader(getDracoLoader())
  loader.setMeshoptDecoder(MeshoptDecoder)
  return loader
}
