const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * 获取系统日期格式 YYYY-MM-DD
 */
function getFormattedDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 调用MediaCrawler爬虫获取小红书创作者笔记详情
 * 执行命令: uv run main.py --platform xhs --lt cookie --type creator
 * @param {string} platformDir - MediaCrawler项目根目录路径
 * @returns {Promise<Array>} 爬虫采集的原始数据
 */
async function runMediaCrawlerCommand(platformDir = 'd:\\code\\platform_game_activity\\MediaCrawler') {
    return new Promise((resolve, reject) => {
        const command = 'uv';
        const args = ['run', 'main.py', '--platform', 'xhs', '--lt', 'cookie', '--type', 'creator'];

        console.log(`执行爬虫命令: ${command} ${args.join(' ')}`);

        const crawler = spawn(command, args, {
            cwd: platformDir,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'] // stdin, stdout, stderr
        });

        let stdout = '';
        let stderr = '';

        crawler.stdout.on('data', (data) => {
            stdout += data.toString();
            console.log(`[爬虫输出] ${data.toString()}`);
        });

        crawler.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error(`[爬虫错误] ${data.toString()}`);
        });

        crawler.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`爬虫执行失败，错误代码: ${code}\n${stderr}`));
            } else {
                console.log('爬虫执行完成');
                resolve();
            }
        });

        crawler.on('error', (err) => {
            reject(new Error(`无法启动爬虫进程: ${err.message}`));
        });
    });
}

/**
 * 读取MediaCrawler生成的JSON文件
 * @param {string} platformDir - MediaCrawler项目根目录
 * @returns {Promise<Array>} 爬虫数据
 */
async function readCrawlerData(platformDir = 'd:\\code\\platform_game_activity\\MediaCrawler') {
    const dateStr = getFormattedDate();
    const jsonPath = path.join(platformDir, 'data', 'xhs', 'json', `creator_contents_${dateStr}.json`);

    console.log(`尝试读取爬虫数据文件: ${jsonPath}`);

    try {
        if (!fs.existsSync(jsonPath)) {
            throw new Error(`数据文件不存在: ${jsonPath}`);
        }

        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(rawData);
        console.log(`成功读取 ${data.length} 条笔记数据`);
        return data;
    } catch (error) {
        throw new Error(`读取爬虫数据失败: ${error.message}`);
    }
}

/**
 * 将MediaCrawler的数据格式转换为BackEnd项目所需的格式
 * MediaCrawler数据格式 -> BackEnd数据格式
 * @param {Array} crawlerData - MediaCrawler爬虫的原始数据
 * @returns {Array} 转换后的数据
 */
function transformCrawlerData(crawlerData) {
    if (!Array.isArray(crawlerData)) {
        throw new Error('爬虫数据格式错误，应为数组');
    }

    // 按用户分组
    const userMap = new Map();

    crawlerData.forEach((note) => {
        const userId = note.user_id || note.nickname;
        
        if (!userMap.has(userId)) {
            userMap.set(userId, {
                user: {
                    name: note.nickname || '',
                    avatar: note.avatar || '',
                    ip_location: note.ip_location || ''
                },
                aweme_list: []
            });
        }

        const user = userMap.get(userId);
        user.aweme_list.push({
            aweme_id: note.note_id,
            desc: note.desc || '',
            title: note.title || '',
            type: note.type === 'normal' ? 'image' : 'video', // video 或 image
            like: Number(note.liked_count) || 0,
            collected_count: Number(note.collected_count) || 0,
            comment_count: Number(note.comment_count) || 0,
            share_count: Number(note.share_count) || 0,
            tag_list: note.tag_list || '',
        });
    });

    // 转换为数组格式
    return Array.from(userMap.values());
}

/**
 * 检查当日的JSON文件是否存在
 * @param {string} platformDir - MediaCrawler项目根目录
 * @returns {boolean} 文件是否存在
 */
function checkJsonFileExists(platformDir = 'd:\\code\\platform_game_activity\\MediaCrawler') {
    const dateStr = getFormattedDate();
    const jsonPath = path.join(platformDir, 'data', 'xhs', 'json', `creator_contents_${dateStr}.json`);
    const exists = fs.existsSync(jsonPath);
    
    if (exists) {
        console.log(`✓ 当日数据文件已存在: ${jsonPath}`);
    } else {
        console.log(`✗ 当日数据文件不存在，需要爬取: ${jsonPath}`);
    }
    
    return exists;
}

/**
 * 查询小红书所有账号的数据
 * 先检查当日数据是否已存在，存在则直接使用，否则调用爬虫
 * @param {string} platformDir - MediaCrawler项目根目录，默认值: d:\code\platform_game_activity\MediaCrawler
 * @returns {Promise<Array>} 转换后的笔记数据
 */
async function queryXiaoHongShuAllAccountsData(platformDir = 'd:\\code\\platform_game_activity\\MediaCrawler') {
    try {
        console.log('开始获取小红书笔记数据...');
        
        // 1. 检查当日数据文件是否存在
        const fileExists = checkJsonFileExists(platformDir);
        
        // 2. 如果文件不存在，调用爬虫获取数据
        if (!fileExists) {
            console.log('调用MediaCrawler爬虫获取数据...');
            await runMediaCrawlerCommand(platformDir);
        } else {
            console.log('跳过爬虫，直接使用已存在的数据文件');
        }

        // 3. 读取爬虫生成的JSON文件
        const crawlerData = await readCrawlerData(platformDir);

        // 4. 转换数据格式
        const transformedData = transformCrawlerData(crawlerData);

        console.log(`✓ 数据转换完成，共 ${transformedData.length} 个用户`);
        return transformedData;
    } catch (error) {
        console.error(`✗ 小红书数据获取失败: ${error.message}`);
        throw error;
    }
}

/**
 * 直接读取已有的爬虫数据（不重新爬取）
 * 用于调试或离线处理
 */
async function readXiaoHongShuData(platformDir = 'd:\\code\\platform_game_activity\\MediaCrawler') {
    try {
        const crawlerData = await readCrawlerData(platformDir);
        return transformCrawlerData(crawlerData);
    } catch (error) {
        console.error(`读取小红书数据失败: ${error.message}`);
        throw error;
    }
}






module.exports = {
    queryXiaoHongShuAllAccountsData,
    readXiaoHongShuData,
    runMediaCrawlerCommand,
    readCrawlerData,
    transformCrawlerData,
    checkJsonFileExists,
    getFormattedDate
}   