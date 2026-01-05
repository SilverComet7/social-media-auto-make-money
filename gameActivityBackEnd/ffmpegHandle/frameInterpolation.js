const { writeLog } = require('./common.js');

/**
 * 构建帧率变化滤镜
 * @param {Object} config - 配置对象
 * @param {string} config.frameChangeMode - 帧率变化模式: light/medium/heavy/manual
 * @param {number} config.targetFps - 抽帧目标帧率
 * @param {number} config.finalFps - 插帧最终帧率
 * @param {string} config.interpolateMode - 插值模式: mci/blend/dup
 * @returns {string} FFmpeg滤镜字符串
 */
function buildFrameChangeFilter(config) {
  const { frameChangeMode, targetFps, finalFps, interpolateMode } = config;

  // 预设模式配置
  const presets = {
    light: {
      target: 28,
      final: 30,
      mode: 'blend',
      description: '轻度去重(30→28→30)'
    },
    medium: {
      target: 24,
      final: 30,
      mode: 'mci',
      description: '中度去重(30→24→30)'
    },
    heavy: {
      target: 20,
      final: 30,
      mode: 'mci',
      description: '重度去重(30→20→30)'
    }
  };

  // 选择参数
  let params;
  if (frameChangeMode === 'manual') {
    params = {
      target: targetFps || 24,
      final: finalFps || 30,
      mode: interpolateMode || 'mci',
      description: `自定义(${targetFps}→${finalFps})`
    };
  } else {
    params = presets[frameChangeMode] || presets.medium;
  }

  writeLog(`应用帧率去重: ${params.description}, 插值模式: ${params.mode}`);

  // 构建滤镜字符串
  const filters = [
    `fps=${params.target}`,
    buildMinterpolateFilter(params.mode, params.final)
  ];

  return filters.join(',');
}

/**
 * 构建minterpolate滤镜
 * @param {string} mode - 插值模式: mci/blend/dup
 * @param {number} fps - 目标帧率
 * @returns {string} minterpolate滤镜字符串
 */
function buildMinterpolateFilter(mode, fps) {
  const modeParams = {
    mci: {
      filter: `minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=${fps}'`,
      description: '运动补偿插值（高质量，速度慢）'
    },
    blend: {
      filter: `minterpolate='mi_mode=blend:fps=${fps}'`,
      description: '混合模式插值（平衡）'
    },
    dup: {
      filter: `minterpolate='mi_mode=dup:fps=${fps}'`,
      description: '复制帧插值（极速）'
    }
  };

  const selectedMode = modeParams[mode] || modeParams.mci;
  writeLog(`使用插值算法: ${selectedMode.description}`);

  return selectedMode.filter;
}

/**
 * 根据原始帧率计算最优抽帧插帧参数
 * @param {number} inputFps - 输入视频帧率
 * @param {string} mode - 去重模式: light/medium/heavy
 * @returns {Object} 最优参数 {targetFps, finalFps}
 */
function calculateOptimalFrameRate(inputFps, mode = 'medium') {
  const strategies = {
    light: (fps) => {
      // 轻度：减少2帧
      const target = Math.max(fps - 2, 24);
      return { targetFps: target, finalFps: fps };
    },
    medium: (fps) => {
      // 中度：固定降到24fps
      return { targetFps: 24, finalFps: fps };
    },
    heavy: (fps) => {
      // 重度：降到原帧率的67%
      const target = Math.max(Math.floor(fps * 0.67), 20);
      return { targetFps: target, finalFps: fps };
    }
  };

  const strategy = strategies[mode] || strategies.medium;
  const result = strategy(inputFps);

  writeLog(`自动计算帧率参数: 输入${inputFps}fps → 抽帧${result.targetFps}fps → 插帧${result.finalFps}fps`);

  return result;
}

/**
 * 验证帧率参数是否有效
 * @param {number} targetFps - 目标帧率
 * @param {number} finalFps - 最终帧率
 * @returns {boolean} 是否有效
 */
function validateFrameRateParams(targetFps, finalFps) {
  if (targetFps < 18 || targetFps > 60) {
    writeLog(`警告: 目标帧率${targetFps}超出推荐范围(18-60)`);
    return false;
  }

  if (finalFps < 24 || finalFps > 60) {
    writeLog(`警告: 最终帧率${finalFps}超出推荐范围(24-60)`);
    return false;
  }

  if (targetFps >= finalFps) {
    writeLog(`警告: 目标帧率(${targetFps})应小于最终帧率(${finalFps})`);
    return false;
  }

  return true;
}

/**
 * 获取推荐的插值模式
 * @param {number} targetFps - 目标帧率
 * @param {number} finalFps - 最终帧率
 * @returns {string} 推荐的插值模式
 */
function getRecommendedInterpolateMode(targetFps, finalFps) {
  const fpsGap = finalFps - targetFps;

  if (fpsGap <= 6) {
    // 帧率差距小，使用blend模式
    return 'blend';
  } else if (fpsGap <= 12) {
    // 帧率差距中等，使用mci模式
    return 'mci';
  } else {
    // 帧率差距大，使用dup模式（快速）
    writeLog(`帧率差距较大(${fpsGap}fps)，建议使用dup模式以提升速度`);
    return 'dup';
  }
}

module.exports = {
  buildFrameChangeFilter,
  buildMinterpolateFilter,
  calculateOptimalFrameRate,
  validateFrameRateParams,
  getRecommendedInterpolateMode
};
