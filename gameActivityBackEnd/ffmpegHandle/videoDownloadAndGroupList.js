const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { allGameList, TikTokDownloader_ROOT, specialGameList } = require('../const.js')

async function moveFilePath(gameFolder, oldFilePath, fileName, checkName) {
  const newFilePath = path.join(gameFolder, fileName);
  if (checkName) {
    console.log("🚀 ~ processFiles ~ newFilePath:", newFilePath)
    return
  }
  try {
    await fsPromises.rename(oldFilePath, newFilePath);
    console.log(`文件已重命名并移动: ${oldFilePath} -> ${newFilePath}`);
  } catch (err) {
    console.error(err);
  }
}


async function groupVideos(gameArr, fileName, dirMatchAccountGameType, videosDirPath, folderName, checkName) {
  const fileGameType = gameArr.find(game => fileName.includes(game));
  const fileIsSpecialGameType = specialGameList.includes(dirMatchAccountGameType);
  let gameFolder = '';
  const oldFilePath = path.join(videosDirPath, folderName, fileName);
  // 是视频文件
  const isMp4File = path.extname(fileName).toLowerCase() === '.mp4';
  // 是mp4文件且文件标题包含某个游戏类型
  if (isMp4File && fileGameType) {
    if (dirMatchAccountGameType === 'coser同行' || dirMatchAccountGameType === 'coser本人') {
      gameFolder = path.join(TikTokDownloader_ROOT, "gameList", fileGameType + '/' + dirMatchAccountGameType); // gameList/游戏名/coserXX
    } else {
      gameFolder = path.join(TikTokDownloader_ROOT, "gameList", fileGameType + '/攻略'); // gameList/游戏名/攻略
    }
    if (!fs.existsSync(gameFolder)) {
      await fsPromises.mkdir(gameFolder, { recursive: true });
      await fsPromises.mkdir(path.join(gameFolder, '/未处理'), { recursive: true });
    }
    await moveFilePath(gameFolder, oldFilePath, fileName, checkName);
  } else if (isMp4File && fileIsSpecialGameType) {
    // 文件名不包含游戏类型，但是分组是特殊赛道，可移动分组后查看视频再进行手动区分
    const gameFolder = path.join(TikTokDownloader_ROOT, "gameList", dirMatchAccountGameType);
    if (!fs.existsSync(gameFolder)) {
      await fsPromises.mkdir(gameFolder, { recursive: true });
    }
    await moveFilePath(gameFolder, oldFilePath, fileName, checkName);
  }
}



