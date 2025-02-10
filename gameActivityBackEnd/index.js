const fs = require("fs");
const express = require("express");
const cors = require("cors");
const app = express();
const port = 3000;
const path = require("path");
const { exec, spawn } = require("child_process");
const schedule = require("node-schedule");

const {
  concurrentFetchWithDelay,
  calculateTotalMoney,
  formatDate,
  getOldData,
  formatSecondTimestamp,
} = require("./commonFunction.js");
const { queryDouYinAllAccountsData } = require("./handleCrawer/douyin.js");
const { queryXiaoHongShuAllAccountsData } = require("./handleCrawer/xhs.js");
const { querybilibiliAllAccountsData } = require("./handleCrawer/bilibili.js");
const {
  ffmpegHandleVideos,
} = require("../TikTokDownloader/videoReName_FFmpegHandle.js");
const {
  downloadVideosAndGroup,
} = require("../TikTokDownloader/videoDownloadAndGroupList.js");
const { allGameList } = require("../allGameNameList.js");
const accountJson = getOldData("./jsonFile/accountList.json");


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

async function writeLocalDataJson(arr, fileName = "data.json") {
  const data = JSON.stringify(arr, null, 2);
  fs.writeFileSync(fileName, data);
}

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
    // 按时间过滤出活动稿件
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
      let oldDataArr = getOldData();
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
                // searchKeyWord: oldDataHasThisRewardsItem.searchKeyWord,
                // baseTopic: oldDataHasThisRewardsItem.baseTopic,
                // specialTagAll: oldDataHasThisRewardsItem.specialTagAll,
                // rewards: oldDataHasThisRewardsItem.rewards,
                // bilibili: oldDataHasThisRewardsItem.bilibili,
                // lastJudgeTime: oldDataHasThisRewardsItem.lastJudgeTime,
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

      let oldOtherDataArr = getOldData("./gameData.json");
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
            specialTag: "#" + item.name,
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
      writeLocalDataJson(oldOtherDataArr, "./gameData.json");

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

    let { gameName, platformName, isUpdate } = platformData;
    delete platformData.isUpdate;

    // 读取现有的 gameData.json 文件
    let oldOtherDataArr = getOldData("./gameData.json");

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
      // if (!isUpdate) oldOtherDataArr[gameIndex].rewards[platformIndex].specialTagRequirements = platformData.specialTagRequirements.concat(oldOtherDataArr[gameIndex].rewards[platformIndex].specialTagRequirements)
      // else
      oldOtherDataArr[gameIndex].rewards[platformIndex] = platformData;
    }

    // 写入本地文件
    writeLocalDataJson(oldOtherDataArr, "./gameData.json");

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

