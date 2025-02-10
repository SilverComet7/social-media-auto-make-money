const fs = require("fs");

// 格式化 YYYY-MM-DD 为秒级时间戳

function formatSecondTimestamp(dateString, unit) {
  const date = new Date(dateString);
  if (unit === 'second') {
      return Math.floor(date.getTime() / 1000);
  }
  return date.getTime();
}

// 计算天数差
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

function getOldData(jsonPath = "./data.json") {
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

async function concurrentFetchWithDelay(
  promises,
  minDelay = 100,
  maxDelay = 500,
  limitNum = 5
) {
  const pLimit = (await import("p-limit")).default;
  const limit = pLimit(limitNum); // 假设我们限制并发为1，可以根据需要调整

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

// 计算能简单瓜分到的钱
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

module.exports = {
  formatDate,
  getOldData,
  formatSecondTimestamp,
  getDaysDiff,
  concurrentFetchWithDelay,
  calculateTotalMoney,
};
