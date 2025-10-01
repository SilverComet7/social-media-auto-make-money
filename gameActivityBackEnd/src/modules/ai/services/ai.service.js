
class AIService {
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY; // 建议用环境变量管理
        this.baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
    }

    async chatWithOpenRouter(messages) {
        try {
            const response = await fetch(
                this.baseUrl,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'openai/gpt-3.5-turbo', // 可换成其它模型
                        messages,
                    }),
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('OpenRouter API 调用失败:', error?.response?.data || error.message);
            throw new Error('AI服务异常');
        }
    }
}

module.exports = new AIService(); 