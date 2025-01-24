const fs = require('fs');
const express = require('express');
const cors = require('cors');
const app = express();
const port = 3000;

const { concurrentFetchWithDelay, formatSecondTimestamp, calculateTotalMoney } = require('./commonFunction.js');
const { queryDouYinAllAccountsData } = require('./douyin.js');
const { queryXiaoHongShuAllAccountsData } = require('./xhs.js');
const { querybilibiliAllAccountsData } = require('./bilibili.js');
const { ffmpegHandleVideos } = require('../TikTokDownloader/videoReName_FFmpegHandle_douyin_bilibili_async.js')
const { downloadVideosAndGroup } = require('../TikTokDownloader/videoDownloadAndGroupList.js')
const { allGameList } = require('../baseAvg.js');


// 格式化成为 YYYY-MM-DD-HH 的字符串
const formatDate = (timestamp = (new Date().getTime())) => {
    const date = new Date(timestamp)
    return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate()
}

function getOldData(jsonPath = './data.json') {
    const data = fs.readFileSync(jsonPath);
    let oldDataArr = JSON.parse(data);
    // 将new 字段设置为false
    if (Array.isArray(oldDataArr)) {
        oldDataArr = oldDataArr.map(item => ({
            ...item,
            // new: false,
            // updateData: false,
        }));
    }
    return oldDataArr;
}

const accountJson = getOldData('./jsonFile/accountList.json');

app.use(cors());
app.use(express.json());

const Cookie = accountJson.bilibili[0].Cookie || `_uuid=DCB4B48C-46CC-6F1F-ED51-8152E8E101210B71254infoc; buvid3=9F62B9DD-33A9-6EC7-B838-6B3E180B154D72386infoc; b_nut=1730444972; enable_web_push=DISABLE; header_theme_version=CLOSE; rpdid=|(u|u))kR)u~0J'u~J|RlY~~k; LIVE_BUVID=AUTO7617304600468294; buvid_fp_plain=undefined; buvid4=8004C396-1E33-8C47-8AF8-D095CCBBF99B72541-024110107-nifL5evEKW7y%2B%2FaLdI%2FWoQ%3D%3D; deviceFingerprint=bbcff4d201222c7527e097b38162802a; hit-dyn-v2=1; go-back-dyn=0; is-2022-channel=1; match_float_version=ENABLE; bmg_af_switch=1; bmg_src_def_domain=i1.hdslb.com; opus-goback=1; DedeUserID=64684387; DedeUserID__ckMd5=37df564f28a09f19; bsource_origin=other_widgetUP_bilibili_recommendcard; fingerprint=2126a416c7a6aa6e7bcdd0868c50721f; CURRENT_QUALITY=80; msource=pc_web; home_feed_column=5; browser_resolution=1661-930; bili_ticket=eyJhbGciOiJIUzI1NiIsImtpZCI6InMwMyIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3MzY5NDk0NjAsImlhdCI6MTczNjY5MDIwMCwicGx0IjotMX0.5O5V-B0jLimTxZpDUlG-EMohH1X_wZay-ozEPbFmwqA; bili_ticket_expires=1736949400; SESSDATA=db5cf7a3%2C1752242266%2C2f2d0%2A12CjBIE_kOLzvU8QjZRWS4Mp5rha6vmNDQspSdutj2w2q5cI0Ydz8J_4aic3ZMMsHGGg4SVjFTRERSQTRLYl9LRHdEOTBKVHdzNXUyMlQ2UEQzU24tQlZqUVg0ek5JWnZiS0dfVm5FOGZaYTJpdmRoa3hBVUhyUDlaZFhKSl9FX3FjTlNCd1l5VXRRIIEC; bili_jct=8bfe601af9073e968fe9345a9d1ab72c; sid=8bs92re3; buvid_fp=2126a416c7a6aa6e7bcdd0868c50721f; share_source_origin=QQ; bsource=share_source_qqchat; bp_t_offset_64684387=1021651554396012544; CURRENT_FNVAL=2000; PVID=11; b_lsid=10A3F1081D_19460521E52`
const csrfToken = Cookie.split('; ').find(cookie => cookie.startsWith('bili_jct=')).split('=')[1];
const headers = {
    "accept": "application/json, text/javascript, */*; q=0.01",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "referer": "https://member.bilibili.com/",
    "Cookie": Cookie,
}



