const aiService = require('../services/ai.service');

exports.chat = async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages 参数缺失或格式错误' });
    }
    try {
        const aiResponse = await aiService.chatWithOpenRouter(messages);
        res.json(aiResponse);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
