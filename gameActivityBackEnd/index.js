const fs = require("fs");
const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;
const path = require("path");
const { exec, spawn } = require("child_process");
const schedule = require("node-schedule");
const { PROJECT_ROOT, allGameList } = require("./const.js");

const {
  concurrentFetchWithDelay,
  calculateTotalMoney,
  formatDate,
  getJsonData,
  formatSecondTimestamp,
  writeLocalDataJson,
} = require("./commonFunction.js");

const { queryDouYinAllAccountsData } = require("./handleCrawer/douyin.js");
const { queryXiaoHongShuAllAccountsData } = require("./handleCrawer/xhs.js");
const { querybilibiliAllAccountsData } = require("./handleCrawer/bilibili");


const {
  ffmpegHandleVideos,
} = require("./ffmpegHandle/videoReName_FFmpegHandle.js");
const {
  downloadVideosAndGroup,
} = require("./ffmpegHandle/videoDownloadAndGroupList.js");
const accountJson = getJsonData("accountList.json")
const replyRoutes = require('./src/modules/reply/controllers/reply.controller.js');

app.use(cors());
app.use(express.json());

const Cookie = accountJson.bilibili[0].Cookie;
const csrfToken = Cookie.split("; ")
  .find((cookie) => cookie.startsWith("bili_jct="))
  .split("=")[1];
const headers = {
  accept: "application/json, text/javascript, */*; q=0.01",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  referer: "https://member.bilibili.com/",
  Cookie: Cookie,
};



async function get_BiliBili_Data(i, account = accountJson.bilibili[0]) {
  const keyword = i.searchKeyWord || "逆水寒";
  const fetchUrl = `https://member.bilibili.com/x/web/archives?status=is_pubing%2Cpubed%2Cnot_pubed&pn=1&ps=30&keyword=${keyword}&coop=1&interactive=1`;
  const bilibili = {
    allNum: 0,
    allViewNum: 0,
    onePlayNumList: [],
  };

  await fetch(fetchUrl, {
    headers: {
      ...headers,
      // "Cookie": account.Cookie
    },
  }).then(async (response) => {
    const data = await response.json();
    if (!data?.data?.arc_audits) {
      return;
    }
    const list = data.data.arc_audits
      .filter(
        (item) => item.Archive.ctime > i.stime && item.Archive.ctime < i.etime
      )
      .map((item) => ({
        view: item.stat.view,
        like: item.stat.like,
        reply: item.stat.reply,
        title: item.Archive.title,
        bvid: item.Archive.bvid,
        ctime: item.Archive.ctime,
        ptime: item.Archive.ptime,
      }))
      .sort((a, b) => b.view - a.view);

    bilibili.allNum = list.length;
    bilibili.onePlayNumList = list;

    list.forEach((element) => {
      bilibili.allViewNum += element.view;
    });
  });

  return bilibili;
}