async function writeLocalDataJson(arr, fileName = 'data.json') {
    // 保存一下旧数据
    // const oldArr = await getOldData(fileName)
    // fs.writeFileSync(`./jsonFile/old_${fileName}`, JSON.stringify(oldArr, null, 2))

    // 写入新数据
    const data = JSON.stringify(arr, null, 2);
    fs.writeFileSync(fileName, data);
}


async function get_BiliBili_Data(i, account = accountJson.bilibili[0]) {
    const keyword = i.searchKeyWord || "逆水寒"
    const fetchUrl = `https://member.bilibili.com/x/web/archives?status=is_pubing%2Cpubed%2Cnot_pubed&pn=1&ps=30&keyword=${keyword}&coop=1&interactive=1`
    // 计算数据
    const bilibili = {
        "allNum": 0,
        "allViewNum": 0,
        "onePlayNumList": [

        ]
    }

    await fetch(fetchUrl, {
        headers: {
            ...headers,
            // "Cookie": account.Cookie
        }
    }).then(async response => {
        const data = await response.json();
        if (!data?.data?.arc_audits) {
            return
        }
        // 按时间过滤出活动稿件
        const list = data.data.arc_audits.filter(item => item.Archive.ctime > i.stime && item.Archive.ctime < i.etime).map(item => ({
            view: item.stat.view,
            like: item.stat.like,
            reply: item.stat.reply,
            title: item.Archive.title,
            bvid: item.Archive.bvid,
            ctime: item.Archive.ctime,
            ptime: item.Archive.ptime,
        })).sort((a, b) => b.view - a.view)

        bilibili.allNum = list.length
        bilibili.onePlayNumList = list

        list.forEach(element => {
            bilibili.allViewNum += element.view
        });
    })

    return bilibili
}

