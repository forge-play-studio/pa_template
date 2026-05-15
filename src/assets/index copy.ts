/**
 * 资源管理模块 (Scaffold)
 *
 * 目的：
 * - 统一管理静态资源 (models / textures / ui / sounds)
 * - 提供“modelId → URL” 的唯一映射入口
 * - 保持与架构文档一致：业务代码只使用 modelId，不直接写资源路径
 *
 * 注意：这是脚手架版本，已剔除与具体游戏强绑定的资源。
 * 你可以按需新增资源：
 * 1) 将资源文件放进 src/assets/**
 * 2) 在本文件使用 ?url 引入
 * 3) 写入 MODEL_URL_MAP / TextureAssets / SoundAssets 等映射
 */
// ============================================================
// Placeholders (可替换)
// ============================================================
import blankPng from './placeholders/blank.png?url';
import silentWav from './placeholders/silent.wav?url';
import choiceBlankUiTexture from './ui/choice-blank.png?url';
import choiceBottomArrowRef from './ui/choice-bottom-arrow-ref.png?url';
import choiceHandRef from './ui/cursor.png?url';
import logoPng from './ui/logo.png?url';
import moneyIconRef from './ui/Icon_money.png?url';
import trainDirectionArrowRef from './ui/引导箭头.png?url';
import trackChoiceLeftCard from './ui/kapai001.png?url';
import trackChoiceRightCard from './ui/kapai002.png?url';
import turnLeftCard from './ui/turn_left.png?url';
import turnRightCard from './ui/turn_right.png?url';
import sceneBorderPng from './边框.png?url';
import sceneTrainBoxPng from './chexiang01.png?url';
import sceneMoneyDecalPng from './地贴钞票.png?url';
import sceneUpgradePng from './升级01.png?url';
import sceneBoatPng from './chuan01.png?url';
import sceneFrame11Png from './11 框2.png?url';
import sceneFrame11_3Png from './11 框3.png?url';
import sceneKuangPng from './kuang.png?url';
import sceneKuangFramePng from './框.png?url';
import sceneKuangLvPng from './框lv.png?url';
import sceneKuangGreenPng from './ui/kuang_green.png?url';
import sceneXiyou01Png from './xiyou01.png?url';
import sceneShiyouPng from './shiyou.png?url';
import sceneBubbleCirclePng from './圆形气泡.png?url';
import sceneGroundProgressGreenPng from './ui/地贴/地贴绿进度.png?url';
import sceneResourceGroundBasePng from './ui/地贴/资源地贴底.png?url';
import sceneHalfTransparentBasePng from './ui/地贴/半透底.png?url';
import wireFlowGlow08Texture from './textures/wire_flow_fx_glow_08.png?url';
import whiteEllipseTexture from './ui/white_ellipse.png?url';
import gasStationGlb from './加油站.glb?url';
import gasCarGlb from './加油废车.glb?url';
import railSegmentGlb from './火车轨道.glb?url';
import trackCurveGlb from './轨道弯曲.glb?url';
import trackCurve45Glb from './轨道弯曲45.glb?url';
import cargoShipGlb from './货船.glb?url';
import craneGlb from './吊机.glb?url';
import craneAnimGlb from './吊机动画.glb?url';
import craneReducedGlb from './吊机模型删减结构.glb?url';
import oilWellAnimGlb from './油井动画.glb?url';
import tower1Glb from './电塔1.glb?url';
import tower2Glb from './电塔2.glb?url';
import trainFactoryGlb from './火车厂房.glb?url';
import trainGlb from './火车.glb?url';
import oilWellGlb from './油井.glb?url';
import bombGlb from './炸弹.glb?url';
import brokenOilWellGlb from './破损油井.glb?url';
import lighthouse001Glb from './灯塔__001.glb?url';
import stonePierGlb from './石墩.glb?url';
import deckGlb from './甲板.glb?url';
import optimizedGlb from './optimized.restored.glb?url';
import optimized001Glb from './optimized001.restored.glb?url';
import shipLv2Glb from './SM_chuan-lv2.glb?url';
import tilesGlb from './地砖.glb?url';
import youtongGlb from './YOUTong.glb?url';
import pingtai001Glb from './pingtai001.glb?url';
import taiziGlb from './台子.restored.glb?url';
import containerGlb from './集装箱.glb?url';
import container3Glb from './集装箱3.glb?url';
import container4Glb from './集装箱4.glb?url';
import jiagongGlb from './jiagong.glb?url';
import cygTmGlb from './CYG_TM.glb?url';
import smChuyouguanGlb from './SM_chuyouguan.glb?url';
import smHuocheYoutongGlb from './new_point火车油罐.glb?url';
import smHuocheYoutongDiGlb from './SM_火车油罐底.glb?url';
import smHuocheYoutongShenGlb from './SM_火车油罐身.glb?url';
import smEnvTrackRaisedBridgeStraight04Glb from './SM_Env_Track_Raised_Bridge_Straight_04.glb?url';
import trainFactoryWallGlb from './火车厂房墙面_.glb?url';
import xiyouGlb from './吸油.glb?url';
import xiyouqiGlb from './XIYOUQI.glb?url';
import zhixiangGlb from './纸箱.glb?url';
import luzhangGlb from './路障.glb?url';
import chengseLuzhangGlb from './橙色路障.glb?url';
import shuitanGlb from './水潭.glb?url';
import hongbaiwenLuzhangGlb from './红白纹路障.glb?url';
import smShiqiao3Glb from './SM_shiqiao_3.glb?url';
import huangseHulanGlb from './黄色护栏.glb?url';
import jiayouXincheGlb from './加油新车.glb?url';
import luntaiGlb from './轮胎.glb?url';
import carWithWheelGlb from './car_with_wheel.glb?url';
import huocheTouGlb from './火车头.glb?url';
import huocheChexiang1Glb from './火车车厢1.glb?url';
import jinshuYoutongGlb from './金属油桶.glb?url';
import moneyGlb from './money.glb?url';
import pineTreeGlb from './低多边形卡通风格松树_TREE.glb?url';
import guanzibGlb from './低多边形简约青色L型管道_guanzib.glb?url';
import guanzicGlb from './低多边形风格青色工业管道_guanzic__1_.glb?url';
import metalPipeAdapter2Glb from './低多边形金属弯管转接头_ZhuanJieTou2.glb?url';
import longPipeGlb from './长管.glb?url';
import shortPipeGlb from './短管.glb?url';
import smSmCaoGlb from './低多边形卡通风格绿色植被_SM_SM_cao.glb?url';
import dingpengGlb from './dingpeng.glb?url';
import zhuziGlb from './zhuzi.glb?url';
import gasGlb from './gas.glb?url';
// ============================================================
// Models
// ============================================================
/**
 * modelId → 资源 URL 的映射
 *
 * 这是唯一定义 modelId 和实际资源路径对应关系的地方。
 *
 * Scaffold 默认不内置任何具体模型，你可以在此处逐步注册：
 * ```ts
 * import heroModel from './models/hero.glb?url';
 * export const MODEL_URL_MAP = { hero: heroModel };
 * ```
 */
