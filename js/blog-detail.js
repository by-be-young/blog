/**
 * 博客详情页模块
 * 功能：文章渲染、目录生成、交互控制、显示管理、导出功能
 */
(function () {
    'use strict';

    // ==================== 工具函数 ====================

    /** 获取 URL 查询参数 */
    function getQueryParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    /** 获取当前语言 */
    function getLang() {
        try {
            return window.siteI18n?.getLang?.() || 'zh';
        } catch (_) {
            return 'zh';
        }
    }

    /** 获取国际化文本 */
    function getI18nText(key, fallback) {
        try {
            const lang = getLang();
            const map = window.siteI18n?.translations?.[lang] || {};
            return map[key] ?? fallback;
        } catch (_) {
            return fallback;
        }
    }

    /** 安全获取元素（通过 ID） */
    function getElement(id) {
        return document.getElementById(id);
    }

    /** 节流函数 */
    function throttle(fn, wait) {
        let last = 0;
        return function (...args) {
            const now = Date.now();
            if (now - last >= wait) {
                last = now;
                fn.apply(this, args);
            }
        };
    }

    /** 数字补零 */
    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    /** 格式化日期 */
    function formatDate(dateString) {
        if (typeof window.formatDate === 'function') {
            return window.formatDate(dateString);
        }
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        try {
            const lang = getLang();
            const locale = lang === 'ja' ? 'ja-JP' : lang === 'en' ? 'en-US' : 'zh-CN';
            return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (_) {
            const y = date.getFullYear();
            const m = pad2(date.getMonth() + 1);
            const d = pad2(date.getDate());
            return `${y}-${m}-${d}`;
        }
    }

    /** 统计文章字符数（不含 Markdown 标记） */
    function countArticleCharacters(markdownText) {
        const raw = String(markdownText || '');
        const stripped = raw
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/`[^`\n]*`/g, ' ')
            .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
            .replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1')
            .replace(/<[^>]+>/g, ' ')
            .replace(/[#>*~\-]/g, ' ')
            .replace(/\s+/g, '');
        return stripped.length;
    }

    /** 解析不蒜子数字 */
    function parseBusuanziNumber(value) {
        const txt = String(value || '').trim();
        if (!txt) return NaN;
        const num = Number(txt.replace(/,/g, ''));
        return isFinite(num) ? num : NaN;
    }

    /** 格式化数字 */
    function formatMetricInt(num) {
        const n = isFinite(Number(num)) ? Number(num) : 0;
        return n.toLocaleString('zh-CN');
    }

    /** 安全获取元素（通过选择器） */
    function getElementSafe(selector) {
        try {
            return document.querySelector(selector);
        } catch (_) {
            return null;
        }
    }

    /** 安全获取所有元素（通过选择器） */
    function getElementsSafe(selector) {
        try {
            return document.querySelectorAll(selector);
        } catch (_) {
            return [];
        }
    }

    // ==================== 状态管理 ====================

    const state = {
        wordCount: null,
        pagePv: NaN,
        pageUv: NaN,
        rawMarkdown: '',
        mdSourcePath: '',
        immersiveMode: false,
        subVisible: false,
    };

    // ==================== 文章加载与渲染 ====================

    function loadArticle() {
        const id = getQueryParam('id');

        fetch('data/blogs.json')
            .then((res) => res.json())
            .then((blogs) => {
                let blog = blogs.find((b) => String(b.id) === id);
                if (!blog) blog = blogs[0];
                if (!blog) return;

                renderArticleMeta(blog);
                renderPostNav(blog, blogs);
                loadMarkdownContent(blog);

                // 设置永久链接
                const permalinkEl = getElement('article-permalink');
                if (permalinkEl) {
                    const permalink = new URL('blog-detail.html?id=' + encodeURIComponent(String(blog.id)), window.location.href).toString();
                    permalinkEl.href = permalink;
                    permalinkEl.textContent = permalink;
                }
            })
            .catch((err) => {
                console.error('加载博客数据失败:', err);
                const contentEl = getElement('markdown-content');
                if (contentEl) {
                    contentEl.innerHTML = '<p>文章加载失败，请稍后重试。</p>';
                }
            });
    }

    function renderArticleMeta(blog) {
        // 标题
        const titleEl = getElement('article-title');
        if (titleEl) {
            titleEl.textContent = blog.title || '';
            if (blog.type) {
                const tspan = document.createElement('span');
                tspan.className = 'blog-type';
                tspan.textContent = blog.type;
                titleEl.appendChild(tspan);
            }
        }
        document.title = blog.title || '博客详情';

        // 日期
        const dateEl = getElement('article-date');
        if (dateEl) {
            if (blog.date) dateEl.setAttribute('data-date', blog.date);
            const formatted = formatDate(blog.date);
            dateEl.innerHTML = '<i class="far fa-calendar"></i> ' + formatted;
            dateEl.classList.add('date');
        }

        // 最近编辑时间
        const lastEditedEl = getElement('article-last-edited');
        if (lastEditedEl) {
            const lastEdited = (typeof blog.lastEditedDate === 'string' && blog.lastEditedDate.trim()) ? blog.lastEditedDate.trim() : '';
            if (lastEdited) {
                lastEditedEl.setAttribute('data-date', lastEdited);
                const formattedEdited = formatDate(lastEdited);
                lastEditedEl.innerHTML = '<i class="fas fa-pencil-alt"></i> ' + formattedEdited;
                lastEditedEl.style.display = 'inline-flex';
                lastEditedEl.classList.add('date');
            } else {
                lastEditedEl.style.display = 'none';
                lastEditedEl.setAttribute('data-date', '');
            }
        }

        // 标签
        const tagsEl = getElement('article-tags');
        if (tagsEl && Array.isArray(blog.tags)) {
            tagsEl.innerHTML = blog.tags.map((tag, idx) => {
                const path = blog.tags.slice(0, idx + 1);
                const href = 'categories.html?tags=' + encodeURIComponent(JSON.stringify(path));
                return `<a class="tag" href="${href}" target="_blank" rel="noopener noreferrer">${tag}</a>`;
            }).join('');
        }
    }

    function loadMarkdownContent(blog) {
        fetch(blog.contentFile)
            .then((res) => {
                if (!res.ok) {
                    throw new Error('加载失败: ' + blog.contentFile);
                }
                return res.text();
            })
            .then((md) => {
                const contentEl = getElement('markdown-content');
                if (contentEl) {
                    state.rawMarkdown = md;
                    state.mdSourcePath = blog.contentFile;
                    state.wordCount = countArticleCharacters(md);
                    renderArticleMetrics();
                    contentEl.textContent = md;
                    if (window.renderMarkdownContent) {
                        window.renderMarkdownContent();
                    }
                    setTimeout(generateTOC, 0);
                    // 文章内容渲染完成后绑定内部引用事件
                    initInternalRefHandler();
                }
            })
            .catch((err) => {
                console.error('加载 Markdown 失败:', err);
                const contentEl = getElement('markdown-content');
                if (contentEl) {
                    contentEl.innerHTML = '<p>文章内容加载失败，请稍后重试。</p>';
                }
            });
    }

    function renderArticleMetrics() {
        const metricsEl = getElement('article-metrics');
        if (!metricsEl) return;

        const parts = [];
        if (isFinite(state.wordCount)) {
            parts.push('<span class="article-metric-item"><i class="far fa-file-lines" aria-hidden="true"></i><span>' + formatMetricInt(state.wordCount) + '</span></span>');
        }

        const canShowViewAndVisitor = isFinite(state.pagePv) && isFinite(state.pageUv) && state.pagePv >= 100 && state.pageUv >= 100;

        if (canShowViewAndVisitor) {
            parts.push('<span class="article-metric-item"><i class="far fa-eye" aria-hidden="true"></i><span>' + formatMetricInt(state.pagePv) + '</span></span>');
            parts.push('<span class="article-metric-item"><i class="far fa-user" aria-hidden="true"></i><span>' + formatMetricInt(state.pageUv) + '</span></span>');
        }

        metricsEl.innerHTML = parts.join('');
    }

    function watchBusuanziPageStats() {
        let attempts = 0;
        const maxAttempts = 80;
        const timer = setInterval(function () {
            attempts++;
            const pvEl = getElement('busuanzi_page_pv');
            const uvEl = getElement('busuanzi_page_uv');
            if (pvEl) state.pagePv = parseBusuanziNumber(pvEl.textContent);
            if (uvEl) state.pageUv = parseBusuanziNumber(uvEl.textContent);
            renderArticleMetrics();
            if ((isFinite(state.pagePv) && isFinite(state.pageUv)) || attempts >= maxAttempts) {
                clearInterval(timer);
            }
        }, 150);
    }

    // ==================== 文章导航 ====================

    function renderPostNav(blog, blogs) {
        const prevEl = getElement('post-prev');
        const nextEl = getElement('post-next');
        const simEl = getElement('post-similar');
        if (!prevEl || !nextEl || !simEl) return;

        function normalizeSeriesName(value) {
            return (typeof value === 'string' && value.trim()) ? value.trim() : '';
        }

        function normalizeOrder(value) {
            if (typeof value === 'number' && isFinite(value)) return Math.trunc(value);
            if (typeof value === 'string' && value.trim()) {
                const parsed = Number(value.trim());
                if (isFinite(parsed)) return Math.trunc(parsed);
            }
            return null;
        }

        function normalizeChapter(value) {
            return (typeof value === 'string' && value.trim()) ? value.trim() : '';
        }

        function parseChapter(value) {
            const raw = normalizeChapter(value);
            if (!raw) {
                return { raw: '', order: Infinity, title: '未分章', hasChapter: false };
            }
            const match = raw.match(/^(\d+)\s*-\s*(.+)$/);
            if (match) {
                return { raw, order: Number(match[1]), title: match[2].trim(), hasChapter: true };
            }
            return { raw, order: Infinity, title: raw, hasChapter: true };
        }

        function compareSeriesPosts(a, b) {
            const aChapter = parseChapter(a && a.chapter);
            const bChapter = parseChapter(b && b.chapter);

            if (aChapter.hasChapter || bChapter.hasChapter) {
                if (aChapter.hasChapter && !bChapter.hasChapter) return -1;
                if (!aChapter.hasChapter && bChapter.hasChapter) return 1;
                if (aChapter.order !== bChapter.order) return aChapter.order - bChapter.order;
                if (aChapter.title !== bChapter.title) return aChapter.title.localeCompare(bChapter.title, 'zh-CN');
            }

            const aHasOrder = isFinite(a && a.__seriesOrder);
            const bHasOrder = isFinite(b && b.__seriesOrder);

            if (aHasOrder && bHasOrder) {
                if (a.__seriesOrder !== b.__seriesOrder) return a.__seriesOrder - b.__seriesOrder;
                return new Date(b.date) - new Date(a.date);
            }

            if (aHasOrder && !bHasOrder) return -1;
            if (!aHasOrder && bHasOrder) return 1;

            return new Date(b.date) - new Date(a.date);
        }

        const currentSeries = normalizeSeriesName(blog.series);
        let sorted = [];

        if (currentSeries) {
            sorted = Array.isArray(blogs)
                ? blogs
                    .filter((b) => normalizeSeriesName(b && b.series) === currentSeries)
                    .map((b) => ({ ...b, __seriesOrder: normalizeOrder(b && b.order), chapter: normalizeChapter(b && b.chapter) }))
                    .sort(compareSeriesPosts)
                : [];
            simEl.style.display = 'none';
        } else {
            sorted = Array.isArray(blogs) ? blogs.slice().sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
        }

        const curIdx = sorted.findIndex((b) => String(b.id) === String(blog.id));
        if (curIdx === -1) {
            prevEl.style.display = 'none';
            nextEl.style.display = 'none';
            simEl.style.display = 'none';
            return;
        }

        const prev = sorted[curIdx - 1];
        const next = sorted[curIdx + 1];

        if (prev) {
            prevEl.href = 'blog-detail.html?id=' + prev.id;
            if (currentSeries) {
                prevEl.removeAttribute('target');
                prevEl.removeAttribute('rel');
            } else {
                prevEl.target = '_blank';
                prevEl.rel = 'noopener noreferrer';
            }
            const titleEl = prevEl.querySelector('.post-nav-title');
            if (titleEl) titleEl.textContent = prev.title || '';
            prevEl.style.display = 'flex';
        } else {
            prevEl.style.display = 'none';
        }

        if (next) {
            nextEl.href = 'blog-detail.html?id=' + next.id;
            if (currentSeries) {
                nextEl.removeAttribute('target');
                nextEl.removeAttribute('rel');
            } else {
                nextEl.target = '_blank';
                nextEl.rel = 'noopener noreferrer';
            }
            const titleEl = nextEl.querySelector('.post-nav-title');
            if (titleEl) titleEl.textContent = next.title || '';
            nextEl.style.display = 'flex';
        } else {
            nextEl.style.display = 'none';
        }

        if (!currentSeries) {
            function tag(b, i) {
                return (b.tags && b.tags[i] !== undefined) ? b.tags[i] : null;
            }
            const cur0 = tag(blog, 0),
                cur1 = tag(blog, 1),
                cur2 = tag(blog, 2);
            let similar = null;

            if (cur0 !== null && cur1 !== null && cur2 !== null) {
                similar = blogs.find((b) => String(b.id) !== String(blog.id) && tag(b, 0) === cur0 && tag(b, 1) === cur1 && tag(b, 2) === cur2);
            }
            if (!similar && cur1 !== null) {
                similar = blogs.find((b) => String(b.id) !== String(blog.id) && tag(b, 1) === cur1 && tag(b, 2) !== cur2);
            }
            if (!similar && cur0 !== null) {
                similar = blogs.find((b) => String(b.id) !== String(blog.id) && tag(b, 0) === cur0 && tag(b, 1) !== cur1);
            }

            if (similar) {
                simEl.href = 'blog-detail.html?id=' + similar.id;
                simEl.target = '_blank';
                simEl.rel = 'noopener noreferrer';
                const titleEl = simEl.querySelector('.post-nav-title');
                if (titleEl) titleEl.textContent = similar.title || '';
                simEl.style.display = 'flex';
            } else {
                simEl.style.display = 'none';
            }
        }

        try {
            if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
                window.siteI18n.applyTo(getElement('post-nav-left'));
            }
        } catch (_) { }
    }

    // ==================== 目录生成 ====================

    function generateTOC() {
        const tocProgressEl = getElement('toc-progress');
        const articleContentEl = getElement('markdown-content');
        if (!tocProgressEl || !articleContentEl) return;

        const TOC_SUBLIST_ANIM_MS = 220;
        const TOC_SCROLL_LOCK_MIN_MS = 650;
        const TOC_SCROLL_LOCK_MAX_MS = 2200;

        function clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        function setSubListState(ul, open, instant) {
            if (!ul) return;
            const hasState = ul.dataset.open === '1' || ul.dataset.open === '0';
            const wasOpen = ul.dataset.open === '1';
            if (hasState && wasOpen === !!open) {
                if (open) {
                    ul.style.display = 'block';
                    ul.style.maxHeight = 'none';
                    ul.style.opacity = '1';
                    ul.style.overflow = 'visible';
                }
                return;
            }
            if (ul.__tocAnimTimer) {
                clearTimeout(ul.__tocAnimTimer);
                ul.__tocAnimTimer = null;
            }

            const seq = (Number(ul.dataset.animSeq || '0') || 0) + 1;
            ul.dataset.animSeq = String(seq);
            ul.dataset.open = open ? '1' : '0';
            ul.style.overflow = 'hidden';
            ul.style.transition = instant ? 'none' : 'max-height ' + TOC_SUBLIST_ANIM_MS + 'ms ease, opacity 180ms ease';

            if (open) {
                ul.style.display = 'block';
                const target = ul.scrollHeight;
                if (instant) {
                    ul.style.maxHeight = 'none';
                    ul.style.opacity = '1';
                    ul.style.overflow = 'visible';
                    return;
                }

                ul.style.maxHeight = '0px';
                ul.style.opacity = '0';
                requestAnimationFrame(() => {
                    if (ul.dataset.animSeq !== String(seq) || ul.dataset.open !== '1') return;
                    ul.style.maxHeight = target + 'px';
                    ul.style.opacity = '1';
                });
                ul.__tocAnimTimer = setTimeout(() => {
                    if (ul.dataset.animSeq !== String(seq) || ul.dataset.open !== '1') return;
                    ul.style.maxHeight = 'none';
                    ul.style.overflow = 'visible';
                }, TOC_SUBLIST_ANIM_MS + 40);
                return;
            }

            const current = ul.scrollHeight;
            ul.style.display = 'block';
            if (instant) {
                ul.style.maxHeight = '0px';
                ul.style.opacity = '0';
                ul.style.display = 'none';
                return;
            }

            ul.style.maxHeight = current + 'px';
            ul.style.opacity = '1';
            requestAnimationFrame(() => {
                if (ul.dataset.animSeq !== String(seq) || ul.dataset.open !== '0') return;
                ul.style.maxHeight = '0px';
                ul.style.opacity = '0';
            });
            ul.__tocAnimTimer = setTimeout(() => {
                if (ul.dataset.animSeq !== String(seq) || ul.dataset.open !== '0') return;
                ul.style.display = 'none';
            }, TOC_SUBLIST_ANIM_MS + 40);
        }

        function updateTocProgress() {
            if (!tocProgressEl || !articleContentEl) return;
            const rect = articleContentEl.getBoundingClientRect();
            const viewportBottom = window.innerHeight || document.documentElement.clientHeight || 0;
            const total = Math.max(rect.height, 1);
            const passed = viewportBottom - rect.top;
            const ratio = Math.max(0, Math.min(1, passed / total));
            tocProgressEl.textContent = String(Math.round(ratio * 100));
        }

        let activeH1Id = null;
        let lastUrlH1Id = null;
        let tocAutoSyncLockUntil = 0;

        /** 安全获取元素（通过 ID） */
        function safeGetElementById(id) {
            try {
                return document.getElementById(id);
            } catch (_) {
                return null;
            }
        }

        /** 安全获取元素（通过选择器） */
        function safeQuerySelector(selector) {
            try {
                return document.querySelector(selector);
            } catch (_) {
                return null;
            }
        }

        function openH1ById(h1Id) {
            if (!h1Id || !h1Map.has(h1Id)) return;
            const currentH1Li = h1Map.get(h1Id);
            const currentSubList = currentH1Li ? currentH1Li.querySelector('ul') : null;
            if (activeH1Id === h1Id && (!currentSubList || currentSubList.dataset.open === '1')) return;

            document.querySelectorAll('.toc-h1 > .toc-sub-list').forEach(function (ul) {
                setSubListState(ul, false);
            });
            document.querySelectorAll('.toc-h1 > .toc-toggle').forEach(function (t) {
                t.textContent = '▶';
            });

            const h1Li = h1Map.get(h1Id);
            if (!h1Li) {
                activeH1Id = h1Id;
                return;
            }
            const ul = h1Li.querySelector('ul');
            const toggle = h1Li.querySelector('.toc-toggle');
            if (ul) setSubListState(ul, true);
            if (toggle) toggle.textContent = '▼';

            activeH1Id = h1Id;
            syncActiveH2WithSubList();
        }

        function scrollToHeaderAndExpand(e, headerId) {
            e.preventDefault();
            const header = safeGetElementById(headerId);
            if (header) {
                let h1Id = null;
                if (header.tagName.toLowerCase() === 'h1') {
                    h1Id = header.id;
                    setActiveH2(null, null, true);
                    setActiveH3(null, null);
                } else if (header.tagName.toLowerCase() === 'h2' || header.tagName.toLowerCase() === 'h3') {
                    let prev = header.previousElementSibling;
                    while (prev) {
                        if (prev.tagName && prev.tagName.toLowerCase() === 'h1') {
                            h1Id = prev.id;
                            break;
                        }
                        prev = prev.previousElementSibling;
                    }
                }
                openH1ById(h1Id);
                if (header.tagName.toLowerCase() === 'h2') {
                    const h2Li = h2Map.get(header.id);
                    setActiveH2(h2Li || null, header, true);
                    setActiveH3(null, null);
                } else if (header.tagName.toLowerCase() === 'h3') {
                    const parentH2 = getParentH2ForHeading(header);
                    const h2Li = parentH2 && parentH2.id ? h2Map.get(parentH2.id) : null;
                    setActiveH2(h2Li || null, parentH2 || null, true);
                    const h3Li = h3Map.get(header.id);
                    setActiveH3(h3Li || null, header);
                }
                refreshActiveH2IndicatorSoon();

                const nav = document.querySelector('.navbar');
                const navHeight = nav ? nav.offsetHeight : 0;
                if (window.__scrollingToTOC) return;
                window.__scrollingToTOC = true;
                const y = header.getBoundingClientRect().top + window.scrollY - navHeight - 10;
                const distance = Math.abs(y - window.scrollY);
                const lockMs = clamp(Math.round(distance * 0.9), TOC_SCROLL_LOCK_MIN_MS, TOC_SCROLL_LOCK_MAX_MS);
                tocAutoSyncLockUntil = Date.now() + lockMs;
                window.scrollTo({ top: y, behavior: 'smooth' });
                setTimeout(function () {
                    window.__scrollingToTOC = false;
                }, lockMs);

                try {
                    history.replaceState(null, '', '#' + headerId);
                } catch (_) { }
            }
        }

        const content = getElement('markdown-content');
        const tocList = getElement('toc-list');
        if (!content || !tocList) return;
        tocList.innerHTML = '';
        tocList.classList.add('has-animated-h2-indicator');

        const h2Indicator = document.createElement('div');
        h2Indicator.className = 'toc-h2-active-indicator';
        tocList.appendChild(h2Indicator);

        const tocBug = document.createElement('div');
        tocBug.id = 'toc-bug';
        tocBug.className = 'toc-bug';
        const bugImg = document.createElement('img');
        bugImg.src = 'assets/images/task/correct.png';
        bugImg.alt = '';
        tocBug.appendChild(bugImg);
        tocList.appendChild(tocBug);

        let activeH2Li = null;
        let activeH3Li = null;
        let tocCenterPending = false;
        let tocCenterTargetLi = null;

        function scheduleCenterTocItem(li, instant) {
            if (!tocList || !li || !li.isConnected) return;
            tocCenterTargetLi = li;
            if (tocCenterPending) return;
            tocCenterPending = true;

            requestAnimationFrame(function () {
                tocCenterPending = false;
                const target = tocCenterTargetLi;
                if (!target || !target.isConnected) return;

                const anchor = target.querySelector(':scope > a');
                const targetEl = (anchor && anchor.getClientRects().length > 0) ? anchor : target;
                if (!targetEl || targetEl.getClientRects().length === 0) return;

                const containerHeight = tocList.clientHeight || 0;
                if (containerHeight <= 0) return;

                const containerRect = tocList.getBoundingClientRect();
                const itemRect = targetEl.getBoundingClientRect();
                const itemTopInList = itemRect.top - containerRect.top + tocList.scrollTop;
                const desiredTop = itemTopInList - (containerHeight - itemRect.height) / 2;
                const maxTop = Math.max(0, tocList.scrollHeight - containerHeight);
                const nextTop = Math.max(0, Math.min(desiredTop, maxTop));

                const currentTop = tocList.scrollTop;
                if (Math.abs(currentTop - nextTop) < 2) return;

                if (instant) {
                    tocList.scrollTop = nextTop;
                } else {
                    tocList.scrollTo({ top: nextTop, behavior: 'smooth' });
                }
            });
        }

        function getRelativeOffset(el, ancestor) {
            let top = 0;
            let left = 0;
            let node = el;
            while (node && node !== ancestor) {
                top += node.offsetTop || 0;
                left += node.offsetLeft || 0;
                node = node.offsetParent;
            }
            if (node !== ancestor) return null;
            return { top: top, left: left };
        }

        function getH2IndicatorReachWidth(anchorRect, listRect) {
            const leftInList = anchorRect.left - listRect.left;
            const rightPadding = 2;
            const reach = listRect.width - leftInList - rightPadding;
            return Math.max(0, Math.round(reach));
        }

        function refreshActiveH2IndicatorSoon() {
            requestAnimationFrame(function () {
                moveH2IndicatorTo(activeH2Li, true);
                moveTocBugTo(activeH3Li);
            });
            setTimeout(function () {
                moveH2IndicatorTo(activeH2Li, true);
                moveTocBugTo(activeH3Li);
            }, TOC_SUBLIST_ANIM_MS + 60);
        }

        function moveH2IndicatorTo(li, instant) {
            if (!h2Indicator) return;
            if (!li) {
                h2Indicator.style.opacity = '0';
                return;
            }

            if (!li.isConnected || !tocList.contains(li) || li.getClientRects().length === 0) {
                h2Indicator.style.opacity = '0';
                return;
            }
            const ownerSubList = li.closest('.toc-sub-list');
            if (ownerSubList && ownerSubList.dataset.open !== '1') {
                h2Indicator.style.opacity = '0';
                return;
            }

            const anchor = li.querySelector(':scope > a');
            if (!anchor) {
                h2Indicator.style.opacity = '0';
                return;
            }
            if (anchor.getClientRects().length === 0) {
                h2Indicator.style.opacity = '0';
                return;
            }

            const relative = getRelativeOffset(anchor, tocList);
            if (!relative) {
                h2Indicator.style.opacity = '0';
                return;
            }

            const listRect = tocList.getBoundingClientRect();
            const anchorRect = anchor.getBoundingClientRect();
            const top = relative.top - 4;
            const left = relative.left - 12;
            const width = getH2IndicatorReachWidth(anchorRect, listRect) + 12;
            const height = anchorRect.height + 8;

            if (!isFinite(top) || !isFinite(left) || !isFinite(width) || !isFinite(height)) {
                h2Indicator.style.opacity = '0';
                return;
            }

            if (instant) {
                h2Indicator.style.transition = 'none';
            } else {
                h2Indicator.style.transition = '';
            }

            h2Indicator.style.transform = 'translateY(' + Math.round(top) + 'px)';
            h2Indicator.style.left = Math.round(left) + 'px';
            h2Indicator.style.width = Math.round(width) + 'px';
            h2Indicator.style.height = Math.round(height) + 'px';
            h2Indicator.style.opacity = '1';

            if (instant) {
                requestAnimationFrame(function () {
                    h2Indicator.style.transition = '';
                });
            }
        }

        function moveTocBugTo(li) {
            const bug = getElement('toc-bug');
            if (!bug) return;
            if (!li) {
                bug.style.opacity = '0';
                return;
            }

            if (!li.isConnected || !tocList.contains(li) || li.getClientRects().length === 0) {
                bug.style.opacity = '0';
                return;
            }

            const anchor = li.querySelector(':scope > a');
            if (!anchor || anchor.getClientRects().length === 0) {
                bug.style.opacity = '0';
                return;
            }

            const relative = getRelativeOffset(anchor, tocList);
            if (!relative) {
                bug.style.opacity = '0';
                return;
            }

            const anchorRect = anchor.getBoundingClientRect();
            const bugWidth = 18;
            const bugHeight = 18;
            const left = Math.round(relative.left - bugWidth - 10);
            const top = Math.round(relative.top + (anchorRect.height - bugHeight) / 2);

            if (!isFinite(left) || !isFinite(top)) {
                bug.style.opacity = '0';
                return;
            }

            bug.style.left = left + 'px';
            bug.style.top = top + 'px';
            bug.style.width = bugWidth + 'px';
            bug.style.height = bugHeight + 'px';
            bug.style.opacity = '1';
        }

        function setActiveH2(li, headingEl, instant) {
            const nextLi = li || null;
            const nextHeading = headingEl || null;
            const currentHeading = content.querySelector('h2.is-toc-active');
            if (activeH2Li === nextLi && currentHeading === nextHeading) {
                moveH2IndicatorTo(activeH2Li, true);
                if (activeH2Li) scheduleCenterTocItem(activeH2Li, instant);
                return;
            }

            document.querySelectorAll('.toc-h2.is-active').forEach(function (el) {
                el.classList.remove('is-active');
            });
            content.querySelectorAll('h2.is-toc-active').forEach(function (h) {
                h.classList.remove('is-toc-active');
            });

            activeH2Li = nextLi;
            if (nextLi) nextLi.classList.add('is-active');
            if (nextHeading) nextHeading.classList.add('is-toc-active');

            setH3SubListOpenForH2Li(activeH2Li, instant);
            moveH2IndicatorTo(activeH2Li, instant);
            if (activeH2Li) scheduleCenterTocItem(activeH2Li, instant);
        }

        function setActiveH3(li, headingEl, instant) {
            const nextLi = li || null;
            const nextHeading = headingEl || null;
            const currentHeading = content.querySelector('h3.is-toc-active');
            if (activeH3Li === nextLi && currentHeading === nextHeading) {
                moveTocBugTo(activeH3Li);
                if (activeH3Li) scheduleCenterTocItem(activeH3Li, instant);
                return;
            }

            document.querySelectorAll('.toc-h3.is-active').forEach(function (el) {
                el.classList.remove('is-active');
            });
            content.querySelectorAll('h3.is-toc-active').forEach(function (h) {
                h.classList.remove('is-toc-active');
            });

            activeH3Li = nextLi;
            if (nextLi) nextLi.classList.add('is-active');
            if (nextHeading) nextHeading.classList.add('is-toc-active');

            moveTocBugTo(activeH3Li);
            if (activeH3Li) scheduleCenterTocItem(activeH3Li, instant);
        }

        function getCurrentH2WithinH1(h1El, offset) {
            if (!h1El) return null;
            let node = h1El.nextElementSibling;
            let currentH2 = null;
            const activationOffset = offset - 6;
            while (node) {
                if (!node.tagName) {
                    node = node.nextElementSibling;
                    continue;
                }
                const tag = node.tagName.toLowerCase();
                if (tag === 'h1') break;
                if (tag === 'h2') {
                    const r = node.getBoundingClientRect();
                    if (r.top <= activationOffset) currentH2 = node;
                    else break;
                }
                node = node.nextElementSibling;
            }
            return currentH2;
        }

        function getCurrentH3WithinH2(h2El, offset) {
            if (!h2El) return null;
            let node = h2El.nextElementSibling;
            let currentH3 = null;
            const activationOffset = offset - 6;
            while (node) {
                if (!node.tagName) {
                    node = node.nextElementSibling;
                    continue;
                }
                const tag = node.tagName.toLowerCase();
                if (tag === 'h1' || tag === 'h2') break;
                if (tag === 'h3') {
                    const r = node.getBoundingClientRect();
                    if (r.top <= activationOffset) currentH3 = node;
                    else break;
                }
                node = node.nextElementSibling;
            }
            return currentH3;
        }

        function isNearNextH2Top(h1El, offset) {
            if (!h1El) return false;
            const activationOffset = offset - 6;
            const transitionBand = 28;
            let node = h1El.nextElementSibling;
            while (node) {
                if (!node.tagName) {
                    node = node.nextElementSibling;
                    continue;
                }
                const tag = node.tagName.toLowerCase();
                if (tag === 'h1') break;
                if (tag === 'h2') {
                    const top = node.getBoundingClientRect().top;
                    if (top > activationOffset) {
                        return (top - activationOffset) <= transitionBand;
                    }
                }
                node = node.nextElementSibling;
            }
            return false;
        }

        function getParentH2ForHeading(headingEl) {
            if (!headingEl) return null;
            if (headingEl.tagName && headingEl.tagName.toLowerCase() === 'h2') return headingEl;
            let prev = headingEl.previousElementSibling;
            while (prev) {
                if (prev.tagName) {
                    const tag = prev.tagName.toLowerCase();
                    if (tag === 'h2') return prev;
                    if (tag === 'h1') break;
                }
                prev = prev.previousElementSibling;
            }
            return null;
        }

        function setH3SubListOpenForH2Li(targetH2Li, instant) {
            document.querySelectorAll('.toc-h2 > .toc-sub-list').forEach(function (ul) {
                const shouldOpen = !!targetH2Li && ul.parentElement === targetH2Li;
                setSubListState(ul, shouldOpen, instant);
            });
        }

        function parseHeadingLabelWithStar(rawText) {
            const txt = String(rawText || '').trim();
            const re = /(?:【\s*[!！]\s*】|\[\s*[!！]\s*\]|［\s*[!！]\s*］)\s*$/;
            return {
                text: txt.replace(re, '').trim(),
                star: re.test(txt)
            };
        }

        function createTocAnchor(header) {
            const plain = header && header.dataset ? (header.dataset.headingPlainText || '') : '';
            const marked = header && header.dataset ? (header.dataset.starMarked === '1') : false;
            const meta = marked ?
                { text: plain || ((header && header.textContent) || '').replace(/★\s*$/, '').trim(), star: true } :
                parseHeadingLabelWithStar(plain || (header && header.textContent));
            const a = document.createElement('a');
            a.setAttribute('href', '#' + header.id);

            const label = document.createElement('span');
            label.className = 'toc-item-label';
            label.textContent = meta.text || (header && header.textContent) || '';
            a.appendChild(label);

            if (meta.star) {
                a.classList.add('has-star-marker');
                const star = document.createElement('span');
                star.className = 'toc-star-marker';
                star.setAttribute('aria-hidden', 'true');
                star.textContent = '★';
                a.appendChild(star);
            }
            return a;
        }

        function syncActiveH2WithSubList() {
            if (!activeH2Li) return;
            const subList = activeH2Li.closest('.toc-sub-list');
            if (!subList) return;
            if (subList.dataset.open !== '1') {
                setActiveH2(null, null, true);
                setActiveH3(null, null);
            }
        }

        const headers = Array.from(content.querySelectorAll('h1, h2, h3'));
        let lastH1 = null,
            lastH2 = null;
        const h1Map = new Map();
        const h2Map = new Map();
        const h3Map = new Map();
        const h3ParentH2IdMap = new Map();

        headers.forEach(function (header, idx) {
            if (!header.id) header.id = 'toc-h-' + idx;
            const tag = header.tagName.toLowerCase();
            if (tag === 'h1') {
                lastH1 = document.createElement('li');
                lastH1.className = 'toc-h1';
                const toggle = document.createElement('span');
                toggle.className = 'toc-toggle';
                toggle.title = '展开/收起';
                toggle.textContent = '▶';
                lastH1.appendChild(toggle);
                lastH1.appendChild(createTocAnchor(header));
                tocList.appendChild(lastH1);
                h1Map.set(header.id, lastH1);
                lastH2 = null;
                lastH1.querySelector('a').addEventListener('click', function (e) {
                    scrollToHeaderAndExpand(e, header.id);
                });
            } else if (tag === 'h2') {
                if (!lastH1) return;
                let ul = lastH1.querySelector('ul');
                if (!ul) {
                    ul = document.createElement('ul');
                    ul.className = 'toc-sub-list';
                    lastH1.appendChild(ul);
                }
                lastH2 = document.createElement('li');
                lastH2.className = 'toc-h2';
                lastH2.appendChild(createTocAnchor(header));
                ul.appendChild(lastH2);
                h2Map.set(header.id, lastH2);
                lastH2.querySelector('a').addEventListener('click', function (e) {
                    scrollToHeaderAndExpand(e, header.id);
                });
            } else if (tag === 'h3') {
                if (!lastH2) return;
                let ul = lastH2.querySelector('ul');
                if (!ul) {
                    ul = document.createElement('ul');
                    ul.className = 'toc-sub-list toc-h3-sub-list';
                    lastH2.appendChild(ul);
                }
                const h3Li = document.createElement('li');
                h3Li.className = 'toc-h3';
                h3Li.appendChild(createTocAnchor(header));
                ul.appendChild(h3Li);
                h3Map.set(header.id, h3Li);

                const parentLink = lastH2.querySelector('a[href^="#"]');
                const parentH2Id = parentLink ? parentLink.getAttribute('href').slice(1) : null;
                if (parentH2Id) h3ParentH2IdMap.set(header.id, parentH2Id);

                h3Li.querySelector('a').addEventListener('click', function (e) {
                    scrollToHeaderAndExpand(e, header.id);
                });
            }
        });

        tocList.appendChild(h2Indicator);
        moveH2IndicatorTo(null, true);

        document.querySelectorAll('.toc-h1 > .toc-sub-list, .toc-h2 > .toc-sub-list').forEach(function (ul) {
            setSubListState(ul, false, true);
        });

        document.querySelectorAll('.toc-h1 > .toc-toggle').forEach(function (toggle) {
            toggle.addEventListener('click', function (e) {
                e.stopPropagation();
                const h1Li = this.parentElement;
                const ul = this.parentElement.querySelector('ul');
                if (!ul) return;
                const isOpen = ul.dataset.open === '1';
                document.querySelectorAll('.toc-h1 > .toc-sub-list').forEach(function (otherUl) {
                    setSubListState(otherUl, false);
                    const t = otherUl.parentElement.querySelector('.toc-toggle');
                    if (t) t.textContent = '▶';
                });
                if (!isOpen) {
                    setSubListState(ul, true);
                    this.textContent = '▼';
                    const h1Link = h1Li.querySelector('a[href^="#"]');
                    activeH1Id = h1Link ? h1Link.getAttribute('href').slice(1) : activeH1Id;
                } else {
                    setSubListState(ul, false);
                    this.textContent = '▶';
                    activeH1Id = null;
                }
                syncActiveH2WithSubList();
            });
        });

        function openCurrentH1ByHash() {
            if (!location.hash) return;
            var target = null;
            try {
                var decodedId = decodeURIComponent(location.hash.slice(1));
                target = document.getElementById(decodedId);
            } catch (_) {
                try {
                    target = document.querySelector(location.hash);
                } catch (__) { }
            }
            if (!target) return;

            var h1Id = null;
            if (target.tagName.toLowerCase() === 'h1') {
                h1Id = target.id;
            } else if (target.tagName.toLowerCase() === 'h2' || target.tagName.toLowerCase() === 'h3') {
                var prev = target.previousElementSibling;
                while (prev) {
                    if (prev.tagName && prev.tagName.toLowerCase() === 'h1') {
                        h1Id = prev.id;
                        break;
                    }
                    prev = prev.previousElementSibling;
                }
            }
            openH1ById(h1Id);
            if (target.tagName.toLowerCase() === 'h2') {
                setActiveH2(h2Map.get(target.id) || null, target, true);
                setActiveH3(null, null);
            } else if (target.tagName.toLowerCase() === 'h3') {
                var parentH2Id = h3ParentH2IdMap.get(target.id);
                var parentH2 = parentH2Id ? document.getElementById(parentH2Id) : getParentH2ForHeading(target);
                var h2Li = parentH2 && parentH2.id ? h2Map.get(parentH2.id) : null;
                setActiveH2(h2Li || null, parentH2 || null, true);
                setActiveH3(h3Map.get(target.id) || null, target);
            }
            refreshActiveH2IndicatorSoon();
        }

        var scrollHandler = function () {
            updateTocProgress();
            if (window.__scrollingToTOC) return;
            if (Date.now() < tocAutoSyncLockUntil) return;

            var h1s = Array.from(content.querySelectorAll('h1'));
            var current = null;
            var nav = document.querySelector('.navbar');
            var offset = (nav ? nav.offsetHeight : 0) + 20;
            for (var i = 0; i < h1s.length; i++) {
                var rect = h1s[i].getBoundingClientRect();
                if (rect.top <= offset) {
                    current = h1s[i];
                } else {
                    break;
                }
            }

            if (!current || !current.id) return;
            openH1ById(current.id);

            try {
                if (isNearNextH2Top(current, offset)) {
                    setActiveH2(null, null, true);
                    setActiveH3(null, null);
                } else {
                    var currentH2 = getCurrentH2WithinH1(current, offset);
                    if (currentH2 && currentH2.id) {
                        var li = h2Map.get(currentH2.id);
                        setActiveH2(li || null, currentH2);
                        var currentH3 = getCurrentH3WithinH2(currentH2, offset);
                        if (currentH3 && currentH3.id) {
                            setActiveH3(h3Map.get(currentH3.id) || null, currentH3);
                        } else {
                            setActiveH3(null, null);
                        }
                    } else {
                        setActiveH2(null, null);
                        setActiveH3(null, null);
                    }
                }
            } catch (_) { }

            if (lastUrlH1Id !== current.id) {
                lastUrlH1Id = current.id;
                try {
                    history.replaceState(null, '', '#' + current.id);
                } catch (_) { }
            }
        };

        window.addEventListener('scroll', scrollHandler);
        window.addEventListener('resize', function () {
            updateTocProgress();
            moveH2IndicatorTo(activeH2Li, true);
            moveTocBugTo(activeH3Li);
        });
        tocList.addEventListener('scroll', function () {
            moveH2IndicatorTo(activeH2Li, true);
            moveTocBugTo(activeH3Li);
        });

        window.addEventListener('hashchange', function () {
            openCurrentH1ByHash();
            try {
                var target = null;
                if (location.hash) {
                    try {
                        var decodedId = decodeURIComponent(location.hash.slice(1));
                        target = document.getElementById(decodedId);
                    } catch (_) {
                        try {
                            target = document.querySelector(location.hash);
                        } catch (__) { }
                    }
                }
                if (target && target.tagName.toLowerCase() === 'h2') {
                    var li = h2Map.get(target.id);
                    setActiveH2(li || null, target);
                    setActiveH3(null, null);
                } else if (target && target.tagName.toLowerCase() === 'h3') {
                    var parentH2Id = h3ParentH2IdMap.get(target.id);
                    var parentH2 = parentH2Id ? document.getElementById(parentH2Id) : getParentH2ForHeading(target);
                    var h2Li = parentH2 && parentH2.id ? h2Map.get(parentH2.id) : null;
                    setActiveH2(h2Li || null, parentH2 || null);
                    setActiveH3(h3Map.get(target.id) || null, target);
                } else {
                    setActiveH2(null, null);
                    setActiveH3(null, null);
                }
            } catch (_) { }
        });

        openCurrentH1ByHash();

        try {
            if (location.hash) {
                var target = null;
                try {
                    var decodedId = decodeURIComponent(location.hash.slice(1));
                    target = document.getElementById(decodedId);
                } catch (_) {
                    try {
                        target = document.querySelector(location.hash);
                    } catch (__) { }
                }
                if (target && target.tagName.toLowerCase() === 'h2' && h2Map.has(target.id)) {
                    setActiveH2(h2Map.get(target.id), target, true);
                    setActiveH3(null, null);
                } else if (target && target.tagName.toLowerCase() === 'h3') {
                    var parentH2Id = h3ParentH2IdMap.get(target.id);
                    var parentH2 = parentH2Id ? document.getElementById(parentH2Id) : getParentH2ForHeading(target);
                    var h2Li = parentH2 && parentH2.id ? h2Map.get(parentH2.id) : null;
                    setActiveH2(h2Li || null, parentH2 || null, true);
                    setActiveH3(h3Map.get(target.id) || null, target);
                }
            }
        } catch (_) { }

        updateTocProgress();
    }

    // ==================== 返回顶部 ====================

    function initBackToTop() {
        const btn = getElement('back-to-top');
        if (!btn) return;

        function updateVisibility() {
            if (window.scrollY > 300) {
                btn.style.display = 'inline-flex';
                btn.style.flexShrink = '0';
            } else {
                btn.style.display = 'none';
            }
        }

        updateVisibility();
        window.addEventListener('scroll', throttle(updateVisibility, 50));

        btn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ==================== 返回引用 ====================

    function initReturnFromRef() {
        const btn = getElement('return-from-ref-btn');
        if (!btn) return;

        const stateRef = window.__internalRefBackState || { scrollY: 0, hash: '', available: false };
        window.__internalRefBackState = stateRef;

        function hide() {
            stateRef.available = false;
            btn.style.display = 'none';
            btn.classList.remove('is-visible');
            btn.setAttribute('aria-hidden', 'true');
        }

        function show() {
            if (!stateRef.available) return;
            btn.style.display = 'inline-flex';
            btn.classList.add('is-visible');
            btn.style.opacity = '1';
            btn.style.transform = 'translateX(0)';
            btn.setAttribute('aria-hidden', 'false');
        }

        hide();

        btn.addEventListener('click', function () {
            if (!stateRef.available) return;
            const targetY = isFinite(Number(stateRef.scrollY)) ? Number(stateRef.scrollY) : 0;
            const targetHash = typeof stateRef.hash === 'string' ? stateRef.hash : '';
            hide();
            window.scrollTo({ top: targetY, behavior: 'smooth' });
            try {
                if (targetHash) history.replaceState(null, '', targetHash);
                else history.replaceState(null, '', window.location.pathname + window.location.search);
            } catch (_) { }
        });

        window.addEventListener('internal-ref:back-state-change', function () {
            if (stateRef.available) show();
            else hide();
        });
    }

    // ==================== 内部引用跳转 ====================

    var internalRefHandlerBound = false;

    var internalRefHandlerBound = false;

    function initInternalRefHandler() {
        if (internalRefHandlerBound) return;
        internalRefHandlerBound = true;

        document.addEventListener('mousedown', function (e) {
            var link = e.target.closest('a[href^="#"]');
            if (!link) return;
            if (!link.closest('.article-content')) return;

            // 排除目录和导航链接
            if (link.closest('.toc-list')) return;
            if (link.closest('.post-nav-btn')) return;

            var href = link.getAttribute('href');
            if (href === '#' || href === '#top') return;

            // 精确匹配内部引用链接（class="internal-ref"）
            if (!link.classList.contains('internal-ref')) return;

            var targetId = href.slice(1);
            console.log('内部引用点击(mousedown):', targetId);

            // 保存当前位置
            var state = window.__internalRefBackState || { scrollY: 0, hash: '', available: false };
            state.scrollY = window.scrollY;
            state.hash = window.location.hash || '';
            state.available = true;
            window.__internalRefBackState = state;

            var btn = document.getElementById('return-from-ref-btn');
            if (btn) {
                btn.style.display = 'inline-flex';
                btn.classList.add('is-visible');
                btn.style.opacity = '1';
                btn.style.transform = 'translateX(0)';
                btn.setAttribute('aria-hidden', 'false');
            }

            window.dispatchEvent(new CustomEvent('internal-ref:back-state-change'));

            // 不阻止默认行为，让浏览器正常跳转
        }, true); // 第三个参数 true 表示捕获阶段
    }

    // ==================== 浮动控件 ====================

    function initFloatingControls() {
        const settingsBtn = getElement('settings-btn');
        const wideBtn = getElement('wide-read-btn');
        const exportBtn = getElement('export-md-btn');
        const displayBtn = getElement('display-manage-btn');
        const returnBtn = getElement('return-from-ref-btn');
        const container = getElement('floating-controls');
        const markdownContent = getElement('markdown-content');
        const toc = getElement('blog-toc');
        const article = document.querySelector('.blog-article');
        const exportModal = getElement('exportModal');
        const exportModalClose = getElement('exportModalClose');
        const exportModalConfirm = getElement('exportModalConfirm');
        const displayModal = getElement('displayModal');
        const displayModalClose = getElement('displayModalClose');
        const displayModalConfirm = getElement('displayModalConfirm');

        if (!settingsBtn || !wideBtn || !exportBtn || !displayBtn || !returnBtn || !container) return;

        if (exportModal) {
            try { exportModal.inert = true; } catch (_) { }
        }
        if (displayModal) {
            try { displayModal.inert = true; } catch (_) { }
        }

        function openDisplayModal() {
            if (!displayModal) return;
            try { displayModal.inert = false; } catch (_) { }
            displayModal.classList.add('is-open');
            displayModal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('display-modal-open');
        }

        function closeDisplayModal() {
            if (!displayModal) return;
            displayModal.classList.remove('is-open');
            displayModal.setAttribute('aria-hidden', 'true');
            try { displayModal.inert = true; } catch (_) { }
            document.body.classList.remove('display-modal-open');
        }

        function setAllExercisesVisible(visible) {
            if (!markdownContent) return;
            var tasks = Array.from(markdownContent.querySelectorAll('.md-task'));
            tasks.forEach(function (task) {
                if (visible) {
                    task.style.display = '';
                    task.removeAttribute('aria-hidden');
                } else {
                    task.style.display = 'none';
                    task.setAttribute('aria-hidden', 'true');
                }
            });
        }

        function setAllAnswersExpanded(expand) {
            if (!markdownContent) return;
            var answerBlocks = Array.from(markdownContent.querySelectorAll('.answer-block'));
            answerBlocks.forEach(function (block) {
                var toggle = block.querySelector('.answer-toggle');
                if (!toggle) return;
                var isOpen = block.classList.contains('is-open');
                if (expand && !isOpen) {
                    toggle.click();
                } else if (!expand && isOpen) {
                    toggle.click();
                }
            });
        }

        function setAllCodeBlocksExpanded(expand) {
            if (!markdownContent) return;
            var codeblocks = Array.from(markdownContent.querySelectorAll('.codeblock'));
            codeblocks.forEach(function (containerEl) {
                var toggle = containerEl.querySelector('.codeblock__actions .codeblock__btn:last-child');
                if (!toggle) return;
                var isCollapsed = containerEl.classList.contains('is-collapsed');
                if (expand && isCollapsed) {
                    toggle.click();
                } else if (!expand && !isCollapsed) {
                    toggle.click();
                }
            });
        }

        function applyDisplaySettings() {
            var exerciseEl = document.querySelector('input[name="display-exercise"]:checked');
            var codeEl = document.querySelector('input[name="display-code"]:checked');
            var exerciseMode = exerciseEl ? exerciseEl.value : 'collapse';
            var codeMode = codeEl ? codeEl.value : 'expand';

            if (markdownContent) {
                markdownContent.classList.toggle('practice-mode', exerciseMode === 'practice');
            }

            if (exerciseMode === 'hide') {
                setAllAnswersExpanded(false);
                setAllExercisesVisible(false);
            } else if (exerciseMode === 'practice') {
                setAllExercisesVisible(true);
                setAllAnswersExpanded(false);
            } else if (exerciseMode === 'expand') {
                setAllExercisesVisible(true);
                setAllAnswersExpanded(true);
            } else {
                setAllExercisesVisible(true);
                setAllAnswersExpanded(false);
            }

            if (codeMode === 'expand') {
                setAllCodeBlocksExpanded(true);
            } else {
                setAllCodeBlocksExpanded(false);
            }

            if (displayModalConfirm) {
                var textNode = displayModalConfirm.querySelector('span');
                if (textNode) {
                    var doneText = getI18nText('display_applied', '已应用');
                    var restoreText = getI18nText('display_apply', '应用设置');
                    textNode.textContent = doneText;
                    setTimeout(function () {
                        textNode.textContent = restoreText;
                    }, 1200);
                }
            }
        }

        var subVisible = false;

        function showSubs(show) {
            subVisible = !!show;
            settingsBtn.setAttribute('aria-expanded', subVisible ? 'true' : 'false');
            if (subVisible) {
                wideBtn.style.display = 'inline-flex';
                exportBtn.style.display = 'inline-flex';
                displayBtn.style.display = 'inline-flex';
                if (returnBtn && window.__internalRefBackState && window.__internalRefBackState.available) {
                    returnBtn.style.display = 'inline-flex';
                    returnBtn.classList.add('is-visible');
                    returnBtn.style.opacity = '1';
                    returnBtn.style.transform = 'translateX(0)';
                    returnBtn.setAttribute('aria-hidden', 'false');
                }
                wideBtn.setAttribute('aria-hidden', 'false');
                exportBtn.setAttribute('aria-hidden', 'false');
                displayBtn.setAttribute('aria-hidden', 'false');
                requestAnimationFrame(function () {
                    wideBtn.style.opacity = '1';
                    wideBtn.style.transform = 'translateX(0)';
                    exportBtn.style.opacity = '1';
                    exportBtn.style.transform = 'translateX(0)';
                    displayBtn.style.opacity = '1';
                    displayBtn.style.transform = 'translateX(0)';
                    if (returnBtn && returnBtn.style.display !== 'none') {
                        returnBtn.style.opacity = '1';
                        returnBtn.style.transform = 'translateX(0)';
                    }
                });
            } else {
                wideBtn.style.opacity = '0';
                wideBtn.style.transform = 'translateX(8px)';
                exportBtn.style.opacity = '0';
                exportBtn.style.transform = 'translateX(8px)';
                displayBtn.style.opacity = '0';
                displayBtn.style.transform = 'translateX(8px)';
                if (returnBtn && (!window.__internalRefBackState || !window.__internalRefBackState.available)) {
                    returnBtn.style.opacity = '0';
                    returnBtn.style.transform = 'translateX(8px)';
                }
                setTimeout(function () {
                    if (!subVisible) {
                        wideBtn.style.display = 'none';
                        exportBtn.style.display = 'none';
                        displayBtn.style.display = 'none';
                        if (returnBtn && (!window.__internalRefBackState || !window.__internalRefBackState.available)) {
                            returnBtn.style.display = 'none';
                            returnBtn.classList.remove('is-visible');
                            returnBtn.setAttribute('aria-hidden', 'true');
                        }
                        wideBtn.setAttribute('aria-hidden', 'true');
                        exportBtn.setAttribute('aria-hidden', 'true');
                        displayBtn.setAttribute('aria-hidden', 'true');
                    }
                }, 180);
            }
        }

        settingsBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            showSubs(!subVisible);
        });

        document.addEventListener('click', function (e) {
            if (!container.contains(e.target)) {
                showSubs(false);
            }
        });

        var immersiveMode = false;
        var immersiveHint = document.createElement('div');
        immersiveHint.id = 'immersive-read-hint';
        immersiveHint.setAttribute('aria-live', 'polite');
        document.body.appendChild(immersiveHint);

        var hintFadeTimer = null;
        var hintHideTimer = null;

        function showImmersiveHint() {
            if (hintFadeTimer) clearTimeout(hintFadeTimer);
            if (hintHideTimer) clearTimeout(hintHideTimer);
            var exitHint = getI18nText('immersive_exit_hint', '按ESC以退出沉浸阅读');
            var pdfHint = getI18nText('immersive_pdf_hint', '使用快捷键Ctrl+P可以导出PDF');
            var exitHintHtml = exitHint.replace('ESC', '<strong class="immersive-key">ESC</strong>');
            var pdfHintHtml = pdfHint.replace('Ctrl+P', '<strong class="immersive-key">Ctrl+P</strong>');
            immersiveHint.innerHTML = '<span class="immersive-hint-line">' + exitHintHtml + '</span>' +
                '<span class="immersive-hint-line">' + pdfHintHtml + '</span>';
            immersiveHint.classList.remove('is-fading');
            immersiveHint.classList.add('is-visible');
            hintFadeTimer = setTimeout(function () {
                immersiveHint.classList.add('is-fading');
            }, 3300);
            hintHideTimer = setTimeout(function () {
                immersiveHint.classList.remove('is-visible');
                immersiveHint.classList.remove('is-fading');
            }, 4300);
        }

        function enterImmersiveMode() {
            var isMobileViewport = window.matchMedia('(max-width: 880px)').matches;
            immersiveMode = true;
            if (article) article.classList.add('wide-mode');
            if (toc) {
                toc.classList.add('toc-collapsed');
                toc.style.display = 'none';
            }
            showSubs(false);
            try {
                var tocOverlay = getElement('toc-overlay');
                var tocFab = getElement('toc-fab');
                if (tocOverlay) {
                    tocOverlay.classList.remove('is-active');
                    tocOverlay.style.display = 'none';
                }
                if (tocFab) tocFab.setAttribute('aria-expanded', 'false');
            } catch (_) { }
            try {
                document.body.classList.add('wide-mode-active');
                document.body.classList.add('immersive-reading-active');
                if (isMobileViewport) document.body.classList.add('immersive-mobile-mode');
                else document.body.classList.remove('immersive-mobile-mode');
            } catch (_) { }
            if (!isMobileViewport) {
                showImmersiveHint();
            } else {
                immersiveHint.classList.remove('is-visible');
                immersiveHint.classList.remove('is-fading');
            }
        }

        function exitImmersiveMode() {
            immersiveMode = false;
            if (article) article.classList.remove('wide-mode');
            if (toc) {
                toc.classList.remove('toc-collapsed');
                toc.style.display = '';
                toc.style.position = '';
                toc.style.left = '';
                toc.style.top = '';
                toc.style.zIndex = '';
                toc.style.width = '';
                toc.style.boxShadow = '';
                toc.style.opacity = '';
            }
            try {
                document.body.classList.remove('wide-mode-active');
                document.body.classList.remove('immersive-reading-active');
                document.body.classList.remove('immersive-mobile-mode');
            } catch (_) { }
            immersiveHint.classList.remove('is-visible');
            immersiveHint.classList.remove('is-fading');
        }

        wideBtn.addEventListener('click', function (e) {
            if (!immersiveMode) {
                enterImmersiveMode();
            } else {
                var isMobileViewport = window.matchMedia('(max-width: 880px)').matches;
                if (!isMobileViewport) showImmersiveHint();
            }
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && exportModal && exportModal.classList.contains('is-open')) {
                e.preventDefault();
                closeExportModal();
                return;
            }
            if (e.key === 'Escape' && displayModal && displayModal.classList.contains('is-open')) {
                e.preventDefault();
                closeDisplayModal();
                return;
            }
            if (!immersiveMode) return;
            if (e.key !== 'Escape') return;
            e.preventDefault();
            exitImmersiveMode();
        });

        exportBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            openExportModal();
        });

        displayBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            openDisplayModal();
        });

        // ===== 导出功能 =====

        function openExportModal() {
            var modal = getElement('exportModal');
            if (!modal) return;
            try { modal.inert = false; } catch (_) { }
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('export-modal-open');
        }

        function closeExportModal() {
            var modal = getElement('exportModal');
            if (!modal) return;
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
            try { modal.inert = true; } catch (_) { }
            document.body.classList.remove('export-modal-open');
        }

        function stripFrontMatter(md) {
            if (!md) return md;
            var s = md.trimStart();
            if (s.startsWith('---')) {
                var idx = s.indexOf('\n---', 3);
                if (idx !== -1) return s.slice(idx + 4).replace(/^\n+/, '');
            }
            return md;
        }

        function normalizeExerciseMarkers(md) {
            if (!md) return md;
            var normalized = md
                .replace(/\[task\]/gi, '例题：')
                .replace(/\[answer\]/gi, '答案：')
                .replace(/\[analysis\]/gi, '解析：');
            normalized = normalized
                .replace(/\[(?:\\|\/)?(?:task|answer|analysis|question|options)\]/gi, '');
            return normalized;
        }

        function removeExerciseBlocks(md) {
            if (!md) return md;
            var cleaned = md
                .replace(/\[task\][\s\S]*?\[\\task\]/gi, '')
                .replace(/\[(answer|analysis|question|options)\][\s\S]*?\[\\\1\]/gi, '')
                .replace(/^\s*\[(?:\\|\/)?(?:task|answer|analysis|question|options)\]\s*$/gim, '');
            cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
            return cleaned.trim();
        }

        function getExportMarkdownContent(exerciseMode) {
            var raw = state.rawMarkdown || '';
            if (!raw) return '';

            if (exerciseMode === 'source') {
                return raw;
            }

            var clean = stripFrontMatter(raw);

            if (exerciseMode === 'exclude') {
                return normalizeExerciseMarkers(removeExerciseBlocks(clean));
            }

            return normalizeExerciseMarkers(clean);
        }

        function getSourceFilename(titleFallback) {
            try {
                var sourcePath = (state.mdSourcePath || '').toString().replace(/\\/g, '/');
                var sourceName = sourcePath.split('/').pop();
                if (sourceName && /\.md$/i.test(sourceName)) return sourceName;
            } catch (_) { }
            return titleFallback + '.md';
        }

        function downloadMarkdown(content, exerciseMode) {
            try {
                var clean = String(content || '');
                if (!clean.trim()) return false;
                var title = (getElement('article-title') || {}).textContent || 'post';
                var safeTitle = title.replace(/[^a-z0-9\u4e00-\u9fa5_-]/ig, '_') || 'post';
                var filename = exerciseMode === 'source' ? getSourceFilename(safeTitle) : (safeTitle + '.md');
                var blob = new Blob([clean], { type: 'text/markdown;charset=utf-8' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                return true;
            } catch (e) {
                console.error('export markdown failed', e);
                return false;
            }
        }

        async function copyMarkdown(content) {
            var clean = String(content || '');
            if (!clean) return false;
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(clean);
                return true;
            }

            var ta = document.createElement('textarea');
            ta.value = clean;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            ta.style.pointerEvents = 'none';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            var copied = false;
            try {
                copied = document.execCommand('copy');
            } finally {
                ta.remove();
            }
            return copied;
        }

        function showActionResult(btn, iconClass, message) {
            if (!btn) return;
            var icon = btn.querySelector('i');
            var textNode = btn.querySelector('span');
            var originalLabel = getI18nText('export_confirm', '执行导出');
            var originalIcon = 'fas fa-file-export';
            if (icon && iconClass) icon.className = iconClass;
            if (textNode && message) textNode.textContent = message;
            setTimeout(function () {
                if (icon) icon.className = originalIcon;
                if (textNode) textNode.textContent = originalLabel;
            }, 1200);
        }

        if (exportModalClose) {
            exportModalClose.addEventListener('click', function () {
                closeExportModal();
            });
        }

        if (exportModal) {
            exportModal.addEventListener('click', function (e) {
                if (e.target === exportModal) {
                    closeExportModal();
                }
            });
        }

        if (displayModalClose) {
            displayModalClose.addEventListener('click', function () {
                closeDisplayModal();
            });
        }

        if (displayModal) {
            displayModal.addEventListener('click', function (e) {
                if (e.target === displayModal) {
                    closeDisplayModal();
                }
            });
        }

        if (displayModalConfirm) {
            displayModalConfirm.addEventListener('click', function () {
                applyDisplaySettings();
                setTimeout(closeDisplayModal, 220);
            });
        }

        if (exportModalConfirm) {
            exportModalConfirm.addEventListener('click', async function () {
                var methodEl = document.querySelector('input[name="export-method"]:checked');
                var exerciseEl = document.querySelector('input[name="exercise-mode"]:checked');
                var method = methodEl ? methodEl.value : 'download';
                var exerciseMode = exerciseEl ? exerciseEl.value : 'normal';
                var content = getExportMarkdownContent(exerciseMode);

                if (!content || !String(content).trim()) {
                    var emptyText = getI18nText('export_no_content', '当前选项下无可导出内容');
                    showActionResult(exportModalConfirm, 'fas fa-circle-exclamation', emptyText);
                    return;
                }

                if (method === 'download') {
                    var ok = downloadMarkdown(content, exerciseMode);
                    if (ok) {
                        var doneText = getI18nText('export_done_download', '已下载');
                        showActionResult(exportModalConfirm, 'fas fa-check', doneText);
                        setTimeout(closeExportModal, 220);
                    }
                    return;
                }

                var copied = false;
                var msg = '';
                try {
                    copied = await copyMarkdown(content);
                    msg = copied ?
                        getI18nText('export_done_copy', '已复制') :
                        getI18nText('export_copy_failed', '复制失败');
                } catch (err) {
                    console.error('copy markdown failed', err);
                    copied = false;
                    msg = getI18nText('export_copy_failed', '复制失败');
                }
                showActionResult(exportModalConfirm, copied ? 'fas fa-check' : 'fas fa-circle-xmark', msg);
                if (copied) setTimeout(closeExportModal, 220);
            });
        }
    }

    // ==================== 目录高度调整 ====================

    function adjustTocHeight() {
        try {
            var nav = document.querySelector('.navbar');
            var toc = getElement('blog-toc');
            if (!toc) return;
            var top = nav ? nav.offsetHeight : 60;
            if (!toc.dataset.initialViewportTop) {
                var rect = toc.getBoundingClientRect();
                toc.dataset.initialViewportTop = String(Math.max(0, Math.round(rect.top)));
            }
            var initialTop = Number(toc.dataset.initialViewportTop) || 0;
            var desiredTop = Math.max(top + 12, initialTop);

            var rawHeight = Math.max(120, window.innerHeight - desiredTop - 18);
            var clamped = Math.max(120, Math.min(rawHeight, Math.round(window.innerHeight * 0.85)));
            toc.style.height = clamped + 'px';
            toc.style.overflow = 'hidden';

            var tocList = getElement('toc-list');
            if (tocList) {
                var titleEl = toc.querySelector('.toc-title');
                var postNav = getElement('post-nav-left');
                var titleH = titleEl ? Math.ceil(titleEl.getBoundingClientRect().height) : 0;
                var postNavH = postNav ? Math.ceil(postNav.getBoundingClientRect().height) : 0;
                var paddingGap = 20;
                var listMax = Math.max(80, clamped - titleH - postNavH - paddingGap);
                tocList.style.maxHeight = listMax + 'px';
                tocList.style.overflowY = 'auto';
                tocList.style.boxSizing = 'border-box';
            }
        } catch (e) {
            console.warn('adjustTocHeight failed', e);
        }
    }

    // ==================== 初始化 ====================

    function init() {
        loadArticle();
        initBackToTop();
        initReturnFromRef();
        initInternalRefHandler();
        watchBusuanziPageStats();

        // 延迟执行，等待 DOM 渲染完成
        setTimeout(function () {
            adjustTocHeight();
            window.addEventListener('resize', throttle(adjustTocHeight, 150));
            initFloatingControls();
        }, 100);
    }

    // DOM 就绪后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();