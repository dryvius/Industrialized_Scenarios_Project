import * as THREE from "three";
import { VIRUS_COLORS, VIRUS_GOLD_LOOK, VIRUS_MAIN_LOOK } from "@/constants/virusMonitor";

/**
 * 主球 / 金体使用自定义着色器：
 * - 不依赖 RoomEnvironment + transmission，避免整球过曝成白团
 * - 体表用多尺度噪声做酒红 / 灰青斑驳与纤维颗粒
 * - 平滑法线负责大块明暗，细节只走颜色，避免高光碎成白点
 * - aRadial + 法线夹角区分球面与管状刺突；aSpike 只负责稀疏橙红尖端
 */

const VIRUS_VERTEX = /* glsl */ `
attribute float aSpike;
attribute float aRadial;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;
varying float vSpike;
varying float vRadial;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  // 原始几何尺度往往远大于拟合后的世界尺寸；乘上模型缩放，噪声频率才和之前世界空间那套一致
  float modelScale = length(modelMatrix[0].xyz);
  vLocalPos = position * modelScale;
  vSpike = aSpike;
  vRadial = aRadial;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const VIRUS_NOISE = /* glsl */ `
float virusHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float virusNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = virusHash(i + vec3(0.0, 0.0, 0.0));
  float n100 = virusHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = virusHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = virusHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = virusHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = virusHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = virusHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = virusHash(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}
`;

const VIRUS_FRAGMENT_MAIN = /* glsl */ `
precision highp float;

uniform vec3 uDark;
uniform vec3 uMid;
uniform vec3 uMaroon;
uniform vec3 uCyan;
uniform vec3 uRed;
uniform vec3 uSpike;
uniform float uRimStrength;
uniform float uRimPower;
uniform float uRedRimStrength;
uniform float uRedRimPower;
uniform float uSpikeMix;
uniform float uTipStrength;
uniform float uGrain;
uniform float uAmbient;
uniform float uKeyStrength;
uniform float uFillStrength;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;
varying float vSpike;
varying float vRadial;

${VIRUS_NOISE}