app.get('/getNewActData', async (req, res) => {
    try {
        // 获取活动数据，游戏任务转到otherGameData.json里
        async function getActivitiesList() {
            let oldDataArr = getOldData();
            const fetchUrl = `https://member.bilibili.com/x/web/activity/videoall`
            const response = await fetch(fetchUrl, {
                headers
            })
            let newActList = await response.json();
            if (!newActList?.data) return newActList
            newActList = newActList.data.map(e => ({
                ...e, addTime: `${new Date().getFullYear()}年${new Date().getMonth() + 1}月${new Date().getDate()}添加`,
            }))
            const list = newActList.filter(item => {
                return !allGameList.some(gameName => item.name.includes(gameName))
                //  && oldDataArr.every(item2 => item.name !== item2.name)
            }).
                map(item => {
                    const oldDataHasThisRewardsItem = oldDataArr.find(item2 => item.name === item2.name)
                    return {

                        // type: item.type,
                        // new: true,

                        ...(oldDataHasThisRewardsItem ? {
                            // searchKeyWord: oldDataHasThisRewardsItem.searchKeyWord,
                            // baseTopic: oldDataHasThisRewardsItem.baseTopic,
                            // specialTagAll: oldDataHasThisRewardsItem.specialTagAll,
                            // rewards: oldDataHasThisRewardsItem.rewards,
                            // bilibili: oldDataHasThisRewardsItem.bilibili,
                            // lastJudgeTime: oldDataHasThisRewardsItem.lastJudgeTime,
                            ...oldDataHasThisRewardsItem
                        } : {
                            name: item.name,
                            stime: item.stime,
                            etime: item.etime,
                            act_url: item.act_url,
                            cover: item.cover,
                            comment: item.comment,
                            protocol: item.protocol,
                        })
                    }
                }
                )


            let oldOtherDataArr = getOldData('./otherGameData.json');
            newActList.filter(item => {
                return allGameList.some(gameName => item.name.includes(gameName))
            }).map(item => {

                const gameName = allGameList.find(gameName => item.name.includes(gameName))
                // const oldDataHasThisRewardsItem = oldDataArr.find(item2 => item2.name.includes(gameName))

                const biliGameActObj = {
                    name: item.name,
                    act_url: item.act_url,
                    comment: item.comment,
                    sDate: formatDate(item.stime * 1000) || "2023/1/11",
                    eDate: formatDate(item.etime * 1000) || "2025/1/11",
                    specialTag: '#' + item.name,
                    // searchKeyWord: item.name,
                    reward: [

                    ]
                }
                // 不存在该游戏分类
                if (!oldOtherDataArr.some(item2 => item2.name === gameName)) {
                    oldOtherDataArr.push({
                        name: gameName,
                        rewards: [
                            {
                                name: "bilibili",
                                specialTagRequirements: [
                                    biliGameActObj
                                ]
                            },

                        ]
                    })
                } else {
                    // 3. 如果otherGameData.json中已经收录该游戏活动，则将该游戏活动收录到对应gameName下的rewards的下name为bilibili下的specialTagRequirements中细分活动中

                    const gameBilibiliRewards = oldOtherDataArr.find(item2 => item2.name === gameName)?.rewards?.find(item2 => item2.name === "bilibili")
                    if (!gameBilibiliRewards) {
                        oldOtherDataArr.find(item2 => item2.name === gameName).rewards.unshift({
                            name: "bilibili",
                            specialTagRequirements: [
                                biliGameActObj
                            ]
                        })
                    } else {
                        const bilibiliHasThisSpecialAct = gameBilibiliRewards?.specialTagRequirements.some(item2 => item2.name === item.name)
                        if (bilibiliHasThisSpecialAct === false) {
                            gameBilibiliRewards?.specialTagRequirements.push(biliGameActObj)
                        } else {
                            console.log(`${item.name}已存在`);
                        }
                    }
                }
            }
            )

            // // 计算每个活动奖励是否达标,优化按顺序查询，避免被风控
            // Promise.all(
            //     oldDataArr.map(async item => {
            //         // 有获奖档位设置  且  距离上一次评测时间不小于一天
            //         if (item.rewards) {
            //             if (item?.lastJudgeTime) {
            //                 if ((new Date().getTime() - item.lastJudgeTime) < 86400000) return
            //             }
            //             const bilibili = await get_BiliBili_Data(item)
            //             item.rewards.forEach(i => {
            //                 i.requirements = i.requirements.map(i2 => {
            //                     let isGet = false;
            //                     if (i2.allNum) i2.allNum <= bilibili.allNum ? isGet = true : isGet = false
            //                     if (i2.allViewNum) i2.allViewNum <= bilibili.allViewNum ? isGet = true : isGet = false
            //                     if (i2.view) bilibili.onePlayNumList.some(i3 => i3.view >= i2.view) ? isGet = true : isGet = false
            //                     return {
            //                         ...i2,
            //                         isGet
            //                     }
            //                 })
            //             })
            //             item['bilibili'] = bilibili
            //             item['lastJudgeTime'] = new Date().getTime()
            //             item["updateData"] = true
            //             item["updateDate"] = formatDateHour(new Date())
            //             return item
            //         }
            //     })).then((res) => {
            //     })



            writeLocalDataJson(list);
            writeLocalDataJson(oldOtherDataArr, './otherGameData.json');

            return newActList
        }
        const data = await getActivitiesList();
        res.json(data);
    } catch (error) {
        console.error("Error in /data endpoint:", error);
        res.json({

            msg: error
        });
        // res.status(500).send("Internal Server Error");
    }
});


