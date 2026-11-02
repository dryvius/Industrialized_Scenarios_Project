/** 病毒监控面板常量（视觉 SSOT，数值与效果图对齐） */

/** 运行时 LOD：约 10.5 万三角 / 0.32MB（Draco） */
export const VIRUS_MODEL_URL = "/model/corona_virus_lod.glb";

export const VIRUS_MODEL_ATTRIBUTION = "模型 © Abdullah EKER / Sketchfab · CC-BY-4.0";

export const VIRUS_COLORS = {
    /** 主球基底：深青黑，模拟显微渲染的暗部 */
    core: 0x081516,
    /** 主球中间调：灰青，只负责体表可读性 */
    mid: 0x667a72,
    /** 暗红酒红：效果图腹腔与右缘的暖色 */
    maroon: 0x6e3323,
    /** 主体青：轮廓 / 刺突高光 */
    emissive: 0x3fd6d0,
    accent: 0x5fe8de,
    /** 刺突玻璃灰青 */
    spike: 0xa9b4ae,
    /** 少量橙红点缀（刺尖 / 右缘） */
    alert: 0xff3b14,
    goldCore: 0x4a2c04,
    gold: 0xffd45a,
    goldHot: 0xff9e1f,
    /** 结构态电青 */
    cloud: 0x14dbe2,
    /** 金体暗部 */
    goldShadow: 0x2a1702,
} as const;

export const VIRUS_HUD_BACKGROUND = "#050d11";

/**
 * 构图（以 16:9 视口为基准）：
 * - 主球约 3/4 可见（左侧裁切），直径约 1.15 屏高
 * - 金体 / 结构体相对原构图右移，停在主球与右轨之间
 */
export const VIRUS_TARGET_SIZE = 2.72;
export const VIRUS_MAIN_OFFSET = { x: -1.22, y: 0.06, z: 0 } as const;
export const VIRUS_LAYOUT_ASPECT = 16 / 9;
/** 右轨 HUD 约占用的视口宽度（无容器尺寸时的回退） */
export const VIRUS_HUD_WIDTH_RATIO = 0.3;

export const VIRUS_GOLD_SCALE = 0.188;
export const VIRUS_GOLD_OFFSET = { x: 0.38, y: 0.5, z: 0.12 } as const;
export const VIRUS_GOLD_SPIN_RAD_PER_SEC = -0.1;

export const VIRUS_CLOUD_SCALE = 0.194;
export const VIRUS_CLOUD_OFFSET = { x: 0.5, y: -0.34, z: 0.1 } as const;
export const VIRUS_CLOUD_SPIN_RAD_PER_SEC = 0.08;

/**
 * 右下结构态：按半径拆成「内膜密网 + 外刺线网」。
 * 提高点密度、缩短连线，避免长线条糊成线团。
 */
export const VIRUS_WIRE_COLOR = 0x14dbe2;
export const VIRUS_PLEXUS_POINT_COUNT = 9200;
/** 球体表面半径约 0.74–0.82，以内为膜，以外为刺 */
export const VIRUS_PLEXUS_MEMBRANE_RATIO = 0.82;
export const VIRUS_PLEXUS_MEMBRANE = {
    maxDegree: 2,
    linkRadiusRatio: 0.052,
    lineOpacity: 0.3,
    pointSize: 0.022,
    pointOpacity: 0.9,
} as const;
export const VIRUS_PLEXUS_SPIKE = {
    maxDegree: 2,
    linkRadiusRatio: 0.06,
    lineOpacity: 0.44,
    pointSize: 0.012,
    pointOpacity: 0.78,
} as const;

/**
 * 刺突：aRadial 覆盖全部刺突（玻璃灰青），aSpike 只留稀疏橙红尖端。
 */
export const VIRUS_SPIKE_INNER = 0.9;
export const VIRUS_SPIKE_OUTER = 0.995;
export const VIRUS_SPIKE_SELECT_RATIO = 0.16;
export const VIRUS_SPIKE_POWER = 2.4;

/** 主球视觉参数（着色器 uniform） */
export const VIRUS_MAIN_LOOK = {
    rimStrength: 0.95,
    rimPower: 2.1,
    redRimStrength: 0.8,
    redRimPower: 3.8,
    spikeMix: 0.92,
    tipStrength: 1.2,
    grain: 1.4,
    ambient: 0.12,
    keyStrength: 1.35,
    fillStrength: 0.16,
} as const;

/** 金体视觉参数（着色器 uniform） */
export const VIRUS_GOLD_LOOK = {
    rimStrength: 0.55,
    specStrength: 1.6,
    ambient: 0.06,
    keyStrength: 1.25,
    spikeStrength: 0.5,
} as const;

export const VIRUS_CAMERA_FOV = 28;
export const VIRUS_CAMERA_DISTANCE = 3.35;
export const VIRUS_CAMERA_DISTANCE_MIN = 2.6;
export const VIRUS_CAMERA_DISTANCE_MAX = 4.6;
export const VIRUS_CAMERA_Y = 0;
/** 窄视口时自动拉远，保证主球与金体不叠在一起（16:9 基准可见宽约 2.97） */
export const VIRUS_MIN_VISIBLE_WIDTH = 2.86;
export const VIRUS_LOOK_AT_X = 0;
export const VIRUS_LOOK_AT_Y = 0;

/** 主体连续自转（rad/s）；不用 GLTF clip，避免循环跳变 */
export const VIRUS_FALLBACK_SPIN_RAD_PER_SEC = 0.09;

/** 主病毒外围微尘（挂在 mainPivot，随主体同转） */
export const VIRUS_AURA_COUNT = 2600;
export const VIRUS_AURA_INNER_RATIO = 1.12;
export const VIRUS_AURA_OUTER_RATIO = 1.95;
export const VIRUS_AURA_SIZE = 0.042;
export const VIRUS_AURA_OPACITY = 0.78;
export const VIRUS_AURA_SPARKLE_COUNT = 560;
export const VIRUS_AURA_SPARKLE_SIZE = 0.06;
export const VIRUS_AURA_SPARKLE_OPACITY = 0.7;
/** 少量暗红浮尘，对齐效果图病毒边缘的红点 */
export const VIRUS_DUST_COUNT = 320;
export const VIRUS_DUST_SIZE = 0.048;
export const VIRUS_DUST_OPACITY = 0.82;

/** 背景星点（固定于世界空间，不随病毒转） */
export const VIRUS_STAR_COUNT = 2200;
export const VIRUS_STAR_DISTANCE_MIN = 6;
export const VIRUS_STAR_DISTANCE_MAX = 24;
export const VIRUS_STAR_SIZE = 0.085;
export const VIRUS_STAR_OPACITY = 0.85;

/** Bloom：只吃边缘峰值，避免再次洗白主体 */
export const VIRUS_BLOOM_STRENGTH = 0.36;
export const VIRUS_BLOOM_RADIUS = 0.46;
export const VIRUS_BLOOM_THRESHOLD = 0.56;
export const VIRUS_TONE_MAPPING_EXPOSURE = 1.0;
