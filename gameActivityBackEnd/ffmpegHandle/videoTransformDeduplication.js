const fs = require('fs');
const path = require('path');
const { runFFmpegCommand } = require('./common.js');
const { buildFrameChangeFilter, validateFrameRateParams } = require('./frameInterpolation.js');
const { exec } = require('child_process');
const util = require("util");
const execPromise = util.promisify(exec);

const fsPromises = fs.promises;

function sanitizePathRaw(p) {
    if (!p) return p;
    return String(p).replace(/\r?\n/g, '').trim().replace(/\\/g, '/');
}

function quotePath(p) {
    const raw = sanitizePathRaw(p);
    return `"${raw}"`;
}

async function deduplicateVideo(filePath, deduplicationConfig = {
    speedFactor: 0.95,
    enableMirror: false,
    enableRotate: false,
    rotateAngle: 1,
    enableBlur: false,
    blurRadius: 0.1,
    enableFade: false,
    fadeDuration: 0.5,
    brightness: 0,
    contrast: 1,
    saturation: 1,
    enableBgBlur: false,
    bgBlurTop: 0.1,
    bgBlurBottom: 0.1,
    // 新增：帧率去重配置
    enableFrameChange: false,
    frameChangeMode: 'medium',
    targetFps: 24,
    finalFps: 30,
    interpolateMode: 'mci'
}) {
    const foldPath = path.dirname(filePath);
    const baseFileName = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(foldPath, `${baseFileName}_dedup.mp4`);


    // 构建滤镜链
    let filters = [];

    // 【新增】步骤0：抽帧插帧（必须最先执行！）
    if (deduplicationConfig.enableFrameChange) {
        // 验证参数
        if (validateFrameRateParams(deduplicationConfig.targetFps, deduplicationConfig.finalFps)) {
            const frameFilter = buildFrameChangeFilter(deduplicationConfig);
            filters.push(frameFilter);
            console.log(`启用帧率去重：${frameFilter}`);
        } else {
            console.log(`帧率参数无效，跳过帧率去重`);
        }
    }

    // 1. 变速处理 (通过setpts和atempo)
    if (deduplicationConfig.speedFactor !== 1) {
        filters.push(`setpts=${1 / deduplicationConfig.speedFactor}*PTS`);
        // 音频速度调整将在最终命令中单独处理
    }

    // 2. 镜像效果
    if (deduplicationConfig.enableMirror) {
        filters.push('hflip');
    }

    // 3. 旋转效果
    if (deduplicationConfig.enableRotate) {
        filters.push(`rotate=${deduplicationConfig.rotateAngle}*PI/180`);
    }

    // 4. 背景虚化
    if (deduplicationConfig.enableBgBlur) {
        filters.push(`split=2[bg][fg];[bg]scale=iw*1.1:-1,boxblur=20:20[blurred];[blurred][fg]overlay=(W-w)/2:(H-h)/2`);
    }

    // 5. 模糊效果
    if (deduplicationConfig.enableBlur) {
        filters.push(`boxblur=${deduplicationConfig.blurRadius}`);
    }

    // 6. 色彩调整
    if (deduplicationConfig.brightness !== 0 ||
        deduplicationConfig.contrast !== 1 ||
        deduplicationConfig.saturation !== 1) {
        filters.push(`eq=brightness=${deduplicationConfig.brightness}:contrast=${deduplicationConfig.contrast}:saturation=${deduplicationConfig.saturation}`);
    }

    // 7. 淡入淡出
    if (deduplicationConfig.enableFade) {
        // 只做淡入以避免需要知道视频长度来计算淡出起始时间
        filters.push(`fade=t=in:st=0:d=${deduplicationConfig.fadeDuration}`);
    }

    // 构建最终的 ffmpeg 命令
    let command = 'ffmpeg';

    // 如果启用外部叠加特效（如 effect.mp4），需要额外处理输入顺序和使用 -filter_complex
    const overlayEnabled = !!deduplicationConfig.enableOverlayEffect;
    const overlayPathRaw = path.join(__dirname, 'effectMp4/', deduplicationConfig.overlayPath) || path.join(foldPath, 'effect.mp4');
    const overlayPathQuoted = quotePath(overlayPathRaw);
    const filePathRaw = sanitizePathRaw(filePath);
    const filePathQuoted = quotePath(filePathRaw);
    const outputPathRaw = sanitizePathRaw(outputPath);
    const outputPathQuoted = quotePath(outputPathRaw);
    const overlayLoop = deduplicationConfig.overlayLoop !== false; // 默认为 true
    const blendMode = deduplicationConfig.overlayBlendMode || 'lighten';
    const blendOpacity = typeof deduplicationConfig.overlayOpacity === 'number' ? deduplicationConfig.overlayOpacity : 1;

    if (overlayEnabled) {
        // 把 overlay 放在第一个输入（并循环），主视频作为第二个输入
        if (overlayLoop) {
            command += ` -stream_loop -1 -i ${overlayPathQuoted}`;
        } else {
            command += ` -i ${overlayPathQuoted}`;
        }
        command += ` -i ${filePathQuoted}`;

        // 构建 filter_complex
        // [0:v] = overlay 特效视频 (fg)，[1:v] = 主视频 (bg)
        let filterComplexParts = [];
        // 确保尺寸一致
        filterComplexParts.push('[0:v][1:v]scale2ref[fg][bg]');

        // 如果有对主视频的常规模拟滤镜（之前 filters 数组），把它作用到 bg 上
        if (filters.length > 0) {
            // 把 filters 作用到 bg 并命名为 bgf
            filterComplexParts.push(`[bg]${filters.join(',')}[bgf]`);
        }

        // 使用 blend 滤镜将 fg 以指定模式叠加到 bg（或 bgf）上
        const bgLabel = filters.length > 0 ? 'bgf' : 'bg';
        filterComplexParts.push(`[${bgLabel}][fg]blend=all_mode=${blendMode}:all_opacity=${blendOpacity}[out]`);

        const filterComplex = filterComplexParts.join(';');
        command += ` -filter_complex "${filterComplex}"`;

        // map 输出和音频（音频来自主视频，输入索引为 1）
        command += ` -map [out] -map 1:a?`;

        // 变速时需要单独处理音频
        if (deduplicationConfig.speedFactor !== 1) {
            command += ` -filter:a "atempo=${deduplicationConfig.speedFactor}"`;
        } else if (deduplicationConfig.enableFrameChange) {
            command += ` -c:a copy`;
        }

        // 输出文件
        command += ` -c:v libx264 -crf 18 -preset medium -y ${outputPathQuoted}`;

    } else {
        // 单输入场景（保持原有行为）
        command += ` -i ${filePathQuoted}`;  // 输入文件

        // 添加滤镜链
        if (filters.length > 0) {
            command += ` -vf "${filters.join(',')}"`;
        }

        // 变速时需要单独处理音频
        if (deduplicationConfig.speedFactor !== 1) {
            command += ` -filter:a "atempo=${deduplicationConfig.speedFactor}"`;
        } else if (deduplicationConfig.enableFrameChange) {
            // 帧率变化不影响音频，直接复制音频流（避免重新编码）
            command += ` -c:a copy`;
        }

        // 输出文件
        command += ` -c:v libx264 -crf 18 -preset medium -y ${outputPathQuoted}`;
    }

    try {
        // 执行单个 ffmpeg 命令
        console.log('dedup ffmpeg command:', command);
        // 简单检查：保证命令中的引号成对出现，避免 PowerShell 截断
        const quoteCount = (command.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
            throw new Error('Detected unbalanced quotes in ffmpeg command');
        }
        // await runFFmpegCommand(command);
        await execPromise(command)

        // 替换原文件
        // await fsPromises.rename(outputPath, filePath);
        console.log(`最终处理后的文件: ${outputPath}`);
        return outputPath

    } catch (error) {
        console.error('处理视频时出错:', error);
        // 清理临时文件
        if (fs.existsSync(outputPath)) {
            await fsPromises.unlink(outputPath);
        }
        throw error;
    }
}

// 导出模块
module.exports = {
    deduplicateVideo,
    defaultDeduplicationConfig: {
        speedFactor: 0.95,
        enableMirror: false,
        enableRotate: false,
        rotateAngle: 1,
        enableBlur: false,
        blurRadius: 0.1,
        enableFade: false,
        fadeDuration: 0.5,
        brightness: 0,
        contrast: 1,
        saturation: 1,
        enableBgBlur: false,
        bgBlurTop: 0.1,
        bgBlurBottom: 0.1,
        // 新增：帧率去重配置
        enableFrameChange: false,
        frameChangeMode: 'medium',  // light/medium/heavy/manual
        targetFps: 24,
        finalFps: 30,
        interpolateMode: 'mci',  // mci/blend/dup
        // 外部叠加遮罩/特效配置
        enableOverlayEffect: false,           // 是否启用外部 overlay（如 effect.mp4）
        overlayPath: 'effect.mp4',            // overlay 文件路径，默认位于同目录
        overlayLoop: true,                    // 是否循环 overlay
        overlayBlendMode: 'lighten',          // blend 模式，如 lighten/screen/overlay
        overlayOpacity: 1                     // blend 不透明度
    }
};