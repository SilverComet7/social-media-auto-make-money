import { queryPlatformData } from './mediaCrawlerHelper.js';

interface BiliNote {
    video_id: string;
    title: string;
    desc: string;
    create_time: number;
    video_play_count: string | number;
    liked_count: string | number;
    user_id: string;
    nickname: string;
}

function transformBiliData(crawlerData: any[]): any[] {
    if (!Array.isArray(crawlerData)) {
        throw new Error('爬虫数据格式错误，应为数组');
    }

    const userMap = new Map<string, any>();

    crawlerData.forEach((note: BiliNote) => {
        const userId = note.user_id || note.nickname;
        if (!userMap.has(userId)) {
            userMap.set(userId, { user: { name: note.nickname || '' }, aweme_list: [] });
        }
        const user = userMap.get(userId);
        user.aweme_list.push({
            title: note.title,
            aweme_id: note.video_id,
            desc: note.desc,
            create_time: note.create_time,
            view: Number(note.video_play_count) || 0,
            like: Number(note.liked_count) || 0,
        });
    });

    return Array.from(userMap.values());
}

async function querybilibiliAllAccountsData(platformDir?: string) {
    return queryPlatformData('bili', transformBiliData, platformDir);
}

// commonjs export for compatibility
// @ts-ignore
module.exports = { querybilibiliAllAccountsData };

// also export ES modules
export { querybilibiliAllAccountsData };