app.post('/updateReward', async (req, res) => {
    try {
        const { name, specialTagRequirements } = req.body;

        // 读取现有的 otherGameData.json 文件
        let oldOtherDataArr = getOldData('./otherGameData.json');

        // 找到对应的游戏
        const gameIndex = oldOtherDataArr.findIndex(item => item.name === name);
        if (gameIndex === -1) {
            return res.status(404).json({ code: -1, msg: '游戏未找到' });
        }

        // 找到对应平台的奖励
        const platformIndex = oldOtherDataArr[gameIndex].rewards.findIndex(item => item.name === specialTagRequirements[0].name);
        if (platformIndex === -1) {
            // 如果平台不存在，则添加新的平台
            oldOtherDataArr[gameIndex].rewards.push({
                name: specialTagRequirements[0].name,
                specialTagRequirements: [specialTagRequirements[0]],
            });
        } else {
            // 如果平台存在，则更新奖励
            oldOtherDataArr[gameIndex].rewards[platformIndex].specialTagRequirements = [specialTagRequirements[0]];
        }

        // 写入本地文件
        writeLocalDataJson(oldOtherDataArr, './otherGameData.json');

        res.json({ code: 0, msg: '奖励更新成功' });
    } catch (error) {
        console.error("Error in /updateReward endpoint:", error);
        res.status(500).send("Internal Server Error");
    }
});



app.post('/addPlatformReward', async (req, res) => {
    try {
        const { platformData } = req.body;

        let { gameName, platformName, isUpdate } = platformData
        delete platformData.isUpdate

        // 读取现有的 otherGameData.json 文件
        let oldOtherDataArr = getOldData('./otherGameData.json');

        // 找到对应的游戏
        const gameIndex = oldOtherDataArr.findIndex(item => item.name === gameName);
        const platformIndex = oldOtherDataArr[gameIndex].rewards.findIndex(item => item.name === platformName);

        delete platformData.gameName
        platformData.name = platformName
        delete platformData.platformName
        // 1. 如果还未有该平台奖励，则直接添加新的平台和对应的活动赛道
        if (platformIndex === -1) {
            oldOtherDataArr[gameIndex].rewards.unshift(platformData)
            console.log("🚀 ~ app.post ~ oldOtherDataArr:", oldOtherDataArr)
        } else {

            // 2. 如果已有该平台的其他活动赛道，则添加新的活动赛道
            // if (!isUpdate) oldOtherDataArr[gameIndex].rewards[platformIndex].specialTagRequirements = platformData.specialTagRequirements.concat(oldOtherDataArr[gameIndex].rewards[platformIndex].specialTagRequirements)
            // else 
            oldOtherDataArr[gameIndex].rewards[platformIndex].specialTagRequirements = platformData.specialTagRequirements
            console.log("🚀 ~ app.post ~ oldOtherDataArr:", oldOtherDataArr)
        }
        

        // 写入本地文件
        writeLocalDataJson(oldOtherDataArr, './otherGameData.json');

        res.json({ code: 0, msg: '奖励更新成功' });
    } catch (error) {
        console.error("Error in /updateReward endpoint:", error);
        res.status(500).send("Internal Server Error");
    }
});




app.post('/downloadVideosAndGroup', async (req, res) => {
    try {
        const { downloadSettings } = req.body;
        await downloadVideosAndGroup(downloadSettings);
        res.json({ code: 0, msg: '视频处理成功' });
    } catch (error) {
        console.error('视频处理失败:', error);
        res.status(500).send('视频处理失败');
    }
});
app.post('/ffmpegHandleVideos', async (req, res) => {
    try {
        const { ffmpegSettings } = req.body;
        await ffmpegHandleVideos(ffmpegSettings);

        res.json({ code: 0, msg: '视频处理成功' });
    } catch (error) {
        console.error('视频处理失败:', error);
        res.status(500).send('视频处理失败');
    }
});



// 更新打卡活动列表
app.get('/getNewDakaData', async (req, res) => {
    try {
        async function getDakaNewData() {
            const url = 'https://member.bilibili.com/x2/creative/h5/clock/v4/activity/list';
            const params = {
                act_type: 0,
                csrf: csrfToken,
                s_locale: 'zh_CN'
            };

            try {
                const response = await fetch(url, { params, headers });
                let dakaData = (await response.json())
                if (dakaData.code === -101) {
                    // 自动去登录B站获取新的Cookie
                    dakaData = JSON.parse(fs.readFileSync('./B站打卡活动.json'));
                    return dakaData
                }
                dakaData = dakaData.data.list.filter(item => item.etime * 1000 > new Date().getTime())

                // 循环 dakaData 中的数据，通过act_id去获取详情  
                const dakaNewData = await concurrentFetchWithDelay(dakaData.map(item => {
                    return () => fetch(`https://member.bilibili.com/x2/creative/h5/clock/v4/act/detail?act_id=${item.act_id}&csrf=${csrfToken}&s_locale=zh_CN`, { headers })
                        .then(response => response.json())
                        .then(res => ({
                            ...item,
                            detail: { ...res.data },
                        }));

                }))
                writeLocalDataJson(dakaNewData, 'B站打卡活动.json');

                return dakaNewData
            } catch (error) {
                console.error('获取打卡数据时出错:', error.message);
                throw error;
            }
        }
        const data = await getDakaNewData();
        res.json(data);
    } catch (error) {
        console.error("Error in /data endpoint:", error);
        res.status(500).send("Internal Server Error");
    }
});