export const MODEL_URL_MAP: Record<string, string> = {
    platform_1: pingtai001Glb,
    platform_2: pingtai001Glb,
    platform_3: pingtai001Glb,
    platform_4: pingtai001Glb,
    oil_well: oilWellGlb,
    bomb: bombGlb,
    broken_oil_well: brokenOilWellGlb,
    lighthouse: lighthouse001Glb,
    lighthouse_001: lighthouse001Glb,
    stone_pier: stonePierGlb,
    deck: deckGlb,
    optimized: optimizedGlb,
    optimized001: optimized001Glb,
    ship_lv2: shipLv2Glb,
    tiles: tilesGlb,
    youtong: youtongGlb,
    pingtai001: pingtai001Glb,
    taizi: taiziGlb,
    container: containerGlb,
    container_3: container3Glb,
    container_4: container4Glb,
    jiagong: jiagongGlb,
    train: trainGlb,
    cargo_ship: cargoShipGlb,
    crane: craneGlb,
    吊机动画: craneAnimGlb,
    吊机模型删减结构: craneReducedGlb,
    油井动画: oilWellAnimGlb,
    tower_1: tower1Glb,
    tower_2: tower2Glb,
    gas_station: gasStationGlb,
    gas_car: gasCarGlb,
    train_factory: trainFactoryGlb,
    cyg_tm: cygTmGlb,
    sm_chuyouguan: smChuyouguanGlb,
    sm_huoche_youtong: smHuocheYoutongGlb,
    sm_huoche_youtong_di: smHuocheYoutongDiGlb,
    sm_huoche_youtong_shen: smHuocheYoutongShenGlb,
    sm_env_track_raised_bridge_straight_04: smEnvTrackRaisedBridgeStraight04Glb,
    train_factory_wall: trainFactoryWallGlb,
    xiyou: xiyouGlb,
    xiyouqi: xiyouqiGlb,
    zhixiang: zhixiangGlb,
    luzhang: luzhangGlb,
    chengse_luzhang: chengseLuzhangGlb,
    shuitan: shuitanGlb,
    hongbaiwen_luzhang: hongbaiwenLuzhangGlb,
    sm_shiqiao_3: smShiqiao3Glb,
    huangse_hulan: huangseHulanGlb,
    jiayou_xinche: jiayouXincheGlb,
    luntai: luntaiGlb,
    car_with_wheel: carWithWheelGlb,
    huoche_tou: huocheTouGlb,
    huoche_chexiang_1: huocheChexiang1Glb,
    jinshu_youtong: jinshuYoutongGlb,
    money: moneyGlb,
    pine_tree: pineTreeGlb,
    rail_segment: railSegmentGlb,
    track_curve: trackCurveGlb,
    track_curve_45: trackCurve45Glb,
    guanzib: guanzibGlb,
    guanzic: guanzicGlb,
    metal_pipe_adapter_2: metalPipeAdapter2Glb,
    long_pipe: longPipeGlb,
    short_pipe: shortPipeGlb,
    sm_sm_cao: smSmCaoGlb,
    dingpeng: dingpengGlb,
    zhuzi: zhuziGlb,
    gas: gasGlb
};
/** 根据 modelId 获取资源 URL */
export function resolveModelUrl(modelId: string): string | undefined {
    return MODEL_URL_MAP[modelId];
}
/** 获取所有已注册的模型 ID */
export function getAllModelIds(): string[] {
    return Object.keys(MODEL_URL_MAP);
}
/** 检查模型 ID 是否已注册 */
export function isModelRegistered(modelId: string): boolean {
    return modelId in MODEL_URL_MAP;
}
// ============================================================
// UI Images (可选)
// ============================================================
/**
 * UIImages
 *
 * 用于 UI、粒子特效等需要图片纹理 URL 的场景。
 * Scaffold 默认全部指向 blank 占位图。
 */
