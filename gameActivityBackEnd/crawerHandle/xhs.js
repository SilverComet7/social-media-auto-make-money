const { queryPlatformData, readCrawlerData } = require('./mediaCrawlerHelper');

/**
 * 小红书数据转换逻辑，将MediaCrawler输出的原始数组转换成后端通用格式
 * @param {Array} crawlerData
 */
function transformXhsData(crawlerData) {
    if (!Array.isArray(crawlerData)) {
        throw new Error('爬虫数据格式错误，应为数组');
    }

    const userMap = new Map();

    crawlerData.forEach((note) => {
        const userId = note.user_id || note.nickname;
        if (!userMap.has(userId)) {
            userMap.set(userId, { user: { name: note.nickname || '' }, aweme_list: [] });
        }
        const user = userMap.get(userId);
        user.aweme_list.push({
            aweme_id: note.note_id,
            desc: note.desc || '',
            title: note.title || '',
            type: note.type === 'normal' ? 'image' : 'video',
            like: Number(note.liked_count) || 0,
            collected_count: Number(note.collected_count) || 0,
            comment_count: Number(note.comment_count) || 0,
            share_count: Number(note.share_count) || 0,
            tag_list: note.tag_list || '',
        });
    });

    return Array.from(userMap.values());
}

async function queryXiaoHongShuAllAccountsData(platformDir) {
    return queryPlatformData('xhs', transformXhsData, platformDir);
}

async function readXiaoHongShuData(platformDir) {
    const crawlerData = await readCrawlerData('xhs', platformDir);
    return transformXhsData(crawlerData);
}

module.exports = {
    queryXiaoHongShuAllAccountsData,
    readXiaoHongShuData,
};
