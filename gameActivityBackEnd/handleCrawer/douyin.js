const fs = require('fs');
const path = require('path');
const { concurrentFetchWithDelay } = require('../commonFunction.js');

// 读取 accountList.json 文件
const accountListPath = path.join(__dirname, '../jsonFile', 'accountList.json');
const accountList = JSON.parse(fs.readFileSync(accountListPath, 'utf8'));

// 循环查询每个账号的数据
async function queryDouYinAllAccountsData() {
    const promises = accountList.douyin.map(account => {
        const userId = account.id; // 假设 account 对象中有 id 字段
        const limit = 36;
        const url = `http://127.0.0.1:8080/douyin/user?id=${userId}&limit=${limit}&accountName=${account.accountName}`;

        return () => fetch(url).then(response => response.json()).then(res => {
            const workDetails = res.data;
            return workDetails
        });
    })



    let data = await concurrentFetchWithDelay(promises, 1000, 3000, 1); // 延迟 1-3 秒
    let handleData = data.map((item, index) => ({
        user: {
            name: item?.user?.nickname || item.aweme_list?.[0]?.author.nickname,
            aweme_count: item.user.aweme_count,
            follower_count: item.user.follower_count
        },
        aweme_list: item.aweme_list.map(e => ({
            title: e.title,
            aweme_id: e.aweme_id,
            desc: e.desc,
            create_time: e.create_time,
            // statistics: e.statistics,
            view: e.statistics.play_count,
            like: e.statistics.digg_count,
            // musicId: e.music.id
        }))
    }))
    return handleData
}

// 账号失活 自动更新Cookie






module.exports = {
    queryDouYinAllAccountsData
}   