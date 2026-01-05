const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const os = require('os');
const fsPromises = fs.promises;
const execPromise = util.promisify(exec);
const { deduplicateVideo } = require('./videoTransformDeduplication.js');
const { TikTokDownloader_ROOT } = require("../const.js");
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { getRandomMusicName } = require("../commonFunction.js");
const { runFFmpegCommand, writeLog, detectGPUType } = require("./common.js");
const {
  generateTaskId,
  loadTaskProgress,
  initTaskProgress,
  updateTaskProgress,
  markTaskCompleted,
  markTaskPaused,
  TASK_STATUS
} = require('./taskProgress.js');


// 动态获取最优并行度
async function getOptimalWorkerCount() {
  const gpuType = await detectGPUType();
  const cpuCores = os.cpus().length;

  if (gpuType === 'AMD' || gpuType === 'NVIDIA') {
    // GPU编码：可以提高并行度，GPU可同时处理多路视频
    const optimalCount = Math.min(cpuCores, 8);
    writeLog(`检测到${gpuType} GPU，设置并行度为: ${optimalCount}`);
    return optimalCount;
  } else {
    // CPU编码：使用核心数的一半
    const optimalCount = Math.max(1, Math.floor(cpuCores / 2));
    writeLog(`使用CPU编码，设置并行度为: ${optimalCount}`);
    return optimalCount;
  }
}

// 默认值，用于Worker线程
const cpuCount = os.cpus().length / 2;
writeLog(`系统CPU核心数/2: ${cpuCount}`);

if (!isMainThread) {
  const { filePath, basicVideoInfoObj, pathInfoObj, mergeVideoInfoObj } = workerData;
  const startTime = Date.now();
  writeLog(`工作线程开始处理文件: ${path.basename(filePath)}`);

  processVideo(filePath, basicVideoInfoObj, pathInfoObj, mergeVideoInfoObj)
    .then(result => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      writeLog(`工作线程完成处理文件: ${path.basename(filePath)}, 耗时: ${duration}秒`);
      parentPort.postMessage({ success: true, result, duration });
    })
    .catch(error => {
      writeLog(`工作线程处理失败: ${path.basename(filePath)}, 错误: ${error.message}`);
      parentPort.postMessage({ success: false, error: error.message });
    });
}

const formatDate = () => {
  const date = new Date();
  return (
    date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds()
  );
};


const mapName = "reNameMap.json";
let fileNameMap = {};
const mapFilePath = path.join(TikTokDownloader_ROOT, "gameList/" + mapName);

if (fs.existsSync(mapFilePath)) {
  try {
    fileNameMap = JSON.parse(fs.readFileSync(mapFilePath, "utf8"));
  } catch (err) {
    console.error(`读取映射文件时出错: ${err.message}`);
    fileNameMap = {};
  }
}