app.get('/data', async (req, res) => {
    try {
        // 每次都实时读取data.json 文件并返回
        const data = getOldData()

        let otherGameData = getOldData('./otherGameData.json')
        // 计算otherGameData rewards下各平台specialTagRequirements里的最近的活动结束时间，并赋值给最外层etime
        otherGameData.forEach(game => {
            let minEtime = game.etime || Number.MAX_SAFE_INTEGER;  // 默认活动最大
            game.rewards.forEach(reward => {
                if (reward.specialTagRequirements) {
                    reward.specialTagRequirements = reward.specialTagRequirements.filter(e => (new Date(e.eDate).getTime() + 24 * 60 * 60 * 60) > new Date().getTime());
                    reward.specialTagRequirements.forEach(requirement => {
                        if (requirement.eDate) {
                            const eTime = (new Date(requirement.eDate).getTime() + 24 * 60 * 60 * 60) / 1000;
                            // 如果结束日期小于当天的etime，则跳过 不计入最近结束日期
                            if (eTime < new Date().getTime() / 1000) return;
                            // 如果结束日期小于minEtime，则更新minEtime
                            if (eTime < minEtime) {
                                minEtime = eTime;
                            }
                        }
                    });
                }
            });
            game.etime = minEtime; // 更新最外层的etime
        });

        // filter(e => e.etime < Number.MAX_SAFE_INTEGER).
        const gameData = otherGameData.sort((a, b) => a.etime - b.etime).
            map(item => {
                return {
                    ...item,
                    allMoney: calculateTotalMoney(item)
                }
            })

        const bilibiliActData = data.filter(item => !item.notDo && !allGameList.some(gameName => item.name.includes(gameName))).sort((a, b) => a.etime - b.etime).
            map(item => {
                return {
                    ...item,
                    allMoney: calculateTotalMoney(item)
                }
            })


        let dakaData = getOldData('./B站打卡活动.json')



        dakaData = dakaData.filter(item => item.stime * 1000 < new Date().getTime()).map(e => ({
            act_id: e.act_id,
            title: e.title,
            icon_state: e.icon_state,
            stime: e.stime,
            etime: e.etime,
            act_tags: e.act_tags,
            detail: {
                rule_text: e.detail.rule_text,
                task_data: e.detail.task_data,
                act_rule: { topic: e.detail.act_rule.topic },
            },
        }))

        res.json({
            gameData,
            bilibiliActData,
            dakaData,
            allGameList,
        });


    } catch (error) {
        console.error("Error in /data endpoint:", error);
        res.status(500).send("Internal Server Error");
    }
});

