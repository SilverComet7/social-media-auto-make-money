
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const os = require('os');
const execPromise = util.promisify(exec);

async function runFFmpegCommand(command) {
    const startTime = Date.now();
    try {
        // 检测GPU支持情况
        let gpuInfo = '';
        let gpuType = 'CPU';

        try {
            // 检测 NVIDIA GPU   根据不同平台使用不同命令？
            const osPlatform = os.platform();  // 1. windows 2. linux 3. MacOS
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
                command = command.replace('-c:v libx264', '-c:v h264_nvenc -preset p4 -tune hq');
            } else {
                // 检测 AMD GPU
                if (GpuInfo.toLowerCase().includes('amd') || GpuInfo.toLowerCase().includes('radeon')) {
                    gpuInfo = GpuInfo;
                    gpuType = 'AMD';
                    command = command.replace('-c:v libx264', '-c:v h264_amf -quality quality -preset quality');
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

        const { stdout, stderr } = await execPromise(command);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (stderr) {
            writeLog(`FFmpeg警告输出 (耗时${duration}秒): ${stderr}`);
        }
        writeLog(`FFmpeg命令执行完成，耗时: ${duration}秒`);

        return { success: true, duration };
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        writeLog(`FFmpeg命令执行失败 (耗时${duration}秒):`);
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
    writeLog
};