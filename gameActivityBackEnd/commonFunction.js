

// import pLimit from 'p-limit';
// // 设置并发限制
// const limit = pLimit(10);


// 格式化成为 YYYY-MM-DD 的字符串
const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000)
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
}


// 格式化 YYYY-MM-DD 为秒级时间戳
const formatSecondTimestamp = (timestamp) => {
    return new Date(timestamp).getTime() / 1000
}

// 计算天数差
const getDaysDiff = (timeStamp1, timeStamp2) => {
    const diffTime = timeStamp1 - timeStamp2;
    const endDiffDate = diffTime / (1000 * 60 * 60 * 24);
    return Math.ceil(endDiffDate);
}


/* 
// 延迟函数，带有随机间隔
function delayWithRandomInterval(minDelay = 100, maxDelay = 500) {
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    return new Promise(resolve => setTimeout(resolve, delay));
}

// 封装 Promise.all 以包含随机延迟
export async function concurrentFetchWithDelay(promises, minDelay, maxDelay) {
    return Promise.all(promises.map(promise => {
        return limit(async () => {
            await delayWithRandomInterval(minDelay, maxDelay); // 延迟 1-3 秒
            return promise();
        });
    }));
}
 */



async function concurrentFetchWithDelay(promises, minDelay = 100, maxDelay = 500, limitNum = 5) {
    const pLimit = (await import('p-limit')).default;
    const limit = pLimit(limitNum); // 假设我们限制并发为1，可以根据需要调整

    const limitedPromises = promises.map(promiseFactory => limit(async () => {
        if (typeof promiseFactory !== 'function') {
            throw new TypeError('Each element in the promises array must be a function that returns a Promise.');
        }
        const result = await promiseFactory();
        await new Promise(resolve => setTimeout(resolve, Math.random() * (maxDelay - minDelay) + minDelay));
        return result;
    }));

    return Promise.all(limitedPromises);
}




// 计算能简单瓜分到的钱
function calculateTotalMoney(gameData) {
    let totalMoney = 0;

    if (!gameData?.rewards) return 0
    for (const reward of gameData.rewards) {
        if (!reward?.specialTagRequirements) continue;
        for (const requirement of reward.specialTagRequirements) {
            if (reward.minView >= 5000) continue  // 单稿最低播放大于5000 不参与计算
            for (const rewardItem of requirement.reward) {
                if (rewardItem.allViewNum >= 50000) continue // 总播放大于50000 不参与计算  
                if (rewardItem.view >= 10000) continue  // 爆款将：单稿播放大于10000 不参与计算
                if (rewardItem.like > 500) continue // 点赞大于500 不参与计算
                totalMoney += rewardItem.money;
            }
        }
    }

    return totalMoney;
}


module.exports = {
    formatDate,
    formatSecondTimestamp,
    getDaysDiff,
    concurrentFetchWithDelay,
    calculateTotalMoney
}