export const UIImages: Record<string, string> = {
    blank: blankPng,
    logo: logoPng,
    gameLogo: blankPng,
    particleSpark: blankPng,
    particleSoft: blankPng,
    trackChoiceBlank: choiceBlankUiTexture,
    choiceBottomArrowRef,
    choiceHandRef,
    moneyIconRef,
    trainDirectionArrow: trainDirectionArrowRef,
    towerChoiceArrow: trackChoiceLeftCard,
    towerChoiceSpike: trackChoiceRightCard,
    turnLeftChoice: turnLeftCard,
    turnRightChoice: turnRightCard,
    wireFlowGlow08: wireFlowGlow08Texture,
    whiteEllipse: whiteEllipseTexture,
};
/** 场景图片（用于 image 类型 sceneInstance） */
export const SCENE_IMAGE_URL_MAP: Record<string, string> = {
    border: sceneBorderPng,
    chexiang01: sceneTrainBoxPng,
    moneyDecal: sceneMoneyDecalPng,
    upgrade01: sceneUpgradePng,
    chuan01: sceneBoatPng,
    frame11_2: sceneFrame11Png,
    frame11_3: sceneFrame11_3Png,
    kuang: sceneKuangPng,
    kuangFrame: sceneKuangFramePng,
    kuangLv: sceneKuangLvPng,
    kuangGreen: sceneKuangGreenPng,
    xiyou01: sceneXiyou01Png,
    shiyou: sceneShiyouPng,
    bubbleCircle: sceneBubbleCirclePng,
    groundProgressGreen: sceneGroundProgressGreenPng,
    resourceGroundBase: sceneResourceGroundBasePng,
    halfTransparentBase: sceneHalfTransparentBasePng,
};
export function resolveSceneImageUrl(imageId: string): string | undefined {
    return SCENE_IMAGE_URL_MAP[imageId];
}
export function isSceneImageRegistered(imageId: string): boolean {
    return imageId in SCENE_IMAGE_URL_MAP;
}
// ============================================================
// Sounds (可选)
// ============================================================
/**
 * SoundAssets
 *
 * Scaffold 默认提供静音音频占位，避免 AudioService 在启用时因为缺失资源而报错。
 * 你可以替换为实际的 mp3/wav：
 * ```ts
 * import bgm from './Sound/bgm.mp3?url';
 * ```
 */
