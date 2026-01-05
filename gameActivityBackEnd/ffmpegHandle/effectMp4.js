const path = require('path');
const { runFFmpegCommand } = require('./common.js');

/**
 * 特效类型定义
 * - mirror: 镜像翻转
 * - rotate: 旋转
 * - mosaic: 马赛克
 * - pixelate: 像素化
 * - cartoon: 卡通效果
 * - sepia: 褐色效果
 * - grayscale: 灰度
 * - blur: 模糊
 * - sharpen: 锐化
 * - invert: 反色
 * - colorshift: 色调偏移
 * - speedUp: 加速
 * - slowDown: 减速
 * - boomerang: 回旋效果
 * - zoom: 缩放
 * - border: 边框
 */

/**
 * 应用视频特效的主函数
 * @param {string} inputPath - 输入视频路径
 * @param {Array<string>} effects - 特效数组，如 ['mirror', 'blur']
 * @param {Object} effectParams - 特效参数对象
 * @param {string} outputPath - 输出视频路径
 * @returns {Promise<void>}
 */
async function applyVideoEffects(inputPath, effects = [], effectParams = {}, outputPath) {
    if (!effects || effects.length === 0) {
        console.log('未配置特效，跳过特效处理');
        return;
    }

    const filters = [];

    // 处理各个特效
    for (const effect of effects) {
        const filterStr = buildEffectFilter(effect, effectParams);
        if (filterStr) {
            filters.push(filterStr);
        }
    }

    if (filters.length === 0) {
        console.log('无有效特效，跳过处理');
        return;
    }

    // 构建最终命令
    let command = `ffmpeg -i "${inputPath}"`;
    command += ` -vf "${filters.join(',')}"`; // 视频滤镜链
    command += ` -c:a copy`; // 音频不变
    command += ` -y "${outputPath}"`;

    console.log(`应用特效: ${effects.join(', ')}`);
    await runFFmpegCommand(command);
}

/**
 * 为单个特效构建FFmpeg滤镜字符串
 * @param {string} effectType - 特效类型
 * @param {Object} params - 特效参数
 * @returns {string} FFmpeg滤镜字符串
 */
function buildEffectFilter(effectType, params = {}) {
    switch (effectType) {
        case 'mirror':
            return 'hflip'; // 水平翻转
        
        case 'verticalMirror':
            return 'vflip'; // 竖直翻转

        case 'rotate':
            return `rotate=${params.rotateAngle || 45}*PI/180`;

        case 'mosaic':
            // 马赛克效果 - 通过缩放后扩大实现
            const mosaicSize = params.mosaicSize || 20;
            return `scale=${mosaicSize}:${mosaicSize},scale=iw*${1920 / mosaicSize}:ih*${1080 / mosaicSize}`;

        case 'pixelate':
            // 像素化效果
            const pixelSize = params.pixelSize || 10;
            return `scale=${pixelSize}:-1,scale=1920:1080`;

        case 'cartoon':
            // 卡通效果 - 使用边缘检测和颜色减少
            return 'edgedetect=low:high:high,scale=1920:1080';

        case 'sepia':
            // 褐色效果
            return 'colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131';

        case 'grayscale':
            // 灰度效果
            return 'format=gray';

        case 'blur':
            const blurAmount = params.blurAmount || 10;
            return `boxblur=${blurAmount}`;

        case 'sharpen':
            // 锐化效果
            const sharpAmount = params.sharpAmount || 1;
            return `unsharp=5:5:${sharpAmount}`;

        case 'invert':
            // 反色效果
            return 'negate';

        case 'colorshift':
            // 色调偏移 - 调整色调值
            const hue = params.hue || 0; // 0-360
            const saturation = params.saturation !== undefined ? params.saturation : 1; // 0-2
            return `hue=h=${hue}:s=${saturation}`;

        case 'speedUp':
            // 加速 - 注意这是帧数加速，音频需要分开处理
            const speedUpFactor = params.speedUpFactor || 1.5;
            return `setpts=PTS/${speedUpFactor}`;

        case 'slowDown':
            // 减速
            const slowDownFactor = params.slowDownFactor || 0.75;
            return `setpts=PTS/${slowDownFactor}`;

        case 'boomerang':
            // 回旋效果 - 正常播放后反向播放
            // 这个效果需要特殊处理，此处返回空
            return null;

        case 'zoom':
            // 缩放效果
            const zoomLevel = params.zoomLevel || 1.2;
            return `scale='if(gte(iw,ih),${1920 * zoomLevel},-1)':'if(gte(iw,ih),-1,${1080 * zoomLevel})'`;

        case 'border':
            // 边框效果
            const borderColor = params.borderColor || 'black';
            const borderWidth = params.borderWidth || 10;
            return `pad=${1920 + borderWidth * 2}:${1080 + borderWidth * 2}:${borderWidth}:${borderWidth}:${borderColor}`;

        case 'vignette':
            // 晕影效果 - 四周变暗
            return 'vignette=PI/4';

        case 'wave':
            // 波纹效果
            return 'displace=x=sin(y/64)*cos(t)*16:y=sin(x/64)*cos(t)*16';

        case 'twirl':
            // 旋转扭曲效果
            return 'lut3d=interp=nearest:file=twirl.cube';

        default:
            console.warn(`未知的特效类型: ${effectType}`);
            return null;
    }
}

