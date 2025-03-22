// ==UserScript==
// @name         抖音视频选择器
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  在抖音视频页面添加复选框，用于选择和收集视频ID
// @author       Your name
// @match        https://www.douyin.com/search/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 创建复制按钮
    function createCopyButton() {
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

    // 监听页面变化
    const observer = new MutationObserver(() => {
        addCheckboxesToVideos();
    });

    // 初始化
    function init() {
        createCopyButton();
        addCheckboxesToVideos();
        
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