// 单个更新活动投稿数据通过 judgeArchiveIsGet 函数 
app.post('/updateDataOne', async (req, res) => {
    try {
        // 获取参数
        const { searchKeyWord } = req.body;
        const newData = await get_BiliBili_Data(req.body);
        const oldDataArr = getOldData();
        // 查找并替换newData
        const arr = oldDataArr.map(item => {
            if (item.searchKeyWord === searchKeyWord) {
                item.bilibili = newData
                // item["updateData"] = true
                item["updateDate"] = formatDate(new Date().getTime())
            }
            return item
        })
        // 写入本地文件
        writeLocalDataJson(arr);

        res.json({
            code: 200,
            msg: "更新成功"
        });

    } catch (error) {
        console.error("Error in /data endpoint:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.post('/updateOnePlatData', async (req, res) => {
    let douyinData = []
    let xhsData = []
    let bilibiliData = []
    try {
        // const { rewardName } = req.body;
        douyinData = await queryDouYinAllAccountsData();
        xhsData = await queryXiaoHongShuAllAccountsData();
        // else if (rewardName === '快手') data = await queryXiaoHongShuAllAccountsData();
        // else if (rewardName === 'BiliBili') data = await queryXiaoHongShuAllAccountsData();
        bilibiliData = await querybilibiliAllAccountsData();
        const oldOtherGameDataArr = getOldData('./otherGameData.json');
        const jsonData = oldOtherGameDataArr.map(item => {
            return {
                ...item,
                updateDate: formatDate(new Date().getTime()),
                rewards: item.rewards.map(e => {
                    if (e.name === '抖音') {
                        return {
                            ...e,
                            specialTagRequirements: e.specialTagRequirements.map(i => {

                                return {
                                    ...i,
                                    videoData: douyinData.map(t => {
                                        // 过滤不满足条件的视频
                                        const valuedList = t.aweme_list.filter(l => l.desc.includes(i.specialTag) && l.view >= (l.minView || i.minView || 100))
                                        // 目前忽视了挂在小手柄问题，可手动isGet调整

                                        let alsoRelayList = []
                                        if (i?.videoData?.find(c => c.userName === t.user.name)) {
                                            alsoRelayList = i?.videoData.find(c => c.userName === t.user.name).onePlayNumList.filter(l => {
                                                // 保留活动期间过去发过的稿件数据计入（因为单次可能只发36条数据）
                                                if (valuedList.find(v => v.aweme_id === l.aweme_id)) {
                                                    return false
                                                }
                                                // 视频发布时间在活动开始结束期内的  l.create_time < formatSecondTimestamp(sDate) ||
                                                // if (l.create_time > formatSecondTimestamp(eDate)) {
                                                //     return false
                                                // }
                                                return true
                                            })
                                        }

                                        let list = valuedList.concat(alsoRelayList).sort((a, b) => {
                                            return b.create_time - a.create_time
                                        })
                                        return {
                                            userName: t.user.name,
                                            allNum: list.length,
                                            allViewNum: list.reduce((a, b) => a + b.view, 0),
                                            onePlayNumList: list
                                        }
                                    })

                                }

                            })
                        }
                    } else if (e.name === '小红书') {
                        return {
                            ...e,
                            specialTagRequirements: e.specialTagRequirements.map(i => {
                                return {
                                    ...i,
                                    videoData: xhsData.map(t => {
                                        // 过滤不满足条件的视频
                                        const valuedList = t.aweme_list.filter(l => l.desc.split(' ').map(e => '#' + e).join(' ').includes(i.specialTag))

                                        let alsoRelayList = []
                                        if (i?.videoData?.find(c => c.userName === t.user.name)) {
                                            alsoRelayList = i?.videoData.find(c => c.userName === t.user.name).onePlayNumList.filter(l => {
                                                // 保留活动期间过去发过的稿件数据计入（因为单次可能只发20条数据）
                                                if (valuedList.find(v => v.aweme_id === l.aweme_id)) {
                                                    return false
                                                }
                                                // 视频发布时间在活动开始结束期内的  l.create_time < formatSecondTimestamp(sDate) ||
                                                // if (l.create_time > formatSecondTimestamp(eDate)) {
                                                //     return false
                                                // }
                                                return true
                                            })
                                        }

                                        let list = valuedList.concat(alsoRelayList)
                                        return {
                                            userName: t.user.name,
                                            allNum: list.length,
                                            allLike: list.reduce((a, b) => a + b.like, 0),
                                            // allViewNum: list.reduce((a, b) => a + b.view, 0),
                                            onePlayNumList: list
                                        }
                                    })
                                }

                            })
                        }
                    } else if (e.name === 'bilibili') {
                        return {
                            ...e,
                            specialTagRequirements: e.specialTagRequirements.map(i => {
                                return {
                                    ...i,
                                    videoData: bilibiliData.map(t => {
                                        // 过滤不满足条件的视频
                                        const valuedList = t.aweme_list.filter(l => l.title.includes(item.name) || l.desc.includes(item.name))

                                        let alsoRelayList = []
                                        if (i?.videoData?.find(c => c.userName === t.user.name)) {
                                            alsoRelayList = i?.videoData.find(c => c.userName === t.user.name).onePlayNumList.filter(l => {
                                                // 保留活动期间过去发过的稿件数据计入（因为单次可能只发20条数据）
                                                if (valuedList.find(v => v.aweme_id === l.aweme_id)) {
                                                    return false
                                                }
                                                // 视频发布时间在活动开始结束期内的  l.create_time < formatSecondTimestamp(sDate) ||
                                                // if (l.create_time > formatSecondTimestamp(eDate)) {
                                                //     return false
                                                // }
                                                return true
                                            })
                                        }

                                        let list = valuedList.concat(alsoRelayList)
                                        return {
                                            userName: t.user.name,
                                            allNum: list.length,
                                            // allLike: list.reduce((a, b) => a + b.like, 0),
                                            allViewNum: list.reduce((a, b) => a + b.view, 0),
                                            onePlayNumList: list
                                        }
                                    })
                                }

                            })
                        }
                    }
                    return e
                })
            }
        })
        // 写入本地文件
        writeLocalDataJson(jsonData, './otherGameData.json');

        res.json({
            code: 200,
            data: jsonData,
            msg: "更新成功"
        });

    } catch (error) {
        // writeLocalDataJson(douyinData, './jsonFile/douyinHandleData.json');
        // writeLocalDataJson(xhsData, './jsonFile/xhsHandleData.json');
        console.error("Error in /data endpoint:", error);
        res.status(500).send("Internal Server Error");
    }
});






// 定时任务：查询评论接口并记录不利评论功能
// 查询最近50条评论，加入出现  抄 | 发过 | 假 | 抄袭 其中某一个词则记录改评论的所有信息   
// 查询接口 GET  https://api.bilibili.com/x/v2/reply/up/fulllist?keyword=${keyword}&order=1&filter=-1&type=1&bvid=&pn=1&ps=50&charge_plus_filter=false


// 查询不利评论接口
app.get('/unfavorableReply', async (req, res) => {
    const unfavorableWords = [
        { id: 1, keyword: '抄' },
        { id: 2, keyword: '侵权' },
        { id: 6, keyword: '洗稿' },
        { id: 5, keyword: '搬运' },
        { id: 5, keyword: '盗' },
    ];

    const messageList = await concurrentFetchWithDelay(unfavorableWords.map(word => {
        // 查询接口 fetch GET  https://api.bilibili.com/x/v2/reply/up/fulllist?keyword=${keyword}&order=1&filter=-1&type=1&bvid=&pn=1&ps=50&charge_plus_filter=false
        return () => fetch(`https://api.bilibili.com/x/v2/reply/up/fulllist?keyword=${word.keyword}&order=1&filter=-1&type=1&bvid=&pn=1&ps=10&charge_plus_filter=false`, {
            headers
        })
            .then(async response => {
                // Process the data and return the results
                const result = await response.json();
                return result?.data?.list?.map(wordData => {
                    return {
                        bvid: wordData.bvid,
                        oid: wordData.oid,
                        rpid: wordData.rpid,
                        message: wordData.content.message,
                    }
                }) ?? [];
            })
    }))

    // Return the results as JSON
    res.json(messageList.flat());
});


// https://api.bilibili.com/x/v2/reply/del
// 删除评论接口

app.post('/deleteUnfavorableReply', async (req, res) => {
    try {
        // 获取参数
        const { oid, rpid } = req.body;

        const jsonBody = {
            type: 1,
            rpid: rpid,
            oid: oid,
            jsonp: "jsonp",
            csrf: csrfToken
        }
        const response = await fetch(`https://api.bilibili.com/x/v2/reply/del`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', },
            body: JSON.stringify(jsonBody)
        })
        const data = await response.json()
        res.json(data)

    } catch (error) {
        console.error("Error in /data endpoint:", error);
        res.status(500).send("Internal Server Error");
    }

})



app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

