const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const fsPromises = fs.promises;
const execPromise = util.promisify(exec);
const { deduplicateVideo } = require('./videoTransformDeduplication.js');
const { TikTokDownloader_ROOT } = require("../../const.js");
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

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

// 获取CPU核心数
const cpuCount = os.cpus().length;
writeLog(`系统CPU核心数: ${cpuCount}`);

// 工作线程处理函数
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

async function runFFmpegCommand(command) {
  const startTime = Date.now();
  try {
    // 检测GPU支持情况
    let gpuInfo = '';
    let gpuType = 'CPU';

    try {
      // 检测 NVIDIA GPU
      const { stdout: nvidiaInfo } = await execPromise('nvidia-smi -L').catch(() => ({ stdout: '' }));
      if (nvidiaInfo.toLowerCase().includes('nvidia')) {
        gpuInfo = nvidiaInfo;
        gpuType = 'NVIDIA';
        command = command.replace('-c:v libx264', '-c:v h264_nvenc -preset p4 -tune hq');
      } else {
        // 检测 AMD GPU
        const { stdout: amdInfo } = await execPromise('lspci | grep AMD').catch(() => ({ stdout: '' }));
        if (amdInfo.toLowerCase().includes('amd')) {
          gpuInfo = amdInfo;
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
    beforeTime,
    fps,
    scalePercent,
    replaceMusic,
    gameName,
    groupName,
    deduplicationConfig,
    addPublishTime,
    enableMerge,
    addEnding
  } = basicVideoInfoObj;


  let {
    musicFilePath,
    videoFolderPath,
    newVideoFolderPath,
    newOriginalFolderPath
  } = pathInfoObj

  const fileExt = path.extname(filePath);
  let originFileName = path.basename(filePath, path.extname(filePath));
  let { fileName, nickName } = genFileName(originFileName, gameName, groupName, addPublishTime);

  if (checkName) {
    return console.log(fileName, nickName);
  }

  if (onlyRename) {
    const finalGameVideoScrPath = path.join(videoFolderPath, `/已重命名处理`)
    const finalGameVideoScrYiFaPath = path.join(videoFolderPath, `/已重命名处理/已发`)

    if (!fs.existsSync(finalGameVideoScrPath)) {
      fs.mkdirSync(finalGameVideoScrPath);
      fs.mkdirSync(finalGameVideoScrYiFaPath);
    }

    const finalGameVideoPath = path.join(videoFolderPath, `/已重命名处理/${fileName}${fileExt}`)
    fs.renameSync(filePath, finalGameVideoPath);
    fileNameMap[originFileName] = fileName;
    return;
  }


  const videoTempPath = path.join(
    videoFolderPath,
    `${fileName}_temp${fileExt}`
  );
  const finalNoMusicVideoPath = path.join(
    videoFolderPath,
    `${fileName}_final${fileExt}`
  );
  const fileListPath = path.join(videoFolderPath, `${fileName}_filelist.txt`);
  const gameFileListPath = path.join(
    videoFolderPath,
    `${fileName}_game_filelist.txt`
  );

  if (!fs.existsSync(newVideoFolderPath)) {
    fs.mkdirSync(newVideoFolderPath);
    if (enableMerge) fs.mkdirSync(path.join(newVideoFolderPath, `/合集`));
    fs.mkdirSync(path.join(newVideoFolderPath + '/已发'));
  }

  if (!fs.existsSync(newOriginalFolderPath)) {
    fs.mkdirSync(newOriginalFolderPath);
  }

  async function deleteTempFile(mergeVideoInfoObj) {
    if (fs.existsSync(fileListPath)) await fsPromises.unlink(fileListPath);
    if (fs.existsSync(finalNoMusicVideoPath))
      await fsPromises.unlink(finalNoMusicVideoPath);
    if (fs.existsSync(gameFileListPath))
      await fsPromises.unlink(gameFileListPath);
    if (
      fs.existsSync(`${finalNoMusicVideoPath.replace("_final", "_game_final")}`)
    )
      await fsPromises.unlink(
        `${finalNoMusicVideoPath.replace("_final", "_game_final")}`
      );
    if (mergeVideoInfoObj) return; // 存在合并视频信息对象时，不直接删除临时文件，最后合并合集后删除
    if (fs.existsSync(videoTempPath)) await fsPromises.unlink(videoTempPath);
  }

  // 先删除之前的文件，避免ffmpeg卡住
  await deleteTempFile(mergeVideoInfoObj);


  // 开始处理视频
  if (deduplicationConfig && deduplicationConfig.enable && Object.keys(deduplicationConfig).length > 0) {
    try {
      await deduplicateVideo(filePath, deduplicationConfig);
      console.log(`视频去重处理完成: ${filePath}`);
    } catch (error) {
      console.error(`视频去重处理失败: ${error.message}`);
    }
  }

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

  // 视频分辨率
  if (scalePercent) { 
    scalePercent = scalePercent / 100; 
    scale = `scale=${videoParams.width * scalePercent}:${videoParams.height * scalePercent}` 
  }
  let command2 = ''
  // 如果分组是coser本人，或者游戏名是coser本人，或者文件名包含coser本人，则打上本人文字水印
  if (groupName == "coser本人" || gameName == "coser本人" || filePath.includes("coser本人")) {
    command2 = `ffmpeg -ss ${beforeTime}  -i "${filePath}"  -r ${fps} -vf "${scale},drawtext=fontfile='./SourceHanSansCN-Bold.otf':text='coser：${nickName}':fontsize=18:fontcolor=white:x=50:y=50" -c:v libx264 -c:a aac "${videoTempPath}"`;
  } else {
    command2 = `ffmpeg -ss ${beforeTime}  -i "${filePath}"  -r ${fps} -vf "${scale}" -c:v libx264 -c:a aac "${videoTempPath}"`;
  }
  await runFFmpegCommand(command2);

  if (mergeVideoInfoObj) {
    const videoTrueDuration = (videoParams.duration - beforeTime);
    mergeVideoInfoObj.totalDuration += videoTrueDuration
    mergeVideoInfoObj.fileStr += `file '${videoTempPath}'\n`;
    if (mergeVideoInfoObj.totalDuration > mergeVideoInfoObj.mergedLimitTime) {
      const txtPath = path.join(newVideoFolderPath, `/合集/${gameName}coser合集${mergeVideoInfoObj.videoIndex + 1}.0_filelist.txt`)
      const mp4File = path.join(newVideoFolderPath, `/合集/${gameName}coser合集${mergeVideoInfoObj.videoIndex + 1}.0.mp4`)
      fsPromises.writeFile(txtPath, mergeVideoInfoObj.fileStr);
      mergeVideoInfoObj.totalDuration = 0
      mergeVideoInfoObj.fileStr = ''
      mergeVideoInfoObj.videoIndex += 1
      mergeVideoInfoObj.needMergeBiliBiliVideoPath.push({
        txtPath,
        mp4File
      })
      mergeVideoInfoObj.needDeleteTempFilePath.push(txtPath)
    }
    mergeVideoInfoObj.needDeleteTempFilePath.push(videoTempPath)
  }


  const endingFilePath = path.join(TikTokDownloader_ROOT, `./素材/after/点赞关注${w_h}.mp4`);
  // 步骤3：生成准备要合并的文件路径文件 filelist.txt  
  const filelistContentTest = addEnding
    ? `file '${videoTempPath}'\nfile '${endingFilePath}'`
    : `file '${videoTempPath}'`;
  fs.writeFileSync(fileListPath, filelistContentTest);
  const finalVideoPath = path.join(newVideoFolderPath, `${fileName}${fileExt}`);

  // 步骤4：合并temp视频和默认片尾，并根据是否替换背景音乐来确定命令
  let command3 = ''
  if (replaceMusic) {
    command3 = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -i "${musicFilePath}" -map 0:v:0 -map 1:a:0 -c:v copy -shortest "${finalVideoPath}"`;
  } else {
    command3 = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${finalVideoPath}"`;
  }
  await runFFmpegCommand(command3);


  if (fileName !== originFileName) {
    const originNewFilePath = path.join(
      newOriginalFolderPath,
      `${originFileName}${fileExt}`
    );
    fs.renameSync(filePath, originNewFilePath);
    fileNameMap[originFileName] = fileName;
  }

  // 删除临时文件
  return await deleteTempFile(mergeVideoInfoObj);

}


function genFileName(originFileName, gameName, groupName, addPublishTime) {
  let fileName = '';
  const fileSplit = originFileName.split("-");
  let nickName = fileSplit[0];
  let publishTime = '';
  if (originFileName.includes("#")) {
    publishTime = fileSplit.slice(-3).join('-');
    fileName = originFileName.split("#")[0];
    fileName = fileName.split("-")[1];
    if (fileName == "") {
      const arr = originFileName.split("#");
      fileName = arr[arr.length - 1];
      fileName = fileName.split("-")[0];
      // TODO 1. 接入deepSeek AI改名，生成新的爆款自媒体标题  
    }
    if (!fileName?.includes(gameName) && groupName === '攻略') fileName = `${fileName}~${gameName}`;
  } else {
    fileName = originFileName;
  }
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
  mergedLimitTime: 20,
  addPublishTime: false,
  videoDir: ''
}) {
  const startTime = Date.now();
  writeLog('开始FFmpeg视频处理任务');
  writeLog(`处理参数: ${JSON.stringify(basicVideoInfoObj, null, 2)}`);

  let {
    checkName,
    beforeTime,
    fps,
    scalePercent,
    replaceMusic,
    musicName,
    gameName,
    groupName,

    enableMerge,
    mergedLimitTime,
    enableMergeMusic,
    mergeMusicName,

    videoDir
  } = basicVideoInfoObj;

  // 初始化合并视频信息对象
  const mergeVideoInfoObj = {
    mergedLimitTime: mergedLimitTime || 30,
    videoIndex: 0,
    totalDuration: 0,
    fileStr: '',
    needMergeBiliBiliVideoPath: [],  // 后续合并
    needDeleteTempFilePath: []  // 后续删除
  }

  const musicFilePath = path.join(TikTokDownloader_ROOT, `./素材/music/${musicName}.mp3`); // 音乐文件路径,优先foldPath下的music文件夹，其次读取根目录下的素材/music文件夹里的随机mp3文件
  const mergeMusicPath = path.join(TikTokDownloader_ROOT, `./素材/music/${mergeMusicName}.mp3`);
  const foldPathName = `gameList/${gameName}/${groupName}`;
  const videoFolderPath = videoDir || path.join(TikTokDownloader_ROOT, `${foldPathName}`);
  const newVideoFolderPath = path.join(videoFolderPath, formatDate() + `_截取${beforeTime}秒后_${replaceMusic ? `音乐=${musicName}` : ''}缩放${scalePercent}%_合集时间大于${mergeVideoInfoObj.mergedLimitTime}_帧数=${fps}`);
  const newOriginalFolderPath = path.join(videoFolderPath + '/已处理');

  const pathInfoObj = {
    musicFilePath,
    videoFolderPath,
    newVideoFolderPath,
    newOriginalFolderPath
  }

  try {
    const files = await fsPromises.readdir(videoFolderPath);
    const videoFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === ".mp4" || ext === ".mov";
    });

    writeLog(`找到待处理视频文件数量: ${videoFiles.length}`);

    // 根据CPU核心数划分任务
    const batchSize = Math.max(1, Math.floor(videoFiles.length / cpuCount));
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
            resolve(message.result);
          } else {
            reject(new Error(message.error));
          }
        });

        worker.on('error', reject);
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

    // 处理合并视频的逻辑
    if (enableMerge) {
      writeLog('开始处理视频合并任务');
      await Promise.all(mergeVideoInfoObj.needMergeBiliBiliVideoPath.map(async ({ txtPath, mp4File }) => {
        let command = '';
        if (enableMergeMusic) {
          command = `ffmpeg -f concat -safe 0 -i "${txtPath}" -i "${mergeMusicPath}" -c copy -map 0:v:0 -map 1:a:0 -shortest "${mp4File}"`;
        } else {
          command = `ffmpeg -f concat -safe 0 -i "${txtPath}" -c copy "${mp4File}"`;
        }
        return await runFFmpegCommand(command);
      }));

      // 清理临时文件
      await Promise.all(mergeVideoInfoObj.needDeleteTempFilePath.map(async (filePath) => {
        return await fsPromises.unlink(filePath);
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
      batchCount: batches.length
    };
  } catch (err) {
    const errorDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    writeLog(`主程序执行出错 (耗时${errorDuration}秒): ${err.message}`);
    writeLog(err.stack || '无堆栈信息');
    fs.writeFileSync(mapFilePath, JSON.stringify(fileNameMap, null, 2));
    throw err;
  }
}


module.exports = {
  ffmpegHandleVideos
}