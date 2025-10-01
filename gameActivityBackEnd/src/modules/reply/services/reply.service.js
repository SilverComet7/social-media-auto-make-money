const { concurrentFetchWithDelay } = require('../../../../commonFunction');

class ReplyService {
    constructor() {
        // 从环境变量或配置文件中获取
        this.headers = {
            accept: "application/json, text/javascript, */*; q=0.01",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            referer: "https://member.bilibili.com/",
            Cookie: process.env.BILIBILI_COOKIE || ''
        };
        this.csrfToken = this.headers.Cookie.split("; ")
            .find((cookie) => cookie.startsWith("bili_jct="))
            ?.split("=")[1] || '';
    }

    async getUnfavorableReplies() {
        const unfavorableWords = [
            { id: 1, keyword: "抄" },
        ];

        const messageList = await concurrentFetchWithDelay(
            unfavorableWords.map((word) => {
                return () =>
                    fetch(
                        `https://api.bilibili.com/x/v2/reply/up/fulllist?keyword=${word.keyword}&order=1&filter=-1&type=1&bvid=&pn=1&ps=10&charge_plus_filter=false`,
                        {
                            headers: this.headers,
                        }
                    ).then(async (response) => {
                        const result = await response.json();
                        return (
                            result?.data?.list?.map((wordData) => {
                                return {
                                    bvid: wordData.bvid,
                                    oid: wordData.oid,
                                    rpid: wordData.rpid,
                                    message: wordData.content.message,
                                };
                            }) ?? []
                        );
                    });
            })
        );
        return messageList.flat();
    }

    async deleteUnfavorableReply(oid, rpid) {
        const jsonBody = {
            type: 1,
            rpid: rpid,
            oid: oid,
            jsonp: "jsonp",
            csrf: this.csrfToken,
        };

        const response = await fetch(`https://api.bilibili.com/x/v2/reply/del`, {
            method: "POST",
            headers: {
                ...this.headers,
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            },
            body: JSON.stringify(jsonBody),
        });

        return await response.json();
    }
}

module.exports = ReplyService; 