import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { HOLOGRAM_COLORS, HOLOGRAM_TARGET_HEIGHT } from "@/constants/hologram";

export interface HologramSurfaceHandle {
    root: THREE.Group;
    setAssemble: (value: number) => void;
    setTime: (value: number) => void;
    dispose: () => void;
}

/**
 * 点云下层的光滑皮肤：不透明度 0.5 + 菲涅尔轮廓光，不含折痕线框。
 */
export function createHologramSurface(sourceRoot: THREE.Object3D): HologramSurfaceHandle {
    const shellMaterials: THREE.ShaderMaterial[] = [];
    const ownedGeometries: THREE.BufferGeometry[] = [];
    const timeUniform = { value: 0 };
    const assembleUniform = { value: 0 };
    const leftover: THREE.Object3D[] = [];

    sourceRoot.traverse((obj: THREE.Object3D): void => {
        const line = obj as THREE.Line;
        if (line.isLine) {
            leftover.push(obj);
            return;
        }
        const points = obj as THREE.Points;
        if (points.isPoints) {
            leftover.push(obj);
        }
    });
    for (const obj of leftover) {
        obj.removeFromParent();
    }

    sourceRoot.traverse((obj: THREE.Object3D): void => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) {
            return;
        }

        const previous = mesh.geometry;
        const smoothed = smoothSkinGeometry(previous);
        previous.dispose();
        ownedGeometries.push(smoothed);
        mesh.geometry = smoothed;

        const shellMaterial = createSkinMaterial(timeUniform, assembleUniform);
        shellMaterials.push(shellMaterial);

        if (Array.isArray(mesh.material)) {
            for (const old of mesh.material) {
                old.dispose();
            }
        } else {
            mesh.material?.dispose();
        }
        mesh.material = shellMaterial;
        mesh.renderOrder = 0;
        mesh.frustumCulled = false;
    });

    const fitted = fitObjectToTargetHeight(sourceRoot, HOLOGRAM_TARGET_HEIGHT);
    fitted.name = "hologram-fresnel-shell";
    fitted.renderOrder = 0;

    return {
        root: fitted,
        setAssemble(value: number): void {
            assembleUniform.value = value;
        },
        setTime(value: number): void {
            timeUniform.value = value;
        },
        dispose(): void {
            for (const material of shellMaterials) {
                material.dispose();
            }
            for (const geometry of ownedGeometries) {
                geometry.dispose();
            }
        },
    };
}

function smoothSkinGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
    const merged = mergeVertices(source, 1e-4);
    merged.computeVertexNormals();
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
}

function createSkinMaterial(uTime: { value: number }, uAssemble: { value: number }): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: true,
        depthTest: true,
        side: THREE.FrontSide,
        blending: THREE.NormalBlending,
        uniforms: {
            uTime: uTime,
            uAssemble: uAssemble,
            uColor: { value: new THREE.Color(HOLOGRAM_COLORS.skinBase) },
            uLit: { value: new THREE.Color(HOLOGRAM_COLORS.skinLit) },
            uAccent: { value: new THREE.Color(HOLOGRAM_COLORS.pointAccent) },
        },
        vertexShader: /* glsl */ `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
        fragmentShader: /* glsl */ `
      uniform float uAssemble;
      uniform vec3 uColor;
      uniform vec3 uLit;
      uniform vec3 uAccent;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;

      void main() {
        vec3 n = normalize(vWorldNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float facing = clamp(dot(n, viewDir), 0.0, 1.0);
        float fresnel = pow(1.0 - facing, 2.8);
        float appear = smoothstep(0.22, 0.88, uAssemble);

        vec3 lit = mix(uColor, uLit, facing);
        vec3 skin = mix(lit, uAccent * 0.42, fresnel * 0.55);
        gl_FragColor = vec4(skin, appear * 0.25);
      }
    `,
    });
}

function fitObjectToTargetHeight(root: THREE.Object3D, targetHeight: number): THREE.Group {
    const wrap = new THREE.Group();
    wrap.add(root);
    root.updateMatrixWorld(true);

    const box = computeMeshBounds(wrap);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    let upAxis = 1;
    if (size.x >= size.y && size.x >= size.z) {
        upAxis = 0;
    } else if (size.z >= size.y && size.z >= size.x) {
        upAxis = 2;
    }

    const extent = Math.max(size.x, size.y, size.z, 1e-5);
    const scale = targetHeight / extent;

    root.position.x -= center.x;
    root.position.y -= center.y;
    root.position.z -= center.z;

    if (upAxis === 0) {
        wrap.rotation.z = Math.PI / 2;
    } else if (upAxis === 2) {
        wrap.rotation.x = -Math.PI / 2;
    }
    wrap.scale.setScalar(scale);
    wrap.updateMatrixWorld(true);
    return wrap;
}

function computeMeshBounds(root: THREE.Object3D): THREE.Box3 {
    const box = new THREE.Box3();
    const temp = new THREE.Box3();
    root.updateMatrixWorld(true);
    root.traverse((obj: THREE.Object3D): void => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) {
            return;
        }
        if (!mesh.geometry.boundingBox) {
            mesh.geometry.computeBoundingBox();
        }
        if (!mesh.geometry.boundingBox) {
            return;
        }
        temp.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        box.union(temp);
    });
    if (box.isEmpty()) {
        return new THREE.Box3().setFromObject(root);
    }
    return box;
}
