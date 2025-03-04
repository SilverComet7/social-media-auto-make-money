const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { allGameList, TikTokDownloader_ROOT } = require('../../const.js')

async function downloadVideosAndGroup({
  isDownload,    // 是否下载视频,  false 则只进行mp4文件分组

  checkNewAdd,    // 检测新旧文件对比，只下载新增的文件

  allDownload,    // 是否开启setting.json中全部视频的下载

  checkName, // 检测debugger

  currentUpdateGameList,    // 控制哪些game下载

  earliest,    // 统一下载的最早时间,为空字符串则没有日期限制下载全部作品,活动起始时间

  strategy = 'group', // 新增策略参数
  keyword = '',       // 新增关键词参数
  filePath = ''       // 新增下载文件路径参数
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
      accountsUrls = accountsUrls.map(acc => {
        if (currentUpdateGameList.includes(acc.game)) {
          acc.enable = true;
        } else {
          acc.enable = false;
        }
        // 对比新旧数据, 避免多次下载
        if (checkNewAdd) {
          const oldAcc = oldAccountsUrls.find(oldAcc => oldAcc.name === acc.name);
          if (oldAcc) {
            acc.enable = false;
          } else {
            acc.enable = true;
          }
        }
        // 如果开启全部下载，则全部启用
        if (allDownload) acc.enable = true;
        if (earliest || earliest == '') acc.earliest = earliest
        return acc;
      });
      if (strategy == 'group') settings.run_command = '6 1 1 Q' // 分组下载 参考TikTokDownloader
      // if (strategy == 'keyword') 
      if (strategy == 'filePath') settings.run_command = '6 2 2 Q' // TODO  处理默认路径 读取特定download.txt文件路径下载  
      await fsPromises.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
      console.log("settings.json 更新完成");

      // 2. 如果存在enable，使用 python 调用 main.py

      const hasEnableGame = accountsUrls.some(acc => acc.enable);

      if (hasEnableGame) {
        const pythonScriptPath = path.join(TikTokDownloader_ROOT, 'main.py');
        const pythonExecutable = 'python'; // 如果不在系统路径中，可以使用完整路径，例如 'C:\\Python39\\python.exe'

        try {
          console.log(`Python 脚本开始执行: `);

          // 使用Promise包装spawn进程
          await new Promise((resolve, reject) => {
            const pythonProcess = spawn(pythonExecutable, [pythonScriptPath], {
              shell: true,
              env: {
                PYTHONUTF8: '1',  // 强制Python使用UTF-8编码
                PYTHONIOENCODING: 'utf-8'  // 设置输入输出编码
              }
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

          // 更新下载了的日期为当前日期 XXXX/XX/XX
          const currentDate = new Date().toLocaleDateString();
          accountsUrls = accountsUrls.map(acc => {
            if (currentUpdateGameList.includes(acc.game)) {
              acc.earliest = currentDate;
            }
            return acc;
          });
          // 更新 settings.json 文件
          await fsPromises.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
          console.log("settings.json 更新完成");
        } catch (error) {
          console.error(`执行 Python 脚本时出错: ${error.message}`);
          console.error(`Python 脚本标准错误输出: ${error.stderr}`);
          return;
        }
      }
      // 更新 settings.json 文件
      await fsPromises.writeFile(oldSettingsPath, JSON.stringify(settings, null, 2), "utf8");
    }



    // 全部游戏类型，后续将coser同行 coser本人 的mp4视频,根据名称是否包含该游戏分组到各自的游戏文件夹下的对应子文件夹 coser同行 coser本人
    let gameArr = accountsUrls.filter(item => !['coser同行', 'coser本人'].includes(item.game)).map(acc => acc.game).concat(currentUpdateGameList)
    gameArr = [...new Set(gameArr.concat(allGameList))]


    const videosDirPath = path.join(TikTokDownloader_ROOT, 'accountDownload') || 'D:\\code\\TikTokDownloader';
    const files = await fsPromises.readdir(videosDirPath, { withFileTypes: true });

    for (const file of files) {
      if (file.isDirectory()) {
        const folderName = file.name;
        const account = accountsUrls.find(acc => folderName.includes(acc.name));
        if (account && account.game) {
          const directoryFolder = await fsPromises.readdir(videosDirPath + "/" + folderName);
          for (const fileName of directoryFolder) {

            const gameName = gameArr.find(game => fileName.includes(game))
            let gameFolder = ''
            const oldFilePath = path.join(videosDirPath, folderName, fileName);
            const isSpecialGameType = ['coser同行', 'coser本人', '搞笑', '可爱赛道'].includes(account.game);
            const isMp4File = path.extname(fileName).toLowerCase() === '.mp4';
            // 是mp4文件且文件标题包含某个游戏名称
            if (isMp4File && gameName) {
              if (account.game === 'coser同行' || account.game === 'coser本人') {
                gameFolder = path.join(TikTokDownloader_ROOT, "gameList", gameName + '/' + account.game); // gameList/游戏名/coserXX
              } else {
                gameFolder = path.join(TikTokDownloader_ROOT, "gameList", gameName + '/攻略'); // gameList/游戏名/攻略
              }
              if (!fs.existsSync(gameFolder)) {
                await fsPromises.mkdir(gameFolder, { recursive: true });
                await fsPromises.mkdir(path.join(gameFolder, '/未处理'), { recursive: true });
              }
              let newFilePath = path.join(gameFolder, fileName);
              if (checkName) {
                console.log("🚀 ~ processFiles ~ newFilePath:", newFilePath)
                continue
              }
              try {
                await fsPromises.rename(oldFilePath, newFilePath);
                console.log(`文件已重命名并移动: ${oldFilePath} -> ${newFilePath}`);
              } catch (err) {
                console.error('无法重命名文件:', err);
              }
            } else if (isMp4File && isSpecialGameType) {
              // 文件名不包含游戏类型，但是分组是特殊赛道，可移动分组后查看视频再进行手动区分
              const gameFolder = path.join(TikTokDownloader_ROOT, "gameList", account.game);
              if (!fs.existsSync(gameFolder)) {
                await fsPromises.mkdir(gameFolder, { recursive: true });
              }
              let newFilePath = path.join(gameFolder, fileName);
              if (checkName) {
                console.log("🚀 ~ processFiles ~ newFilePath:", newFilePath)
                continue
              }
              try {
                await fsPromises.rename(oldFilePath, newFilePath);
                console.log(`文件移动到新文件夹: ${oldFilePath} -> ${newFilePath}`);
              } catch (err) {
                console.error('无法移动文件:', err);
              }
            }
          }
        }
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