/** 全息人体最小验证与后续模块共用常量 */

export const HOLOGRAM_PERSON_MODEL_URL = "/model/man.glb";

export const HOLOGRAM_COLORS = {
    backgroundCenter: 0x081e32,
    backgroundMid: 0x081e32,
    backgroundEdge: 0x081e32,
    pointCore: 0x2bc4de,
    pointAccent: 0x5ed8ee,
    pedestal: 0x4cc9ff,
    skinBase: 0x07131c,
    skinLit: 0x16323c,
} as const;

/** 弹窗主体、名册、人体画布共用，避免中间一块更深的“黑洞” */
export const HOLOGRAM_HUD_BACKGROUND = "#081e32";

/** 面积加权过采样后再按轮廓收束到此数量 */
export const HOLOGRAM_POINT_TARGET_COUNT = 64000;

/** 过采样倍率：先多采，再按轮廓权重筛，保证剪影密度 */
export const HOLOGRAM_SAMPLE_OVERSAMPLE = 2.2;

/** 额外消散砂粒数量相对表面点的比例（复制一份飞走，不移动人体点） */
export const HOLOGRAM_SAND_RATIO = 0.1;

/** 额外能量丝带数量相对表面点的比例（复制一份飞走，不移动人体点） */
export const HOLOGRAM_FILAMENT_RATIO = 0.09;

/** 大光斑 / 飞沫占比 */
export const HOLOGRAM_SPARKLE_RATIO = 0.05;

/** Bloom：压一点溢光，避免人体发白 */
export const HOLOGRAM_BLOOM_STRENGTH = 0.14;
export const HOLOGRAM_BLOOM_RADIUS = 0.32;
export const HOLOGRAM_BLOOM_THRESHOLD = 0.62;

/** 面板内人体统一高度（世界单位）；略缩小以留白 */
export const HOLOGRAM_TARGET_HEIGHT = 1;

/** 菲涅尔壳相对点云略内缩，让颗粒贴在连续表面上 */
export const HOLOGRAM_SHELL_SCALE = 0.994;

/** 侧视微幅呼吸摆动；拖转后不再叠加 */
export const HOLOGRAM_YAW_AMPLITUDE = 0.018;

/** 全身 + 底座完整入画，避免裁脚 */
export const HOLOGRAM_CAMERA_DISTANCE = 2.72;
export const HOLOGRAM_CAMERA_DISTANCE_MIN = 2.05;
export const HOLOGRAM_CAMERA_DISTANCE_MAX = 4.2;

/**
 * 微侧的正面 3/4：负角从人物右侧看去，屏幕上略朝右。
 */
export const HOLOGRAM_PROFILE_YAW = -0.38;

export const HOLOGRAM_CAMERA_FOV = 30;
export const HOLOGRAM_LOOK_AT_Y_BUST = 0.02;
export const HOLOGRAM_LOOK_AT_Y_FULL = -0.1;
export const HOLOGRAM_CAMERA_Y_BUST = 0.18;
export const HOLOGRAM_CAMERA_Y_FULL = 0.12;

/** 粒子散开旋飞后再汇聚成人体的总时长（秒） */
export const HOLOGRAM_ASSEMBLE_DURATION = 3.2;

/** 汇聚开始前，粒子保持散开运动的时长（秒） */
export const HOLOGRAM_ASSEMBLE_SWIRL_HOLD = 0.7;

/** 换人重扫描：消散时长（秒） */
export const HOLOGRAM_RESYNC_DISSOLVE_SECONDS = 0.55;

/** 换人重扫描：消散后空窗（秒） */
export const HOLOGRAM_RESYNC_HOLD_SECONDS = 0.12;

/** 换人重扫描：再聚合时长（秒），不含开场 swirl hold */
export const HOLOGRAM_RESYNC_ASSEMBLE_SECONDS = 1.05;

/** 换人重扫描：消散到接近完全散开 */
export const HOLOGRAM_RESYNC_FLOOR = 0.02;

/** 换人消散时旋飞半径倍率 */
export const HOLOGRAM_RESYNC_BURST = 1.85;
