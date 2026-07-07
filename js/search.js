/**
 * 搜索面板模块
 * 功能：全站搜索与文章详情页内搜索，支持标题、标签、系列、正文检索，
 * 并带有高亮定位、侧边栏模式、国际化支持。
 */
(function () {
    'use strict';

    // ==================== 配置常量 ====================
    /** 输入防抖延迟（ms） */
    const DEBOUNCE_DELAY = 220;
    /** 搜索结果摘要半径（字符数） */
    const SNIPPET_RADIUS = 60;
    /** 详情页摘要半径（字符数） */
    const DETAIL_SNIPPET_RADIUS = 100;
    /** 展开后聚焦延迟（ms） */
    const EXPAND_FOCUS_DELAY = 320;
    /** 高亮闪烁持续时间（ms） */
    const FLASH_DURATION = 800;

    // ==================== 状态变量 ====================
    let blogsCache = null;
    let includeBodySearch = false;
    const bodyTextCache = new Map();
    let bodyLoadPromise = null;

    // ==================== 工具函数 ====================

    /** HTML 转义 */
    function escapeHtml(value) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;'
        };
        return String(value).replace(/[&<>"]/g, ch => map[ch]);
    }

    /** 防抖函数 */
    function debounce(fn, wait) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(null, args), wait);
        };
    }

    /** 获取 URL 查询参数 */
    function getQueryParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    /** 获取当前语言 */
    function getLang() {
        try {
            if (window.siteI18n && typeof window.siteI18n.getLang === 'function') {
                return window.siteI18n.getLang();
            }
        } catch (error) {
            console.error('[search] 获取当前语言失败:', error);
        }
        return 'zh';
    }

    /** 获取国际化文本 */
    function t(key, fallback) {
        try {
            const i18n = window.siteI18n;
            const lang = getLang();
            const map = (i18n && i18n.translations && i18n.translations[lang]) || {};
            if (Object.prototype.hasOwnProperty.call(map, key) && map[key] != null) {
                return map[key];
            }
        } catch (error) {
            console.error('[search] 获取国际化文本失败:', error);
        }
        return fallback;
    }

    /** 规范化内容文件路径 */
    function normalizeContentPath(path) {
        if (!path) return '';
        const raw = String(path).trim().replace(/\\/g, '/');
        return raw ? encodeURI(raw) : '';
    }

    // ==================== 面板生命周期 ====================

    /**
     * 渲染空闲提示（搜索面板默认状态）
     */
    function renderIdleHint(resultsEl) {
        if (!resultsEl) return;
        resultsEl.innerHTML = '<div class="search-empty-hint" data-i18n="search_idle_hint"></div>';
        try {
            if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
                window.siteI18n.applyTo(resultsEl);
            }
        } catch (error) {
            console.error('[search] 应用国际化失败:', error);
        }
    }

    /**
     * 创建搜索面板 DOM
     * 详情页模式：右侧边栏样式；普通模式：模态框样式
     */
    function createPanel() {
        if (document.querySelector('.search-panel')) return;

        const isDetail = document.body.classList.contains('blog-detail-page');
        const panel = document.createElement('div');
        panel.className = 'search-panel' + (isDetail ? ' right-sidebar' : '');

        panel.innerHTML = isDetail
            ? `
            <div class="search-wrap" role="dialog" aria-label="site-search">
                <div class="search-row">
                    <div class="search-input">
                        <input type="search" placeholder="" data-i18n="search_placeholder" aria-label="搜索输入" id="global-search-input">
                    </div>
                    <div class="search-actions">
                        <button class="search-close-btn" id="search-close" data-i18n="search_close" aria-label="close"></button>
                    </div>
                </div>
                <div class="search-results" id="search-results" role="list"></div>
            </div>
            `
            : `
            <div class="search-wrap" role="dialog" aria-label="site-search">
                <button class="search-close-btn" id="search-close" data-i18n="search_close" aria-label="close"></button>
                <div class="search-modal-content">
                    <div class="search-row">
                        <div class="search-input">
                            <input type="search" placeholder="" data-i18n="search_placeholder" aria-label="搜索输入" id="global-search-input">
                        </div>
                    </div>
                    <div class="search-options" role="group" aria-label="search-options">
                        <label class="search-option-item">
                            <input type="checkbox" id="search-include-body">
                            <span data-i18n="search_include_body">搜索正文</span>
                        </label>
                    </div>
                    <div class="search-results" id="search-results" role="list"></div>
                </div>
            </div>
            `;

        document.body.appendChild(panel);

        // 非详情页显示空闲提示
        if (!isDetail) {
            const initialResults = panel.querySelector('#search-results');
            renderIdleHint(initialResults);
        }

        // 应用国际化
        try {
            if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
                window.siteI18n.applyTo(panel);
            }
        } catch (error) {
            console.error('[search] 应用国际化失败:', error);
        }

        // ===== 关闭按钮 =====
        panel.querySelector('#search-close').addEventListener('click', hidePanel);

        // ===== 点击背景关闭（仅非详情页） =====
        panel.addEventListener('click', (e) => {
            if (panel.classList.contains('right-sidebar')) return;
            if (e.target === panel) hidePanel();
        });

        // ===== 搜索输入事件 =====
        const input = panel.querySelector('#global-search-input');
        const includeBodyInput = panel.querySelector('#search-include-body');

        // 正文搜索开关
        if (includeBodyInput) {
            includeBodyInput.checked = includeBodySearch;
            includeBodyInput.addEventListener('change', function (e) {
                includeBodySearch = !!(e && e.target && e.target.checked);
                const value = input && input.value ? input.value.trim() : '';
                if (value) doSearch(value);
            });
        }

        // 输入防抖搜索
        const debouncedSearch = debounce((val) => {
            const v = (val || '').trim();
            if (v.length > 0) {
                doSearch(v);
            } else {
                const resultsEl = panel.querySelector('#search-results');
                if (!resultsEl) return;
                if (panel.classList.contains('right-sidebar')) {
                    resultsEl.innerHTML = '';
                } else {
                    renderIdleHint(resultsEl);
                }
            }
        }, DEBOUNCE_DELAY);

        input.addEventListener('input', (e) => {
            debouncedSearch(e.target.value);
        });

        // Enter 键确认搜索
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                doSearch(input.value.trim());
            }
        });
    }

    /**
     * 显示搜索面板
     */
    function showPanel() {
        createPanel();
        const panel = document.querySelector('.search-panel');
        if (!panel) return;

        const nav = document.querySelector('.navbar');
        const top = nav ? nav.offsetHeight : 60;
        const input = panel.querySelector('#global-search-input');
        const resultsEl = panel.querySelector('#search-results');
        const includeBodyInput = panel.querySelector('#search-include-body');

        // 重置输入和结果
        if (input) input.value = '';
        if (includeBodyInput && !panel.classList.contains('right-sidebar')) {
            includeBodySearch = false;
            includeBodyInput.checked = false;
        }
        if (resultsEl) resultsEl.innerHTML = '';

        // 清除详情页高亮
        try {
            if (document.body.classList.contains('blog-detail-page')) {
                const content = document.getElementById('markdown-content');
                if (content) clearHighlights(content);
            }
        } catch (error) {
            console.error('[search] 清除高亮失败:', error);
        }

        // ===== 定位样式 =====
        if (panel.classList.contains('right-sidebar')) {
            // 详情页侧边栏：与 TOC 顶部对齐
            let desiredTop = top + 12;
            try {
                const toc = document.querySelector('.blog-toc');
                if (toc) {
                    const tocTop = toc.getBoundingClientRect().top;
                    if (typeof tocTop === 'number' && !isNaN(tocTop)) {
                        desiredTop = Math.max(desiredTop, Math.round(tocTop));
                    }
                }
            } catch (error) {
                console.error('[search] 获取 TOC 位置失败:', error);
            }

            panel.style.top = desiredTop + 'px';
            panel.style.right = '18px';
            panel.style.left = 'auto';
            panel.style.height = `calc(100vh - ${desiredTop}px - 18px)`;
            panel.style.width = '360px';
            document.body.classList.add('search-sidebar-open');
        } else {
            // 普通模态框
            panel.style.top = '';
            panel.style.right = '';
            panel.style.left = '';
            panel.style.height = '';
            panel.style.width = '';
            document.body.classList.add('search-modal-open');
            if (resultsEl) renderIdleHint(resultsEl);
        }

        panel.classList.add('active');

        // 提升层级
        try {
            if (typeof window.__bringToFront === 'function') {
                window.__bringToFront(panel);
            }
        } catch (error) {
            console.error('[search] 提升面板层级失败:', error);
        }

        // 聚焦输入框
        if (input) input.focus();
    }

    /**
     * 隐藏搜索面板
     */
    function hidePanel() {
        const panel = document.querySelector('.search-panel');
        if (!panel) return;

        panel.classList.remove('active');
        document.body.classList.remove('search-sidebar-open');
        document.body.classList.remove('search-modal-open');

        // 清除详情页高亮
        try {
            if (document.body.classList.contains('blog-detail-page')) {
                const content = document.getElementById('markdown-content');
                if (content) clearHighlights(content);
            }
        } catch (error) {
            console.error('[search] 清除高亮失败:', error);
        }
    }

    // ==================== 面板层级管理 ====================

    // 点击面板时提升层级
    document.addEventListener('mousedown', (e) => {
        const panel = document.querySelector('.search-panel');
        if (!panel) return;
        if (panel.contains(e.target)) {
            try {
                if (typeof window.__bringToFront === 'function') {
                    window.__bringToFront(panel);
                }
            } catch (error) {
                console.error('[search] 提升面板层级失败:', error);
            }
        }
    });

    // ESC 关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hidePanel();
    });

    // 点击面板外关闭
    document.addEventListener('click', (e) => {
        const panel = document.querySelector('.search-panel');
        const btn = e.target.closest('.nav-search-btn');
        if (btn) return; // 由按钮处理
        if (window.__searchSuppressOutsideClose) return;
        if (!panel) return;
        if (!panel.contains(e.target)) {
            if (e.target.closest('.navbar')) return;
            hidePanel();
        }
    });

    // ==================== 搜索核心逻辑 ====================

    /**
     * 执行搜索
     * @param {string} keyword - 搜索关键词
     */
    function doSearch(keyword) {
        const panel = document.querySelector('.search-panel');
        if (!panel) return;

        const resultsEl = panel.querySelector('#search-results');
        resultsEl.innerHTML = '';
        if (!keyword) return;

        // 详情页模式：在正文中搜索
        if (document.body.classList.contains('blog-detail-page')) {
            doDetailSearch(keyword, resultsEl);
            return;
        }

        // 全站搜索模式
        ensureBlogsLoaded().then(async (blogList) => {
            const q = keyword.toLowerCase();
            const results = [];

            if (includeBodySearch) {
                await ensureBodyTextLoaded(blogList);
            }

            blogList.forEach((b) => {
                let score = 0;
                const title = (b.title || '').toLowerCase();
                const excerpt = (b.excerpt || '').toLowerCase();
                const tags = Array.isArray(b.tags) ? b.tags.join(' ').toLowerCase() : '';
                const series = (b.series || '').toLowerCase();
                const body = includeBodySearch ? getBodyTextByBlog(b) : '';

                if (title.includes(q)) score += 10;
                if (excerpt.includes(q)) score += 6;
                if (tags.includes(q)) score += 8;
                if (series.includes(q)) score += 12;
                if (body && body.includes(q)) score += 5;

                if (score > 0) {
                    results.push({
                        blog: b,
                        score,
                        source: determineMatchSource(b, q)
                    });
                }
            });

            results.sort((a, b) => b.score - a.score);

            if (results.length === 0) {
                const noResults = t('search_no_results', '未找到匹配结果');
                resultsEl.innerHTML = `<div class="search-item">${noResults}</div>`;
                return;
            }

            results.forEach((r) => {
                const div = document.createElement('div');
                div.className = 'search-item';

                // 标题行
                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = r.blog.title || '';

                // 文章类型标签
                if (r.blog.type) {
                    const tspan = document.createElement('span');
                    tspan.className = 'blog-type';
                    tspan.textContent = r.blog.type;
                    title.appendChild(tspan);
                }

                // 日期
                const dateSpan = document.createElement('span');
                dateSpan.className = 'result-date date result-date-inline';
                if (r.blog.date) dateSpan.setAttribute('data-date', r.blog.date);
                try {
                    dateSpan.textContent = typeof window.formatDate === 'function'
                        ? window.formatDate(r.blog.date)
                        : (r.blog.date || '');
                } catch (error) {
                    console.error('[search] 格式化日期失败:', error);
                    dateSpan.textContent = r.blog.date || '';
                }
                title.appendChild(dateSpan);

                // 标签
                let tagsDiv = null;
                if (r.blog.tags && r.blog.tags.length) {
                    tagsDiv = document.createElement('div');
                    tagsDiv.className = 'meta-tags';
                    r.blog.tags.forEach((tag) => {
                        const tagSpan = document.createElement('span');
                        tagSpan.className = 'meta-tag';
                        tagSpan.textContent = tag;
                        tagsDiv.appendChild(tagSpan);
                    });
                }

                // 摘要
                const snippet = document.createElement('div');
                snippet.className = 'snippet';
                snippet.textContent = r.blog.excerpt || '';

                div.appendChild(title);
                div.appendChild(snippet);
                if (tagsDiv) div.appendChild(tagsDiv);

                // 点击跳转
                div.addEventListener('click', () => {
                    const url = `blog-detail.html?id=${r.blog.id}&q=${encodeURIComponent(keyword)}`;
                    const sameTabPages = !!(
                        document.body &&
                        (document.body.classList.contains('home') ||
                            document.body.classList.contains('archive-page') ||
                            document.body.classList.contains('categories-page'))
                    );

                    if (sameTabPages) {
                        if (typeof window.navigateWithTransition === 'function') {
                            window.navigateWithTransition(url);
                        } else {
                            window.location.href = url;
                        }
                    } else {
                        const w = window.open(url, '_blank', 'noopener,noreferrer');
                        try {
                            if (w) w.opener = null;
                        } catch (error) {
                            console.error('[search] 打开新标签页失败:', error);
                        }
                    }
                });

                resultsEl.appendChild(div);
            });
        });
    }

    /**
     * 判断匹配来源
     */
    function determineMatchSource(b, q) {
        const title = (b.title || '').toLowerCase();
        const excerpt = (b.excerpt || '').toLowerCase();
        const tags = Array.isArray(b.tags) ? b.tags.join(' ').toLowerCase() : '';
        const series = (b.series || '').toLowerCase();

        if (series.includes(q)) return 'series';
        if (title.includes(q)) return 'title';
        if (tags.includes(q)) return 'tag';
        if (excerpt.includes(q)) return 'excerpt';
        return 'body';
    }

    // ==================== 数据加载 ====================

    /** 加载博客列表 */
    function ensureBlogsLoaded() {
        if (blogsCache) return Promise.resolve(blogsCache);
        return fetch('data/blogs.json')
            .then((r) => r.json())
            .then((data) => {
                blogsCache = data;
                return data;
            })
            .catch(() => []);
    }

    /** 获取缓存的正文内容 */
    function getBodyTextByBlog(blog) {
        if (!blog || typeof blog !== 'object') return '';
        const key = Number(blog.id);
        if (Number.isFinite(key) && bodyTextCache.has(key)) {
            return bodyTextCache.get(key) || '';
        }
        return '';
    }

    /** 加载所有博客正文到缓存 */
    function ensureBodyTextLoaded(blogList) {
        if (bodyLoadPromise) return bodyLoadPromise;

        const list = Array.isArray(blogList) ? blogList : [];
        bodyLoadPromise = Promise.all(
            list.map(async (blog) => {
                if (!blog || typeof blog !== 'object') return;
                const key = Number(blog.id);
                if (!Number.isFinite(key) || bodyTextCache.has(key)) return;

                const file = normalizeContentPath(blog.contentFile);
                if (!file) {
                    bodyTextCache.set(key, '');
                    return;
                }

                try {
                    const resp = await fetch(file, { cache: 'no-store' });
                    if (!resp.ok) {
                        bodyTextCache.set(key, '');
                        return;
                    }
                    const text = await resp.text();
                    bodyTextCache.set(key, String(text || '').toLowerCase());
                } catch (error) {
                    console.error('[search] 加载博客正文失败:', error);
                    bodyTextCache.set(key, '');
                }
            })
        ).finally(() => {
            bodyLoadPromise = null;
        });

        return bodyLoadPromise;
    }

    // ==================== 详情页搜索 ====================

    /**
     * 在文章正文中搜索并高亮
     */
    function doDetailSearch(keyword, resultsEl) {
        const contentEl = document.getElementById('markdown-content');
        if (!contentEl) return;

        // 清除旧高亮
        clearHighlights(contentEl);

        const q = keyword;
        const matches = highlightQueryInElement(contentEl, q);

        if (!matches || matches.length === 0) {
            const noDetail = t('search_no_results_detail', '未在本文中找到匹配');
            resultsEl.innerHTML = `<div class="search-item">${noDetail}</div>`;
            return;
        }

        // 为每个匹配项生成摘要
        matches.forEach((el, idx) => {
            const div = document.createElement('div');
            div.className = 'search-item detail-search-item';

            // 序号
            const indexEl = document.createElement('div');
            indexEl.className = 'result-index';
            indexEl.textContent = String(idx + 1);

            // 主要内容
            const rightEl = document.createElement('div');
            rightEl.className = 'result-main';

            // 标题上下文
            const headerEl = document.createElement('div');
            headerEl.className = 'result-headings';

            const headingCtx = getHeadingContext(contentEl, el);
            const h1El = document.createElement('div');
            h1El.className = 'result-h1';
            h1El.textContent = headingCtx.h1Text || '未定位一级标题';

            const h2El = document.createElement('div');
            h2El.className = 'result-h2';
            h2El.textContent = headingCtx.h2Text || '未定位二级标题';

            // 摘要片段
            const paragraphEl = document.createElement('div');
            paragraphEl.className = 'result-paragraph';
            paragraphEl.innerHTML = makeSnippetForMatch(el, DETAIL_SNIPPET_RADIUS);

            headerEl.appendChild(h1El);
            headerEl.appendChild(h2El);
            rightEl.appendChild(headerEl);
            rightEl.appendChild(paragraphEl);

            div.appendChild(indexEl);
            div.appendChild(rightEl);

            // 点击定位到匹配位置
            div.addEventListener('click', () => {
                window.__searchSuppressOutsideClose = true;

                const hasExpanded = expandHiddenAncestors(contentEl, el);
                const focusMatchedElement = () => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('active-match');
                    setTimeout(() => el.classList.remove('active-match'), FLASH_DURATION);
                };

                if (hasExpanded) {
                    setTimeout(focusMatchedElement, EXPAND_FOCUS_DELAY);
                } else {
                    focusMatchedElement();
                }

                setTimeout(() => {
                    window.__searchSuppressOutsideClose = false;
                }, hasExpanded ? EXPAND_FOCUS_DELAY + 200 : 180);
            });

            resultsEl.appendChild(div);
        });
    }

    /**
     * 获取匹配元素所在的标题上下文
     */
    function getHeadingContext(contentEl, targetEl) {
        const headers = Array.from(contentEl.querySelectorAll('h1, h2'));
        let h1Text = '';
        let h2Text = '';

        headers.forEach((h) => {
            if (h === targetEl || (h.compareDocumentPosition(targetEl) & Node.DOCUMENT_POSITION_FOLLOWING)) {
                if (h.tagName.toLowerCase() === 'h1') {
                    h1Text = (h.textContent || '').trim();
                    h2Text = '';
                } else if (h.tagName.toLowerCase() === 'h2') {
                    h2Text = (h.textContent || '').trim();
                }
            }
        });

        return { h1Text, h2Text };
    }

    /**
     * 为匹配元素生成摘要片段
     */
    function makeSnippetForMatch(el, radius) {
        radius = typeof radius === 'number' ? radius : SNIPPET_RADIUS;
        const matchText = (el.textContent || '').trim();
        const parent = el.parentElement;

        try {
            if (parent) {
                const clone = parent.cloneNode(true);
                // 替换数学公式节点为占位符
                const mathNodes = clone.querySelectorAll('.katex, .katex-display, script[type^="math"], .math');
                mathNodes.forEach((n) => {
                    try {
                        if (n.parentNode) {
                            n.parentNode.replaceChild(document.createTextNode('【公式】'), n);
                        }
                    } catch (error) {
                        console.error('[search] 替换数学公式节点失败:', error);
                    }
                });

                const recordedParentText = (el.dataset.parentText || (parent.textContent || '')).trim();
                const cleaned = recordedParentText;
                const lowerClean = cleaned.toLowerCase();
                const matchLower = matchText.toLowerCase();

                // 查找所有匹配位置
                const positions = [];
                if (matchLower.length > 0) {
                    let p = lowerClean.indexOf(matchLower, 0);
                    while (p !== -1) {
                        positions.push(p);
                        p = lowerClean.indexOf(matchLower, p + 1);
                    }
                }

                let idx = -1;
                if (positions.length > 0) {
                    const occ = parseInt(el.dataset.occurrence || '-1', 10);
                    if (!isNaN(occ) && occ >= 0 && occ < positions.length) {
                        idx = positions[occ];
                    } else {
                        const dataIdx = parseInt(el.dataset.parentIndex || '-1', 10);
                        if (!isNaN(dataIdx) && dataIdx >= 0) {
                            let best = positions[0];
                            let bestDist = Math.abs(best - dataIdx);
                            for (let i = 1; i < positions.length; i++) {
                                const d = Math.abs(positions[i] - dataIdx);
                                if (d < bestDist) {
                                    bestDist = d;
                                    best = positions[i];
                                }
                            }
                            idx = best;
                        } else {
                            idx = positions[0];
                        }
                    }
                }

                if (idx === -1) {
                    const txt = (el.textContent || '').trim();
                    return escapeHtml(txt.slice(0, radius * 2));
                }

                const start = Math.max(0, idx - radius);
                const end = Math.min(cleaned.length, idx + matchText.length + radius);
                const before = cleaned.slice(start, idx);
                const match = cleaned.slice(idx, idx + matchText.length);
                const after = cleaned.slice(idx + matchText.length, end);

                let out = '';
                if (start > 0) out += '...';
                out += escapeHtml(before);
                out += `<span class="match-highlight">${escapeHtml(match)}</span>`;
                out += escapeHtml(after);
                if (end < cleaned.length) out += '...';
                return out;
            }
        } catch (error) {
            console.error('[search] 格式化匹配文本失败:', error);
        }

        // 最终备用方案
        const fallbackTxt = (el.textContent || '').trim();
        return escapeHtml(fallbackTxt.slice(0, radius * 2));
    }

    /**
     * 展开隐藏的祖先元素（折叠块、details 等）
     */
    function expandHiddenAncestors(contentEl, targetEl) {
        if (!targetEl) return false;
        let expanded = false;
        const expandedAnswerBlocks = new Set();
        const expandedCodeBlocks = new Set();

        let cur = targetEl.parentElement;
        while (cur && cur !== document.body) {
            // 原生 details 折叠
            if (cur.tagName && cur.tagName.toLowerCase() === 'details' && !cur.open) {
                cur.open = true;
                expanded = true;
            }

            // 自定义答案折叠块
            if (cur.classList && cur.classList.contains('answer-content')) {
                const answerBlock = cur.closest('.answer-block');
                if (answerBlock && !expandedAnswerBlocks.has(answerBlock)) {
                    const btn = answerBlock.querySelector('.answer-toggle');
                    const isClosed = btn ? btn.getAttribute('aria-expanded') !== 'true' : !answerBlock.classList.contains('is-open');
                    if (isClosed && btn) {
                        btn.click();
                        expanded = true;
                    }
                    expandedAnswerBlocks.add(answerBlock);
                }
            }

            // 自定义代码折叠块
            if (cur.classList && cur.classList.contains('codeblock__body')) {
                const codeBlock = cur.closest('.codeblock');
                if (codeBlock && !expandedCodeBlocks.has(codeBlock)) {
                    const isCollapsed = codeBlock.classList.contains('is-collapsed');
                    if (isCollapsed) {
                        const toggleBtns = codeBlock.querySelectorAll('.codeblock__btn');
                        const toggleBtn = toggleBtns.length > 1 ? toggleBtns[1] : null;
                        if (toggleBtn) {
                            toggleBtn.click();
                            expanded = true;
                        }
                    }
                    expandedCodeBlocks.add(codeBlock);
                }
            }

            if (cur.hasAttribute && cur.hasAttribute('hidden')) {
                cur.removeAttribute('hidden');
                expanded = true;
            }

            if (cur === contentEl) break;
            cur = cur.parentElement;
        }

        return expanded;
    }

    // ==================== 高亮操作 ====================

    /**
     * 清除元素内所有搜索高亮
     */
    function clearHighlights(root) {
        const spans = Array.from(root.querySelectorAll('span.search-match'));
        spans.forEach((s) => {
            const parent = s.parentNode;
            parent.replaceChild(document.createTextNode(s.textContent), s);
            parent.normalize();
        });
    }

    /**
     * 在元素内高亮查询关键词
     * @returns {HTMLElement[]} 高亮包裹的 span 元素数组
     */
    function highlightQueryInElement(root, query) {
        if (!query) return [];

        const q = query.replace(/[.*+?^${}()|[\]\\]/g, '');
        const re = new RegExp(q, 'ig');
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        const created = [];
        const textNodes = [];

        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        const blockOffsets = new WeakMap();

        textNodes.forEach((tn) => {
            const parent = tn.parentNode;
            if (!parent) return;

            const blockRoot = parent.closest && (parent.closest('pre') || parent.closest('code')) || parent;
            const val = tn.nodeValue;
            const blockText = (blockRoot && blockRoot.textContent) ? blockRoot.textContent : (parent.textContent || '');
            const offset = blockOffsets.get(blockRoot) || 0;

            re.lastIndex = 0;
            let match;
            let lastIndex = 0;
            const frag = document.createDocumentFragment();
            let found = false;

            while ((match = re.exec(val)) !== null) {
                found = true;
                const before = val.slice(lastIndex, match.index);
                if (before) frag.appendChild(document.createTextNode(before));

                const span = document.createElement('span');
                span.className = 'search-match match-highlight';
                span.textContent = match[0];
                span.setAttribute('tabindex', '-1');

                const absIdx = offset + match.index;
                span.dataset.parentIndex = String(absIdx);
                span.dataset.parentText = blockText;
                frag.appendChild(span);
                created.push(span);

                lastIndex = match.index + match[0].length;
            }

            if (found) {
                const after = val.slice(lastIndex);
                if (after) frag.appendChild(document.createTextNode(after));
                parent.replaceChild(frag, tn);
            }

            blockOffsets.set(blockRoot, offset + val.length);
        });

        return created;
    }

    // ==================== 国际化更新 ====================

    /**
     * 更新搜索面板中的国际化内容
     */
    function updateSearchPanelI18n() {
        try {
            // 更新日期
            document.querySelectorAll('.result-date[data-date]').forEach((el) => {
                const d = el.getAttribute('data-date');
                if (!d) return;
                try {
                    el.textContent = typeof window.formatDate === 'function' ? window.formatDate(d) : d;
                } catch (error) {
                    console.error('[search] 格式化日期失败:', error);
                    el.textContent = d;
                }
            });

            // 应用国际化到面板
            const panel = document.querySelector('.search-panel');
            if (panel && window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
                window.siteI18n.applyTo(panel);
            }

            // 更新空状态提示
            const resultsEl = document.getElementById('search-results');
            if (resultsEl && resultsEl.children.length === 1) {
                const first = resultsEl.children[0];
                if (first.classList && first.classList.contains('search-empty-hint')) {
                    try {
                        if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
                            window.siteI18n.applyTo(first);
                        }
                    } catch (error) {
                        console.error('[search] 应用国际化失败:', error);
                    }
                } else if (!first.querySelector('.title')) {
                    const noDetail = t('search_no_results_detail', '未在本文中找到匹配');
                    first.textContent = noDetail;
                }
            }
        } catch (error) {
            console.error('[search] 更新搜索面板国际化内容失败:', error);
        }
    }

    // 绑定语言切换事件
    if (!window.__searchI18nBound) {
        window.__searchI18nBound = true;
        document.addEventListener('site:languageChanged', updateSearchPanelI18n);
    }

    // ==================== 导航按钮绑定 ====================

    function bindNavButtons() {
        document.querySelectorAll('.nav-search-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const panel = document.querySelector('.search-panel');
                if (panel && panel.classList.contains('active')) {
                    hidePanel();
                } else {
                    showPanel();
                    try {
                        if (typeof window.__bringToFront === 'function') {
                            window.__bringToFront(panel);
                        }
                    } catch (error) {
                        console.error('[search] 提升面板层级失败:', error);
                    }
                }
            });
        });
    }

    // ==================== URL 参数自动搜索 ====================

    /**
     * 从 URL 中读取 ?q=keyword 并自动执行搜索
     */
    function tryApplyQueryFromUrl() {
        const q = getQueryParam('q');
        if (!q) return;

        const tryRun = () => {
            const content = document.getElementById('markdown-content');
            if (content && content.children.length > 0) {
                showPanel();
                const input = document.getElementById('global-search-input');
                if (input) input.value = q;
                doSearch(q);

                // 自动跳转到第一个匹配
                const matches = Array.from(content.querySelectorAll('span.search-match'));
                if (matches && matches.length > 0) {
                    matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return true;
            }
            return false;
        };

        // 立即尝试，若内容未就绪则轮询
        if (!tryRun()) {
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (tryRun() || attempts > 10) clearInterval(interval);
            }, 200);
        }
    }

    // ==================== 初始化 ====================

    document.addEventListener('DOMContentLoaded', () => {
        bindNavButtons();
        createPanel();

        // 详情页 URL 参数自动搜索
        if (document.body.classList.contains('blog-detail-page')) {
            tryApplyQueryFromUrl();
        }
    });
})();