/**
 * 构建包含特效的合并视频命令
 * 在合并视频时应用特效
 * @param {string} fileListPath - 视频列表文件路径
 * @param {string} outputPath - 输出路径
 * @param {Array<string>} effects - 特效数组
 * @param {Object} effectParams - 特效参数
 * @param {string} audioFilePath - 可选的音频文件路径
 * @returns {string} FFmpeg命令
 */
function buildMergeWithEffectsCommand(fileListPath, outputPath, effects = [], effectParams = {}, audioFilePath = null) {
    let command = `ffmpeg -f concat -safe 0 -i "${fileListPath}"`;

    // 构建视频滤镜链
    const filters = [];
    for (const effect of effects) {
        const filterStr = buildEffectFilter(effect, effectParams);
        if (filterStr) {
            filters.push(filterStr);
        }
    }

    // 添加音频文件如果存在
    if (audioFilePath) {
        command += ` -i "${audioFilePath}"`;
    }

    // 添加滤镜链
    if (filters.length > 0) {
        command += ` -vf "${filters.join(',')}"`;
        // 使用滤镜时需要重新编码
        if (audioFilePath) {
            command += ` -map 0:v:0 -map 1:a:0 -c:v libx264 -shortest`;
        } else {
            command += ` -c:v libx264 -c:a aac`;
        }
    } else {
        // 无滤镜时可以直接复制
        if (audioFilePath) {
            command += ` -map 0:v:0 -map 1:a:0 -c:v libx264 -shortest`;
        } else {
            command += ` -c copy`;
        }
    }

    command += ` -y "${outputPath}"`;

    return command;
}

/**
 * 获取预设的特效组合
 * @param {string} presetName - 预设名称
 * @returns {Object} 包含 effects 和 params 的对象
 */
function getEffectPreset(presetName) {
    const presets = {
        // 动感特效 - 适合游戏攻略
        dynamic: {
            effects: ['speedUp', 'sharpen'],
            params: {
                speedUpFactor: 1.2,
                sharpAmount: 1.2
            }
        },
        // 梦幻特效 - 适合coser
        dreamy: {
            effects: ['blur', 'colorshift'],
            params: {
                blurAmount: 3,
                hue: 45,
                saturation: 1.2
            }
        },
        // 艺术特效
        artistic: {
            effects: ['cartoon', 'sharpen'],
            params: {
                sharpAmount: 0.8
            }
        },
        // 复古特效
        vintage: {
            effects: ['sepia', 'blur'],
            params: {
                blurAmount: 2
            }
        },
        // 黑白特效
        blackAndWhite: {
            effects: ['grayscale', 'sharpen'],
            params: {
                sharpAmount: 1.5
            }
        },
        // 炫彩特效
        vibrant: {
            effects: ['colorshift', 'sharpen'],
            params: {
                hue: 0,
                saturation: 1.5,
                sharpAmount: 1.2
            }
        },
        // 缓慢特效 - 强调细节
        slowMo: {
            effects: ['slowDown', 'blur'],
            params: {
                slowDownFactor: 0.5,
                blurAmount: 1
            }
        },
        // 无特效
        none: {
            effects: [],
            params: {}
        }
    };

    return presets[presetName] || presets.none;
}

module.exports = {
    applyVideoEffects,
    buildEffectFilter,
    buildMergeWithEffectsCommand,
    getEffectPreset
};