async function getVideoParams(filePath) {
  try {
    const command = `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,duration  -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const { stdout, stderr } = await execPromise(command);

    if (stderr) {
      console.error(`FFmpeg标准错误输出: ${stderr}`);
    }

    const [codecName, width, height, frameRate, duration] = stdout.trim().split("\n");
    return { codecName, width: parseInt(width), height: parseInt(height), frameRate: parseInt(frameRate), duration: parseInt(duration) };
  } catch (error) {
    console.error(`执行命令时出错: ${error.message}`);
    throw error;
  }
}

async function processVideo(filePath, basicVideoInfoObj,
  pathInfoObj, mergeVideoInfoObj) {

  let {
    onlyRename,
    checkName,
    musicName,
    beforeTime,
    fps,
    scalePercent,
    replaceMusic,
    gameName,
    groupName,
    deduplicationConfig,
    addPublishTime,
    enableMerge,
    addEnding,
    effectConfig // 新增：特效配置
  } = basicVideoInfoObj;

  const fileExt = path.extname(filePath);
  let originFileName = path.basename(filePath, path.extname(filePath));
  let { fileName, nickName } = generateNewName(originFileName, gameName, groupName, addPublishTime);


  let {
    videoFolderPath,
    // musicFilePath,
    newVideoFolderPath,
    // newOriginalFolderPath
  } = pathInfoObj

  const musicFilePath = path.join(TikTokDownloader_ROOT, `./素材/music/${musicName}.mp3`); // 音乐文件路径,优先foldPath下的music文件夹，其次读取根目录下的素材/music文件夹里的随机mp3文件
  const newOriginalFolderPath = path.join(videoFolderPath + '/已处理');
  const videoTempPath = path.join(
    videoFolderPath,
    `${fileName}_temp${fileExt}`
  );
  const fileListPath = path.join(videoFolderPath, `${fileName}_filelist.txt`);


  if (!fs.existsSync(newVideoFolderPath)) {
    fs.mkdirSync(newVideoFolderPath);
    // if (enableMerge) fs.mkdirSync(path.join(newVideoFolderPath, `/合集`));
    fs.mkdirSync(path.join(newVideoFolderPath + '/已发'));
  }

  async function deleteTempFile(mergeVideoInfoObj) {
    if (fs.existsSync(fileListPath)) await fsPromises.unlink(fileListPath);
    // if (mergeVideoInfoObj) return;
    // 存在合并视频信息对象时，不直接删除临时文件，最后合并视频后删除
    if (fs.existsSync(videoTempPath) && !mergeVideoInfoObj) await fsPromises.unlink(videoTempPath);
  }

  // 先删除之前的文件，避免ffmpeg卡住
  await deleteTempFile(mergeVideoInfoObj);


  let dedupResultPath = '';

  // 开始视频去重处理
  if (deduplicationConfig && deduplicationConfig.enable) {
    try {
      // 合并默认配置以避免前端只部分字段导致的 NaN 或非法参数
      const { defaultDeduplicationConfig } = require('./videoTransformDeduplication.js');
      const normalizedDedupConfig = Object.assign({}, defaultDeduplicationConfig, deduplicationConfig);

      dedupResultPath = await deduplicateVideo(filePath, normalizedDedupConfig);
      // if (dedupResultPath) handleIngFilePath = dedupResultPath;
      console.log(`视频去重处理完成: ${filePath}`);
    } catch (error) {
      console.error(`视频去重处理失败: ${error.message}`);
    }
  }


  // 开始视频变换处理
  let videoParams = await getVideoParams(filePath);
  let w_h = "_9_16";
  let scale = '';
  if (Number(videoParams.width) > Number(videoParams.height)) {
    w_h = "_16_9";
    scale = `scale=1920:1080`;
  } else {
    w_h = "_9_16";
    scale = `scale=1080:1920`;
  }

  if (scalePercent) {
    scalePercent = scalePercent / 100;
    scale = `scale=${videoParams.width * scalePercent}:${videoParams.height * scalePercent}`
  }

  let filterChain = [scale];

  // 添加特效滤镜（如果启用且不应用于合并）
  if (effectConfig && effectConfig.enable && !effectConfig.applyOnMerge) {
    try {
      const { buildEffectFilter, getEffectPreset } = require('./effectMp4.js');

      let effectsToApply = [];
      if (effectConfig.preset && effectConfig.preset !== 'custom') {
        const preset = getEffectPreset(effectConfig.preset);
        effectsToApply = preset.effects;
      } else if (effectConfig.selectedEffects && effectConfig.selectedEffects.length > 0) {
        effectsToApply = effectConfig.selectedEffects;
      }

      for (const effect of effectsToApply) {
        const effectFilter = buildEffectFilter(effect, effectConfig.params || {});
        if (effectFilter) {
          filterChain.push(effectFilter);
        }
      }
    } catch (error) {
      writeLog(`加载特效模块失败: ${error.message}`);
    }
  }

  if (groupName == "coser本人" || gameName == "coser本人" || filePath.includes("coser本人")) {
    filterChain.push(`drawtext=fontfile='./SourceHanSansCN-Bold.otf':text='coser：${nickName}':fontsize=18:fontcolor=white:x=50:y=50`);
  }

  let command2 = `ffmpeg -ss ${beforeTime}  -i "${dedupResultPath || filePath}"  -r ${fps} -vf "${filterChain.join(',')}" -c:v libx264 -c:a aac "${videoTempPath}"`;

  // 视频分辨率 截取前后视频时长 添加coser水印 是否在temp视频就添加特效（temp视频会参与多视频合并）
  await runFFmpegCommand(command2);
  // 用完去重后的删除掉，避免后续合并的时候出问题
  if (dedupResultPath) await fsPromises.unlink(dedupResultPath);


  if (mergeVideoInfoObj) {
    mergeVideoInfoObj.needDeleteTempFilePath.push(videoTempPath)
  }


  const endingFilePath = path.join(TikTokDownloader_ROOT, `./素材/after/点赞关注${w_h}.mp4`);
  // 步骤3：生成准备要合并的文件路径文件 filelist.txt
  const fileListContent = addEnding
    ? `file '${videoTempPath}'\nfile '${endingFilePath}'`
    : `file '${videoTempPath}'`;
  fs.writeFileSync(fileListPath, fileListContent);
  const preProcessVideoFilePath = path.join(newVideoFolderPath, `${fileName}${fileExt}`);

  // 步骤4：合并temp视频和默认片尾，并根据是否替换背景音乐来确定命令
  let command3 = ''

  // 检查是否需要在合并时应用特效
  const applyEffectsOnMerge = effectConfig && effectConfig.enable && effectConfig.applyOnMerge;

  if (applyEffectsOnMerge) {
    try {
      const { buildMergeWithEffectsCommand } = require('./effectMp4.js');
      const { getEffectPreset } = require('./effectMp4.js');

      let effectsToApply = [];
      if (effectConfig.preset && effectConfig.preset !== 'custom') {
        const preset = getEffectPreset(effectConfig.preset);
        effectsToApply = preset.effects;
      } else if (effectConfig.selectedEffects && effectConfig.selectedEffects.length > 0) {
        effectsToApply = effectConfig.selectedEffects;
      }

      const audioFile = replaceMusic ? musicFilePath : null;
      command3 = buildMergeWithEffectsCommand(
        fileListPath,
        preProcessVideoFilePath,
        effectsToApply,
        effectConfig.params || {},
        audioFile
      );
    } catch (error) {
      writeLog(`应用合并特效失败，使用默认处理: ${error.message}`);
      if (replaceMusic) {
        command3 = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -i "${musicFilePath}" -map 0:v:0 -map 1:a:0 -c:v copy -shortest "${preProcessVideoFilePath}"`;
      } else {
        command3 = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${preProcessVideoFilePath}"`;
      }
    }
  } else {
    if (replaceMusic) {
      command3 = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -i "${musicFilePath}" -map 0:v:0 -map 1:a:0 -c:v copy -shortest "${preProcessVideoFilePath}"`;
    } else {
      command3 = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${preProcessVideoFilePath}"`;
    }
  }

  // 合并片尾  合并单视频时应用特效  替换全局音乐
  await runFFmpegCommand(command3);


  // 移动原文件
  if (!fs.existsSync(newOriginalFolderPath)) {
    fs.mkdirSync(newOriginalFolderPath);
  }
  const originFileNewPath = path.join(
    newOriginalFolderPath,
    `${originFileName}${fileExt}`
  );
  fs.renameSync(filePath, originFileNewPath);

  await deleteTempFile(mergeVideoInfoObj);
  return { mergeVideoInfoObj }
}


