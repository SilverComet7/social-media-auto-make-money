const fs = require('fs');
const path = require('path');
const { concurrentFetchWithDelay } = require('../commonFunction.js');

// 读取 accountList.json 文件
const accountListPath = path.join(__dirname, '../jsonFile', 'accountList.json');
const accountList = JSON.parse(fs.readFileSync(accountListPath, 'utf8'));

// 循环查询每个账号的数据
async function queryXiaoHongShuAllAccountsData() {
    const promises = accountList.xhs.map(account => {
        const userId = account.id; // 假设 account 对象中有 id 字段
        const limit = 20;
        const url = `http://127.0.0.1:8080/xhs/user?id=${userId}&limit=${limit}&accountName=${account.accountName}`;

        return () => fetch(url).then(response => response.json()).then(res => {
            const workDetails = res.data;

            // 根据笔记id 获取笔记详情 发布时间
            return { ...workDetails, userName: account.accountName }
        });
    })



    let data = await concurrentFetchWithDelay(promises, 1000, 3000, 1); // 延迟 1-3 秒
    let handleData = data.map((item, index) => ({
        user: {
            name: item.userName
        },
        aweme_list: item.user.notes.map(e => ({
            aweme_id: e.note_id,
            desc: e.display_title,
            type: e.type,
            // view: e.statistics.play_count,
            like: Number(e.interact_info.liked_count),
        }))
    }))
    return handleData
}

// 账号失活 自动更新Cookie






module.exports = {
    queryXiaoHongShuAllAccountsData
}   