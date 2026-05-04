// ==UserScript==
// @name         平台内容选择器 (抖音 / 小红书)
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  在抖音或小红书搜索/主页页面添加复选框，用于批量选择并复制链接；抖音搜索/用户主页标题点击可用纯标题在 B站、小红书、快手同步搜索
// @author       Your name
// @match        https://www.douyin.com/search/*
// @match        https://www.douyin.com/user/*
// @match        https://www.xiaohongshu.com/search_result?keyword=*
// @match        https://www.xiaohongshu.com/user/profile/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // 统一创建复制按钮：根据页面和位置设置文案
    function createCopyButton() {
        // 避免重复创建
        if (document.getElementById('copy-selected-item-btn')) return;
        const button = document.createElement('button');
        button.id = 'copy-selected-item-btn';
        // 搜索页/个人主页不同文案
        // 平台与位置决定按钮名称
        if (isXHS()) {
            button.textContent = /search_result\?keyword/.test(window.location.href)
                ? '复制已选笔记链接'
                : '复制主页已选笔记链接';
        } else {
            button.textContent = /\/search\//.test(window.location.pathname)
                ? '复制稿件ID'
                : '复制主页稿件ID';
        }
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 300px;
            z-index: 9999;
            padding: 10px 20px;
            background-color: #fe2c55;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        `;
        // 鼠标悬浮样式
        button.onmouseover = () => button.style.backgroundColor = '#d42449';
        button.onmouseout = () => button.style.backgroundColor = '#fe2c55';
        button.addEventListener('click', copySelectedUrls);
        document.body.appendChild(button);
    }

    // 平台检测：抖音 vs 小红书
    function isXHS() {
        return /xiaohongshu\.com/.test(window.location.host);
    }

    function isDouyinHost() {
        return /www\.douyin\.com/.test(window.location.host);
    }

    function isDouyinSearchPage() {
        return isDouyinHost() && /\/search\//.test(window.location.pathname);
    }

    function isDouyinUserPage() {
        return isDouyinHost() && /\/user\//.test(window.location.pathname);
    }

    const CROSS_SEARCH_TITLE_CLASS = 'douyin-cross-search-title';

    /** 去掉 # 及后续话题，只保留标题用于多平台搜索 */
    function extractDouyinTitleForSearch(rawText) {
        const t = (rawText || '').replace(/\s+/g, ' ').trim();
        if (!t) return '';
        const idx = t.indexOf('#');
        if (idx === -1) return t;
        return t.slice(0, idx).trim();
    }

    /** 仅用标题（不含 #话题）在 B站 / 小红书 / 快手 打开搜索 */
    function openCrossPlatformVideoSearch(rawText) {
        const keyword = extractDouyinTitleForSearch(rawText);
        if (!keyword) return;
        const kuaishouSearchUrl =
            'https://www.kuaishou.com/search/' + encodeURIComponent(keyword) + '?source=NewReco';
        const bilibiliSearchUrl = 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(keyword);
        const xhsSearchUrl =
            'https://www.xiaohongshu.com/search_result?keyword=' +
            encodeURIComponent(keyword) +
            '&source=web_search_result_notes';
        window.open(kuaishouSearchUrl, '_blank', 'noopener');
        window.open(bilibiliSearchUrl, '_blank', 'noopener');
        window.open(xhsSearchUrl, '_blank', 'noopener');
    }

    function onCrossSearchTitleClick(e) {
        const el = e.currentTarget;
        const keyword = extractDouyinTitleForSearch(el.textContent);
        if (!keyword) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openCrossPlatformVideoSearch(keyword);
    }

    /** 抖音瀑布流标题：点击即可多站搜索（搜索页 div.BjLsdJMi；用户页 p.eJFBAbdI.H4IE9Xgd） */
    function bindDouyinCrossSearchTitles() {
        if (isXHS() || !isDouyinHost() || hasModalId()) return;

        let selector = '';
        if (isDouyinSearchPage()) selector = 'div.BjLsdJMi';
        else if (isDouyinUserPage()) selector = 'p.eJFBAbdI.H4IE9Xgd';
        else return;

        document.querySelectorAll(selector).forEach(el => {
            if (el.dataset.douyinCrossSearchBound) return;
            const keyword = extractDouyinTitleForSearch(el.textContent);
            if (!keyword) return;
            el.dataset.douyinCrossSearchBound = '1';
            el.classList.add(CROSS_SEARCH_TITLE_CLASS);
            el.style.cursor = 'pointer';
            el.title = '点击：在 B站、小红书、快手 用当前标题搜索（不含 #话题）';
            el.addEventListener('click', onCrossSearchTitleClick, true);
        });
    }

    // 为内容条目添加复选框（兼容抖音视频与小红书笔记）
    function addCheckboxesToItems() {
        if (isXHS()) {
            const anchors = document.querySelectorAll('a[href*="/note/"]');
            anchors.forEach(a => {
                const card = a.closest('div');
                if (!card || card.querySelector('.video-selector-checkbox')) return;
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
                    accent-color: #fe2c55;
                    background: white;
                    border: 1px solid #eee;
                    border-radius: 2px;
                `;
                if (window.getComputedStyle(card).position === 'static') {
                    card.style.position = 'relative';
                }
                checkbox.dataset.itemUrl = a.href;
                card.insertBefore(checkbox, card.firstChild);
            });
        } else {
            const videoSelectors = [
                'div[class*="AMqhOzPC"]',
                'li[class*="wqW3g_Kl WPzYSlFQ OguQAD1e"]'
            ];
            const videos = document.querySelectorAll(videoSelectors.join(','));
            videos.forEach(video => {
                if (video.querySelector('.video-selector-checkbox')) return;
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
                    accent-color: #fe2c55;
                    background: white;
                    border: 1px solid #eee;
                    border-radius: 2px;
                `;
                if (window.getComputedStyle(video).position === 'static') {
                    video.style.position = 'relative';
                }
                let itemUrl = '';
                if (video.id) {
                    const idMatch = video.id.match(/waterfall_item_(\d+)/);
                    if (idMatch) itemUrl = `https://www.douyin.com/video/${idMatch[1]}`;
                }
                if (!itemUrl) {
                    const videoLink = video.querySelector('a[href*="/video/"]') || video.querySelector('a[href*="/note/"]')
                    if (videoLink) {
                        const linkMatch = videoLink.href.match(/\/video\/(\d+)/) || videoLink.href.match(/\/note\/(\d+)/)
                        if (linkMatch) itemUrl = `https://www.douyin.com/video/${linkMatch[1]}`;
                    }
                }
                if (itemUrl) {
                    checkbox.dataset.itemUrl = itemUrl;
                }
                video.insertBefore(checkbox, video.firstChild);
            });
        }
    }

    // 复制选中的链接（通用方法，兼容所有平台）
    function copySelectedUrls() {
        const selectedCheckboxes = document.querySelectorAll('.video-selector-checkbox:checked');
        const urls = Array.from(selectedCheckboxes)
            .map(checkbox => checkbox.dataset.itemUrl)
            .filter(u => u);

        if (urls.length === 0) {
            alert('请至少选择一个条目！');
            return;
        }
        const text = urls.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            alert(`✅ 已成功复制 ${urls.length} 个链接到剪贴板！`);
        }).catch(err => {
            console.error('复制失败:', err);
            alert('❌ 复制失败，请检查浏览器剪贴板权限！');
        });
    }

    // 矩形相交检测
    function rectsIntersect(a, b) {
        return !(b.left > a.right || b.right < a.left || b.top > a.bottom || b.bottom < a.top);
    }

    // 拖拽框选功能
    function initDragSelect() {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let selDiv = null;

        function onMouseDown(e) {
            // 只响应左键，且避免在点击按钮或链接时触发
            if (e.button !== 0) return;
            const tgt = e.target;
            if (
                tgt.closest('button') ||
                tgt.closest('a') ||
                tgt.closest('input') ||
                tgt.closest('.' + CROSS_SEARCH_TITLE_CLASS)
            )
                return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            selDiv = document.createElement('div');
            selDiv.style.position = 'fixed';
            selDiv.style.border = '1px dashed #2196f3';
            selDiv.style.background = 'rgba(33,150,243,0.1)';
            selDiv.style.zIndex = '9998';
            selDiv.style.pointerEvents = 'none';
            document.body.appendChild(selDiv);
        }

        function onMouseMove(e) {
            if (!isDragging) return;
            const x = Math.min(e.clientX, startX);
            const y = Math.min(e.clientY, startY);
            const w = Math.abs(e.clientX - startX);
            const h = Math.abs(e.clientY - startY);
            selDiv.style.left = x + 'px';
            selDiv.style.top = y + 'px';
            selDiv.style.width = w + 'px';
            selDiv.style.height = h + 'px';
        }

        function onMouseUp(e) {
            if (!isDragging) return;
            isDragging = false;
            if (selDiv) {
                const selRect = selDiv.getBoundingClientRect();
                document.querySelectorAll('.video-selector-checkbox').forEach(cb => {
                    const cbRect = cb.getBoundingClientRect();
                    if (rectsIntersect(selRect, cbRect)) {
                        cb.checked = true;
                    }
                });
                selDiv.remove();
                selDiv = null;
            }
        }

        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    // 复制用户信息按钮（个人主页专属，位置下移避免遮挡视频复制按钮）
    function createCopyUserInfoButton() {
        if (!/\/user\//.test(window.location.pathname) || document.getElementById('copy-user-info-btn')) return;
        const button = document.createElement('button');
        button.id = 'copy-user-info-btn';
        button.textContent = '复制信息';
        button.style.cssText = `
            position: fixed;
            top: 70px; /* 从60px调整到70px，避开视频复制按钮 */
            right: 300px;
            z-index: 9999;
            padding: 10px 20px;
            background-color: #2196f3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
        `;
        button.onmouseover = () => button.style.backgroundColor = '#1976d2';
        button.onmouseout = () => button.style.backgroundColor = '#2196f3';
        button.addEventListener('click', copyUserInfo);
        document.body.appendChild(button);
    }

    // 复制用户信息（原逻辑保留，优化提示）
    function copyUserInfo() {
        let name = '';
        const nameSelectors = [
            'h1[class*="xgplayer-nickname"], h1[class*="xgplayer-user-nickname"]',
            'span[class*="xgplayer-nickname"], span[class*="xgplayer-user-nickname"]',
            'span[class*="Nu66P_ba"]',
            'h1[class*="Nu66P_ba"]',
            'h1',
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
        const kuaishouSearchUrl = `https://www.kuaishou.com/search/${encodeURIComponent(name)}?source=NewReco`;
        const bilibiliSearchUrl = 'https://search.bilibili.com/upuser?keyword=' + encodeURIComponent(name);
        const xhsSearchUrl = 'https://www.xiaohongshu.com/search_result?keyword=' + encodeURIComponent(name) + '&source=web_user_page';
        window.open(kuaishouSearchUrl, '_blank', 'noopener');
        window.open(bilibiliSearchUrl, '_blank', 'noopener');
        window.open(xhsSearchUrl, '_blank', 'noopener');


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
            alert('✅ 用户信息已复制到剪贴板！');
        }).catch(err => {
            console.error('复制失败:', err);
            alert('❌ 复制失败，请检查浏览器剪贴板权限！');
        });
    }

    // 过滤搬运/全网类无效用户（原逻辑保留）
    function filterNoUsers() {
        const isJingxuanUserSearch =
            /\/jingxuan\/search\//.test(window.location.pathname) &&
            /(^|&|\?)type=user(&|$)/.test(window.location.search);
        if (!isJingxuanUserSearch) return;
        const userLinks = document.querySelectorAll('a[href*="/user/"]');
        userLinks.forEach(link => {
            const card = link.closest('div[class]');
            if (!card) return;
            const text = (card.textContent || '').trim();
            if (text.includes('搬运') || text.includes('全网')) {
                card.style.display = 'none';
            }
        });
    }

    // 判断当前 URL 是否带有 modal_id 参数（仅抖音会出现）
    function hasModalId() {
        return /([?&])modal_id=/.test(window.location.search);
    }

    // 删除页面上所有复选框（用于进入大视频时清理）
    function removeAllCheckboxes() {
        document.querySelectorAll('.video-selector-checkbox').forEach(cb => cb.remove());
    }

    // 根据 modal_id 控制复制按钮显示/隐藏
    function updateCopyButtonVisibility() {
        const btn = document.getElementById('copy-selected-item-btn');
        if (!btn) return;
        btn.style.display = hasModalId() ? 'none' : '';
    }

    // 处理 URL 变化时的逻辑
    function handleUrlChange() {
        if (hasModalId()) {
            removeAllCheckboxes();
        } else {
            addCheckboxesToItems();
        }
        updateCopyButtonVisibility();
        filterNoUsers();
        bindDouyinCrossSearchTitles();
    }

    // 监听页面变化（防抖优化，避免频繁执行）
    let observerTimer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(observerTimer);
        // 防抖：50ms后执行，减少页面滚动时的性能消耗
        observerTimer = setTimeout(() => {
            handleUrlChange();
        }, 50);
    });

    // 监听历史记录 API 的调用以捕获 pushState/replaceState
    (function (history) {
        const push = history.pushState;
        const replace = history.replaceState;
        history.pushState = function (state) {
            const ret = push.apply(this, arguments);
            window.dispatchEvent(new Event('locationchange'));
            return ret;
        };
        history.replaceState = function (state) {
            const ret = replace.apply(this, arguments);
            window.dispatchEvent(new Event('locationchange'));
            return ret;
        };
    })(window.history);
    window.addEventListener('popstate', () => window.dispatchEvent(new Event('locationchange')));
    window.addEventListener('locationchange', handleUrlChange);

    // 初始化入口（全页面通用）
    function init() {
        createCopyButton(); // 初始化复制按钮
        // 进入页面时如果 modal_id 存在就不添加复选框，否则正常添加
        if (hasModalId()) {
            removeAllCheckboxes();
        } else {
            addCheckboxesToItems(); // 初始化复选框
        }
        updateCopyButtonVisibility();
        createCopyUserInfoButton(); // 初始化用户信息按钮
        filterNoUsers(); // 初始化无效用户过滤
        bindDouyinCrossSearchTitles();
        initDragSelect(); // 初始化拖拽框选功能
        // 监听页面内容变化（子元素+子树）
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 页面加载完成后执行（兼容异步加载）
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 页面卸载时取消监听，防止内存泄漏
    window.addEventListener('beforeunload', () => {
        observer.disconnect();
        clearTimeout(observerTimer);
    });
})();