function generateNewName(originFileName, gameName, groupName, addPublishTime) {
  let fileName = '';
  const fileSplit = originFileName.split("-");
  let nickName = fileSplit[0];
  let publishTime = '';
  if (originFileName.includes("#")) {
    publishTime = fileSplit.slice(-3).join('-');
    fileName = originFileName.split("#")[0];
    fileName = fileName.split("-")[1];
    // if (fileName == "") {
    //   const arr = originFileName.split("#");
    //   fileName = arr[arr.length - 1];
    //   fileName = fileName.split("-")[0];
    //   // TODO 1. 接入deepSeek AI改名，生成新的爆款自媒体标题
    // }
    if (!fileName?.includes(gameName) && groupName === '攻略') fileName = `${fileName}~${gameName}`;
  }
  if (fileName === '') fileName = originFileName
  if (addPublishTime && publishTime) {
    fileName = fileName + '_' + publishTime;
  }


  return { fileName, nickName };
}

async function ffmpegHandleVideos(basicVideoInfoObj = {
  checkName: false,
  beforeTime: 1,
  fps: 30,
  scalePercent: 0,
  replaceMusic: false,
  musicName: 'billll',
  gameName: '崩坏3',
  groupName: 'coser本人',
  onlyRename: false,
  deduplicationConfig: null,
  enableMerge: false,
  mergedMinTime: 20,
  addPublishTime: false,
  videoDir: ''
}) {
  const startTime = Date.now();
  writeLog(`开始FFmpeg视频处理任务:处理参数: ${JSON.stringify(basicVideoInfoObj, null, 2)}`);

  // === 断点续传逻辑 ===
  const taskId = generateTaskId(basicVideoInfoObj);
  writeLog(`任务ID: ${taskId}`);

  // 检查是否有未完成任务
  const existingTask = loadTaskProgress(taskId);
  if (existingTask && existingTask.status !== TASK_STATUS.COMPLETED) {
    writeLog(`检测到未完成任务: ${taskId}, 状态: ${existingTask.status}`);
    writeLog(`已处理: ${existingTask.progress.processed}/${existingTask.progress.total}, 失败: ${existingTask.progress.failed}`);

    // 如果配置了自动恢复，恢复任务
    if (basicVideoInfoObj.autoResumeTask) {
      writeLog(`自动恢复任务: ${taskId}`);
      // 恢复逻辑将在后面的视频处理循环中实现
    } else {
      writeLog(`任务需要手动恢复，请在前端确认是否继续`);
      // 可以在这里抛出错误或返回提示，由前端处理
    }
  }

  let {
    // 重命名相关
    enableRename,
    checkName,
    onlyRename,
    addPublishTime,
    // 预处理相关
    enableTransform,
    beforeTime,
    fps,
    scalePercent,
    replaceMusic,
    musicName,
    gameName,
    groupName,
    // 合集混剪相关参数
    enableMerge,
    mergedMinTime,
    enableMergeMusic,
    mergeMusicName,
    segmentDuration,
    mixCount,
    deduplicationConfig,
    effectConfig, // 新增：特效配置
    gpuQuality, // 新增：GPU配置
    enableResumeTask, // 新增：断点续传
    autoResumeTask, // 新增：自动恢复

    videoDir,
  } = basicVideoInfoObj;

  // 初始化合并视频信息对象
  const mergeVideoInfoObj = {
    mergedMinTime: mergedMinTime || 30,
    videoIndex: 0,
    totalDuration: 0,
    fileStr: '',
    needMergeBiliBiliVideoPath: [],  // 后续合并
    needDeleteTempFilePath: []  // 后续删除
  }

  const foldPathName = `gameList/${gameName}/${groupName}`;
  const videoFolderPath = videoDir || path.join(TikTokDownloader_ROOT, `${foldPathName}`);
  const newVideoFolderPath = path.join(videoFolderPath, formatDate() + `_截取${beforeTime}秒后_${replaceMusic ? `音乐=${musicName}` : ''}缩放${scalePercent}%_合集时间大于${mergeVideoInfoObj.mergedMinTime}_帧数=${fps}`);

  const pathInfoObj = {
    videoFolderPath,
    newVideoFolderPath
  }

  try {
    let videoFiles = await getVideoFiles(videoFolderPath);
    // 重命名相关
    if (enableRename) {
      const fileArr = []
      videoFiles.forEach(async (fileNameExt, index) => {
        // 视频重命名相关
        const fileExt = path.extname(fileNameExt);
        let originFileName = path.basename(fileNameExt, path.extname(fileNameExt));
        let { fileName, nickName } = generateNewName(originFileName, gameName, groupName, addPublishTime);

        fileArr.push(fileArr.includes(fileName) ? `${fileName}_${index}` : fileName)

        if (checkName) {
          return console.log(fileName, nickName, index);
        }
        const finalGameVideoScrPath = path.join(videoFolderPath, `/已重命名处理`)
        const finalGameVideoScrYiFaPath = path.join(videoFolderPath, `/已重命名处理/已发`)

        if (!fs.existsSync(finalGameVideoScrPath)) {
          fs.mkdirSync(finalGameVideoScrPath);
          fs.mkdirSync(finalGameVideoScrYiFaPath);
        }

        const filePath = path.join(videoFolderPath, fileNameExt);
        const finalVideoPath = path.join(videoFolderPath, `/已重命名处理/${fileName}${fileExt}`)
        fs.renameSync(filePath, finalVideoPath);

        fileNameMap[originFileName] = fileName;
      });
    }

    const isPreProcess = enableTransform || deduplicationConfig.enable;
    // 开启视频预处理

    if (isPreProcess) {
      let videoFiles = await getVideoFiles(videoFolderPath);
      writeLog(`找到待处理视频文件数量: ${videoFiles.length}`);

      // 初始化或恢复任务
      let currentTask;
      if (existingTask && existingTask.status !== TASK_STATUS.COMPLETED) {
        currentTask = existingTask;
        // 过滤已处理的文件
        const processedFiles = currentTask.progress.processedFiles;
        videoFiles = videoFiles.filter(file => !processedFiles.includes(path.basename(file)));
        writeLog(`过滤已处理文件，剩余待处理: ${videoFiles.length}`);
      } else {
        // 初始化新任务
        currentTask = initTaskProgress(taskId, basicVideoInfoObj, videoFiles.length);
      }

      if (videoFiles.length === 0) {
        writeLog(`所有文件已处理完成`);
        markTaskCompleted(taskId);
        return;
      }

      // 动态获取最优并行度
      const optimalWorkerCount = await getOptimalWorkerCount();

      // 根据最优并行度划分任务
      const batchSize = Math.max(1, Math.floor(videoFiles.length / optimalWorkerCount));
      const batches = [];
      for (let i = 0; i < videoFiles.length; i += batchSize) {
        batches.push(videoFiles.slice(i, i + batchSize));
      }
      writeLog(`任务分片情况: 总共${batches.length}个批次，每批次处理${batchSize}个文件`);
      // 创建工作线程池
      const processVideoInWorker = async (filePath) => {
        return new Promise((resolve, reject) => {
          const worker = new Worker(__filename, {
            workerData: {
              filePath: path.join(videoFolderPath, filePath),
              basicVideoInfoObj,
              pathInfoObj,
              mergeVideoInfoObj: enableMerge ? mergeVideoInfoObj : null
            }
          });

          worker.on('message', (message) => {
            if (message.success) {
              // 更新任务进度 - 成功
              updateTaskProgress(taskId, filePath, 'success');

              // 从子进程返回的消息中更新 要删除的filePath
              if (isPreProcess && enableMerge) mergeVideoInfoObj.needDeleteTempFilePath.push(...message.result.mergeVideoInfoObj.needDeleteTempFilePath)
              resolve(message.result);
            } else {
              // 更新任务进度 - 失败
              updateTaskProgress(taskId, filePath, 'failed', message.error);
              reject(new Error(message.error));
            }
          });

          worker.on('error', (error) => {
            // 更新任务进度 - 错误
            updateTaskProgress(taskId, filePath, 'failed', error.message);
            reject(error);
          });
          worker.on('exit', (code) => {
            if (code !== 0) {
              reject(new Error(`工作线程退出，退出码 ${code}`));
            }
          });
        });
      };
      // 并行处理每个批次
      writeLog('开始并行处理视频批次');
      const results = await Promise.all(
        batches.map(async (batch, batchIndex) => {
          writeLog(`开始处理第${batchIndex + 1}批次，包含${batch.length}个文件`);
          const batchStartTime = Date.now();

          const batchResults = await Promise.all(
            batch.map(async (file) => {
              try {
                const result = await processVideoInWorker(file);
                writeLog(`完成处理文件: ${file}`);
                return result;
              } catch (error) {
                writeLog(`处理文件失败: ${file}, 错误: ${error.message}`);
                return null;
              }
            })
          );

          const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
          writeLog(`第${batchIndex + 1}批次处理完成，耗时: ${batchDuration}秒`);
          return batchResults;
        })
      );

      // 标记任务完成
      markTaskCompleted(taskId);
      writeLog(`任务${taskId}处理完成`);
    }

    console.log('所有视频预处理完毕');

    // 处理合并视频的逻辑,如果有去重或视频变换后的 temp 文件，则合并temp文件，否则合并原视频

    // 读取当前文件夹下的视频文件，可能是预处理后的temp文件
    videoFiles = await getVideoFiles(videoFolderPath);
    if (enableMerge) {
      let availableVideos = [...videoFiles];

      await Promise.all(Array.from({ length: mixCount }, async (_, index) => {
        const mergeMusicPath = path.join(TikTokDownloader_ROOT,
          `./素材/music/${mergeMusicName === '随机' ? getRandomMusicName() : mergeMusicName + '.mp3'}`);
        let totalDuration = 0;
        let fileStr = '';
        let localAvailableVideos = [...availableVideos];

        // 用于存储第一个视频的参数
        let firstVideoParams = null;
        let targetWidth, targetHeight;
        const transitionDuration = 0.5;

        while (totalDuration < mergedMinTime && localAvailableVideos.length > 0) {
          const randomIndex = Math.floor(Math.random() * localAvailableVideos.length);
          const randomFile = localAvailableVideos.splice(randomIndex, 1)[0];
          const filePath = path.join(videoFolderPath, randomFile);

          const videoParams = await getVideoParams(filePath);
          const maxStartTime = videoParams.duration - segmentDuration - transitionDuration;
          if (maxStartTime <= 0) continue;

          // 如果是第一个视频，记录其参数作为目标宽高比
          if (!firstVideoParams) {
            firstVideoParams = videoParams;
            targetWidth = videoParams.width;
            targetHeight = videoParams.height;
            writeLog(`选定第一个视频的宽高比为 ${targetWidth}:${targetHeight}`);
          }

          const startTime = Math.floor(Math.random() * maxStartTime)
          const tempFilePath = path.join(videoFolderPath, `temp_${index}_${Date.now()}_${randomFile}.mp4`);

          // 检查当前视频是否需要转换
          const needsConversion = videoParams.width / videoParams.height !== firstVideoParams.width / firstVideoParams.height;

          if (needsConversion) {
            writeLog(`视频 ${randomFile} 需要转换以匹配目标宽高比`);
            // 计算新的尺寸，保持宽高比并添加黑边
            let scaleFilter = '';
            const sourceRatio = videoParams.width / videoParams.height;
            const targetRatio = targetWidth / targetHeight;

            if (sourceRatio > targetRatio) {
              // 源视频更宽，需要在上下添加黑边
              const newHeight = Math.floor(targetWidth / sourceRatio);
              const padHeight = Math.floor((targetHeight - newHeight) / 2);
              scaleFilter = `scale=${targetWidth}:${newHeight},pad=${targetWidth}:${targetHeight}:0:${padHeight}:black`;
            } else {
              // 源视频更高，需要在两侧添加黑边
              const newWidth = Math.floor(targetHeight * sourceRatio);
              const padWidth = Math.floor((targetWidth - newWidth) / 2);
              scaleFilter = `scale=${newWidth}:${targetHeight},pad=${targetWidth}:${targetHeight}:${padWidth}:0:black`;
            }

            const command = `ffmpeg -ss ${startTime} -t ${segmentDuration + transitionDuration} -i "${filePath}" -vf "${scaleFilter}" -c:v libx264 -c:a aac "${tempFilePath}"`;
            await runFFmpegCommand(command);

          } else {
            writeLog(`视频 ${randomFile} 无需转换，直接使用`);
            // 视频宽高比匹配，直接使用copy
            if (fileStr === '') {
              const command = `ffmpeg -ss ${startTime} -t ${segmentDuration} -i "${filePath}" -c copy "${tempFilePath}"`;
              await runFFmpegCommand(command);
            } else {
              const command = `ffmpeg -ss ${startTime} -t ${segmentDuration + transitionDuration} -i "${filePath}" -c copy "${tempFilePath}"`;
              await runFFmpegCommand(command);
            }
          }

          fileStr += `file '${tempFilePath}'\n`;
          totalDuration += segmentDuration;
        }

        // 修改输出文件名，添加宽高比信息
        const aspectRatio = firstVideoParams.width > firstVideoParams.height ? "16_9" : "9_16";
        const mergedFilePath = path.join(
          isPreProcess ? newVideoFolderPath : videoFolderPath,
          `merged_video_${aspectRatio}_${index}_${Date.now()}.mp4`
        );

        // 修改合并视频的命令，添加转场效果
        const mergedFileListPath = path.join(videoFolderPath, `filelist_${index}_${Date.now()}.txt`);
        await fsPromises.writeFile(mergedFileListPath, fileStr);
        // 从文件列表中获取临时文件
        const tempFiles = fileStr.split('\n').map(line => line.replace("file '", "").replace("'", "")).filter(Boolean);
        try {
          // 构建输入文件参数
          const inputsStr = tempFiles.map(file => `-i "${file}"`).join(' ');

          // 构建滤镜复杂度字符串
          let filterComplex = '';
          let lastOutput = '0';

          for (let i = 1; i < tempFiles.length; i++) {
            filterComplex += `[${lastOutput}][${i}]xfade=transition=fade:duration=0.5:offset=${i * segmentDuration - 0.5}[v${i}];`;
            lastOutput = `v${i}`;
          }

          // 最终的合并命令
          const mergeCommand = `ffmpeg ${inputsStr} -i "${mergeMusicPath}" -filter_complex "${filterComplex}" -map "[${lastOutput}]" -map ${tempFiles.length}:a -c:v libx264 -c:a aac -shortest "${mergedFilePath}"`;
          await runFFmpegCommand(mergeCommand);

          await deleteFiles(tempFiles, mergedFileListPath);
        } catch (error) {
          console.log('合并视频失败' + error);
          await deleteFiles(tempFiles, mergedFileListPath);
          throw error
        }
      }));

      // // 预处理后的视频顺序合并
      // await Promise.all(mergeVideoInfoObj.needMergeBiliBiliVideoPath.map(async ({ txtPath, mp4File }) => {
      //   let command = '';
      //   if (enableMergeMusic) {
      //     command = `ffmpeg -f concat -safe 0 -i "${txtPath}" -i "${mergeMusicPath}" -c copy -map 0:v:0 -map 1:a:0 -shortest "${mp4File}"`;
      //   } else {
      //     command = `ffmpeg -f concat -safe 0 -i "${txtPath}" -c copy "${mp4File}"`;
      //   }
      //   return await runFFmpegCommand(command);
      // }));

    }
    // 清理临时文件
    if (isPreProcess && enableMerge) {
      await Promise.all(mergeVideoInfoObj.needDeleteTempFilePath.map(async (videoPath) => {
        return await fsPromises.unlink(videoPath);
      }));
    }

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    writeLog(`所有视频处理任务完成，总耗时: ${totalDuration}秒`);

    // 保存文件名映射
    fs.writeFileSync(mapFilePath, JSON.stringify(fileNameMap, null, 2));
    writeLog('文件名映射已保存');

    return {
      success: true,
      totalDuration,
      processedFiles: videoFiles.length,
      // batchCount: batches.length
    };
  } catch (err) {
    const errorDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    writeLog(`主程序执行出错 (耗时${errorDuration}秒): ${err.message}`);
    writeLog(err.stack || '无堆栈信息');

    // 标记任务暂停
    if (taskId) {
      markTaskPaused(taskId, err.message);
      writeLog(`任务${taskId}已暂停，可通过恢复功能继续处理`);
    }

    fs.writeFileSync(mapFilePath, JSON.stringify(fileNameMap, null, 2));
    throw err;
  }

  async function deleteFiles(tempFiles, fileListPath) {
    await Promise.all(tempFiles.map(tempFile => fsPromises.unlink(tempFile)));
    await fsPromises.unlink(fileListPath);
  }
}


// 混剪处理




module.exports = {
  ffmpegHandleVideos,
  generateNewName,
  runFFmpegCommand
}

// 读取当前目录下的视频文件
async function getVideoFiles(videoFolderPath) {
  const files = await fsPromises.readdir(videoFolderPath);
  const videoFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ext === ".mp4" || ext === ".mov";
  });
  return videoFiles;
}
