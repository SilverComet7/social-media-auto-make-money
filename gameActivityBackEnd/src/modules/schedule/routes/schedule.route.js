const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/index');

// 注册路由
router.post('/scheduleUpload', scheduleController.scheduleUpload);
router.post('/executeScheduleJobs', scheduleController.executeScheduleJobs);

module.exports = router;