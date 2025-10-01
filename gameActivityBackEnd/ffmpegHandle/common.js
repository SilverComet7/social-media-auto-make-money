
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
// const os = require('os'); // 暂时注释掉，未来可能需要用于跨平台支持
const execPromise = util.promisify(exec);

// 检测编码器是否可用
async function checkEncoderSupport(encoder) {
    try {
        const command = `ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 -c:v ${encoder} -f null -`;
        await execPromise(command);
        return true;
    } catch {
        return false;
    }
}

async function runFFmpegCommand(command) {
    const startTime = Date.now();
    try {
        // 检测GPU支持情况
        let gpuInfo = '';
        let gpuType = 'CPU';
        let originalCommand = command;

        try {
            // 检测 NVIDIA GPU   根据不同平台使用不同命令？
            // const osPlatform = os.platform();  // 1. windows 2. linux 3. MacOS
            let differentOsCheckCommand = 'wmic path win32_VideoController get name';
            // if (osPlatform === 'win32') {
            //   checkCommand = 'wmic path win32_VideoController get name';
            // } else if (osPlatform === 'linux') {
            //   checkCommand = 'lspci | grep VGA';
            // } else if (osPlatform === 'darwin') {
            //   checkCommand = 'system_profiler SPDisplaysDataType | grep -A 1 "Chipset Model"';
            // }

            const { stdout: GpuInfo } = await execPromise(differentOsCheckCommand).catch(() => ({ stdout: '' }));
            if (GpuInfo.toLowerCase().includes('nvidia')) {
                gpuInfo = GpuInfo;
                gpuType = 'NVIDIA';
                // 检测NVIDIA编码器是否可用
                const nvencSupported = await checkEncoderSupport('h264_nvenc');
                if (nvencSupported) {
                    command = command.replace('-c:v libx264', '-c:v h264_nvenc -preset p4 -tune hq');
                    writeLog('NVIDIA编码器支持检测通过');
                } else {
                    writeLog('NVIDIA编码器不支持，使用CPU编码器');
                    gpuType = 'CPU';
                }
            } else {
                // 检测 AMD GPU
                if (GpuInfo.toLowerCase().includes('amd') || GpuInfo.toLowerCase().includes('radeon')) {
                    gpuInfo = GpuInfo;
                    gpuType = 'AMD';
                    // 检测AMD编码器是否可用
                    const amfSupported = await checkEncoderSupport('h264_amf');
                    if (amfSupported) {
                        command = command.replace('-c:v libx264', '-c:v h264_amf -quality quality -preset quality');
                        writeLog('AMD编码器支持检测通过');
                    } else {
                        writeLog('AMD编码器不支持，使用CPU编码器');
                        gpuType = 'CPU';
                    }
                }
            }
        } catch (error) {
            writeLog(`GPU检测失败: ${error.message}`);
        }

        writeLog(`使用硬件: ${gpuType}`);
        if (gpuInfo) {
            writeLog(`GPU信息: ${gpuInfo.trim()}`);
        }
        writeLog(`执行FFmpeg命令: ${command}`);

        try {
            const { stderr } = await execPromise(command);
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            if (stderr) {
                writeLog(`FFmpeg警告输出 (耗时${duration}秒): ${stderr}`);
            }
            writeLog(`FFmpeg命令执行完成，耗时: ${duration}秒`);

            return { success: true, duration };
        } catch (gpuError) {
            // 如果GPU编码器失败，回退到CPU编码器
            if (gpuType !== 'CPU') {
                writeLog(`GPU编码器失败，回退到CPU编码器: ${gpuError.message}`);
                writeLog(`使用原始命令: ${originalCommand}`);

                try {
                    const { stderr } = await execPromise(originalCommand);
                    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

                    if (stderr) {
                        writeLog(`FFmpeg警告输出 (耗时${duration}秒): ${stderr}`);
                    }
                    writeLog(`FFmpeg命令执行完成（CPU编码器），耗时: ${duration}秒`);

                    return { success: true, duration };
                } catch (cpuError) {
                    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                    writeLog(`CPU编码器也失败 (耗时${duration}秒),错误信息: ${cpuError.message}`);
                    writeLog(`CPU错误信息: ${cpuError.message}`);
                    if (cpuError.stderr) {
                        writeLog(`FFmpeg错误输出: ${cpuError.stderr}`);
                    }
                    throw cpuError;
                }
            } else {
                throw gpuError;
            }
        }
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        writeLog(`FFmpeg命令执行失败 (耗时${duration}秒),错误信息: ${error.message}`);
        writeLog(`错误信息: ${error.message}`);
        if (error.stderr) {
            writeLog(`FFmpeg错误输出: ${error.stderr}`);
        }
        throw error;
    }
}

// 日志记录函数
const logFilePath = path.join(__dirname, 'logs/ffmpeg_process.log');

function ensureLogDirectory() {
  const logDir = path.dirname(logFilePath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());

  ensureLogDirectory();
  fs.appendFileSync(logFilePath, logMessage);
}
module.exports = {
    runFFmpegCommand,
    writeLog,
    checkEncoderSupport
};