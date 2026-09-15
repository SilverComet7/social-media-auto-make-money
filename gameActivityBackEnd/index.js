const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;
const { allGameList, TikTokDownloader_ROOT } = require("./const.ts");

const {
  calculateTotalMoney,
  formatDate,
  getJsonData,
  formatSecondTimestamp,
  writeLocalDataJson,
  removeExpiredActivities,
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

const { setTimeout: sleep } = require("node:timers/promises");

// 带超时和指数退避重试的 fetch
async function fetchWithRetry(url, options = {}, { retries = 3, timeout = 10000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      // 429/503 等限流状态码也触发重试
      if (response.status === 429 || response.status === 503) {
        throw new Error(`HTTP ${response.status} (rate limited)`);
      }
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = 500 * Math.pow(2, attempt - 1) + Math.random() * 300;
        console.log(`fetch 请求失败，${Math.round(delay)}ms 后重试 (${attempt}/${retries}): ${err.cause?.code || err.message}`);
        await sleep(delay);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

// 限制并发数的 Promise.all，concurrency 建议 2~3
async function mapWithConcurrency(list, concurrency, mapper) {
  const results = new Array(list.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < list.length) {
      const i = nextIndex++;
      results[i] = await mapper(list[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, worker));
  return results;
}

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

const headers = {
  accept: "application/json, text/javascript, */*; q=0.01",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  // "sec-fetch-mode": "cors",
  // "sec-fetch-site": "same-site",
  // referer: "https://member.bilibili.com/",
  Cookie: Cookie,
};

// helper for XHS headers (uses cookie from accountList and optional X-S from caller)
function buildXhsHeaders(req) {
  const accountJson = getJsonData("accountList.json");
  const Feeling = accountJson.xhs?.[0];
  const xhsCookie = Feeling?.Cookie || "";
  const xS = req.headers["x-s"] || req.query["x-s"] || Feeling?.["X-S"] || "";
  const xSCommon = req.headers["x-s-common"] || req.query["x-s-common"] || "";
  return {
    accept: "application/json, text/javascript, */*; q=0.01",
    "User-Agent": headers["User-Agent"],
    Cookie: xhsCookie,
    "X-S": xS,
    "X-S-Common": xSCommon,
  };
}

// 获取各平台活动数据，处理活动数据
app.get("/getNewBiliActData", async (req, res) => {
  try {
    async function getActivitiesList() {
      let oldDataArr = getJsonData('bilibiliNoGameData.json');
      const fetchUrl = `https://member.bilibili.com/x/web/activity/videoall`;
      const response = await fetchWithRetry(fetchUrl, {
        headers,
      });
      let result = await response.json();
      if (!result?.data) return result;
      let newActivityList = result.data.map((e) => ({
        ...e,
        addTime: `${new Date().getFullYear()}年${new Date().getMonth() + 1
          }月${new Date().getDate()}添加`,
      }));

      const notGameActivityDataArr = newActivityList
        .filter((item) => {
          return !allGameList.some((gameName) => item.name.includes(gameName));
        });
      const newDataArr = notGameActivityDataArr
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
      writeLocalDataJson(newDataArr, 'bilibiliNoGameData.json');

      let gameData = getJsonData("gameData.json");
      const gameActivityDataArr = newActivityList
        .filter((item) => {
          return allGameList.some((gameName) => item.name.includes(gameName));
        })

      const topicCache = new Map();
      const fetchingPromises = new Map();


      await mapWithConcurrency(
        gameActivityDataArr,
        3,
        async (activity) => {
            try {
              const activityName = activity.name;
              const activityBindGameName = allGameList.find((gameName) =>
                activityName.includes(gameName)
              );

              const oldGameDataHasThisGameName = gameData.find((game) => game.name === activityBindGameName);
              // 还不存在该游戏分类
              if (!oldGameDataHasThisGameName) {
                gameData.push({
                  name: activityBindGameName,
                  rewards: [
                    {
                      name: "bilibili",
                      activityRequirements: [],
                    },
                  ],
                });
              }

              const bindGamePlatformsArr = oldGameDataHasThisGameName
                ?.rewards;
              // 3. 如果gameData.json中已经收录该平台游戏，则将该游戏活动收录到对应gameName下的rewards的下name为bilibili下的specialTagRequirements中细分活动中
              const bindGame_bilibili_platform = bindGamePlatformsArr?.find((platform) => platform.name === "bilibili");

              if (!bindGame_bilibili_platform) {
                bindGamePlatformsArr?.unshift({
                  name: "bilibili",
                  activityRequirements: [],
                });
              } else {
                try {
                  let topics;
                  if (topicCache.has(activityBindGameName)) {
                    topics = topicCache.get(activityBindGameName);
                  } else if (fetchingPromises.has(activityBindGameName)) {
                    topics = await fetchingPromises.get(activityBindGameName);
                  } else {
                    const fetchPromise = (async () => {
                      const topicUrl = `https://member.bilibili.com/x/vupre/web/topic/search?keywords=${encodeURIComponent(activityBindGameName)}&page_size=50&offset=0&t=${Date.now()}`;
                      const response = await fetchWithRetry(topicUrl, { headers });
                      const result = await response.json();

                      if (result.code !== 0 || !result.data?.result?.topics) {
                        console.log(`  查询失败: ${result.message || '未知错误'}`);
                        return [];
                      }

                      return result.data.result.topics;
                    })();
                    fetchingPromises.set(activityBindGameName, fetchPromise);
                    topics = await fetchPromise;
                    topicCache.set(activityBindGameName, topics);
                    fetchingPromises.delete(activityBindGameName);
                  }

                  const topicsWithActivity = topics.filter(
                    topic => topic.show_activity_icon === true
                      && topic.mission_id === activity.id  // 大活动id
                    // && bindGame_bilibili_platform?.activityRequirements.every((e) => e?.topic_id !== topic.id) // 已记录得大活动没有相同topic_id小活动
                  ).map(topic => {

                    // 更新同一个大活动下小活动的数据，并与老json可能已经存在的数据进行合并，形成最终的活动对象
                    let oldActivityData = bindGame_bilibili_platform?.activityRequirements?.find((act) => act.topic_id === topic.id);

                    return {
                      // 保留原有活动数据中的其他字段，避免丢失
                      ...(oldActivityData ? { ...oldActivityData } : {}),

                      name: activityName,
                      act_url: activity.act_url,
                      comment: activity.comment,
                      sDate: formatDate(activity.stime * 1000),
                      eDate: formatDate(activity.etime * 1000),
                      specialTag: oldActivityData ? oldActivityData.specialTag : '', // 保留原有特殊标签，后续更新时再进行替换或合并``,
                      reward: oldActivityData ? oldActivityData.reward : [],
                      mission_id: activity.id,
                      topic_id: topic.id,
                      topic: topic.name,
                      arc_play_vv: topic.arc_play_vv,
                    }
                  });

                  const existing = bindGame_bilibili_platform.activityRequirements || [];

                  const merged = Array.from(
                    new Map(
                      [...existing, ...topicsWithActivity].map(item => [item.topic_id, item])
                    ).values()
                  );

                  bindGame_bilibili_platform.activityRequirements = merged;
                } catch (error) {
                  console.error("Error fetching topic data:", error);
                }

              }
            } catch (error) {
              console.error("Error fetching topic data:", error);
            }
        });

      gameData = removeExpiredActivities(gameData);
      writeLocalDataJson(gameData, "gameData.json");
      return newActivityList;
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

// new XHS activity route
app.get("/getNewXhsActData", async (req, res) => {
  try {
    async function getActivitiesList() {
      let oldDataArr = getJsonData('xhsNoGameData.json') || [];
      const fetchUrl = 'https://creator.xiaohongshu.com/api/galaxy/v2/creator/activity_center/list?sort=2&type=1&source=3&topic_activity=0';
      const headersXhs = buildXhsHeaders(req);
      const response = await fetchWithRetry(fetchUrl, { headers: headersXhs });
      let result = await response.json();
      const activity_list = result?.data?.activity_list;
      if (!activity_list) return result;
      let newActList = activity_list.map((e) => ({
        name: e.activity_name || '',
        stime: e.start_time ? Math.floor(e.start_time / 1000) : 0,
        etime: e.end_time ? Math.floor(e.end_time / 1000) : 0,
        act_url: e.activity_link || e.capa_deep_link || '',
        comment: e.activity_reward || '',
        addTime: `${new Date().getFullYear()}年${new Date().getMonth() + 1}月${new Date().getDate()}添加`,
      }));

      const noGameDataArr = newActList.filter((item) => !allGameList.some((gameName) => item.name.includes(gameName)));
      const newDataArr = noGameDataArr.map((item) => {
        const oldDataHasThis = oldDataArr.find((old) => item.name === old.name);
        return oldDataHasThis ? { ...oldDataHasThis } : { ...item };
      });
      writeLocalDataJson(newDataArr, 'xhsNoGameData.json');

      let gameData = getJsonData('gameData.json');
      const gameDataArr = newActList.filter((item) => allGameList.some((gameName) => item.name.includes(gameName)));
      await Promise.all(
        gameDataArr.map(async (activity) => {
          try {
            const thisActivityGameName = allGameList.find((gameName) => activity.name.includes(gameName));
            let oldGame = gameData.find((g) => g.name === thisActivityGameName);
            if (!oldGame) {
              oldGame = { name: thisActivityGameName, rewards: [{ name: '小红书', activityRequirements: [] }] };
              gameData.push(oldGame);
            }
            let xhsPlatform = oldGame.rewards.find((p) => p.name === '小红书');
            if (!xhsPlatform) {
              xhsPlatform = { name: '小红书', activityRequirements: [] };
              oldGame.rewards.unshift(xhsPlatform);
            }
            const exists = xhsPlatform.activityRequirements.find((act) => act.name === activity.name);
            if (!exists) {
              xhsPlatform.activityRequirements.push({
                name: activity.name,
                act_url: activity.act_url,
                comment: activity.comment,
                sDate: formatDate(activity.stime * 1000),
                eDate: formatDate(activity.etime * 1000),
                specialTag: '',
                reward: [],
              });
            }
          } catch (e) {
            console.error('Error processing xhs activity', e);
          }
        })
      );
      gameData = removeExpiredActivities(gameData);
      writeLocalDataJson(gameData, 'gameData.json');
      return newActList;
    }

    const data = await getActivitiesList();
    res.json(data);
  } catch (error) {
    console.error('Error in /getNewXhsActData endpoint:', error);
    res.json({ msg: error });
  }
});

app.get('/getLatestTopic', async (req, res) => {
  const { topic } = req.query;

  if (!topic) {
    return res.status(400).json({ code: 400, message: 'Missing topic parameter' });
  }
  try {
    const response = await fetchWithRetry(`https://member.bilibili.com/x/vupre/web/topic/search?keywords=${encodeURIComponent(topic)}&page_size=50&offset=0&t=${Date.now()}`, {
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

app.post("/getPlatformVideoData", async (req, res) => {
  try {
    // 从请求中读取需要更新的平台列表，默认都包含
    const requested = Array.isArray(req.body.platforms)
      ? req.body.platforms
      : [];
    const selectedPlatforms = new Set(
      requested.length > 0 ? requested : ["抖音", "小红书", "bilibili"]
    );

    // 是否清除过往数据，默认 false（保留历史数据）
    const clearPreviousData = req.body.clearPreviousData === true;
    if (clearPreviousData) {
      console.log(`⚠️  清除模式启用：将清除 ${Array.from(selectedPlatforms).join(', ')} 平台的历史数据，仅使用新爬取数据`);
    }

    const jsonData = await useThirdUtil_GetVideoData();

    async function useThirdUtil_GetVideoData() {
      // 只有在平台被选中时才去调用对应的查询函数，以减轻开销
      let xhsVideoData = selectedPlatforms.has("小红书")
        ? await queryXiaoHongShuAllAccountsData()
        : null;
      let bilibiliVideoData = selectedPlatforms.has("bilibili")
        ? await querybilibiliAllAccountsData()
        : null;
      let douyinVideoData = selectedPlatforms.has("抖音")
        ? await queryDouYinAllAccountsData()
        : null;

      const oldOtherGameDataArr = getJsonData("gameData.json");


      // -----------------------------------------------------------------------------
      // utilities for platform videoData merging and statistics
      // -----------------------------------------------------------------------------

      /**
       * Merge two arrays of video records keyed by `aweme_id`.
       * New entries override old ones; result is sorted by create_time desc.
       *
       * @param {Array<Object>} prevList - previously stored records (may be empty)
       * @param {Array<Object>} valuedList - newly fetched records to merge
       * @returns {Array<Object>} merged and sorted list
       */
      function mergeVideoLists(prevList = [], valuedList = []) {
        const map = new Map();
        prevList.forEach((l) => map.set(l.aweme_id, l));
        valuedList.forEach((l) => map.set(l.aweme_id, l));
        return Array.from(map.values()).sort((a, b) => {
          return (b.create_time || 0) - (a.create_time || 0);
        });
      }

      /**
       * Sum a numeric field across a list of records.
       *
       * @param {Array<Object>} list
       * @param {string} field
       * @returns {number}
       */
      function sumField(list = [], field) {
        return list.reduce((acc, cur) => acc + (cur[field] || 0), 0);
      }



      const jsonData = oldOtherGameDataArr.map((item) => {
        return {
          ...item,
          updateDate: formatDate(new Date().getTime()),
          rewards: item.rewards.map((e) => {
            if (e.name === "抖音") {
              if (!selectedPlatforms.has("抖音")) return e; // 未选择则保持原样
              return {
                ...e,
                activityRequirements: e.activityRequirements.map((douyin_activity) => {
                  return {
                    ...douyin_activity,
                    videoData: douyinVideoData.map((t) => {
                      // 过滤不满足条件的视频
                      const valuedList = t.aweme_list.filter(
                        (l) => {
                          if (douyin_activity.specialTag == '') return false;
                          const tagMatches = l.desc.includes(douyin_activity.specialTag) && l.view >= (douyin_activity.minView || 100);
                          if (!tagMatches) return false;

                          // // 检查 type 是否匹配
                          // if (i.reward && i.reward.length > 0) {
                          //   const rewardType = i.reward[0]?.type;
                          //   if (rewardType && rewardType !== 'all') {
                          //     return (l.type || 'video') === rewardType;
                          //   }
                          // }
                          return true;
                        }
                      );
                      // 清除模式：不复用之前的数据；正常模式：合并新旧数据
                      const prevList = clearPreviousData
                        ? []
                        : (douyin_activity?.videoData?.find((c) => c.userName === t.user.name)
                          ?.videoList || []);
                      const list = mergeVideoLists(prevList, valuedList);
                      return {
                        userName: t.user.name,
                        allNum: list.length,
                        allViewNum: sumField(list, 'view'),
                        videoList: list,
                      };
                    }),
                  };
                }),
              };
            }
            else if (e.name === "小红书") {
              if (!selectedPlatforms.has("小红书")) return e;
              return {
                ...e,
                activityRequirements: e.activityRequirements.map((xhs_activity) => {
                  // 将 specialTag 的 "#tag1 #tag2" 格式转换为数组 ["tag1", "tag2"]
                  const requiredTags = (xhs_activity.specialTag || '')
                    .split(/\s+/)
                    .filter(tag => tag.length > 0)
                    .map(tag => tag.replace(/^#/, ''));

                  return {
                    ...xhs_activity,
                    videoData: xhsVideoData.map((t) => {
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
                        return true;
                      });

                      // 清除模式：不复用之前的数据；正常模式：合并新旧数据
                      const prevList = clearPreviousData
                        ? []
                        : (xhs_activity?.videoData?.find((c) => c.userName === t.user.name)
                          ?.videoList || []);
                      const list = mergeVideoLists(prevList, valuedList);
                      return {
                        userName: t.user.name,
                        allNum: list.length,
                        allLikeNum: sumField(list, 'like'),
                        videoList: list,
                      };
                    }),
                  };
                }),
              };
            }
            else if (e.name === "bilibili") {
              if (!selectedPlatforms.has("bilibili")) return e;
              return {
                ...e,
                activityRequirements: e.activityRequirements.map((bili_activity) => {

                  return {
                    ...bili_activity,
                    videoData: bilibiliVideoData.map((userVideoList) => {
                      const valuedList = userVideoList.aweme_list.filter(l => {
                        const matches_desc_topic = (l.desc === bili_activity.topic)
                        if (!(matches_desc_topic)) return false;
                        return true;
                      });

                      // 清除模式：不复用之前的数据；正常模式：合并新旧数据
                      const prevList = clearPreviousData
                        ? []
                        : (bili_activity?.videoData?.find((c) => c.userName === userVideoList.user.name)
                          ?.videoList || []);
                      const list = mergeVideoLists(prevList, valuedList);
                      return {
                        userName: userVideoList.user.name,
                        allNum: list.length,
                        allViewNum: sumField(list, 'view'),
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

    const bilibiliActData = getJsonData('bilibiliNoGameData.json')
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

    const xhsActData = getJsonData('xhsNoGameData.json')
      .filter(
        (item) =>
          !item.notDo &&
          !allGameList.some((gameName) => item.name.includes(gameName))
      )
      .sort((a, b) => a.etime - b.etime)
      .map((item) => ({
        ...item,
        allMoney: calculateTotalMoney(item),
      }));



    const BiliBiliScheduleJob = getJsonData("scheduleJob/BiliBiliScheduleJob.json");
    const DouyinScheduleJob = getJsonData("scheduleJob/DouyinScheduleJob.json");
    const XhsScheduleJob = getJsonData("scheduleJob/XhsScheduleJob.json");
    const accountList = getJsonData("accountList.json");

    res.json({
      gameData,
      bilibiliActData,
      xhsActData,
      allGameList,
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
