const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
const { PROJECT_ROOT, platformConfig } = require("../../../../const.ts");
const { getJsonData, writeLocalDataJson } = require("../../../../commonFunction.js");
const accountJson = getJsonData("accountList.json")



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


function generateUploadCommand(platform, uploaderPath, account, job) {

    const execTime = new Date(job.execTime);
    const isPastTime = Date.now() > execTime;
    const formattedTime = isPastTime ? '' :
        `-t "${execTime.toISOString().replace('T', ' ').substring(0, 16)}"`;

    if (platform === 'bilibili') {
        // 读取元数据文件获取标题和描述
        let desc = job.topicName // 默认使用活动名作为描述

        // 构建命令参数
        const params = [
            `python "${path.join(PROJECT_ROOT, 'social-auto-upload/cli_main.py')}"`,
            'bilibili',
            account.accountName,
            'upload',
            `"${job.videoPath}"`,
            '-pt', isPastTime ? 0 : 1
        ];

        // 添加定时发布时间
        if (!isPastTime && formattedTime) {
            params.push(formattedTime);
        }

        // 添加 bilibili 特定参数
        if (job.missionId) {
            params.push('--mission-id', job.missionId);
        }
        if (job.tid) {
            params.push('--tid', job.tid);
        }
        if (desc) {
            params.push('--desc', `"${desc}"`);
        }
        if (job.topicId) {
            params.push('--topic-id', job.topicId);
        }
        return params.join(' ');
    }


    else if (platform === '抖音') {
        return `python "${path.join(PROJECT_ROOT, 'social-auto-upload/cli_main.py')}" douyin ${account.accountName} upload "${job.videoPath}" -pt ${isPastTime ? 0 : 1} ${isPastTime ? '' : formattedTime}`;
    }

    else if (platform === '小红书') {
        return `python "${path.join(PROJECT_ROOT, 'social-auto-upload/examples/upload_video_to_xhs.py')}" ${account.accountName} "${job.videoPath}" -pt ${isPastTime ? 0 : 1} ${isPastTime ? '' : formattedTime}`;
    }
}

