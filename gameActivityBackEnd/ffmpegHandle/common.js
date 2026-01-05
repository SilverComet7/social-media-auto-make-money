
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
      const osPlatform = os.platform();  // 1. windows 2. linux 3. MacOS
      let differentOsCheckCommand = 'wmic path win32_VideoController get name';
      if (osPlatform === 'win32') {
        differentOsCheckCommand = 'wmic path win32_VideoController get name';
      } else if (osPlatform === 'linux') {
        differentOsCheckCommand = 'lspci | grep VGA';
      } else if (osPlatform === 'darwin') {
        differentOsCheckCommand = 'system_profiler SPDisplaysDataType | grep -A 1 "Chipset Model"';
      }

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
            const gpuParams = getOptimalAMDParams('balanced');
            command = command.replace('-c:v libx264', gpuParams);
            writeLog('AMD编码器支持检测通过，使用balanced模式');
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

    // 如果检测到GPU，使用降级链；否则直接执行原始命令
    if (gpuType !== 'CPU' && command !== originalCommand) {
      writeLog(`开始使用降级链处理`);
      const fallbackChain = buildFallbackChain(gpuType);

      for (let i = 0; i < fallbackChain.length; i++) {
        const config = fallbackChain[i];
        const modifiedCommand = replaceEncoder(originalCommand, config.params);

        writeLog(`尝试编码器 [${config.name}]: ${modifiedCommand}`);

        try {
          const { stderr } = await execPromise(modifiedCommand);
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);

          if (stderr) {
            writeLog(`FFmpeg警告输出 (耗时${duration}秒): ${stderr}`);
          }
          writeLog(`编码成功 [${config.name}] 耗时: ${duration}秒`);

          return { success: true, duration, encoder: config.name };
        } catch (error) {
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          writeLog(`编码失败 [${config.name}] (耗时${duration}秒): ${error.message}`);

          if (i === fallbackChain.length - 1) {
            writeLog(`所有编码方案均失败`);
            throw error;
          }
          writeLog(`尝试下一个降级方案 [${fallbackChain[i + 1].name}]`);
        }
      }
    } else {
      // CPU模式或未修改命令，直接执行
      writeLog(`执行FFmpeg命令: ${command}`);
      try {
        const { stderr } = await execPromise(command);
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        if (stderr) {
          writeLog(`FFmpeg警告输出 (耗时${duration}秒): ${stderr}`);
        }
        writeLog(`FFmpeg命令执行完成，耗时: ${duration}秒`);

        return { success: true, duration };
      } catch (error) {
        throw error;
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
// AMD GPU参数优化函数
function getOptimalAMDParams(quality = 'balanced') {
  const paramsMap = {
    speed: '-c:v h264_amf -quality speed -rc cqp -qp_i 23 -qp_p 25 -preanalysis true -vbaq true',
    balanced: '-c:v h264_amf -quality balanced -rc vbr_latency -qp_i 23 -qp_p 25 -preanalysis true',
    quality: '-c:v h264_amf -quality quality -rc cqp -qp_i 20 -qp_p 22 -preanalysis true -vbaq true'
  };
  return paramsMap[quality] || paramsMap.balanced;
}

// 构建降级链
function buildFallbackChain(gpuType) {
  const chain = [];

  if (gpuType === 'AMD') {
    chain.push(
      { name: 'AMD-Balanced', params: getOptimalAMDParams('balanced') },
      { name: 'AMD-Speed', params: getOptimalAMDParams('speed') },
      { name: 'AMD-Quality', params: getOptimalAMDParams('quality') }
    );
  } else if (gpuType === 'NVIDIA') {
    chain.push(
      { name: 'NVIDIA-P4', params: '-c:v h264_nvenc -preset p4 -tune hq' },
      { name: 'NVIDIA-P6', params: '-c:v h264_nvenc -preset p6 -tune hq' }
    );
  }

  // CPU降级方案
  chain.push(
    { name: 'CPU-Fast', params: '-c:v libx264 -preset fast -crf 23' },
    { name: 'CPU-Medium', params: '-c:v libx264 -preset medium -crf 23' }
  );

  return chain;
}

// 替换编码器参数
function replaceEncoder(command, newParams) {
  // 匹配 -c:v 后面的编码器及其参数
  const regex = /-c:v\s+\S+(?:\s+-[a-zA-Z_]+\s+\S+)*/g;
  return command.replace(regex, newParams);
}

// 检测GPU类型
async function detectGPUType() {
  try {
    const differentOsCheckCommand = 'wmic path win32_VideoController get name';
    const { stdout: GpuInfo } = await execPromise(differentOsCheckCommand).catch(() => ({ stdout: '' }));

    if (GpuInfo.toLowerCase().includes('nvidia')) {
      return 'NVIDIA';
    } else if (GpuInfo.toLowerCase().includes('amd') || GpuInfo.toLowerCase().includes('radeon')) {
      return 'AMD';
    }
    return 'CPU';
  } catch (error) {
    return 'CPU';
  }
}

module.exports = {
  runFFmpegCommand,
  writeLog,
  checkEncoderSupport,
  getOptimalAMDParams,
  detectGPUType
};