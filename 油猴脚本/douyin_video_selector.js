// ==UserScript==
// @name         抖音视频选择器
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  在抖音视频页面添加复选框，用于选择和收集视频ID
// @author       Your name
// @match        https://www.douyin.com/search/*
// @match        https://www.douyin.com/user/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 创建复制按钮
    function createCopyButton() {
        // 只在/search/页面显示
        if (!/\/search\//.test(window.location.pathname)) return;
        const button = document.createElement('button');
        button.textContent = '复制已选视频ID';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            padding: 10px 20px;
            background-color: #fe2c55;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        button.addEventListener('click', copySelectedVideoIds);
        document.body.appendChild(button);
    }

    // 为视频添加复选框
    function addCheckboxesToVideos() {
        // 修改选择器以匹配实际的视频元素
        const videos = document.querySelectorAll('div[class*="AMqhOzPC"]');
        videos.forEach(video => {
            if (!video.querySelector('.video-selector-checkbox')) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'video-selector-checkbox';
                checkbox.style.cssText = `
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    z-index: 999;
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                `;

                // 获取视频ID
                const videoId = video.id || '';
                if (videoId) {
                    // 从waterfall_item_XXXXXX格式中提取ID
                    const idMatch = videoId.match(/waterfall_item_(\d+)/);
                    if (idMatch) {
                        // 添加默认前缀
                        checkbox.dataset.videoId = 'https://www.douyin.com/video/' + idMatch[1];
                    }
                }

                // video.style.position = 'relative';
                video.insertBefore(checkbox, video.firstChild);
            }
        });
    }

    // 复制选中的视频ID
    function copySelectedVideoIds() {
        const selectedCheckboxes = document.querySelectorAll('.video-selector-checkbox:checked');
        const videoIds = Array.from(selectedCheckboxes)
            .map(checkbox => checkbox.dataset.videoId)
            .filter(id => id); // 过滤掉未成功获取ID的项

        if (videoIds.length === 0) {
            alert('请至少选择一个视频！');
            return;
        }

        const videoIdText = videoIds.join('\n');
        navigator.clipboard.writeText(videoIdText).then(() => {
            alert(`已成功复制 ${videoIds.length} 个视频ID到剪贴板！`);
        }).catch(err => {
            console.error('复制失败:', err);
            alert('复制失败，请重试！');
        });
    }


    // ========== 新增：个人主页用户信息复制按钮 ==========
    function createCopyUserInfoButton() {
        // 只在/user/页面显示
        if (!/\/user\//.test(window.location.pathname)) return;
        if (document.getElementById('copy-user-info-btn')) return; // 防止重复添加

        const button = document.createElement('button');
        button.id = 'copy-user-info-btn';
        button.textContent = '复制用户信息';
        button.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            z-index: 9999;
            padding: 10px 20px;
            background-color: #2196f3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        button.addEventListener('click', copyUserInfo);
        document.body.appendChild(button);
    }

    function copyUserInfo() {
        // 获取昵称（尝试多种常见选择器）
        let name = '';
        // 1. 2024年常见昵称选择器
        const nameSelectors = [
            'h1[class*="xgplayer-nickname"], h1[class*="xgplayer-user-nickname"]', // 旧版
            'span[class*="xgplayer-nickname"], span[class*="xgplayer-user-nickname"]',
            'span[class*="Nu66P_ba"]', // 2024新版
            'h1[class*="Nu66P_ba"]',
            'h1', // 兜底
            'span',
        ];
        for (const sel of nameSelectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent && el.textContent.length >= 2 && el.textContent.length <= 30) {
                name = el.textContent.trim();
                break;
            }
        }
        if (!name) {
            alert('未能自动获取昵称，请手动填写');
            name = prompt('请输入昵称：', '');
            if (!name) return;
        }

        const bilibiliSearchUrl = 'https://search.bilibili.com/upuser?keyword=' + encodeURIComponent(name);
        window.open(bilibiliSearchUrl, '_blank', 'noopener');
        const url = window.location.href;
        const userInfo = {
            mark: name,
            game: '游戏综合',
            name: name,
            url: url,
            tab: 'post',
            earliest: '2025/3/8',
            latest: '2025/6/8',
            enable: false
        };
        const text = JSON.stringify(userInfo, null, 2) + ',';
        navigator.clipboard.writeText(text).then(() => {
            alert('用户信息已复制到剪贴板！');
        }).catch(err => {
            console.error('复制失败:', err);
            alert('复制失败，请重试！');
        });
    }


    function filterNoUsers() {
        // 只在 /jingxuan/search/ 且 type=user 的页面执行
        const isJingxuanUserSearch =
            /\/jingxuan\/search\//.test(window.location.pathname) &&
            /(^|&|\?)type=user(&|$)/.test(window.location.search);

        if (!isJingxuanUserSearch) return;

        // 一个相对稳妥的遍历方式：
        // 找所有指向 /user/ 的链接，然后向上找到整张用户卡片容器
        const userLinks = document.querySelectorAll('a[href*="/user/"]');

        userLinks.forEach(link => {
            const card = link.closest('div[class]'); // 粗粒度：向上找最近的 div 容器
            if (!card) return;

            const text = (card.textContent || '').trim();
            if (!text) return;

            if (text.includes('搬运') || text.includes('全网')) {
                card.style.display = 'none';
            }
        });
    }

    // 监听页面变化
    const observer = new MutationObserver(() => {
        addCheckboxesToVideos();
        filterNoUsers();
    });

    // 初始化
    function init() {
        createCopyButton();
        addCheckboxesToVideos();
        createCopyUserInfoButton(); // 新增：初始化时插入用户信息按钮
        // 新增：初始化时先过滤一次
        filterNoUsers();
        // 监听页面内容变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();