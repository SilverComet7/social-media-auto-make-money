// 例举account_urls 可能没包含的相应的game攻略，不会分类

const specialTypeList = ['coser同行', 'coser本人', '搞笑', '可爱赛道']
const gameList = [
     // TODO 后续按厂商分类 按类型分类
    // 米哈游
    "崩坏星穹铁道", "绝区零", "原神", "少女前线2", "无期迷途", "剑与远征启程", "QQ飞车", "决战平安京", "二重螺旋", "解限机", "守望先锋", "怪物猎人", "LPL", "KPL", "双影奇境", "双点博物馆",
    // 网易
    "永劫无间手游", "永劫无间", "漫威争锋", "鸣潮", "明日方舟", "蛋仔派对", "第五人格", "如鸢",
    // 腾讯
    "界外狂潮", "新月同行", "英雄联盟手游", "英雄联盟", "王者荣耀", "逆水寒手游", "逆水寒", "DNF", "航海王壮志雄心", "龙之谷世界", "龙之谷", "三国谋定天下",
    "光遇", "燕云", "心动小镇", "阴阳师", "火影忍者", "金铲铲之战",
    "以闪亮之名", "归龙潮","最终幻想",
    "宝可梦大集结",
    "碧蓝档案",
    "诛仙世界", "尘白禁区", "三角洲行动", "暗区", "恋与深空", "荒野乱斗", "星际战甲1999", "CF手游", "时空中的绘旅人",
    "和平精英",

    // MMO
    "剑网3","倩女幽魂","暗黑",
     "物华弥新",
    "战双帕弥什", "使命召唤手游", "幻塔", "穿越火线", "一梦江湖", "恋与制作人","炉石传说","卡拉彼丘","codm",
    // 其它厂商
    "碧蓝航线", "无限暖暖", "闪耀暖暖", "无尽梦回", "天龙八部", "重返未来", "崩坏3", "无畏契约", "魔兽世界",
    "七日世界","潮汐守望者"
]

const allGameList = [
    ...specialTypeList,
    "游戏综合",
    ...gameList
]



const isVideoFile = ['.mp4', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.webm', '.mpg', '.mpeg', '.m4v', '.3gp', '.3g2', '.m3u8']
const PROJECT_ROOT = "D:\\code\\platform_game_activity\\";
const TikTokDownloader_ROOT = "D:\\code\\platform_game_activity\\TikTokDownloader\\";

module.exports = {
    gameList,
    allGameList,
    PROJECT_ROOT,
    TikTokDownloader_ROOT,
    specialGameList: specialTypeList
}

// 赛道
// 该分组的博主
// 通用tag
// 通用title库
// 通用奖励


// 文件
// 多平台
// 多账号