async function downloadVideosAndGroup({
  isDownload,    // 是否下载视频,  false 则只进行mp4文件分组
  checkNewAdd,    // 检测新旧文件对比，只下载新增的文件
  allDownload,    // 是否开启setting.json中全部视频的下载
  checkName, // 检测debugger
  currentUpdateGameList,    // 控制哪些game下载
  earliest,    // 统一下载的最早时间,为空字符串则没有日期限制下载全部作品,活动起始时间
  latest,

  selectedStrategy = 'group', // 新增策略参数
  keyword = '',       // 新增关键词参数
  filePath = '',      // 新增下载文件路径参数
  groupDir = ''       // 新增分组目录参数
  // 时长筛选控制
}) {

  try {
    const settingsPath = path.join(TikTokDownloader_ROOT, 'settings.json');
    let settingsData = await fsPromises.readFile(settingsPath, "utf8");
    let settings = JSON.parse(settingsData);
    let accountsUrls = settings.accounts_urls;
    const oldSettingsPath = path.join(TikTokDownloader_ROOT, 'oldSettings.json');
    let oldSettingsData = await fsPromises.readFile(oldSettingsPath, "utf8");
    let oldSettings = JSON.parse(oldSettingsData);
    let oldAccountsUrls = oldSettings.accounts_urls;

    if (isDownload) {
      // 根据不同下载方式，设置启用状态
      accountsUrls = accountsUrls.map(acc => {
        // 如果开启全部下载，则全部启用
        if (allDownload) acc.enable = true;
        else if (checkNewAdd) {
          // 对比新旧数据, 避免多次下载
          const oldAcc = oldAccountsUrls.find(oldAcc => oldAcc.name === acc.name);
          acc.enable = !oldAcc; // 简化逻辑：如果找到旧数据则禁用，否则启用
        } else {
          // 分组下载 游戏列表设置启用状态  如果上一次下载的时间对比这一次，latest最近7天内没有下载过，则下载
          const latestDate = new Date(acc.latest);
          const fifteenDaysAgo = new Date();
          fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 7);
          acc.enable = latestDate < fifteenDaysAgo && currentUpdateGameList.includes(acc.game)
        }
        if (acc.enable && earliest) acc.earliest = earliest
        if (acc.enable && latest) acc.latest = latest
        return acc;
      });
      // 记录一下当前启用的账号和每个游戏分组总共有多少个账号
      const isEnableAccount = accountsUrls.filter(acc => acc.enable);
      const gameAccountCount = Object.entries(
        accountsUrls.reduce((acc, cur) => {
          acc[cur.game] = acc[cur.game] || [];
          acc[cur.game].push(cur);
          return acc;
        }, {})
      ).map(([game, items]) => ({
        game,
        count: items.length
      }));
      console.log(isEnableAccount, gameAccountCount);

      // 根据不同下载方式，设置运行命令  参考TikTokDownloader
      if (['group', "checkNewAdd", 'all'].includes(selectedStrategy)) settings.run_command = '6 1 1 Q'
      else if (selectedStrategy == 'filePath') settings.run_command = '6 2 2 Q'
      // if (selectedStrategy == 'keyword')  const input_command = 'xxcoser  1  1  0'

      // 及时更新setting.json，保证运行命令和启用状态能生效
      await fsPromises.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");

      try {

        const pythonScriptPath = path.join(TikTokDownloader_ROOT, 'main.py');
        const pythonExecutable = 'python';
        const envVars = {
          PYTHONUTF8: '1',
          PYTHONIOENCODING: 'utf-8',
        };

        // 如果是filePath策略且提供了文件路径,添加到环境变量，文件路径下载
        if (selectedStrategy === 'filePath' && filePath) {
          if (!fs.existsSync(filePath)) {
            console.error(`文件不存在: ${filePath}`);
            return;
          }
          envVars.download_path = filePath;
        }

        // spawn 子进程，与主进程并行执行
        await new Promise((resolve, reject) => {
          const pythonProcess = spawn(pythonExecutable, [pythonScriptPath], {
            shell: true,
            env: envVars
          });

          // 实时监听标准输出
          pythonProcess.stdout.on('data', (data) => {
            const output = data.toString('utf8', {
              stripBOM: true,
              replacementChar: ''
            });
            console.log(`[Python stdout]: ${output}`);
          });

          // 实时监听错误输出
          pythonProcess.stderr.on('data', (data) => {
            const errorOutput = data.toString('utf8', {
              stripBOM: true,
              replacementChar: ''
            });
            console.error(`[Python stderr]: ${errorOutput}`);
          });

          // 进程结束处理
          pythonProcess.on('exit', (code) => {
            if (code === 0) {
              console.log('Python脚本执行成功');
              resolve();
            } else {
              reject(new Error(`Python脚本执行失败，退出码: ${code}`));
            }
          });

          // 错误处理
          pythonProcess.on('error', (err) => {
            reject(new Error(`启动Python脚本失败: ${err.message}`));
          });
        });


      } catch (error) {
        console.error(`Python 脚本标准错误输出: ${error.stderr}`);
        return;
      }

      // 更新settings最新 oldSettingsPath.json 文件，方便下次下载时对比
      await fsPromises.writeFile(oldSettingsPath, JSON.stringify(settings, null, 2), "utf8");
    }


    let gameArr = accountsUrls.filter(item => !['coser同行', 'coser本人'].includes(item.game)).map(acc => acc.game).concat(currentUpdateGameList)
    gameArr = [...new Set(gameArr.concat(allGameList))]
    const videosDirPath = groupDir || path.join(TikTokDownloader_ROOT, 'accountDownload')
    const files = await fsPromises.readdir(videosDirPath, { withFileTypes: true });
    for (const file of files) {
      const folderName = file.name;
      if (file.isDirectory()) {
        const dirMatchAccountGameType = accountsUrls.find(acc => folderName.includes(acc.name))?.game
        // 是某个账号类型
        if (dirMatchAccountGameType) {
          const directoryFolder = await fsPromises.readdir(videosDirPath + "/" + folderName);
          for (const fileName of directoryFolder) {
            await groupVideos(gameArr, fileName, dirMatchAccountGameType, videosDirPath, folderName, checkName);
          }
        }
      } else {
        // 文件  D:\code\platform_game_activity\TikTokDownloader\gameList\coser本人
        // 判断路径中  是否包含某个gameType
        // const dirMatchAccountGameType = specialGameList.find(game => videosDirPath.includes(game))
        // await handleVideos(gameArr, file, dirMatchAccountGameType, videosDirPath, folderName);
      }
    }
  }
  catch (err) {
    console.error('读取或解析settings.json文件时出错:', err);
  }

}


module.exports = {
  downloadVideosAndGroup
}