app.get("/getNewDakaData", async (req, res) => {
  try {
    async function getDakaNewData() {
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
          // 自动去登录B站获取新的Cookie
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
    const data = await getDakaNewData();
    res.json(data);
  } catch (error) {
    console.error("Error in /data endpoint:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/data", async (req, res) => {
  try {
    // 每次都实时读取data.json 文件并返回
    const data = getOldData();

    let otherGameData = getOldData("./gameData.json");
    // 计算otherGameData rewards下各平台specialTagRequirements里的最近的活动结束时间，并赋值给最外层etime
    otherGameData.forEach((game) => {
      let minEtime = game.etime || Number.MAX_SAFE_INTEGER; // 默认活动最大
      game.rewards.forEach((reward) => {
        if (reward.specialTagRequirements) {
          reward.specialTagRequirements = reward.specialTagRequirements.filter(
            (e) => {
              const dateTime = formatSecondTimestamp(e.eDate + ' 23:59:59');
              console.log("🚀 ~ game.rewards.forEach ~ dateTime:", e.name, dateTime > new Date().getTime())
              return (dateTime) >
                new Date().getTime()
            }

          );
          reward.specialTagRequirements.forEach((requirement) => {
            if (requirement.eDate) {
              const eTime =
                (new Date(requirement.eDate).getTime() + 24 * 60 * 60 * 60) /
                1000;
              // // 如果结束日期小于当天的time，则跳过 不计入最近结束日期
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

    let dakaData = getOldData("./B站打卡活动.json");

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

app.post("/updateDataOne", async (req, res) => {
  try {
    // 获取参数
    const { searchKeyWord } = req.body;
    const newData = await get_BiliBili_Data(req.body);
    const oldDataArr = getOldData();
    // 查找并替换newData
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
  let douyinData = [];
  let xhsData = [];
  let bilibiliData = [];
  try {
    // const { rewardName } = req.body;
    douyinData = await queryDouYinAllAccountsData();
    xhsData = await queryXiaoHongShuAllAccountsData();
    // else if (rewardName === '快手') data = await queryXiaoHongShuAllAccountsData();
    // else if (rewardName === 'BiliBili') data = await queryXiaoHongShuAllAccountsData();
    bilibiliData = await querybilibiliAllAccountsData();
    const oldOtherGameDataArr = getOldData("./gameData.json");
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
                      (l) =>
                        l.desc.includes(i.specialTag) &&
                        l.view >= (i.minView || 100)
                    );
                    // 目前忽视了挂在小手柄问题，可手动isGet调整

                    let alsoRelayList = [];
                    if (i?.videoData?.find((c) => c.userName === t.user.name)) {
                      alsoRelayList = i?.videoData
                        .find((c) => c.userName === t.user.name)
                        .onePlayNumList.filter((l) => {
                          // 保留活动期间过去发过的稿件数据计入（因为单次可能只发36条数据）
                          if (
                            valuedList.find((v) => v.aweme_id === l.aweme_id)
                          ) {
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
          } else if (e.name === "小红书") {
            return {
              ...e,
              specialTagRequirements: e.specialTagRequirements.map((i) => {
                return {
                  ...i,
                  videoData: xhsData.map((t) => {
                    // 过滤不满足条件的视频
                    const valuedList = t.aweme_list.filter((l) =>
                      l.desc
                        .split(" ")
                        .map((e) => "#" + e)
                        .join(" ")
                        .includes(i.specialTag)
                    );

                    let alsoRelayList = [];
                    if (i?.videoData?.find((c) => c.userName === t.user.name)) {
                      alsoRelayList = i?.videoData
                        .find((c) => c.userName === t.user.name)
                        .onePlayNumList.filter((l) => {
                          // 保留活动期间过去发过的稿件数据计入（因为单次可能只发20条数据）
                          if (
                            valuedList.find((v) => v.aweme_id === l.aweme_id)
                          ) {
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
                      allLike: list.reduce((a, b) => a + b.like, 0),
                      // allViewNum: list.reduce((a, b) => a + b.view, 0),
                      onePlayNumList: list,
                    };
                  }),
                };
              }),
            };
          } else if (e.name === "bilibili") {
            return {
              ...e,
              specialTagRequirements: e.specialTagRequirements.map((i) => {
                return {
                  ...i,
                  videoData: bilibiliData.map((t) => {
                    // 过滤不满足条件的视频
                    const valuedList = t.aweme_list.filter(
                      (l) =>
                        l.title.includes(item.name) ||
                        l.desc.includes(item.name)
                    );

                    let alsoRelayList = [];
                    if (i?.videoData?.find((c) => c.userName === t.user.name)) {
                      alsoRelayList = i?.videoData
                        .find((c) => c.userName === t.user.name)
                        .onePlayNumList.filter((l) => {
                          // 保留活动期间过去发过的稿件数据计入（因为单次可能只发20条数据）
                          if (
                            valuedList.find((v) => v.aweme_id === l.aweme_id)
                          ) {
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
    // 写入本地文件
    writeLocalDataJson(jsonData, "./gameData.json");

    res.json({
      code: 200,
      data: jsonData,
      msg: "更新成功",
    });
  } catch (error) {
    writeLocalDataJson(douyinData, "./jsonFile/douyinHandleData.json");
    writeLocalDataJson(xhsData, "./jsonFile/xhsHandleData.json");
    console.error("Error in /data endpoint:", error);
    res.status(500).send("Internal Server Error");
  }
});

// schedule.scheduleJob("0 40 11 * * *", async () => {
//   try {
//     const cmd =
//       "C:\\Users\\ChrisWang\\Downloads\\bilibili-tool-pro-v2.1.3-win-x64\\win-x64\\Ray.BiliBiliTool.Console.exe";
//     const child = spawn(cmd);

//     child.stdout.on("data", (data) => {
//       console.log(`养号执行成功: ${data}`);
//     });

//     child.stderr.on("data", (data) => {
//       console.error(`养号执行失败: ${data}`);
//     });

//     child.on("close", (code) => {
//       console.log(`子进程退出，退出码 ${code}`);
//     });
//   } catch (error) {
//     console.error("定时养号出错:", error);
//   }
// });

async function executeExpiredJobs() {
  try {
    // 读取定时任务配置
    const scheduleJobsPath = "./scheduleJob/BiliBiliScheduleJob.json";
    let scheduleJobs = [];
    try {
      scheduleJobs = JSON.parse(fs.readFileSync(scheduleJobsPath));
    } catch (err) {
      console.log("定时任务配置文件不存在");
      return;
    }

    const now = new Date();
    const expiredJobs = [];

    // 遍历所有游戏的定时任务
    scheduleJobs.forEach((game) => {
      if (game.scheduleJob && Array.isArray(game.scheduleJob)) {
        const gameExpiredJobs = game.scheduleJob
          .filter((job) => {
            const jobTime = new Date(job.execTime);
            return (
              jobTime < now &&
              job.successExecAccount.length < accountJson.bilibili.length
            );
          })
          .map((job) => ({
            ...job,
            tag: game.tag,
            tid: game.tid,
            missionId: game.missionId,
            gameIndex: scheduleJobs.indexOf(game),
            jobIndex: game.scheduleJob.indexOf(job),
          }));
        expiredJobs.push(...gameExpiredJobs);
      }
    });

    // 立即执行过期任务
    for (const job of expiredJobs) {
      for (let account of accountJson.bilibili) {
        try {
          if (job.successExecAccount.includes(account.accountName)) continue;

          const BILIUP_PATH =
            "C:\\Users\\ChrisWang\\code\\platform_game_activity\\social-auto-upload\\uploader\\bilibili_uploader\\";
          const uploadCmd = `"${BILIUP_PATH}biliup.exe"  -u "${BILIUP_PATH}${account.accountName
            }.json" upload --tag "${job.tag}" --mission-id "${job.missionId
            }" --tid ${job.tid} --title "${path.basename(
              job.videoPath,
              ".mp4"
            )}" "${job.videoPath}"`;

          // 间隔随机时间 防止过快
          const randomDelay = Math.floor(Math.random() * 5000);
          await new Promise((resolve) => setTimeout(resolve, randomDelay));

          await new Promise((resolve, reject) => {
            exec(uploadCmd, (error, stdout, stderr) => {
              if (error) {
                console.error(`上传失败 ${account.accountName}: ${error}`);
                reject(error);
                return;
              }
              // 更新原始scheduleJobs中对应任务的successExecAccount
              scheduleJobs[job.gameIndex].scheduleJob[
                job.jobIndex
              ].successExecAccount.push(account.accountName);
              console.log(`上传成功 ${account.accountName}  ${job.videoPath}`);

              resolve();
            });
          });
        } catch (err) {
          console.error(`账号 ${account.accountName} 上传出错:`, err);
        }
      }
    }

    // 所有任务执行完成后统一写入文件
    fs.writeFileSync(
      "./scheduleJob/BiliBiliScheduleJob.json",
      JSON.stringify(scheduleJobs, null, 2)
    );

    return {
      code: 200,
      msg: "过期任务执行完成",
      jobs: scheduleJobs,
    };
  } catch (error) {
    console.error("执行过期任务失败:", error);
    return {
      code: 500,
      msg: "执行过期任务失败",
    };
  }
}

setInterval(executeExpiredJobs, 2 * 60 * 60 * 1000);

app.post("/scheduleUpload", async (req, res) => {
  // 生成定时上传任务
  async function generateScheduleJobs(videoDir, startTime, intervalHours) {
    const files = fs.readdirSync(videoDir);
    const videoFiles = files.filter((f) => f.endsWith(".mp4"));

    const jobs = [];

    let execTime = new Date(startTime);

    for (const file of videoFiles) {
      jobs.push({
        videoPath: path.join(videoDir, file),
        execTime: new Date(execTime),
        successExecAccount: [],
      });
      // 增加指定的时间间隔
      execTime.setHours(execTime.getHours() + intervalHours);
    }

    return jobs;
  }

  try {
    const {
      tag,
      tid,
      missionId,
      videoDir,
      topicName,
      startTime,
      intervalHours,
      immediately,
    } = req.body;

    // 生成定时上传任务或手动执行

    const scheduleJobsPath = "./scheduleJob/BiliBiliScheduleJob.json";


    let scheduleJobs = [];
    try {
      scheduleJobs = JSON.parse(fs.readFileSync(scheduleJobsPath));
    } catch (err) {
      console.log("定时任务配置文件不存在,创建新文件");
      scheduleJobs = [];
    }

    if (immediately) {
      // 立即执行上传 executeExpiredJobs
      await executeExpiredJobs();
    } else {
      // 生成新的定时任务
      const newJobs = await generateScheduleJobs(
        videoDir,
        startTime,
        intervalHours
      );

      // 创建或更新定时任务配置
      const gameIndex = scheduleJobs.findIndex(
        (game) => game.missionId === missionId
      );
      if (gameIndex === -1) {
        // 添加新游戏配置
        scheduleJobs.push({
          topicName: topicName,
          missionId,
          tag,
          tid,
          videoDir,
          scheduleJob: newJobs,
        });
      } else {
        // 更新现有游戏配置
        scheduleJobs[gameIndex].scheduleJob = newJobs;
      }

      // 保存配置到文件
      fs.writeFileSync(scheduleJobsPath, JSON.stringify(scheduleJobs, null, 2));

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

app.get("/unfavorableReply", async (req, res) => {
  const unfavorableWords = [
    { id: 1, keyword: "抄" },
    { id: 2, keyword: "侵权" },
    { id: 6, keyword: "洗稿" },
    { id: 5, keyword: "搬运" },
    { id: 5, keyword: "盗" },
  ];

  const messageList = await concurrentFetchWithDelay(
    unfavorableWords.map((word) => {
      // 查询接口 fetch GET  https://api.bilibili.com/x/v2/reply/up/fulllist?keyword=${keyword}&order=1&filter=-1&type=1&bvid=&pn=1&ps=50&charge_plus_filter=false
      return () =>
        fetch(
          `https://api.bilibili.com/x/v2/reply/up/fulllist?keyword=${word.keyword}&order=1&filter=-1&type=1&bvid=&pn=1&ps=10&charge_plus_filter=false`,
          {
            headers,
          }
        ).then(async (response) => {
          // Process the data and return the results
          const result = await response.json();
          return (
            result?.data?.list?.map((wordData) => {
              return {
                bvid: wordData.bvid,
                oid: wordData.oid,
                rpid: wordData.rpid,
                message: wordData.content.message,
              };
            }) ?? []
          );
        });
    })
  );

  // Return the results as JSON
  res.json(messageList.flat());
});

app.post("/deleteUnfavorableReply", async (req, res) => {
  try {
    // 获取参数
    const { oid, rpid } = req.body;

    const jsonBody = {
      type: 1,
      rpid: rpid,
      oid: oid,
      jsonp: "jsonp",
      csrf: csrfToken,
    };
    const response = await fetch(`https://api.bilibili.com/x/v2/reply/del`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: JSON.stringify(jsonBody),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error in /data endpoint:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
