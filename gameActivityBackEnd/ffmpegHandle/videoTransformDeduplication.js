const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const fsPromises = fs.promises;
const execPromise = util.promisify(exec);


// 获取视频的宽度和高度
async function getVideoDimensions(filePath) {
    const command = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    try {
        const { stdout, stderr } = await execPromise(command);
        if (stderr) {
            console.error(`FFmpeg标准错误输出: ${stderr}`);
        }
        const [width, height] = stdout.trim().split('\n');
        return { width: parseInt(width, 10), height: parseInt(height, 10) };
    } catch (error) {
        console.error(`获取视频尺寸时出错: ${error.message}`);
        throw error;
    }
}

// 修改分辨率和帧数
async function modifyResolutionAndFrameRate(inputFilePath, outputFilePath, scalePercent, targetWidth, targetHeight, frameRate) {
    const { width: originalWidth, height: originalHeight } = await getVideoDimensions(inputFilePath);

    const newWidth = Math.round(originalWidth * scalePercent);
    const newHeight = Math.round(originalHeight * scalePercent);

    const command = `ffmpeg -i "${inputFilePath}" -vf "scale=${newWidth}:${newHeight},fps=${frameRate}" "${outputFilePath}"`;
    try {
        await execPromise(command);
        console.log(`分辨率和帧数修改完成: ${outputFilePath}`);
    } catch (error) {
        console.error(`修改分辨率和帧数时出错: ${error.message}`);
        throw error;
    }
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
    bgBlurBottom: 0.1
}) {
    const foldPath = path.dirname(filePath);
    const baseFileName = path.basename(filePath, path.extname(filePath));
    const outputPath = path.join(foldPath, `${baseFileName}_dedup.mp4`);

    // 构建滤镜链
    let filters = [];
    
    // 1. 变速处理 (通过setpts和atempo)
    if (deduplicationConfig.speedFactor !== 1) {
        filters.push(`setpts=${1/deduplicationConfig.speedFactor}*PTS`);
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
        filters.push(`fade=t=in:st=0:d=${deduplicationConfig.fadeDuration},fade=t=out:st=end_duration-${deduplicationConfig.fadeDuration}:d=${deduplicationConfig.fadeDuration}`);
    }

    // 构建最终的 ffmpeg 命令
    let command = 'ffmpeg';
    command += ` -i "${filePath}"`;  // 输入文件

    // 添加滤镜链
    if (filters.length > 0) {
        command += ` -vf "${filters.join(',')}"`;
    }

    // 变速时需要单独处理音频
    if (deduplicationConfig.speedFactor !== 1) {
        command += ` -filter:a "atempo=${deduplicationConfig.speedFactor}"`;
    }

    // 输出文件
    command += ` -y "${outputPath}"`;

    try {
        // 执行单个 ffmpeg 命令
        await execPromise(command);
        console.log('视频处理完成');

        // 替换原文件
        await fsPromises.rename(outputPath, filePath);
        console.log(`最终处理后的文件: ${filePath}`);

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
        bgBlurBottom: 0.1
    }
};