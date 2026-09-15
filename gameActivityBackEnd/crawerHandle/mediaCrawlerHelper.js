const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 默认 MediaCrawler 根目录（项目中使用的硬编码路径）
const DEFAULT_CRAWLER_DIR = 'd:\\code\\platform_game_activity\\MediaCrawler';

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
 * 运行 MediaCrawler 命令行获取数据
 * @param {string} platform - 平台标识，例如 'xhs','bili','douyin' 等
 * @param {string} [lt='cookie'] - 登录类型
 * @param {string} [type='creator'] - 爬取类型
 * @param {string} [platformDir] - MediaCrawler 根目录
 * @returns {Promise<void>}
 */
function runMediaCrawlerCommand(platform, lt = 'cookie', type = 'creator', platformDir = DEFAULT_CRAWLER_DIR) {
    return new Promise((resolve, reject) => {
        const command = 'uv';
        const args = ['run', 'main.py', '--platform', platform, '--lt', lt, '--type', type];

        console.log(`执行爬虫命令: ${command} ${args.join(' ')}`);

        const crawler = spawn(command, args, {
            cwd: platformDir,
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        crawler.stdout.on('data', (data) => {
            const text = data.toString();
            stdout += text;
            process.stdout.write(text);
        });

        crawler.stderr.on('data', (data) => {
            const text = data.toString();
            stderr += text;
            process.stderr.write(text);
        });

        crawler.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Crawler exited with code ${code}, stderr: ${stderr}`));
            }
        });

        crawler.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * 读取 MediaCrawler 生成的 JSON 文件
 * @param {string} platform - 平台标识
 * @param {string} [platformDir] - MediaCrawler 根目录
 * @returns {Promise<Array>} 爬虫数据
 */
async function readCrawlerData(platform, platformDir = DEFAULT_CRAWLER_DIR) {
    const dateStr = getFormattedDate();
    const jsonPath = path.join(platformDir, 'data', platform, 'json', `creator_contents_${dateStr}.json`);

    // console.log(`尝试读取爬虫数据文件: ${jsonPath}`);

    try {
        if (!fs.existsSync(jsonPath)) {
            throw new Error(`file not found: ${jsonPath}`);
        }
        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(rawData);
        return data;
    } catch (error) {
        throw new Error(`读取爬虫数据失败: ${error.message}`);
    }
}

/**
 * 检查当日 JSON 文件是否存在
 * @param {string} platform - 平台标识
 * @param {string} [platformDir] - MediaCrawler 根目录
 * @returns {boolean}
 */
function checkJsonFileExists(platform, platformDir = DEFAULT_CRAWLER_DIR) {
    const dateStr = getFormattedDate();
    const jsonPath = path.join(platformDir, 'data', platform, 'json', `creator_contents_${dateStr}.json`);
    const exists = fs.existsSync(jsonPath);
    if (exists) {
        console.log(`✓ 当日数据文件已存在: ${jsonPath}`);
    } else {
        console.log(`✗ 当日数据文件不存在，需要爬取: ${jsonPath}`);
    }
    return exists;
}

/**
 * 通用查询接口，先检查本地 JSON 文件，再决定是否执行爬虫，最后转换数据
 * @param {string} platform - 平台名称
 * @param {Function} transformFn - 用于将原始爬虫数据转换成后端需要的格式
 * @param {string} [platformDir] - MediaCrawler 根目录
 * @returns {Promise<any>}
 */
async function queryPlatformData(platform, transformFn, platformDir = DEFAULT_CRAWLER_DIR) {
    try {

        if (platform === 'dy') {
            platform = 'douyin';
        }
        const fileExists = checkJsonFileExists(platform, platformDir);
        if (!fileExists) {
            if (platform === 'douyin') {
                platform = 'dy';
            }
            await runMediaCrawlerCommand(platform, 'qrcode', 'creator', platformDir);
        }
        const crawlerData = await readCrawlerData(platform, platformDir);
        const transformedData = transformFn(crawlerData);
        console.log(`✓ 数据转换完成，共 ${Array.isArray(transformedData) ? transformedData.length : 0} 项`);
        return transformedData;
    } catch (error) {
        console.error(`✗ ${platform} 数据获取失败: ${error.message}`);
        throw error;
    }
}

module.exports = {
    getFormattedDate,
    runMediaCrawlerCommand,
    readCrawlerData,
    checkJsonFileExists,
    queryPlatformData
};
