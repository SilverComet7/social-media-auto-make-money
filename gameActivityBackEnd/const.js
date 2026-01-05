
const path = require("path");
const specialTypeList = ['coser同行', 'coser本人', '搞笑', '可爱赛道', '游戏综合', "游戏拉新"]
// 1. 特殊节假日
// 2. 周年庆
// 3. 本身运营的非常好的，非常赚钱的游戏
// 4. 新游戏
const gameList = [
    // TODO 后续按厂商分类 按类型分类
    // 米哈游
    "怪物猎人", "LPL", "KPL", "双影奇境", "双点博物馆", "命运方舟", "星痕共鸣",
    'PUBG',
    '命运', '战意', "斗罗大陆", "洛克王国",
    // 网易
    // "永劫无间手游",
    "永劫无间", "漫威争锋", "鸣潮", "明日方舟", "蛋仔", "第五人格", "如鸢",
    // 腾讯
    "界外狂潮", "新月同行", "英雄联盟", "王者荣耀",
    // "逆水寒手游", 
    "逆水寒", "DNF", "航海王壮志雄心", "龙之谷",
    "光遇",
    // "燕云十六声", 
    "燕云", "心动小镇", "阴阳师", "火影忍者", "金铲铲", "胜利女神", "明日之后",
    "以闪亮之名", "归龙潮", "最终幻想",
    "宝可梦大集结",
    "碧蓝档案",
    "诛仙世界", "尘白禁区", "三角洲", '光与夜之恋',
    // "暗区突围无限", "暗区突围",
    "恋与深空", "荒野乱斗", "星际战甲", "时空中的绘旅人",
    '未定事件簿', '狼人杀', "命运", '云顶之弈', "战地风云", "英勇之地",

    "炫舞", "飞车",
    // MMO
    "剑网", "倩女", "射雕",
    // 二次元
    "崩坏星穹铁道", "绝区零", "原神",
    "少女前线2", "无期迷途", "剑与远征启程", "决战平安京", "二重螺旋", "杖剑传说",
    // fps
    "萤火突击", "解限机", "守望先锋", 'CODM', "CS", "CF", "和平精英", '头号追击', "远光84", "暗区",
    // 乙游，换装

    // 竞速

    // 其它
    "英雄杀",
    "三国",

    "终极角逐",
    "暗黑",
    "银与绯",
    "物华弥新",
    "战双帕弥什", "使命召唤", "幻塔", "穿越火线", "一梦江湖", "恋与制作人", "炉石传说", "卡拉彼丘",
    // 其它厂商
    "碧蓝航线", "碧蓝", "晴空之下", "无限暖暖", "闪耀暖暖", "无尽梦回", "天龙八部", "重返未来", "崩坏3", "无畏契约", "魔兽世界",
    "七日世界", "潮汐守望者", "梦幻西游",
    "异环", "异人", "影之诗", "彩虹六号",
]

const allGameList = [
    ...specialTypeList,
    ...gameList
]



const isVideoFile = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm', '.mpg', '.mpeg', '.m4v', '.3gp', '.3g2', '.m3u8']
const PROJECT_ROOT = "D:\\code\\platform_game_activity\\";
const TikTokDownloader_ROOT = "D:\\code\\platform_game_activity\\TikTokDownloader\\";


const platformConfig = {
    bilibili: {
        configPath: "scheduleJob/BiliBiliScheduleJob.json",
        uploaderPath: path.join(PROJECT_ROOT, "social-auto-upload\\uploader\\bilibili_uploader\\biliup.exe"),
        accountType: "bilibili"
    },
    '抖音': {
        configPath: "scheduleJob/DouyinScheduleJob.json",
        uploaderPath: path.join(PROJECT_ROOT, "social-auto-upload"),
        accountType: "douyin"
    },
    '小红书': {
        configPath: "scheduleJob/XhsScheduleJob.json",
        uploaderPath: path.join(PROJECT_ROOT, "social-auto-upload"),
        accountType: "xhs"
    }
};

// todo docker 内的网络
const requestHost = "http://127.0.0.1:8080"


module.exports = {
    gameList,
    allGameList,
    PROJECT_ROOT,
    TikTokDownloader_ROOT,
    specialGameList: specialTypeList,
    isVideoFile,
    platformConfig,
    requestHost
}

// 赛道
// 该分组的博主
// 通用tag
// 通用title库
// 通用奖励
// 文件
// 多平台
// 多账号
