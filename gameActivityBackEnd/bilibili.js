const fs = require('fs');
const path = require('path');
const { concurrentFetchWithDelay } = require('./commonFunction.js');

// 读取 accountList.json 文件
const accountListPath = path.join(__dirname, 'jsonFile', 'accountList.json');
const accountList = JSON.parse(fs.readFileSync(accountListPath, 'utf8'));

// 循环查询每个账号的数据
async function querybilibiliAllAccountsData() {
    const promises = accountList.bilibili.map(account => {
        const userId = account.id; // 假设 account 对象中有 id 字段
        const limit = 30;
        const url = `http://127.0.0.1:8080/bilibili/user?id=${userId}&limit=${limit}&accountName=${account.accountName}`;

        return () => fetch(url).then(response => response.json()).then(res => {
            const workDetails = res.data;
            return { ...workDetails, userName: account.accountName }
        });
    })



    let data = await concurrentFetchWithDelay(promises, 1000, 3000, 1); // 延迟 1-3 秒
    console.log("🚀 ~ querybilibiliAllAccountsData ~ data:", data)
    let handleData = data.map((item, index) => ({
        user: {
            name: item.userName
        },
        aweme_list: item.videos.list.map(e => ({
            title: e.title,
            aweme_id: e.bvid,
            desc: e.description,
            create_time: e.created,
            view: e.play,
            // like: e.statistics.digg_count,
            // musicId: e.music.id
        }))
    }))
    return handleData
}

// 账号失活 自动更新Cookie

module.exports = {
    querybilibiliAllAccountsData
}   