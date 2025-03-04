const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const fsPromises = fs.promises;
const execPromise = util.promisify(exec);
const { deduplicateVideo } = require('./videoTransformDeduplication.js');
const { TikTokDownloader_ROOT } = require("../../const.js");


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
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      // console.warn(`FFmpeg警告输出: ${stderr}`);
    }
    // console.log(`FFmpeg标准输出: ${stdout}`);
  } catch (error) {
    console.error(`执行命令时出错: ${error.message}`);
    console.error(`FFmpeg标准错误输出: ${error.stderr}`);
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
    enableMerge
  } = basicVideoInfoObj;

  scalePercent = scalePercent / 100;

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


  if (deduplicationConfig && deduplicationConfig.enable && Object.keys(deduplicationConfig).length > 0) {
    try {
      await deduplicateVideo(filePath, deduplicationConfig);
      console.log(`视频去重处理完成: ${filePath}`);
    } catch (error) {
      console.error(`视频去重处理失败: ${error.message}`);
    }
  }

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

  await deleteTempFile(mergeVideoInfoObj); // 先删除之前的文件，避免ffmpeg卡住

  let videoParams = await getVideoParams(filePath);
  let w_h = "_9_16";
  if (Number(videoParams.width) > Number(videoParams.height)) {
    w_h = "_16_9";
    scale = `scale=1920:1080`;
  } else {
    w_h = "_9_16";
    scale = `scale=1080:1920`;
  }
  if (scalePercent) scale = `scale=${videoParams.width * scalePercent}:${videoParams.height * scalePercent}`
  // 视频重新编码 , 不含背景音乐
  let command2 = ''
  if (groupName == "coser本人" || gameName == "coser本人") {
    // coser本人打上本人文字水印
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
  const filelistContentTest = `file '${videoTempPath}'\nfile '${endingFilePath}'`;
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
  addPublishTime: false,  // 新增：是否添加发布时间参数
  videoDir: ''
}) {
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
    const videoPromises = [];
    for (const file of files) {
      if (path.extname(file).toLowerCase() === ".mp4" || path.extname(file).toLowerCase() === ".mov") {
        const filePath = path.join(videoFolderPath, file);
        try {
          videoPromises.push(processVideo(filePath, basicVideoInfoObj,
            pathInfoObj, enableMerge ? mergeVideoInfoObj : null))  // 根据enableMerge决定是否传入mergeVideoInfoObj
        } catch (error) {
          console.error("处理视频出错:", error);
        }
      }
    }
    await Promise.all(videoPromises)
    if (checkName) return

    // 只在启用合并时执行合并操作
    if (enableMerge) {
      await Promise.all(mergeVideoInfoObj.needMergeBiliBiliVideoPath.map(async ({ txtPath, mp4File }) => {
        let command = ''
        if (enableMergeMusic) {
          command = `ffmpeg -f concat -safe 0 -i "${txtPath}" -i "${mergeMusicPath}" -c copy -map 0:v:0 -map 1:a:0 -shortest "${mp4File}"`;
        } else {
          command = `ffmpeg -f concat -safe 0 -i "${txtPath}" -c copy "${mp4File}"`;
        }
        return await runFFmpegCommand(command);
      }))
      await Promise.all(mergeVideoInfoObj.needDeleteTempFilePath.map(async (filePath) => {
        return await fsPromises.unlink(filePath);
      }))
    }
    // 将文件名映射保存为 JSON 文件
    fs.writeFileSync(mapFilePath, JSON.stringify(fileNameMap, null, 2));
  } catch (err) {
    console.error("主程序执行出错: " + err);
    fs.writeFileSync(mapFilePath, JSON.stringify(fileNameMap, null, 2));
  }
}


module.exports = {
  ffmpegHandleVideos
}