void main() {
  vec3 V = normalize(vViewDir);
  vec3 N = normalize(vWorldNormal);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 radialDir = normalize(vLocalPos);
  float radialAlign = abs(dot(N, radialDir));
  // 斑驳 / 颗粒钉在物体空间，随模型旋转；光照仍用世界法线
  vec3 surfacePos = vLocalPos;

  // 多尺度体表：低频色块、中频纤维、高频显微颗粒
  float n1 = virusNoise(surfacePos * 3.4 + 1.7);
  float n2 = virusNoise(surfacePos * 10.5 + 5.2);
  float n3 = virusNoise(surfacePos * 34.0);
  float n4 = virusNoise(surfacePos * 46.0);
  float fiber = virusNoise(vec3(surfacePos.x * 40.0, surfacePos.y * 8.0, surfacePos.z * 40.0));

  // 三次前向差分给法线一点显微起伏；高光用原始法线，避免碎白点
  vec3 bumpPos = surfacePos * 46.0;
  float bumpStep = 0.22;
  float bx = virusNoise(bumpPos + vec3(bumpStep, 0.0, 0.0)) - n4;
  float by = virusNoise(bumpPos + vec3(0.0, bumpStep, 0.0)) - n4;
  float bz = virusNoise(bumpPos + vec3(0.0, 0.0, bumpStep)) - n4;
  vec3 NDiffuse = normalize(N + vec3(bx, by, bz) * uGrain * 5.0);

  vec3 teal = uMid * (0.82 + 0.36 * n3);
  vec3 maroon = uMaroon * (0.78 + 0.44 * n2);
  vec3 base = mix(teal, maroon, smoothstep(0.26, 0.68, n1) * 1.45);
  base = mix(base, uMaroon * 1.15, smoothstep(0.56, 0.8, fiber) * 0.28);
  base *= 0.75 + 0.5 * n3;
  base *= 0.68 + 0.58 * n4;

  // 平滑主光 + 冷补光；细节留给颜色，避免法线噪点产生白色碎光
  vec3 L = normalize(vec3(0.56, 0.64, 0.52));
  float ndl = clamp(dot(NDiffuse, L), 0.0, 1.0);
  float wrap = 0.28 + 0.72 * ndl;
  vec3 color = base * (uAmbient + uKeyStrength * wrap) * vec3(1.0, 0.93, 0.87);

  float fill = clamp(dot(N, normalize(vec3(-0.5, 0.12, 0.86))), 0.0, 1.0);
  color += base * uFillStrength * fill;

  // 背光侧压暗，让球体有体积
  float frontSide = smoothstep(-0.15, 0.7, dot(N, normalize(vec3(0.15, 0.05, 1.0))));
  color *= 0.62 + 0.38 * frontSide;

  // 中性环境抬起暗部，避免阴影发纯红
  color += vec3(0.008, 0.012, 0.011);
  // 细颗粒只调制明度，避免产生白色碎点
  color *= 0.74 + 0.44 * n4;

  // 刺突：法线与径向夹角确认「管状」，再叠加半径门槛
  float tubeMask = 1.0 - smoothstep(0.34, 0.86, radialAlign);
  float spikeBody = tubeMask * smoothstep(0.77, 0.86, vRadial);
  float spikeEdge = pow(1.0 - ndv, 2.0);
  vec3 spikeShade = uSpike * (0.36 + 0.55 * wrap);
  spikeShade = mix(spikeShade, uMaroon * 1.7, smoothstep(0.36, 0.72, n2) * 0.6);
  spikeShade += uCyan * spikeEdge * 0.95;
  spikeShade += uSpike * smoothstep(0.92, 1.0, vRadial) * 0.35;
  color = mix(color, spikeShade, spikeBody * uSpikeMix);

  // 玻璃青边
  float sideBias = clamp(dot(N, normalize(vec3(0.8, 0.2, 0.3))) * 0.5 + 0.5, 0.0, 1.0);
  float rim = pow(1.0 - ndv, uRimPower) * (0.2 + 0.9 * sideBias);
  color += uCyan * rim * uRimStrength;

  // 右缘橙红轮廓：跟随屏幕右侧的固定光位，并限制在上半部
  float redSide = smoothstep(0.0, 0.85, N.x) * smoothstep(-0.25, 0.55, N.y);
  color += uRed * pow(1.0 - ndv, uRedRimPower) * redSide * uRedRimStrength;

  // 稀疏橙红刺尖
  color += uRed * smoothstep(0.5, 1.0, vSpike) * uTipStrength;

  // 极轻内部青雾
  color += uCyan * 0.012;
  gl_FragColor = vec4(color, 1.0);
}
`;

const VIRUS_FRAGMENT_GOLD = /* glsl */ `
precision highp float;

uniform vec3 uDark;
uniform vec3 uBright;
uniform vec3 uHot;
uniform vec3 uRed;
uniform float uRimStrength;
uniform float uSpecStrength;
uniform float uAmbient;
uniform float uKeyStrength;
uniform float uSpikeStrength;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;
varying float vSpike;
varying float vRadial;

${VIRUS_NOISE}

