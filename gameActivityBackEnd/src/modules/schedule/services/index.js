// const app = require("@/index");
// const express = require('express');
// const router = express.Router();
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { PROJECT_ROOT, platformConfig } = require("../../../../const.js");
const { getJsonData, writeLocalDataJson } = require("../../../../commonFunction.js");
const accountJson = getJsonData("accountList.json")

const platforms = [
    '抖音',
    // '小红书',
    'bilibili'
];

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
                if (job.selectedAccounts.length > 0 &&
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

function generateUploadCommand(platform, uploaderPath, account, job) {

    const execTime = new Date(job.execTime);
    const isPastTime = Date.now() > execTime;
    const formattedTime = isPastTime ? '' :
        `-t "${execTime.toISOString().replace('T', ' ').substring(0, 16)}"`;

    if (platform === 'bilibili') {
        // 读取元数据文件获取标题和描述
        // const metaFilePath = path.join(path.dirname(job.videoPath),
        //     path.basename(job.videoPath, '.mp4') + '.txt');
        let desc = job.topicName // 默认使用活动名作为描述
        // if (fs.existsSync(metaFilePath)) {
        //     const metaContent = fs.readFileSync(metaFilePath, 'utf-8');
        //     const lines = metaContent.split('\n');
        //     desc = lines[0] || desc; // 使用第一行作为描述
        // }

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

async function checkAndExecuteJobs() {
    try {

        const results = await Promise.allSettled(platforms.map(p => executePlatformExpiredJobs(p)));

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
// 将原来的 app.post 逻辑提取为服务函数
async function handleScheduleUpload(body) {
    function generateScheduleJobs(videoDir, startTime, intervalHours) {
        const files = fs.readdirSync(videoDir);
        const videoFiles = files.filter((f) => f.endsWith(".mp4"));
        const jobs = [];
        let execTime = new Date(startTime);
        let i = 0;
        const h = execTime.getHours();
        for (const file of videoFiles) {
            const currentExecTime = new Date(execTime);
            currentExecTime.setHours(8 + h + i * intervalHours);
            jobs.push({
                videoPath: path.join(videoDir, file),
                execTime: currentExecTime.toISOString(),
                successExecAccount: [],
            });
            i++;
        }
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
        selectedAccounts,
        douyinTitleControl,
        douyinGameBinding,
        topicId
    } = body;

    if (immediately) {
        return await checkAndExecuteJobs();
    } else {
        const scheduleJobsPath = platformConfig[platform].configPath;
        let scheduleJobs = [];
        try {
            scheduleJobs = getJsonData(scheduleJobsPath);
        } catch (err) {
            console.log("定时任务配置文件不存在,创建新文件", err);
            scheduleJobs = [];
        }

        const newJobs = generateScheduleJobs(videoDir, startTime, intervalHours, topicName);

        const baseConfig = {
            gameName,
            topicName,
            tag,
            videoDir,
            scheduleJob: newJobs,
            etime,
            selectedAccounts: selectedAccounts || [],
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

// 导出所有服务函数
module.exports = {
    handleScheduleUpload,
    executePlatformExpiredJobs,
    checkAndExecuteJobs,
    generateUploadCommand
};