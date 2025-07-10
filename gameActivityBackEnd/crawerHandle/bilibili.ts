import fs from 'fs';
import path from 'path';
import { concurrentFetchWithDelay } from '../commonFunction.js';

// 定义类型接口
interface BilibiliAccount {
    id: string;
    accountName: string;
}

interface AccountList {
    bilibili: BilibiliAccount[];
    [key: string]: any;
}

interface VideoItem {
    title: string;
    bvid: string;
    description: string;
    created: number;
    play: number;
}


// 读取 accountList.json 文件
const accountListPath = path.join(__dirname, '../jsonFile', 'accountList.json');
const accountList = JSON.parse(fs.readFileSync(accountListPath, 'utf8')) as AccountList;

// 循环查询每个账号的数据
async function querybilibiliAllAccountsData() {
    const promises = accountList.bilibili.map((account: BilibiliAccount) => {
        const userId = account.id;
        const limit = 60;
        const url = `http://127.0.0.1:8080/bilibili/user?id=${userId}&limit=${limit}&accountName=${account.accountName}`;

        return () => fetch(url)
            .then(response => response.json())
            .then((res: any) => {
                const workDetails = res.data;
                return { ...workDetails, userName: account.accountName };
            });
    });

    const data = await concurrentFetchWithDelay(promises, 1000, 3000, 1); // 延迟 1-3 秒
    const handleData = data.map(item => ({
        user: {
            name: item.userName
        },
        aweme_list: item.videos.list.map((e: VideoItem) => ({
            title: e.title,
            aweme_id: e.bvid,
            desc: e.description,
            create_time: e.created,
            view: e.play,
        }))
    }));

    return handleData;
}

// 使用 CommonJS 导出以兼容现有的 JS 文件
// @ts-ignore - 忽略 TypeScript 对 module.exports 的警告
module.exports = {
    querybilibiliAllAccountsData
};

// 同时也提供 ES Module 导出，以便将来迁移
export { querybilibiliAllAccountsData };