export const SoundAssets = {
    bgm: silentWav,
    coin: silentWav,
    harvest: silentWav,
    unlock: silentWav,
};
// ============================================================
// Textures (可选)
// ============================================================
/**
 * TextureAssets
 *
 * 用于 Babylon GUI 或其他材质贴图等。
 */
export const TextureAssets = {
    ui: {
        gameLogo: blankPng,
        trackChoiceBlank: choiceBlankUiTexture,
        choiceBottomArrowRef,
        choiceHandRef,
        moneyIconRef,
        towerChoiceArrow: trackChoiceLeftCard,
        towerChoiceSpike: trackChoiceRightCard,
        turnLeftChoice: turnLeftCard,
        turnRightChoice: turnRightCard,
    },
};
// ============================================================
// GLB Path Helper
// ============================================================
import { isCompressedGlb, getUsableGlbUrl } from '../utils/glbDecompress';
/** getModelPathAndFileAsync 的返回类型 */
export interface ModelPathInfo {
    path: string;
    filename: string;
    isDataUrl: boolean;
    /** 是否为压缩的 GLB（需要运行时解压） */
    isCompressed: boolean;
}
/**
 * 从完整 URL 中提取 path 和 filename
 * 用于 Babylon SceneLoader.ImportMeshAsync / LoadAssetContainerAsync
 */
export async function getModelPathAndFileAsync(url: string): Promise<ModelPathInfo> {
    // 1) 压缩 GLB data URL 需要先解压，再交给 Babylon 加载。
    if (isCompressedGlb(url)) {
        const usableUrl = await getUsableGlbUrl(url);
        return {
            path: '',
            filename: usableUrl,
            isDataUrl: false,
            isCompressed: true,
        };
    }
    // 2) data URL (base64 内联)
    if (url.startsWith('data:')) {
        return {
            path: '',
            filename: url,
            isDataUrl: true,
            isCompressed: false,
        };
    }
    // 3) 普通 URL
    return splitUrlToPathAndFile(url, false);
}
function splitUrlToPathAndFile(url: string, isCompressed: boolean): ModelPathInfo {
    const idx = url.lastIndexOf('/');
    if (idx === -1) {
        return {
            path: '',
            filename: url,
            isDataUrl: false,
            isCompressed,
        };
    }
    return {
        path: url.slice(0, idx + 1),
        filename: url.slice(idx + 1),
        isDataUrl: false,
        isCompressed,
    };
}
