const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
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

const formatDate = (timestamp = new Date().getTime(), seconds = false) => {
  const date = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0'); // 补零

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  if (seconds) {
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const secs = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${secs}`;
  }

  return `${year}-${month}-${day}`;
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

      return oldDataArr;
    } catch (parseError) {
      console.error(`JSON 解析错误 (${jsonPath}):`, parseError);
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
      try {
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
      } catch (error) {
        console.error(error);
      }
    })
  );

  return Promise.all(limitedPromises);
}

// 计算能简单瓜分到的钱  任务指标【根据账号数据调整】
function calculateTotalMoney(gameData) {
  let totalMoney = 0;

  if (!gameData?.rewards) return 0;
  for (const reward of gameData.rewards) {
    if (!reward?.activityRequirements) continue;
    for (const requirement of reward.activityRequirements) {
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

// 移除过期的活动（eDate 在当前日期之前）
function removeExpiredActivities(gameData) {
  if (!Array.isArray(gameData)) return gameData;

  const today = dayjs();

  return gameData
    .map((game) => {
      if (!game.rewards) return game;

      return {
        ...game,
        rewards: game.rewards
          .map((reward) => {
            if (!reward.activityRequirements) return reward;

            return {
              ...reward,
              activityRequirements: reward.activityRequirements.filter((activity) => {
                // 检查 eDate 或 etime
                const dateString = activity.eDate || (activity.etime ? formatDate(activity.etime * 1000) : null);
                if (!dateString) return true; // 没有结束时间，保留

                try {
                  // 使用day.js处理日期格式 YYYY-MM-DD 或 YYYY/M/D
                  const activityDate = dayjs(dateString);

                  // 如果日期格式无效，保留活动
                  if (!activityDate.isValid()) {
                    console.warn(`Failed to parse date: ${dateString}`);
                    return true;
                  }

                  // 使用 isAfter 判断：eDate > 今天 则保留，否则过滤掉
                  return activityDate.isAfter(today, 'day');
                } catch (e) {
                  console.warn(`Failed to parse date: ${dateString}`);
                  return true; // 解析失败时保留活动
                }
              })
            };
          })
          .filter((reward) => {
            // 保留所有平台，即使活动为空
            return true;
          })
      };
    })
    .filter((game) => game.rewards && game.rewards.length > 0); // 移除没有任何平台的游戏
}

module.exports = {
  formatDate,
  getJsonData,
  formatSecondTimestamp,
  getDaysDiff,
  concurrentFetchWithDelay,
  calculateTotalMoney,
  writeLocalDataJson,
  getRandomMusicName,
  removeExpiredActivities
};
