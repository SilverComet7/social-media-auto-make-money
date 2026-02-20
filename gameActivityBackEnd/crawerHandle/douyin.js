const { queryPlatformData, readCrawlerData } = require('./mediaCrawlerHelper');

function transformDouyinData(crawlerData) {
    if (!Array.isArray(crawlerData)) {
        throw new Error('爬虫数据格式错误，应为数组');
    }

    const userMap = new Map();
    crawlerData.forEach(note => {
        const userId = note.user_id || (note.aweme_list && note.aweme_list[0]?.author?.uid) || note.nickname;
        if (!userMap.has(userId)) {
            userMap.set(userId, {
                user: { name: note.user?.nickname || note.aweme_list?.[0]?.author?.nickname || '' },
                aweme_list: []
            });
        }
        const user = userMap.get(userId);
        // if crawlerData already has aweme_list shape we can reuse, else adapt
        if (note.aweme_list && Array.isArray(note.aweme_list)) {
            note.aweme_list.forEach(e => {
                user.aweme_list.push({
                    title: e.title,
                    aweme_id: e.aweme_id,
                    desc: e.desc,
                    create_time: e.create_time,
                    view: e.statistics?.play_count || e.view || 0,
                    like: e.statistics?.digg_count || e.like || 0,
                });
            });
        }
    });

    return Array.from(userMap.values());
}

async function queryDouYinAllAccountsData(platformDir) {
    return queryPlatformData('douyin', transformDouyinData, platformDir);
}

module.exports = {
    queryDouYinAllAccountsData
};

