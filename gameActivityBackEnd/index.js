const fs = require("fs");
const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;
const { allGameList, TikTokDownloader_ROOT } = require("./const.js");

const {
  concurrentFetchWithDelay,
  calculateTotalMoney,
  formatDate,
  getJsonData,
  formatSecondTimestamp,
  writeLocalDataJson,
} = require("./commonFunction.js");

const { queryDouYinAllAccountsData } = require("./crawerHandle/douyin.js");
const { querybilibiliAllAccountsData } = require("./crawerHandle/bilibili");
const { queryXiaoHongShuAllAccountsData } = require("./crawerHandle/xhs.js");

const {
  ffmpegHandleVideos,
} = require("./ffmpegHandle/videoReName_FFmpegHandle");
const {
  downloadVideosAndGroup,
} = require("./ffmpegHandle/videoDownloadAndGroupList.js");

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`)
  next()
})
// 静态资源服务（确保前端能访问视频文件）
app.use('/static_videos', express.static(TikTokDownloader_ROOT + '/gamelist'));

const accountJson = getJsonData("accountList.json")
const Cookie = accountJson.bilibili[0].Cookie;
const csrfToken = Cookie.split("; ")
  .find((cookie) => cookie.startsWith("bili_jct="))
  .split("=")[1];
const headers = {
  accept: "application/json, text/javascript, */*; q=0.01",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  // "sec-fetch-mode": "cors",
  // "sec-fetch-site": "same-site",
  // referer: "https://member.bilibili.com/",
  Cookie: Cookie,
};



// 获取各平台活动数据，处理活动数据
app.get("/getNewActData", async (req, res) => {
  try {
    async function getActivitiesList() {
      let oldDataArr = getJsonData('data.json');
      const fetchUrl = `https://member.bilibili.com/x/web/activity/videoall`;
      const response = await fetch(fetchUrl, {
        headers,
      });
      let newActList = await response.json();
      if (!newActList?.data) return newActList;
      newActList = newActList.data.map((e) => ({
        ...e,
        addTime: `${new Date().getFullYear()}年${new Date().getMonth() + 1
          }月${new Date().getDate()}添加`,
      }));

      const noGameDataArr = newActList
        .filter((item) => {
          return !allGameList.some((gameName) => item.name.includes(gameName));
        });
      // 非game 活动
      const newDataArr = noGameDataArr
        .map((item) => {
          const oldDataHasThisRewardsItem = oldDataArr.find(
            (old) => item.name === old.name
          );
          return {
            ...(oldDataHasThisRewardsItem
              ? {
                ...oldDataHasThisRewardsItem,
              }
              : {
                name: item.name,
                stime: item.stime,
                etime: item.etime,
                act_url: item.act_url,
                cover: item.cover,
                comment: item.comment,
                protocol: item.protocol,
              }),
          };
        });
      writeLocalDataJson(newDataArr, 'data.json');

      let gameData = getJsonData("gameData.json");
      const gameDataArr = newActList
        .filter((item) => {
          return allGameList.some((gameName) => item.name.includes(gameName));
        })
      // 相同的游戏名活动去重，避免重复请求

      await Promise.all(
        gameDataArr
          .map(async (activity) => {
            try {
              const thisActivityGameName = allGameList.find((gameName) =>
                activity.name.includes(gameName)
              );

              const oldGameDataHasThisGameName = gameData.find((game) => game.name === thisActivityGameName);
              // 还不存在该游戏分类
              if (!oldGameDataHasThisGameName) {
                gameData.push({
                  name: thisActivityGameName,
                  rewards: [
                    {
                      name: "bilibili",
                      activityRequirements: [],
                    },
                  ],
                });
              }

              const thisGamePlatforms = oldGameDataHasThisGameName
                ?.rewards;
              // 3. 如果gameData.json中已经收录该平台游戏，则将该游戏活动收录到对应gameName下的rewards的下name为bilibili下的specialTagRequirements中细分活动中
              const game_rewards_bilibili = thisGamePlatforms?.find((platform) => platform.name === "bilibili");

              if (!game_rewards_bilibili) {
                thisGamePlatforms?.unshift({
                  name: "bilibili",
                  activityRequirements: [],
                });
              } else {
                const bilibili_special_acts_ing_list =
                  game_rewards_bilibili?.activityRequirements?.find(
                    (act) => act.mission_id === activity.id && !act.topic_id
                  );

                const topicUrl = `https://member.bilibili.com/x/vupre/web/topic/search?keywords=${encodeURIComponent(thisActivityGameName)}&page_size=50&offset=0&t=${Date.now()}`;
                const response = await fetch(topicUrl, { headers });
                const result = await response.json();

                if (result.code !== 0 || !result.data?.result?.topics) {
                  console.log(`  查询失败: ${result.message || '未知错误'}`);
                  return
                }

                const topicsWithActivity = result.data.result.topics.filter(
                  topic => topic.show_activity_icon === true
                    && topic.mission_id === activity.id  // 大活动id
                    && game_rewards_bilibili?.activityRequirements.every((e) => e?.topic_id !== topic.id) // 已存活动没有相同id的小活动
                ).map(topic => ({
                  name: activity.name,
                  act_url: activity.act_url,
                  comment: activity.comment,
                  sDate: formatDate(activity.stime * 1000),
                  eDate: formatDate(activity.etime * 1000),
                  specialTag: '',
                  reward: [],
                  mission_id: activity.id,
                  topic_id: topic.id,
                  topic: topic.name,
                  arc_play_vv: topic.arc_play_vv,
                }))

                if (!bilibili_special_acts_ing_list) {
                  game_rewards_bilibili.activityRequirements.push(...topicsWithActivity);
                }
              }
            } catch (error) {
              console.error("Error fetching topic data:", error);
            }
          }));

      writeLocalDataJson(gameData, "gameData.json");
      return newActList;
    }
    const data = await getActivitiesList();
    res.json(data);
  } catch (error) {
    console.error("Error in /data endpoint:", error);
    res.json({
      msg: error,
    });
  }
});
app.get('/getLatestTopic', async (req, res) => {
  const { topic } = req.query;
  console.log(topic);

  if (!topic) {
    return res.status(400).json({ code: 400, message: 'Missing topic parameter' });
  }
  try {
    const response = await fetch(`https://member.bilibili.com/x/vupre/web/topic/search?keywords=${encodeURIComponent(topic)}&page_size=50&offset=0&t=${Date.now()}`, {
      headers,
    });
    const result = await response.json();
    res.json({
      code: 200,
      data: { mission_id: result?.data?.result?.topics[0]?.mission_id }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: 'Bilibili API request failed', error: err.toString() });
  }
})

