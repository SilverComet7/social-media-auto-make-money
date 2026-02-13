

const scheduleService = require('../services/index');

exports.scheduleUpload = async (req, res) => {
    try {
        const result = await scheduleService.handleScheduleUpload(req.body);
        res.json(result);
    } catch (error) {
        console.error("处理任务失败:", error);
        res.status(500).json({
            code: 500,
            msg: "处理任务失败",
        });
    }
};

exports.executeScheduleJobs = async (req, res) => {
    try {
        const result = await scheduleService.handleExecuteScheduleJobs(req.body);
        res.json(result);
    } catch (error) {
        console.error('执行指定分发任务失败:', error);
        res.status(500).json({ code: 500, msg: '执行指定分发任务失败' });
    }
};