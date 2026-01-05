const fs = require('fs');
const path = require('path');
const { writeLog } = require('./common.js');

// 任务状态常量
const TASK_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// 任务进度类
class TaskProgress {
  constructor(taskId, config) {
    this.taskId = taskId;
    this.status = TASK_STATUS.PENDING;
    this.config = config;
    this.progress = {
      total: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      processedFiles: [],
      failedFiles: {},
      startTime: Date.now(),
      lastUpdateTime: Date.now()
    };
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      taskId: this.taskId,
      status: this.status,
      config: this.config,
      progress: this.progress,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

// 任务存储目录
const TASK_DIR = path.join(__dirname, '../jsonFile/taskProgress');

// 确保任务目录存在
function ensureTaskDir() {
  if (!fs.existsSync(TASK_DIR)) {
    fs.mkdirSync(TASK_DIR, { recursive: true });
    writeLog(`创建任务状态目录: ${TASK_DIR}`);
  }
}

// 生成任务ID
function generateTaskId(basicVideoInfoObj) {
  const { gameName, groupName } = basicVideoInfoObj;
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const time = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  return `${date}_${time}_${gameName}_${groupName}`;
}

// 保存任务进度
function saveTaskProgress(taskId, progressData) {
  ensureTaskDir();
  const filePath = path.join(TASK_DIR, `${taskId}.json`);

  // 更新时间戳
  progressData.updatedAt = new Date().toISOString();

  fs.writeFileSync(filePath, JSON.stringify(progressData, null, 2), 'utf8');
  writeLog(`保存任务进度: ${taskId}`);
}

// 加载任务进度
function loadTaskProgress(taskId) {
  const filePath = path.join(TASK_DIR, `${taskId}.json`);

  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const taskData = JSON.parse(data);
      writeLog(`加载任务进度: ${taskId}`);
      return taskData;
    } catch (error) {
      writeLog(`加载任务进度失败: ${taskId}, 错误: ${error.message}`);
      return null;
    }
  }

  return null;
}

// 更新任务进度
function updateTaskProgress(taskId, filePath, status, error = null) {
  const task = loadTaskProgress(taskId);
  if (!task) {
    writeLog(`任务不存在，无法更新: ${taskId}`);
    return;
  }

  const fileName = path.basename(filePath);

  if (status === 'success') {
    task.progress.processed++;
    if (!task.progress.processedFiles.includes(fileName)) {
      task.progress.processedFiles.push(fileName);
    }
    writeLog(`[${taskId}] 文件处理成功: ${fileName} (进度: ${task.progress.processed}/${task.progress.total})`);
  } else if (status === 'failed') {
    task.progress.failed++;
    task.progress.failedFiles[fileName] = error || '未知错误';
    writeLog(`[${taskId}] 文件处理失败: ${fileName}, 错误: ${error}`);
  }

  task.progress.lastUpdateTime = Date.now();
  saveTaskProgress(taskId, task);
}

// 初始化任务
function initTaskProgress(taskId, config, totalFiles) {
  const task = new TaskProgress(taskId, config);
  task.progress.total = totalFiles;
  task.status = TASK_STATUS.PROCESSING;

  saveTaskProgress(taskId, task.toJSON());
  writeLog(`初始化任务: ${taskId}, 总文件数: ${totalFiles}`);

  return task.toJSON();
}

// 标记任务完成
function markTaskCompleted(taskId) {
  const task = loadTaskProgress(taskId);
  if (!task) return;

  task.status = TASK_STATUS.COMPLETED;
  saveTaskProgress(taskId, task);

  const successRate = ((task.progress.processed / task.progress.total) * 100).toFixed(2);
  writeLog(`任务完成: ${taskId}, 成功: ${task.progress.processed}/${task.progress.total} (${successRate}%)`);
}

// 标记任务暂停
function markTaskPaused(taskId, reason = '') {
  const task = loadTaskProgress(taskId);
  if (!task) return;

  task.status = TASK_STATUS.PAUSED;
  if (reason) {
    task.pauseReason = reason;
  }
  saveTaskProgress(taskId, task);

  writeLog(`任务暂停: ${taskId}, 原因: ${reason}`);
}

// 列出所有未完成任务
function listUnfinishedTasks() {
  ensureTaskDir();

  try {
    const files = fs.readdirSync(TASK_DIR);
    const unfinishedTasks = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(TASK_DIR, file);
        const taskData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (taskData.status !== TASK_STATUS.COMPLETED) {
          unfinishedTasks.push(taskData);
        }
      }
    }

    return unfinishedTasks;
  } catch (error) {
    writeLog(`列出未完成任务失败: ${error.message}`);
    return [];
  }
}

// 删除任务
function deleteTask(taskId) {
  const filePath = path.join(TASK_DIR, `${taskId}.json`);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    writeLog(`删除任务: ${taskId}`);
    return true;
  }

  return false;
}

// 获取任务统计信息
function getTaskStats(taskId) {
  const task = loadTaskProgress(taskId);
  if (!task) return null;

  const { total, processed, failed } = task.progress;
  const remaining = total - processed - failed;
  const successRate = total > 0 ? ((processed / total) * 100).toFixed(2) : 0;
  const failureRate = total > 0 ? ((failed / total) * 100).toFixed(2) : 0;

  const startTime = new Date(task.createdAt).getTime();
  const currentTime = Date.now();
  const elapsedTime = ((currentTime - startTime) / 1000).toFixed(2);

  return {
    taskId,
    status: task.status,
    total,
    processed,
    failed,
    remaining,
    successRate: `${successRate}%`,
    failureRate: `${failureRate}%`,
    elapsedTime: `${elapsedTime}秒`
  };
}

module.exports = {
  TASK_STATUS,
  TaskProgress,
  generateTaskId,
  saveTaskProgress,
  loadTaskProgress,
  updateTaskProgress,
  initTaskProgress,
  markTaskCompleted,
  markTaskPaused,
  listUnfinishedTasks,
  deleteTask,
  getTaskStats
};