app.post("/addPlatformReward", async (req, res) => {
  try {
    const { platformData } = req.body;

    let { gameName, platformName } = platformData;
    delete platformData.isUpdate;

    // 读取现有的 gameData.json 文件
    let oldOtherDataArr = getJsonData("gameData.json");

    // 找到对应的游戏
    const gameIndex = oldOtherDataArr.findIndex(
      (item) => item.name === gameName
    );
    const platformIndex = oldOtherDataArr[gameIndex].rewards.findIndex(
      (item) => item.name === platformName
    );

    delete platformData.gameName;
    platformData.name = platformName;
    delete platformData.platformName;
    // 1. 如果还未有该平台奖励，则直接添加新的平台和对应的活动赛道
    if (platformIndex === -1) {
      oldOtherDataArr[gameIndex].rewards.unshift(platformData);
    } else {
      // 2. 如果已有该平台的其他活动赛道，则添加新的活动赛道
      oldOtherDataArr[gameIndex].rewards[platformIndex] = platformData;
    }


    writeLocalDataJson(oldOtherDataArr, "gameData.json");

    res.json({ code: 0, msg: "奖励更新成功" });
  } catch (error) {
    console.error("Error in /updateReward endpoint:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 下载视频与处理
app.post("/downloadVideosAndGroup", async (req, res) => {
  try {
    const { downloadSettings } = req.body;
    await downloadVideosAndGroup(downloadSettings);
    res.json({ code: 0, msg: "视频处理成功" });
  } catch (error) {
    console.error("视频处理失败:", error);
    res.status(500).send("视频处理失败");
  }
});
app.post("/ffmpegHandleVideos", async (req, res) => {
  try {
    const { ffmpegSettings } = req.body;
    await ffmpegHandleVideos(ffmpegSettings);

    res.json({ code: 0, msg: "视频处理成功" });
  } catch (error) {
    console.error("视频处理失败:", error);
    res.status(500).send("视频处理失败");
  }
});
// 获取各平台视频播放数据
app.post("/getPlatformVideoData", async (req, res) => {
  try {
    const jsonData = await useThirdUtil_GetVideoData();

    async function useThirdUtil_GetVideoData() {
      let xhsData = await queryXiaoHongShuAllAccountsData();
      let bilibiliData = await querybilibiliAllAccountsData();
      let douyinData = await queryDouYinAllAccountsData();
      const oldOtherGameDataArr = getJsonData("gameData.json");
      const BiliBiliScheduleJobJson = getJsonData("scheduleJob/BiliBiliScheduleJob.json");
      const jsonData = oldOtherGameDataArr.map((item) => {
        return {
          ...item,
          updateDate: formatDate(new Date().getTime()),
          rewards: item.rewards.map((e) => {
            if (e.name === "抖音") {
              return {
                ...e,
                activityRequirements: e.activityRequirements.map((i) => {
                  return {
                    ...i,
                    videoData: douyinData.map((t) => {
                      // 过滤不满足条件的视频
                      const valuedList = t.aweme_list.filter(
                        (l) => {
                          if (i.specialTag == '') return false;
                          const tagMatches = l.desc.includes(i.specialTag) && l.view >= (i.minView || 100);
                          if (!tagMatches) return false;
                          
                          // 检查 type 是否匹配
                          if (i.reward && i.reward.length > 0) {
                            const rewardType = i.reward[0]?.type;
                            if (rewardType && rewardType !== 'all') {
                              return (l.type || 'video') === rewardType;
                            }
                          }
                          return true;
                        }
                      );
                      // 目前忽视了挂在小手柄问题，可手动isGet调整
                      let alsoRelayList = [];
                      if (i?.videoData?.find((c) => c.userName === t.user.name)) {
                        alsoRelayList = i?.videoData
                          .find((c) => c.userName === t.user.name)
                          .videoList.filter((l) => {
                            // 保留活动期间过去发过的稿件数据计入（因为单次可能只发36条数据）
                            if (valuedList.find((v) => v.aweme_id === l.aweme_id)) {
                              return false;
                            }
                            // 视频发布时间在活动开始结束期内的  l.create_time < formatSecondTimestamp(sDate) ||
                            // if (l.create_time > formatSecondTimestamp(eDate)) {
                            //     return false
                            // }
                            return true;
                          });
                      }

                      let list = valuedList.concat(alsoRelayList).sort((a, b) => {
                        return b.create_time - a.create_time;
                      });
                      return {
                        userName: t.user.name,
                        allNum: list.length,
                        allViewNum: list.reduce((a, b) => a + b.view, 0),
                        videoList: list,
                      };
                    }),
                  };
                }),
              };
            }
            else 
              if (e.name === "小红书") {
              return {
                ...e,
                activityRequirements: e.activityRequirements.map((i) => {
                  // 将 specialTag 的 "#tag1 #tag2" 格式转换为数组 ["tag1", "tag2"]
                  const requiredTags = (i.specialTag || '')
                    .split(/\s+/)
                    .filter(tag => tag.length > 0)
                    .map(tag => tag.replace(/^#/, ''));

                  return {
                    ...i,
                    videoData: xhsData.map((t) => {
                      // 过滤不满足条件的笔记 - 根据 tag 和 type
                      // tag_list 格式: "tag1,tag2,tag3"
                      const valuedList = t.aweme_list.filter((l) => {
                        if (requiredTags.length === 0) return false;
                        
                        // 检查 tag 是否匹配
                        const noteTags = (l.tag_list || '')
                          .toLowerCase()
                          .split(',')
                          .map(tag => tag.trim());
                        
                        const tagsMatched = requiredTags.every(requiredTag => 
                          noteTags.some(noteTag => 
                            noteTag.includes(requiredTag.toLowerCase())
                          )
                        );

                        if (!tagsMatched) return false;

                        // 检查 type 是否匹配（如果设置了类型过滤）
                        if (i.reward && i.reward.length > 0) {
                          // 获取 reward 中的第一个 type 字段用于过滤
                          const rewardType = i.reward[0]?.type;
                          if (rewardType && rewardType !== 'all') {
                            // 如果设置了特定类型，只保留该类型的笔记
                            return (l.type || 'video') === rewardType;
                          }
                        }

                        return true;
                      });

                      let alsoRelayList = [];
                      if (i?.videoData?.find((c) => c.userName === t.user.name)) {
                        alsoRelayList = i?.videoData
                          .find((c) => c.userName === t.user.name)
                          .videoList.filter((l) => {
                            // 保留活动期间过去发过的稿件数据计入（因为单次可能只发20条数据）
                            if (valuedList.find((v) => v.aweme_id === l.aweme_id)) {
                              return false;
                            }
                            return true;
                          });
                      }

                      let list = valuedList.concat(alsoRelayList);
                      return {
                        userName: t.user.name,
                        allNum: list.length,
                        allLikeNum: list.reduce((a, b) => a + b.like, 0),
                        videoList: list,
                      };
                    }),
                  };
                }),
              };
            }
            else if (e.name === "bilibili") {
              return {
                ...e,
                activityRequirements: e.activityRequirements.map((differentTopic) => {
                  const hasSameTopicScheduleJob = BiliBiliScheduleJobJson.find(job => job.topicName === differentTopic.topic);

                  return {
                    ...differentTopic,
                    videoData: bilibiliData.map((t) => {
                      const valuedList = t.aweme_list.filter(l => {
                        // 检查视频描述是否包含活动名称
                        const matchesName = (l.desc === differentTopic.topic) || (l.desc === differentTopic.name)
                        // 如果有定时任务，检查视频的文件名称是否在是某个topic的
                        let isTopicScheduleJob = false;
                        if (hasSameTopicScheduleJob) {
                          isTopicScheduleJob = hasSameTopicScheduleJob.scheduleJob.some(job => {
                            const jobFileName = job.videoPath.split('\\').pop();
                            return jobFileName.includes(l.title)
                          });
                        }

                        if (!(matchesName || isTopicScheduleJob)) return false;

                        // 检查 type 是否匹配
                        if (differentTopic.reward && differentTopic.reward.length > 0) {
                          const rewardType = differentTopic.reward[0]?.type;
                          if (rewardType && rewardType !== 'all') {
                            return (l.type || 'video') === rewardType;
                          }
                        }

                        return true;
                      });

                      let alsoRelayList = [];
                      if (differentTopic?.videoData?.find((c) => c.userName === t.user.name)) {
                        alsoRelayList = differentTopic?.videoData
                          .find((c) => c.userName === t.user.name)
                          .videoList.filter((l) => {
                            // 保留活动期间过去发过的稿件数据计入（因为单次可能只发20条数据）
                            if (valuedList.find((v) => v.aweme_id === l.aweme_id)) {
                              return false;
                            }
                            // 视频发布时间在活动开始结束期内的  l.create_time < formatSecondTimestamp(sDate) ||
                            // if (l.create_time > formatSecondTimestamp(eDate)) {
                            //     return false
                            // }
                            return true;
                          });
                      }

                      let list = valuedList.concat(alsoRelayList);
                      return {
                        userName: t.user.name,
                        allNum: list.length,
                        allViewNum: list.reduce((a, b) => a + b.view, 0),
                        videoList: list,
                      };
                    }),
                  };
                }),
              };
            }
            return e;
          }),
        };
      });
      writeLocalDataJson(jsonData, "gameData.json");
      return jsonData;
    }

    // setInterval(getPlatformData, 1000 * 60 * 60 * 24); // 每24小时更新一次数据
    res.json({
      code: 200,
      data: jsonData,
      msg: "更新成功",
    });
  } catch (error) {
    console.error("Error in /data endpoint:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.get("/allData", async (req, res) => {

  try {
    let gameData = getJsonData("gameData.json");
    // 计算rewards下各平台specialTagRequirements里的最近的活动结束时间，并赋值给最外层etime
    gameData.forEach((game) => {
      let minEtime = game.etime || Number.MAX_SAFE_INTEGER;
      game.rewards.forEach((reward) => {
        if (reward.activityRequirements) {
          reward.activityRequirements = reward?.activityRequirements?.filter(
            (e) => {
              const dateTime = formatSecondTimestamp(e.eDate + ' 23:59:59');
              return (dateTime) >
                new Date().getTime()
            }
          );
          reward.activityRequirements.forEach((requirement) => {
            if (requirement.eDate) {
              const eTime =
                (new Date(requirement.eDate).getTime() + 24 * 60 * 60 * 60) /
                1000;
              // 如果结束日期小于当天的time，则跳过 不计入最近结束日期
              // if (eTime < new Date().getTime() / 1000) return;
              // 如果结束日期小于minEtime，则更新minEtime
              if (eTime < minEtime) {
                minEtime = eTime;
              }
            }
          });
        }
      });
      game.etime = minEtime;
    });

    gameData = gameData
      .sort((a, b) => a.etime - b.etime)
      .map((item) => {
        return {
          ...item,
          allMoney: calculateTotalMoney(item),
        };
      });

    const bilibiliActData = getJsonData('data.json')
      .filter(
        (item) =>
          !item.notDo &&
          !allGameList.some((gameName) => item.name.includes(gameName))
      )
      .sort((a, b) => a.etime - b.etime)
      .map((item) => {
        return {
          ...item,
          allMoney: calculateTotalMoney(item),
        };
      });


    const dakaData = getJsonData("B站打卡活动.json")
      .filter((item) => item.stime * 1000 < new Date().getTime())
      .map((e) => ({
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
      }));
    const BiliBiliScheduleJob = getJsonData("scheduleJob/BiliBiliScheduleJob.json");
    const DouyinScheduleJob = getJsonData("scheduleJob/DouyinScheduleJob.json");
    const XhsScheduleJob = getJsonData("scheduleJob/XhsScheduleJob.json");
    const accountList = getJsonData("accountList.json");

    // 遍历视频目录,拿到各目录的视频列表
    res.json({
      gameData,
      bilibiliActData,
      dakaData,
      allGameList,
      topicJson: getJsonData("topic.json")?.topics,
      scheduleJob: {
        bilibili: BiliBiliScheduleJob,
        '抖音': DouyinScheduleJob,
        '小红书': XhsScheduleJob
      },
      platformAccountMap: accountList // 添加账号列表到返回数据中
    });
  } catch (error) {
    console.error("Error in /data endpoint:", error);
    res.status(500).send("Internal Server Error");
  }
});
const scheduleRoutes = require('./src/modules/schedule/routes/schedule.route');
// 注册路由（可以添加前缀）
app.use(scheduleRoutes);  // 访问路径: /api/scheduleUpload

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