async function executePlatformExpiredJobs(platform) {
    try {
        const { configPath, uploaderPath, accountType } = platformConfig[platform];
        let scheduleJobs = [];
        try {
            scheduleJobs = getJsonData(configPath);
        } catch (err) {
            console.log(`${platform}定时任务配置文件不存在`, err);
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
                            // 如果执行时间 7 天内且大于 4 小时，则设置定时上传
                            const threeDaysInMs = 7 * 24 * 60 * 60 * 1000;
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
            const metaFilePath = path.join(path.dirname(job.videoPath),
                path.basename(job.videoPath, '.mp4') + '.txt');

            if (!fs.existsSync(metaFilePath)) {
                const gameConfig = scheduleJobs[job.gameIndex];
                const metaContent = [
                    path.basename(job.videoPath, '.mp4'), // 标题
                    gameConfig.tag,                       // 主标签
                    gameConfig.gameName                   // 游戏名称
                    // gameConfig.desc                       // 描述 bilibili使用，方便后续聚合查询数据
                ].join('\n');

                fs.writeFileSync(metaFilePath, metaContent);
                console.log(`生成${platform}元数据文件: ${metaFilePath}`);
            }

            // 并行执行上传任务
            const uploadPromises = [];
            const MAX_CONCURRENT_UPLOADS = 6; // 最大并发数

            for (let account of accountJson[accountType]) {
                if (job.successExecAccount.includes(account.accountName)) continue;

                // 如果指定了要执行的账号，则只执行指定的账号
                if (job.needExecAccounts.length > 0 &&
                    !job.needExecAccounts.includes(account.accountName)) {
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
                                    child = spawn(uploadCmd, {
                                        shell: true,
                                        env: {
                                            PYTHONUTF8: '1',  // 强制Python使用UTF-8编码
                                            PYTHONIOENCODING: 'utf-8'  // 设置输入输出编码
                                        }
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

async function executePlatformScheduleJobs() {
    try {

        const results = await Promise.allSettled([
            '抖音',
            '小红书',
            'bilibili'
        ].map(p => executePlatformExpiredJobs(p)));

        // 记录执行结果
        let successPlatforms = 0;
        let failedPlatforms = 0;

        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value?.code === 200) {
                successPlatforms++;
            } else {
                failedPlatforms++;
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

async function handleScheduleUpload(body) {
    // 生成一组按间隔排布的定时任务
    // 使用 dayjs + 时区插件确保按东八区北京时间计算，避免原始 setHours 方法
    // 在 startTime 传入的 ISO 字符串中已有 UTC 信息，我们转换到 东八区 Asia/Shanghai 处理。
    function generateScheduleJobs(videoDir, startTime, intervalHours, existingJobs) {
        const files = fs.readdirSync(videoDir);
        const videoFiles = files.filter((f) => f.endsWith(".mp4"));
        const gameExistingJobs = existingJobs.find(g => g.videoDir === videoDir);
        const jobs = [];

        // 确保文件顺序稳定（按文件名排序），避免因文件顺序导致的时间错位
        videoFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        // 确保 intervalHours 为数字
        const hours = Number(intervalHours) || 0;
        const base = dayjs.tz(startTime)

        videoFiles.filter(file => {
            // 如果已有任务中存在相同视频路径的任务，则跳过生成新任务，避免重复
            if (gameExistingJobs?.scheduleJob) {
                const exists = gameExistingJobs.scheduleJob.some(job => job.videoPath === path.join(videoDir, file));
                return !exists;
            }
            return true;
        }).forEach((file, idx) => {
            // 使用 immutable 的 add 生成每个任务时间，最后转为 ISO UTC 字符串保存

            const exec = base.add(8 + (hours * (idx)), 'hour');
            jobs.push({
                videoPath: path.join(videoDir, file),
                execTime: exec.toISOString(), // UTC 格式，前端按本地显示
                successExecAccount: [],
            });
        });

        return jobs;
    }

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
        needExecAccounts,
        douyinTitleControl,
        douyinGameBinding,
        topicId
    } = body;

    if (immediately) {
        return await executePlatformScheduleJobs();
    } else {
        const scheduleJobsPath = platformConfig[platform].configPath;
        let scheduleJobs = [];
        try {
            scheduleJobs = getJsonData(scheduleJobsPath);
        } catch (err) {
            console.log("定时任务配置文件不存在,创建新文件", err);
            scheduleJobs = [];
        }


        const newJobs = generateScheduleJobs(videoDir, startTime, intervalHours, scheduleJobs);

        const baseConfig = {
            gameName,
            topicName,
            tag,
            videoDir,
            scheduleJob: newJobs,
            etime,
            needExecAccounts: needExecAccounts || [],
        };
        // 抖音平台才增加控制
        if (platform === '抖音') {
            baseConfig.douyinTitleControl = douyinTitleControl;
            baseConfig.douyinGameBinding = douyinGameBinding;
        }

        if (platform === 'bilibili') {
            baseConfig.tid = tid;
            baseConfig.missionId = missionId;
            baseConfig.topicId = topicId;
            // baseConfig.topicName = topicName;
        }



        const sameTopicIndex = scheduleJobs.findIndex(g => g.topicName === topicName);
        if (sameTopicIndex === -1) {
            scheduleJobs.push({
                ...baseConfig,
            });
        } else {
            const filterNewJobs = newJobs.filter(job => !scheduleJobs[sameTopicIndex].scheduleJob.some(j => j.videoPath === job.videoPath));
            // scheduleJobs[sameTopicIndex].scheduleJob.push(...filterNewJobs);
            // 更新新的videoPath，更新新的设置
            scheduleJobs[sameTopicIndex] = { ...baseConfig, scheduleJob: [...scheduleJobs[sameTopicIndex].scheduleJob, ...filterNewJobs] }
        }

        // 删除超过时间的任务
        const now = new Date();
        scheduleJobs = scheduleJobs.filter(game => {
            if (game.etime && new Date(game.etime) < now) {
                return false;
            }
            return true;
        });


        writeLocalDataJson(scheduleJobs, scheduleJobsPath);

        return {
            code: 200,
            msg: "任务处理成功",
            jobs: scheduleJobs,
        };
    }
}

async function handleExecuteScheduleJobs(body) {
    try {
        const { jobs, accountsByPlatform, percentByTopic } = body;

        // if (!jobs || jobs.length === 0) {
        //     return { code: 400, msg: '没有要执行的任务' };
        // }

        // 达标阈值定义：各平台分发账户数要求
        const requiredAccountsThreshold = {
            'bilibili': 3,
            '抖音': 2,
            '小红书': 1,
        };


        const byPlatformTopic = {};
        jobs.forEach(j => {
            const key = `${j.platform}::${j.topicName}`;
            if (!byPlatformTopic[key]) byPlatformTopic[key] = [];
            byPlatformTopic[key].push(j);
        });

        // const filteredJobs = [];

        // for (const [platformTopicKey, jobList] of Object.entries(byPlatformTopic)) {
        //     const [platform, topicName] = platformTopicKey.split('::');
        //     const cfg = platformConfig[platform];
        //     if (!cfg) continue;

        //     const configPath = cfg.configPath;
        //     let scheduleJobs = [];
        //     try {
        //         scheduleJobs = getJsonData(configPath) || [];
        //     } catch (err) {
        //         console.warn(`读取 ${platform} 定时任务配置失败:`, err);
        //         continue;
        //     }

        //     // 找到对应话题的配置
        //     const targetGame = scheduleJobs.find(g => g.topicName === topicName);
        //     if (!targetGame) continue;

        //     const requiredNum = requiredAccountsThreshold[platform] || 1;

        //     // 参考前端提供的百分比数据判断跳过
        //     const percentMap = (percentByTopic && percentByTopic[topicName]) || {};
        //     jobList.forEach(job => {
        //         const scheduleJobItem = (targetGame.scheduleJob || []).find(
        //             sj => sj.videoPath === job.videoPath && sj.execTime === job.execTime
        //         );

        //         if (!scheduleJobItem) {
        //             console.warn(`未找到匹配的定时任务项: ${job.videoPath}`);
        //             return;
        //         }

        //         // 计算该视频对应账户是否全部达到100%（若有 percentMap 提供）
        //         let allAccountsDone = true;
        //         const accounts = accountsByPlatform && accountsByPlatform[platform] ? accountsByPlatform[platform] : [];
        //         if (accounts.length && Object.keys(percentMap).length) {
        //             accounts.forEach(acc => {
        //                 const p = percentMap[acc] || 0;
        //                 if (p < 100) allAccountsDone = false;
        //             });
        //         } else {
        //             const executedCount = (scheduleJobItem.successExecAccount || []).length;
        //             allAccountsDone = executedCount >= requiredNum;
        //         }

        //         if (allAccountsDone) {
        //             console.log(`跳过已达标稿件(按percent): ${job.topicName} - ${job.videoPath}`);
        //             return;
        //         }

        //         filteredJobs.push({
        //             ...job,
        //             requiredNum,
        //             executedAccounts: scheduleJobItem.successExecAccount || []
        //         });
        //     });
        // }

        // if (filteredJobs.length === 0) {
        //     return {
        //         code: 200,
        //         msg: '所有选中稿件均已达标或未找到匹配项，跳过执行',
        //         data: { filteredCount: 0, totalCount: jobs.length }
        //     };
        // }

        // 触发检查并执行（使用已有的检查逻辑）
        const execResult = await executePlatformScheduleJobs();
        return {
            code: 200,
            msg: '已触发执行',
            data: {
                ...execResult.data,
                // filteredJobs: filteredJobs.length,
                totalJobs: jobs.length,
                // skippedJobs: jobs.length - filteredJobs.length
            }
        };
    } catch (err) {
        console.error('handleExecuteScheduleJobs 错误:', err);
        return { code: 500, msg: '执行失败', error: err.message };
    }
}

module.exports = {
    handleScheduleUpload,
    handleExecuteScheduleJobs,
    executePlatformExpiredJobs,
    checkAndExecuteJobs: executePlatformScheduleJobs,
    generateUploadCommand
};