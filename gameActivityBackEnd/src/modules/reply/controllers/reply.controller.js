const express = require('express');
const router = express.Router();
const ReplyService = require('../services/reply.service');

class ReplyController {
    constructor() {
        this.replyService = new ReplyService();
    }

    // 获取不良评论列表
    async getUnfavorableReplies(req, res) {
        try {
            const replies = await this.replyService.getUnfavorableReplies();
            res.json(replies);
        } catch (error) {
            console.error("Error in getUnfavorableReplies:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    // 删除不良评论
    async deleteUnfavorableReply(req, res) {
        try {
            const { oid, rpid } = req.body;
            const result = await this.replyService.deleteUnfavorableReply(oid, rpid);
            res.json(result);
        } catch (error) {
            console.error("Error in deleteUnfavorableReply:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

const replyController = new ReplyController();

// 路由定义
router.get('/unfavorable', (req, res) => replyController.getUnfavorableReplies(req, res));
router.post('/delete', (req, res) => replyController.deleteUnfavorableReply(req, res));

module.exports = router; 