void main() {
  vec3 V = normalize(vViewDir);
  vec3 N = normalize(vWorldNormal);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 radialDir = normalize(vLocalPos);
  float radialAlign = abs(dot(N, radialDir));
  vec3 surfacePos = vLocalPos;

  float g1 = virusNoise(surfacePos * 5.0 + 1.7);
  float g2 = virusNoise(surfacePos * 19.0);
  float g3 = virusNoise(surfacePos * 74.0);

  vec3 base = mix(uDark, uBright, smoothstep(0.24, 0.86, g1));
  base *= 0.68 + 0.5 * g3;

  vec3 L = normalize(vec3(0.5, 0.7, 0.55));
  float ndl = clamp(dot(N, L), 0.0, 1.0);
  vec3 color = base * (uAmbient + uKeyStrength * (0.22 + 0.78 * ndl));

  // 金属暗缘 + 镜面点
  color *= 0.5 + 0.5 * smoothstep(0.0, 0.72, ndv);
  float spec = pow(clamp(dot(N, normalize(L + V)), 0.0, 1.0), 84.0);
  color += vec3(1.0, 0.87, 0.55) * spec * uSpecStrength * (0.55 + 0.45 * g3);
  color += uBright * pow(1.0 - ndv, 3.0) * uRimStrength;

  // 刺突（管状）提亮 + 稀疏红尖
  float tubeMask = 1.0 - smoothstep(0.34, 0.86, radialAlign);
  float spike = tubeMask * smoothstep(0.77, 0.86, vRadial);
  color += uBright * spike * uSpikeStrength * 0.55;
  color += uHot * spike * (0.2 + 0.3 * g2);
  color += uRed * smoothstep(0.62, 1.0, vSpike) * 0.75;

  gl_FragColor = vec4(color, 1.0);
}
`;

function linearColor(hex: number): THREE.Color {
    return new THREE.Color(hex).convertSRGBToLinear();
}

export function createVirusMainMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        vertexShader: VIRUS_VERTEX,
        fragmentShader: VIRUS_FRAGMENT_MAIN,
        uniforms: {
            uDark: { value: linearColor(VIRUS_COLORS.core) },
            uMid: { value: linearColor(VIRUS_COLORS.mid) },
            uMaroon: { value: linearColor(VIRUS_COLORS.maroon) },
            uCyan: { value: linearColor(VIRUS_COLORS.emissive) },
            uRed: { value: linearColor(VIRUS_COLORS.alert) },
            uSpike: { value: linearColor(VIRUS_COLORS.spike) },
            uRimStrength: { value: VIRUS_MAIN_LOOK.rimStrength },
            uRimPower: { value: VIRUS_MAIN_LOOK.rimPower },
            uRedRimStrength: { value: VIRUS_MAIN_LOOK.redRimStrength },
            uRedRimPower: { value: VIRUS_MAIN_LOOK.redRimPower },
            uSpikeMix: { value: VIRUS_MAIN_LOOK.spikeMix },
            uTipStrength: { value: VIRUS_MAIN_LOOK.tipStrength },
            uGrain: { value: VIRUS_MAIN_LOOK.grain },
            uAmbient: { value: VIRUS_MAIN_LOOK.ambient },
            uKeyStrength: { value: VIRUS_MAIN_LOOK.keyStrength },
            uFillStrength: { value: VIRUS_MAIN_LOOK.fillStrength },
        },
        side: THREE.FrontSide,
        depthWrite: true,
        depthTest: true,
    });
}

export function createVirusGoldMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
        vertexShader: VIRUS_VERTEX,
        fragmentShader: VIRUS_FRAGMENT_GOLD,
        uniforms: {
            uDark: { value: linearColor(VIRUS_COLORS.goldShadow) },
            uBright: { value: linearColor(VIRUS_COLORS.gold) },
            uHot: { value: linearColor(VIRUS_COLORS.goldHot) },
            uRed: { value: linearColor(VIRUS_COLORS.alert) },
            uRimStrength: { value: VIRUS_GOLD_LOOK.rimStrength },
            uSpecStrength: { value: VIRUS_GOLD_LOOK.specStrength },
            uAmbient: { value: VIRUS_GOLD_LOOK.ambient },
            uKeyStrength: { value: VIRUS_GOLD_LOOK.keyStrength },
            uSpikeStrength: { value: VIRUS_GOLD_LOOK.spikeStrength },
        },
        side: THREE.FrontSide,
        depthWrite: true,
        depthTest: true,
    });
}
