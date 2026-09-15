
const path = require("path");
const specialTypeList = ['coser同行', 'coser本人', '搞笑', '可爱赛道', '游戏综合', "游戏拉新"]

enum gameDeveloper {
    米哈游 = "米哈游",
    网易 = "网易",
    腾讯 = "腾讯",
    其它 = "其它"
}

enum GameType {
    FPS = "FPS",
    MMO = "MMO",
    二次元 = "二次元",
    其它 = "其它"
}

interface GameInfo {
    gameName: string;      // 1. 游戏名 IP游戏名
    ipGames?: GameInfo[];      // 2. IP衍生的游戏 
    subscribeList?: string[];      // 3. 博主
    douyinSubscribe?: number;      // 4. 抖音订阅人数
    gameDeveloper?: gameDeveloper;      // 7. 厂商
    gameType?: GameType;      // 8. 游戏类型
    audience?: { age: string; gender: string };      // 9. 受众人群(年龄+性别)
    gameTag?: string[];      // 10. 游戏标签
    wyczjTag?: string[];      // 11. 网易创作匠标签
}



const gameList = [


    "怪物猎人", "LPL", "KPL",
    "星痕共鸣", 'PUBG',
    "斗罗大陆",

    // 网易
    "永劫", "漫威争锋", "无限大", "雾海之下",
    "界外狂潮",

    // 二游厂商
    "鸣潮", "明日方舟", "碧蓝档案",

    // 腾讯
    "英雄联盟", "王者", "王者万象棋", "DNF", "航海王壮志雄心", "龙之谷", "命运方舟", "洛克王国",

    "失控进化",
    "三角洲", '光与夜之恋',
    "恋与深空", "星际战甲", "时空中的绘旅人",
    '未定事件簿', '狼人杀', "命运", '云顶之弈', "战地风云", "英勇之地",
    "炫舞", "飞车", "卡厄思梦境", "APEX", "梦境护卫队", "红色沙漠", "战争警戒",

    // A股厂商
    "诛仙世界", "尘白禁区",


    // --------年轻男性
    "星穹铁道", "绝区零", "原神",
    "伊莫", "碧蓝航线", "胜利女神", "明日之后", "最终幻想", "火影忍者",
    "少女前线", "剑与远征启程", "二重螺旋",
    "萤火突击", "解限机", "CS", "CF", "穿越火线",
    "和平精英", "PEL", '头号追击', "远光84", "暗区", "瓦",

    // --------老登男性
    // SLG + MMO + 修仙
    "诡秘之主",
    "英雄杀", "三国",
    "杖剑传说",
    "宗师之上",
    "一梦江湖",
    "七日世界", "梦幻西游", "剑网", "倩女", "天下",
    "FF14", "流放", "魔兽世界",
    // -------- 年轻女性
    "夜幕", "晴空之下", "无限暖暖", "闪耀暖暖", "奇迹暖暖",
    "无期迷途", "蛋仔", "元梦", "第五人格", "如鸢",
    "逆水寒", "光遇", "燕云", "心动小镇", "阴阳师", "金铲铲",
    "以闪亮之名", "决战平安京",
    // -------- 小孩

    // 西方
    "潮汐守望者",


    "星布谷地",
    "极限竞速",
    "银与绯",
    "物华弥新",
    "战双帕弥什", "使命召唤", "幻塔", "恋与制作人", "炉石传说", "卡拉彼丘",
    "无尽梦回", "天龙八部",
    "重返未来", "崩坏", "无畏契约",


    "异环",
    "异人", "影之诗", "彩虹六号",
    "超自然",
    "织梦森林", '街球艺术', "奇蛋生物", "漫画群星",
    
    "逆战", "遗忘之海", "鹅鸭杀",
    "旅人",
    "星绘有晴天", "我的休闲时光",
    "永恒大陆",
    "蓝色星原",
    "归环"
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
    // gameList,
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