app.get("/getNewActData", async (req, res) => {
  try {
    async function getActivitiesList() {
      let oldDataArr = getJsonData();
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
      const list = newActList
        .filter((item) => {
          return !allGameList.some((gameName) => item.name.includes(gameName));
          //  && oldDataArr.every(item2 => item.name !== item2.name)
        })
        .map((item) => {
          const oldDataHasThisRewardsItem = oldDataArr.find(
            (item2) => item.name === item2.name
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

      let oldOtherDataArr = getJsonData("gameData.json");
      newActList
        .filter((item) => {
          return allGameList.some((gameName) => item.name.includes(gameName));
        })
        .map((item) => {
          const gameName = allGameList.find((gameName) =>
            item.name.includes(gameName)
          );
          // const oldDataHasThisRewardsItem = oldDataArr.find(item2 => item2.name.includes(gameName))

          const biliGameActObj = {
            name: item.name,
            act_url: item.act_url,
            comment: item.comment,
            sDate: formatDate(item.stime * 1000) || "2023/1/11",
            eDate: formatDate(item.etime * 1000) || "2025/1/11",
            specialTag: '',
            // searchKeyWord: item.name,
            reward: [],
          };
          // 不存在该游戏分类
          if (!oldOtherDataArr.some((item2) => item2.name === gameName)) {
            oldOtherDataArr.push({
              name: gameName,
              rewards: [
                {
                  name: "bilibili",
                  specialTagRequirements: [biliGameActObj],
                },
              ],
            });
          } else {
            // 3. 如果gameData.json中已经收录该游戏活动，则将该游戏活动收录到对应gameName下的rewards的下name为bilibili下的specialTagRequirements中细分活动中
            const gameBilibiliRewards = oldOtherDataArr
              .find((item2) => item2.name === gameName)
              ?.rewards?.find((item2) => item2.name === "bilibili");
            if (!gameBilibiliRewards) {
              oldOtherDataArr
                .find((item2) => item2.name === gameName)
                .rewards.unshift({
                  name: "bilibili",
                  specialTagRequirements: [biliGameActObj],
                });
            } else {
              const bilibiliHasThisSpecialAct =
                gameBilibiliRewards?.specialTagRequirements.some(
                  (item2) => item2.name === item.name
                );
              if (bilibiliHasThisSpecialAct === false) {
                gameBilibiliRewards?.specialTagRequirements.push(
                  biliGameActObj
                );
              } else {
                console.log(`${item.name}已存在`);
              }
            }
          }
        });

      writeLocalDataJson(list);
      writeLocalDataJson(oldOtherDataArr, "gameData.json");

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

app.get("/getBiliBiliDakaData", async (req, res) => {
  try {
    async function get_BiliBili_DakaData() {
      const url =
        "https://member.bilibili.com/x2/creative/h5/clock/v4/activity/list";
      const params = {
        act_type: 0,
        csrf: csrfToken,
        s_locale: "zh_CN",
      };

      try {
        const response = await fetch(url, { params, headers });
        let dakaData = await response.json();
        if (dakaData.code === -101) {
          dakaData = JSON.parse(fs.readFileSync("./B站打卡活动.json"));
          return dakaData;
        }
        dakaData = dakaData.data.list.filter(
          (item) => item.etime * 1000 > new Date().getTime()
        );

        // 循环 dakaData 中的数据，通过act_id去获取详情
        const dakaNewData = await concurrentFetchWithDelay(
          dakaData.map((item) => {
            return () =>
              fetch(
                `https://member.bilibili.com/x2/creative/h5/clock/v4/act/detail?act_id=${item.act_id}&csrf=${csrfToken}&s_locale=zh_CN`,
                { headers }
              )
                .then((response) => response.json())
                .then((res) => ({
                  ...item,
                  detail: { ...res.data },
                }));
          })
        );
        writeLocalDataJson(dakaNewData, "B站打卡活动.json");

        return dakaNewData;
      } catch (error) {
        console.error("获取打卡数据时出错:", error.message);
        throw error;
      }
    }
    const data = await get_BiliBili_DakaData();
    res.json(data);
  } catch (error) {
    console.error("Error in /data endpoint:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/allData", async (req, res) => {

  try {
    const data = getJsonData();
    let otherGameData = getJsonData("gameData.json");
    // 计算otherGameData rewards下各平台specialTagRequirements里的最近的活动结束时间，并赋值给最外层etime
    otherGameData.forEach((game) => {
      let minEtime = game.etime || Number.MAX_SAFE_INTEGER;
      game.rewards.forEach((reward) => {
        if (reward.specialTagRequirements) {
          reward.specialTagRequirements = reward.specialTagRequirements.filter(
            (e) => {
              const dateTime = formatSecondTimestamp(e.eDate + ' 23:59:59');
              return (dateTime) >
                new Date().getTime()
            }

          );
          reward.specialTagRequirements.forEach((requirement) => {
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

    const gameData = otherGameData
      .sort((a, b) => a.etime - b.etime)
      .map((item) => {
        return {
          ...item,
          allMoney: calculateTotalMoney(item),
        };
      });

    const bilibiliActData = data
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

    let dakaData = getJsonData("B站打卡活动.json");

    dakaData = dakaData
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

    // 获取账号列表
    const accountList = getJsonData("accountList.json");

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

app.post("/updateDataOne", async (req, res) => {
  try {
    const { searchKeyWord } = req.body;
    const newData = await get_BiliBili_Data(req.body);
    const oldDataArr = getJsonData();
    const arr = oldDataArr.map((item) => {
      if (item.searchKeyWord === searchKeyWord) {
        item.bilibili = newData;
        // item["updateData"] = true
        item["updateDate"] = formatDate(new Date().getTime());
      }
      return item;
    });

    writeLocalDataJson(arr);

    res.json({
      code: 200,
      msg: "更新成功",
    });
  } catch (error) {
    console.error("Error in /data endpoint:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/getPlatformData", async (req, res) => {
  try {
    const jsonData = await getPlatformData();

    async function getPlatformData() {
      // let xhsData = await queryXiaoHongShuAllAccountsData();
      let douyinData = await queryDouYinAllAccountsData();
      let bilibiliData = await querybilibiliAllAccountsData();
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
                specialTagRequirements: e.specialTagRequirements.map((i) => {
                  return {
                    ...i,
                    videoData: douyinData.map((t) => {
                      // 过滤不满足条件的视频
                      const valuedList = t.aweme_list.filter(
                        (l) => {
                          if (i.specialTag == '') return false;
                          return (l.desc.includes(i.specialTag)
                          )
                            &&
                            l.view >= (i.minView || 100)
                        }
                      );
                      // 目前忽视了挂在小手柄问题，可手动isGet调整
                      let alsoRelayList = [];
                      if (i?.videoData?.find((c) => c.userName === t.user.name)) {
                        alsoRelayList = i?.videoData
                          .find((c) => c.userName === t.user.name)
                          .onePlayNumList.filter((l) => {
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
                        onePlayNumList: list,
                      };
                    }),
                  };
                }),
              };
            }
              // else if (e.name === "小红书") {
              //   return {
              //     ...e,
              //     specialTagRequirements: e.specialTagRequirements.map((i) => {
              //       return {
              //         ...i,
              //         videoData: xhsData.map((t) => {
              //           // 过滤不满足条件的视频
              //           const valuedList = t.aweme_list.filter((l) => l.desc
              //             .split(" ")
              //             .map((e) => "#" + e)
              //             .join(" ")
              //             .includes(i.specialTag)
              //           );

              //           let alsoRelayList = [];
              //           if (i?.videoData?.find((c) => c.userName === t.user.name)) {
              //             alsoRelayList = i?.videoData
              //               .find((c) => c.userName === t.user.name)
              //               .onePlayNumList.filter((l) => {
              //                 // 保留活动期间过去发过的稿件数据计入（因为单次可能只发20条数据）
              //                 if (valuedList.find((v) => v.aweme_id === l.aweme_id)) {
              //                   return false;
              //                 }
              //                 // 视频发布时间在活动开始结束期内的  l.create_time < formatSecondTimestamp(sDate) ||
              //                 // if (l.create_time > formatSecondTimestamp(eDate)) {
              //                 //     return false
              //                 // }
              //                 return true;
              //               });
              //           }

            //           let list = valuedList.concat(alsoRelayList);
            //           return {
            //             userName: t.user.name,
            //             allNum: list.length,
            //             allLike: list.reduce((a, b) => a + b.like, 0),
            //             // allViewNum: list.reduce((a, b) => a + b.view, 0),
            //             onePlayNumList: list,
            //           };
            //         }),
            //       };
            //     }),
            //   };
            // }
            else if (e.name === "bilibili") {
              return {
                ...e,
                specialTagRequirements: e.specialTagRequirements.map((differentTopic) => {
                  const hasSameTopicScheduleJob = BiliBiliScheduleJobJson.find(job => job.topicName === differentTopic.topic);

                  return {
                    ...differentTopic,
                    videoData: bilibiliData.map((t) => {
                      const valuedList = t.aweme_list.filter(l => {
                        // 检查视频描述是否包含活动名称
                        const matchesName = l.desc.includes(item.name);
                        // 如果有定时任务，检查视频的文件名称是否在是某个topic的，有则计数
                        let isTopicScheduleJob = false;
                        if (hasSameTopicScheduleJob) {
                          isTopicScheduleJob = hasSameTopicScheduleJob.scheduleJob.some(job => {
                            const jobFileName = job.videoPath.split('\\').pop();
                            return jobFileName.includes(l.title)
                          });
                        }

                        return matchesName || isTopicScheduleJob;
                      });

                      let alsoRelayList = [];
                      if (differentTopic?.videoData?.find((c) => c.userName === t.user.name)) {
                        alsoRelayList = differentTopic?.videoData
                          .find((c) => c.userName === t.user.name)
                          .onePlayNumList.filter((l) => {
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
                        // allLike: list.reduce((a, b) => a + b.like, 0),
                        allViewNum: list.reduce((a, b) => a + b.view, 0),
                        onePlayNumList: list,
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

    setInterval(getPlatformData, 1000 * 60 * 60 * 24);
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

// 根据平台选择配置文件
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

async function executePlatformExpiredJobs(platform) {
  try {
    const { configPath, uploaderPath, accountType } = platformConfig[platform];
    let scheduleJobs = [];
    try {
      scheduleJobs = getJsonData(configPath);
    } catch (err) {
      console.log(`${platform}定时任务配置文件不存在`);
      return;
    }

    const now = new Date();
    const expiredJobs = [];
    // 遍历所有游戏的定时任务，过滤掉已过期的任务
    scheduleJobs.forEach(game => {
      if (game.etime && new Date(game.etime) > now) {
        if (game.scheduleJob && Array.isArray(game.scheduleJob)) {
          const { scheduleJob, ...gameInfo } = game;
          const gameExpiredJobs = scheduleJob
            .filter((job) => {
              if (job.successExecAccount.length >= accountJson[accountType].length) return false // 如果已上传成功，则跳过
              const jobTime = new Date(job.execTime);
              const currentTime = new Date();
              const timeDiff = jobTime - currentTime;
              // 如果执行时间 3 天内且大于 4 小时，则设置定时上传
              const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
              const fourHoursInMs = 4 * 60 * 60 * 1000;
              const latest3days = timeDiff >= fourHoursInMs && timeDiff <= threeDaysInMs

              return (
                jobTime < now || latest3days
              );
            })
            .map((job) => ({
              ...job,
              ...gameInfo,
              platform,
              gameIndex: scheduleJobs.indexOf(game),
              jobIndex: game.scheduleJob.indexOf(job),
            }));
          expiredJobs.push(...gameExpiredJobs);
        }
      }
    });

    for (const job of expiredJobs) {
      if (platform === '抖音' || platform === '小红书') {
        const metaFilePath = path.join(path.dirname(job.videoPath),
          path.basename(job.videoPath, '.mp4') + '.txt');

        if (!fs.existsSync(metaFilePath)) {
          const gameConfig = scheduleJobs[job.gameIndex];
          const metaContent = [
            path.basename(job.videoPath, '.mp4'), // 标题
            gameConfig.tag,                       // 主标签
            gameConfig.gameName                   // 游戏名称
          ].join('\n');

          fs.writeFileSync(metaFilePath, metaContent);
          console.log(`生成${platform}元数据文件: ${metaFilePath}`);
        }
      }

      // 并行执行上传任务
      const uploadPromises = [];
      const MAX_CONCURRENT_UPLOADS = 6; // 最大并发数

      for (let account of accountJson[accountType]) {
        if (job.successExecAccount.includes(account.accountName)) continue;

        // 如果指定了要执行的账号，则只执行指定的账号
        if (job.selectedAccounts && job.selectedAccounts.length > 0 &&
          !job.selectedAccounts.includes(account.accountName)) {
          continue;
        }

        const uploadCmd = generateUploadCommand(platform, uploaderPath, account, job);
        await waitSecond(5000);
        uploadPromises.push(
          (async () => {
            try {
              // 使用信号量控制并发
              await acquireSemaphore(MAX_CONCURRENT_UPLOADS);
              return await new Promise((resolve, reject) => {
                let child;
                // 根据平台类型采用不同的执行方式
                if (platform === 'bilibili') {
                  // Windows系统需要特殊处理参数格式
                  child = spawn(uploadCmd[0], uploadCmd.slice(1), {
                    // windowsVerbatimArguments: true,
                    shell: true
                  });
                } else if (platform === '抖音') {
                  child = spawn(uploadCmd, {
                    shell: true,
                    env: {
                      // ...process.env,
                      PYTHONUTF8: '1',  // 强制Python使用UTF-8编码
                      PYTHONIOENCODING: 'utf-8',  // 设置输入输出编码
                      // 标题输入控制
                      title_control: job.douyinTitleControl ? '1' : '0',
                      // 游戏绑定控制
                      game_binding: job.douyinGameBinding ? '1' : '0'
                    }
                  });
                } else if (platform === '小红书') {
                  child = spawn(uploadCmd, {
                    shell: true,
                    env: {
                      PYTHONUTF8: '1',  // 强制Python使用UTF-8编码
                      PYTHONIOENCODING: 'utf-8'  // 设置输入输出编码
                    }
                  });
                }

                // 捕获标准输出（添加编码处理）
                child.stdout.on('data', (data) => {
                  // 将buffer转为字符串时指定编码，并替换无效字符
                  const output = data.toString('utf8', {
                    stripBOM: true,
                    replacementChar: ''
                  });
                  console.log(`[${account.accountName} stdout]: ${output}`);
                });

                // 捕获错误输出（添加编码处理）
                child.stderr.on('data', (data) => {
                  const errorOutput = data.toString('utf8', {
                    stripBOM: true,
                    replacementChar: ''
                  });
                  console.error(`[${account.accountName} stderr]: ${errorOutput}`);
                });

                child.on('exit', (code) => {
                  releaseSemaphore();
                  if (code === 0) {
                    scheduleJobs[job.gameIndex].scheduleJob[job.jobIndex]
                      .successExecAccount.push(account.accountName);
                    console.log(`${platform}上传成功 ${account.accountName} ${job.videoPath}`);
                    resolve({
                      success: true,
                      accountName: account.accountName
                    });
                  } else {
                    console.error(`${platform}上传失败 ${account.accountName} 退出代码: ${code}`);
                    reject(new Error(`${platform}上传失败 ${account.accountName}`));
                  }
                });
              });
            } catch (err) {
              console.error(`${platform}账号 ${account.accountName} 上传出错:`, err);
              releaseSemaphore(); // 确保即使出错也释放信号量
              return {
                success: false,
                accountName: account.accountName,
                error: err.message
              };
            }
          })()
        );
      }

      // 等待所有上传完成，使用allSettled确保所有任务都被处理
      const results = await Promise.allSettled(uploadPromises);

      // 处理结果
      let successCount = 0;
      let failedCount = 0;

      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value && result.value.success) {
          successCount++;
        } else {
          failedCount++;
          // 记录失败的账号和原因
          const accountName = result.status === 'fulfilled' ?
            result.value?.accountName :
            '未知账号';
          const errorMsg = result.status === 'fulfilled' ?
            result.value?.error :
            result.reason?.message || '未知错误';
          console.error(`${platform}账号 ${accountName} 上传失败: ${errorMsg}`);
        }
      });

      console.log(`${platform}任务执行完成: ${job.videoPath}`);
      console.log(`成功: ${successCount}, 失败: ${failedCount}`);

      // 确保配置文件被更新
      // writeLocalDataJson(scheduleJobs, configPath);
    }


    return {
      code: 200,
      msg: `${platform}过期任务执行完成`,
      data: {
        jobs: scheduleJobs,
        configPath
      }
    };
  } catch (error) {
    console.error(`执行${platform}过期任务失败:`, error);
    return {
      code: 500,
      msg: `执行${platform}过期任务失败`,
    };
  }

  async function waitSecond(time = 5000) {
    const randomDelay = Math.floor(2000 + Math.random() * time); // 随机延迟2-n秒
    await new Promise(resolve => setTimeout(resolve, randomDelay));
  }
}

// 生成平台特定的上传命令
function generateUploadCommand(platform, uploaderPath, account, job) {
  if (platform === 'bilibili') {
    // https://github.com/biliup/biliup-rs 文档
    const configPath = path.join(path.dirname(uploaderPath), `${account.accountName}.json`);
    // 确保使用 UTC+8 时区
    const execTime = new Date(job.execTime);
    const time = execTime.getTime() / 1000;  // 转为10位数时间戳
    // 判断发布时间离当前时间≥4小时且≤3天
    const time_4h_And_15day = time > Date.now() / 1000 + 4 * 3600 && time < Date.now() / 1000 + 3 * 24 * 3600;

    const bilibiliVideoUploadCommand = [
      uploaderPath,
      '-u', `"${configPath}"`,
      'upload',
      '--tag', `${job.tag}`,
      '--mission-id', job.missionId,
      '--tid', job.tid.toString(),
      '--title', `"${path.basename(job.videoPath, ".mp4")}"`,
    ]
    if (time_4h_And_15day) {
      bilibiliVideoUploadCommand.push('--dtime', time, `"${job.videoPath}"`);
    } else {
      bilibiliVideoUploadCommand.push(`"${job.videoPath}"`);
    }
    return bilibiliVideoUploadCommand
  }

  if (platform === '抖音') {
    const execTime = new Date(job.execTime);
    const isPastTime = Date.now() > execTime;
    const formattedTime = isPastTime ? '' :
      `-t "${execTime.toISOString().replace('T', ' ').substring(0, 16)}"`;

    return `python "${path.join(PROJECT_ROOT, 'social-auto-upload/cli_main.py')}" douyin ${account.accountName} upload "${job.videoPath}" -pt ${isPastTime ? 0 : 1} ${isPastTime ? '' : formattedTime}`;
  }

  if (platform === '小红书') {
    const execTime = new Date(job.execTime);
    const isPastTime = Date.now() > execTime;
    const formattedTime = isPastTime ? '' :
      `-t "${execTime.toISOString().replace('T', ' ').substring(0, 16)}"`;

    return `python "${path.join(PROJECT_ROOT, 'social-auto-upload/examples/upload_video_to_xhs.py')}" ${account.accountName} "${job.videoPath}" -pt ${isPastTime ? 0 : 1} ${isPastTime ? '' : formattedTime}`;
  }
}

// 信号量控制
const semaphore = {
  count: 0,
  queue: [],
  async acquire(max) {
    while (this.count >= max) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.count++;
  },
  release() {
    this.count--;
    if (this.queue.length > 0) this.queue.shift()();
  }
};
const acquireSemaphore = (max) => semaphore.acquire(max);
const releaseSemaphore = () => semaphore.release();

async function checkAndExecuteJobs() {
  try {
    const platforms = ['bilibili', '抖音', '小红书'];
    const results = await Promise.allSettled(platforms.map(p => executePlatformExpiredJobs(p)));

    // 记录执行结果
    let successPlatforms = 0;
    let failedPlatforms = 0;

    results.forEach((result, index) => {
      const platformName = platforms[index];

      if (result.status === 'fulfilled' && result.value?.code === 200) {
        successPlatforms++;

        console.log(`${platformName}平台任务执行成功`);
      } else {
        failedPlatforms++;
        console.error(`${platformName}平台任务执行失败:`,
          result.status === 'rejected' ? result.reason : result.value?.msg
        );
      }
      const { jobs, configPath } = result.value.data;
      if (jobs && configPath) {
        writeLocalDataJson(jobs, configPath);
        console.log(`成功写入配置文件: ${configPath}`);
      }
    });

    console.log(`定时任务执行完成统计 - 成功平台数: ${successPlatforms}, 失败平台数: ${failedPlatforms}`);

    return {
      code: 200,
      msg: "定时任务执行完成",
      data: {
        successPlatforms,
        failedPlatforms
      }
    };
  } catch (error) {
    console.error('任务检查异常:', error);
    return {
      code: 500,
      msg: "任务执行异常",
      error: error.message
    };
  }
}


app.post("/scheduleUpload", async (req, res) => {
  async function generateScheduleJobs(videoDir, startTime, intervalHours) {
    const files = fs.readdirSync(videoDir);
    const videoFiles = files.filter((f) => f.endsWith(".mp4"));
    const jobs = [];
    let execTime = new Date(startTime);
    let i = 0
    const h = execTime.getHours()
    for (const file of videoFiles) {
      execTime.setHours(8 + h + i * intervalHours);
      jobs.push({
        videoPath: path.join(videoDir, file),
        execTime: execTime.toISOString(),
        successExecAccount: [],
      });
      // 增加指定的时间间隔
      i++
    }
    return jobs;
  }

  try {
    const {
      gameName,
      platform,
      tag,
      tid,
      missionId,
      videoDir,
      topicName,
      startTime,
      intervalHours,
      immediately,
      etime,
      selectedAccounts,
    } = req.body;

    if (immediately) {
      const result = await checkAndExecuteJobs();
      return res.json(result);
    } else {
      const scheduleJobsPath = platformConfig[platform].configPath;

      let scheduleJobs = [];

      try {
        scheduleJobs = getJsonData(scheduleJobsPath);

      } catch (err) {
        console.log("定时任务配置文件不存在,创建新文件");
        scheduleJobs = [];
      }

      const newJobs = await generateScheduleJobs(videoDir, startTime, intervalHours);

      // 添加平台特定字段
      const baseConfig = {
        gameName,
        topicName,
        missionId,
        tag,
        videoDir,
        scheduleJob: newJobs,
        etime,
        selectedAccounts: selectedAccounts || [], // 添加选定的账号列表
        douyinTitleControl: req.body.douyinTitleControl || false, // 添加抖音标题输入控制
        douyinGameBinding: req.body.douyinGameBinding || false,   // 添加抖音游戏绑定控制
      };

      // 根据平台补充不同字段
      const platformSpecificConfig = platform === 'bilibili' ?
        { tid } :
        { gameName: gameName };

      // 创建或更新配置
      const topicIndex = scheduleJobs.findIndex(g => g.topicName === topicName);
      if (topicIndex === -1) {
        scheduleJobs.push({
          ...baseConfig,
          ...platformSpecificConfig
        });
      } else {
        // 更新现有配置的结束时间和任务
        scheduleJobs[topicIndex].etime = etime;
        scheduleJobs[topicIndex].scheduleJob.push(...newJobs);
      }

      writeLocalDataJson(scheduleJobs, scheduleJobsPath);

      res.json({
        code: 200,
        msg: "任务处理成功",
        jobs: scheduleJobs,
      });
    }
  } catch (error) {
    console.error("处理任务失败:", error);
    res.status(500).json({
      code: 500,
      msg: "处理任务失败",
    });
  }
});

app.get("/getNewTopicData", async (req, res) => {
  try {
    const fetchUrl = "https://member.bilibili.com/x/vupre/web/topic/type/v2";
    const params = {
      pn: 0,
      ps: 200,
      platform: 'pc',
      type_id: 21,
      type_pid: 1008,
      t: Date.now()
    };

    const queryString = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&');

    const response = await fetch(`${fetchUrl}?${queryString}`, {
      headers: {
        ...headers,
        "referer": "https://member.bilibili.com/"
      }
    });

    const topicData = await response.json();

    if (topicData.code === 0 && topicData.data) {
      writeLocalDataJson(topicData.data, "topic.json");

      res.json({
        code: 200,
        msg: "Topic数据更新成功",
        data: topicData.data
      });
    }
    else {
      throw new Error(topicData || "获取Topic数据失败");
    }
  } catch (error) {
    console.error("获取Topic数据时出错:", error);
    res.json({
      msg: error,
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});