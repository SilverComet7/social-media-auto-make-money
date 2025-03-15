const fs = require("fs");
const path = require("path");
const jsonParentPath = 'jsonFile';

function formatSecondTimestamp(dateString, unit) {
  const date = new Date(dateString);
  if (unit === 'second') {
    return Math.floor(date.getTime() / 1000);
  }
  return date.getTime();
}

const getDaysDiff = (timeStamp1, timeStamp2) => {
  const diffTime = timeStamp1 - timeStamp2;
  const endDiffDate = diffTime / (1000 * 60 * 60 * 24);
  return Math.ceil(endDiffDate);
};

const formatDate = (timestamp = new Date().getTime()) => {
  const date = new Date(timestamp);
  return (
    date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + date.getDate()
  );
};

function getJsonData(inJsonPath = "data.json") {
  const jsonPath = path.join(__dirname, jsonParentPath, inJsonPath);

  try {
    if (!fs.existsSync(jsonPath)) {
      console.warn(`文件不存在: ${jsonPath}`);
    }

    const data = fs.readFileSync(jsonPath, "utf8");

    try {
      let oldDataArr = JSON.parse(data);

      // 确保返回的是数组
      if (!Array.isArray(oldDataArr)) {
        console.warn(`${jsonPath} 的内容不是数组格式`);
      }

      return oldDataArr;
    } catch (parseError) {
      console.error(`JSON 解析错误 (${jsonPath}):`, parseError);
      console.error("问题数据:", data.substring(0, 200) + "..."); // 只显示前200个字符
      return [];
    }
  } catch (error) {
    console.error(`读取文件错误 (${jsonPath}):`, error);
    return [];
  }
}

async function writeLocalDataJson(arr, fileName = "data.json") {
  const data = JSON.stringify(arr, null, 2);
  const filePath = path.join(__dirname, jsonParentPath, fileName);
  fs.writeFileSync(filePath, data);
}

async function concurrentFetchWithDelay(
  promises,
  minDelay = 100,
  maxDelay = 500,
  limitNum = 5
) {
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(limitNum);

  const limitedPromises = promises.map((promiseFactory) =>
    limit(async () => {
      if (typeof promiseFactory !== "function") {
        throw new TypeError(
          "Each element in the promises array must be a function that returns a Promise."
        );
      }
      const result = await promiseFactory();
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * (maxDelay - minDelay) + minDelay)
      );
      return result;
    })
  );

  return Promise.all(limitedPromises);
}

// 计算能简单瓜分到的钱  任务指标【根据账号数据调整】
function calculateTotalMoney(gameData) {
  let totalMoney = 0;

  if (!gameData?.rewards) return 0;
  for (const reward of gameData.rewards) {
    if (!reward?.specialTagRequirements) continue;
    for (const requirement of reward.specialTagRequirements) {
      if (reward.minView >= 5000) continue; // 单稿最低播放大于5000 不参与计算
      for (const rewardItem of requirement.reward) {
        if (rewardItem.allViewNum >= 50000) continue; // 总播放大于50000 不参与计算
        if (rewardItem.view >= 10000) continue; // 爆款将：单稿播放大于10000 不参与计算
        if (rewardItem.like > 500) continue; // 点赞大于500 不参与计算
        totalMoney += rewardItem.money;
      }
    }
  }

  return totalMoney;
}

// 获取随机音乐名称
function getRandomMusicName(dirPath = 'D:/code/platform_game_activity/TikTokDownloader/素材/music') {
  const musicNames = fs.readdirSync(dirPath);
  return musicNames[Math.floor(Math.random() * musicNames.length)];
}


module.exports = {
  formatDate,
  getJsonData,
  formatSecondTimestamp,
  getDaysDiff,
  concurrentFetchWithDelay,
  calculateTotalMoney,
  writeLocalDataJson,
  getRandomMusicName
};
