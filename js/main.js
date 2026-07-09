/**
 * 博客主页面模块
 * 功能：首页博客列表展示、个人资料统计、公告系统、设置面板、
 * 音乐播放器、页面过渡动画、点击涟漪效果、打字机欢迎语等
 */
(function () {
    'use strict';

    // ==================== 配置常量 ====================
    const HOME_CATEGORY_RULES = {
        learningFirstTags: new Set(['二上', '二下']),
        learningKey: 'home_category_learning',
        entertainmentKey: 'home_category_entertainment'
    };

    const SMOOTH_NAV_DURATION_MS = 260;
    const WELCOME_TYPING_BASE_DELAY_MS = 120;
    const WELCOME_TYPING_PUNCTUATION_DELAY_MS = 260;
    const WELCOME_TYPING_NEWLINE_DELAY_MS = 320;
    const WELCOME_TYPING_START_DELAY_MS = 180;
    const MACARON_RIPPLE_COLORS = ['#ffb6c9', '#ffd2a6', '#a7f3d0', '#9ad7ff', '#c7b6ff', '#b8f2e6'];
    const ANNOUNCEMENT_SCROLL_DELAY_MS = 3000;

    // ==================== 状态变量 ====================
    let blogs = [];
    let footerTotalWordsPromise = null;
    let smoothNavNavigating = false;
    let rippleLayerEl = null;

    const welcomeTypewriterState = {
        timerId: null,
        runId: 0,
        isTyping: false,
        currentText: '',
        fullText: ''
    };

    // ==================== 工具函数 ====================

    /** HTML 转义 */
    function escapeHtml(s) {
        return String(s).replace(/[&<>"]/g, (c) => {
            const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
            return map[c];
        });
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

    /** 获取当前语言 */
    function getCurrentSiteLang() {
        try {
            if (window.siteI18n?.getLang) {
                return window.siteI18n.getLang();
            }
        } catch (error) {
            console.error('[i18n] 获取当前语言失败:', error);
        }
        try {
            return localStorage.getItem('site_language') || 'zh';
        } catch (error) {
            console.error('[i18n] 获取本地存储语言失败:', error);
        }
        return 'zh';
    }

    /** 获取国际化文本 */
    function getI18nText(key, fallback) {
        try {
            const i18n = window.siteI18n;
            if (!i18n?.getLang || !i18n.translations) return fallback;
            const lang = i18n.getLang();
            const map = i18n.translations[lang] || i18n.translations.zh || {};
            return map[key] ?? fallback;
        } catch (error) {
            console.error('[i18n] 获取国际化文本失败:', error);
            return fallback;
        }
    }

    /** 格式化日期（语言感知） */
    function formatDate(dateString) {
        const date = new Date(dateString);
        try {
            const lang = getCurrentSiteLang();
            if (lang === 'en') {
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            }
            if (lang === 'ja') {
                const y = date.getFullYear();
                const m = date.getMonth() + 1;
                const d = date.getDate();
                let era = '';
                if (y >= 2019) {
                    const reiwa = y - 2018;
                    era = reiwa === 1 ? '（令和元年）' : `（令和${reiwa}年）`;
                }
                return `${y}年${m}月${d}日 ${era}`;
            }
            return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (error) {
            console.error('[date] 格式化日期失败:', error);
            return date.toLocaleDateString();
        }
    }

    /** 格式化字数统计（中文 w，英文 k） */
    function formatProfileWordCount(totalWords) {
        const words = Number.isFinite(Number(totalWords)) ? Number(totalWords) : 0;
        const lang = getCurrentSiteLang();
        if (lang === 'zh') {
            return (words / 10000).toFixed(1) + 'w';
        }
        return Math.round(words / 1000).toLocaleString('en-US') + 'k';
    }

    /** 格式化页脚统计数字 */
    function formatFooterStatNumber(value) {
        const num = Number.isFinite(Number(value)) ? Number(value) : 0;
        return num.toLocaleString('zh-CN');
    }

    /** 统计 Markdown 文本中有效字符数（去除代码块、链接、标记等） */
    function countBlogCharacters(markdownText) {
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

    // ==================== 首页分类规则 ====================

    /**
     * 获取博客所属的首页分类键（学习/娱乐）
     */
    function getHomeCategoryKey(blog) {
        if (blog?.category?.trim()) {
            const normalized = blog.category.trim();
            if (normalized === '学习') return HOME_CATEGORY_RULES.learningKey;
            if (normalized === '娱乐') return HOME_CATEGORY_RULES.entertainmentKey;
        }

        const tags = Array.isArray(blog?.tags) ? blog.tags : [];
        const firstTag = typeof tags[0] === 'string' ? tags[0].trim() : '';
        if (HOME_CATEGORY_RULES.learningFirstTags.has(firstTag)) {
            return HOME_CATEGORY_RULES.learningKey;
        }
        return HOME_CATEGORY_RULES.entertainmentKey;
    }

    // ==================== 数据加载 ====================

    /** 加载博客数据 */
    function loadBlogs(callback) {
        fetch('data/blogs.json')
            .then((res) => res.json())
            .then((data) => {
                blogs = data;
                updateProfileStats();
                if (typeof callback === 'function') callback();
            })
            .catch((error) => {
                console.error('[blogs] 加载博客数据失败:', error);
            });
    }

    /** 获取所有博客的总字数（用于页脚统计） */
    function getFooterTotalWords() {
        if (footerTotalWordsPromise) return footerTotalWordsPromise;

        const contentFiles = (Array.isArray(blogs) ? blogs : [])
            .map((blog) => blog?.contentFile)
            .filter(Boolean);

        footerTotalWordsPromise = Promise.all(
            contentFiles.map((path) => {
                const encodedPath = encodeURI(path);
                return fetch(encodedPath)
                    .then((res) => (res.ok ? res.text() : ''))
                    .catch(() => '');
            })
        ).then((contents) => contents.reduce((sum, text) => sum + countBlogCharacters(text), 0));

        return footerTotalWordsPromise;
    }

    /** 更新个人资料统计（文章数、标签数、字数） */
    function updateProfileStats() {
        const articleCountEl = document.getElementById('article-count');
        const wordCountEl = document.getElementById('word-count');
        const tagCountEl = document.getElementById('tag-count');
        const footerBlogCountEl = document.getElementById('footer-blog-count');
        const footerWordCountEl = document.getElementById('footer-word-count');

        if (!articleCountEl && !wordCountEl && !tagCountEl && !footerBlogCountEl && !footerWordCountEl) return;

        const articleCount = Array.isArray(blogs) ? blogs.length : 0;

        const tagSet = new Set();
        (Array.isArray(blogs) ? blogs : []).forEach((blog) => {
            if (Array.isArray(blog.tags)) {
                blog.tags.forEach((tag) => tagSet.add(tag));
            }
        });
        const tagCount = tagSet.size;

        if (articleCountEl) articleCountEl.textContent = articleCount;
        if (tagCountEl) tagCountEl.textContent = tagCount;
        if (footerBlogCountEl) footerBlogCountEl.textContent = formatFooterStatNumber(articleCount);

        if (wordCountEl) wordCountEl.textContent = '...';
        if (footerWordCountEl) footerWordCountEl.textContent = '...';

        getFooterTotalWords()
            .then((totalWords) => {
                if (footerWordCountEl) footerWordCountEl.textContent = formatFooterStatNumber(totalWords);
                if (wordCountEl) wordCountEl.textContent = formatProfileWordCount(totalWords);
            })
            .catch(() => {
                if (footerWordCountEl) footerWordCountEl.textContent = '0';
                if (wordCountEl) wordCountEl.textContent = '0.0w';
            });
    }

    // ==================== 页面过渡动画 ====================

    /** 判断是否为平滑导航目标 URL */
    function isSmoothNavTargetUrl(url) {
        try {
            if (!url || url.origin !== window.location.origin) return false;
            const current = new URL(window.location.href);
            // 同页锚点不拦截
            if (url.pathname === current.pathname && url.search === current.search) return false;
            return true;
        } catch (error) {
            console.error('[smoothNav] 判断平滑导航目标 URL 失败:', error);
            return false;
        }
    }

    /** 判断是否为修改点击（中键、Ctrl 等） */
    function isModifiedClick(event) {
        return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    }

    /** 带过渡效果的页面跳转 */
    function navigateWithTransition(href) {
        try {
            const url = new URL(href, window.location.href);
            if (!isSmoothNavTargetUrl(url)) {
                window.location.href = url.href;
                return;
            }
            if (smoothNavNavigating) return;
            smoothNavNavigating = true;
            document.body.classList.add('page-transition-leaving');
            setTimeout(() => {
                window.location.href = url.href;
            }, SMOOTH_NAV_DURATION_MS);
        } catch (error) {
            console.error('[smoothNav] 页面跳转失败:', error);
            window.location.href = href;
        }
    }

    /** 初始化平滑页面过渡 */
    function initSmoothPageTransition() {
        try {
            const body = document.body;
            if (!body) return;

            window.navigateWithTransition = navigateWithTransition;

            const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            if (prefersReduced) return;

            body.classList.add('page-transition-enter');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    body.classList.add('page-transition-ready');
                });
            });

            document.addEventListener(
                'click',
                (e) => {
                    const anchor = e.target?.closest?.('a[href]');
                    if (!anchor) return;
                    if (isModifiedClick(e)) return;
                    if (anchor.hasAttribute('download')) return;

                    const target = String(anchor.getAttribute('target') || '').toLowerCase();
                    if (target && target !== '_self') return;

                    const href = String(anchor.getAttribute('href') || '').trim();
                    if (!href || href === '#' || /^(javascript:|mailto:|tel:|data:|blob:)/i.test(href)) return;

                    const url = new URL(href, window.location.href);
                    if (!isSmoothNavTargetUrl(url)) return;

                    e.preventDefault();
                    navigateWithTransition(url.href);
                },
                true
            );

            window.addEventListener('pageshow', () => {
                body.classList.remove('page-transition-leaving');
                smoothNavNavigating = false;
            });
        } catch (error) {
            console.error('[smoothNav] 初始化平滑页面过渡失败:', error);
        }
    }

    // ==================== 点击涟漪效果 ====================

    /** 确保涟漪层存在 */
    function ensureRippleLayer() {
        if (rippleLayerEl?.isConnected) return rippleLayerEl;

        const layer = document.createElement('div');
        layer.className = 'click-ripple-layer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);
        rippleLayerEl = layer;
        return layer;
    }

    /** 随机选择涟漪颜色 */
    function pickRippleColor() {
        return MACARON_RIPPLE_COLORS[Math.floor(Math.random() * MACARON_RIPPLE_COLORS.length)];
    }

    /** 生成马卡龙色涟漪 */
    function spawnMacaronRipple(clientX, clientY) {
        const layer = ensureRippleLayer();
        if (!layer) return;

        const sizeSeed = Math.max(26, Math.min(window.innerWidth, window.innerHeight) * 0.05);
        const size = Math.round(sizeSeed * (0.82 + Math.random() * 0.20));

        const ripple = document.createElement('span');
        ripple.className = 'click-ripple';
        ripple.style.left = `${clientX}px`;
        ripple.style.top = `${clientY}px`;
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.setProperty('--ripple-color', pickRippleColor());
        ripple.style.setProperty('--ripple-duration', `${Math.round(500 + Math.random() * 140)}ms`);

        layer.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });

        // 兜底清理
        setTimeout(() => {
            if (ripple.isConnected) ripple.remove();
        }, 1200);
    }

    /** 初始化点击涟漪 */
    function initMacaronClickRipple() {
        if (window.__macaronRippleBound) return;
        window.__macaronRippleBound = true;

        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) return;

        document.addEventListener(
            'pointerdown',
            (event) => {
                if (!event?.clientX || !event?.clientY) return;
                if (event.button !== 0 && event.pointerType !== 'touch') return;
                spawnMacaronRipple(event.clientX, event.clientY);
            },
            { passive: true }
        );
    }

    // ==================== 导航栏 ====================

    /** 初始化导航栏 */
    function initNavigation() {
        const toggle = document.querySelector('.nav-toggle');
        const menu = document.querySelector('.nav-menu');

        if (toggle) {
            toggle.addEventListener('click', () => {
                if (!menu) return;
                const isActive = menu.classList.toggle('active');
                document.body.classList.toggle('offcanvas-open', isActive);
            });

            // 创建背景遮罩
            (function ensureBackdrop() {
                if (document.querySelector('.offcanvas-backdrop')) return;
                const backdrop = document.createElement('div');
                backdrop.className = 'offcanvas-backdrop';
                backdrop.addEventListener('click', () => {
                    if (menu) menu.classList.remove('active');
                    document.body.classList.remove('offcanvas-open');
                });
                const nav = document.querySelector('.navbar');
                if (nav?.parentNode) {
                    nav.parentNode.insertBefore(backdrop, nav);
                } else {
                    document.body.appendChild(backdrop);
                }
            })();
        }

        // 响应式切换 offcanvas 模式
        function updateMenuMode() {
            try {
                if (!menu) return;
                const w = window.innerWidth;
                if (w <= 1100) {
                    menu.classList.add('offcanvas');
                } else {
                    menu.classList.remove('offcanvas', 'active');
                    document.body.classList.remove('offcanvas-open');
                }
            } catch (error) {
                console.error('[navigation] 更新菜单模式失败:', error);
            }
        }

        updateMenuMode();
        window.addEventListener('resize', throttle(updateMenuMode, 150));

        // 点击链接关闭菜单
        document.querySelectorAll('.nav-menu a').forEach((link) => {
            link.addEventListener('click', () => {
                menu?.classList.remove('active');
                document.body.classList.remove('offcanvas-open');
            });
        });
    }

    // ==================== 滚动监听 ====================

    function initScroll() {
        const scrollDown = document.querySelector('.scroll-down');
        if (scrollDown) {
            scrollDown.addEventListener('click', () => {
                window.scrollTo({ top: window.innerHeight, behavior: 'smooth' });
            });
        }
    }

    // ==================== 首页链接处理 ====================

    /**
     * 强制首页内部链接同标签打开（外链保持原样）
     */
    function enforceHomeLinksOpenInNewTab(scope) {
        try {
            if (!document.body?.classList.contains('home')) return;
            const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
            root.querySelectorAll('a[href]').forEach((link) => {
                const href = (link.getAttribute('href') || '').trim();
                if (!href || href === '#' || /^javascript:/i.test(href)) return;

                let isInternal = false;
                try {
                    const u = new URL(href, window.location.href);
                    isInternal = u.origin === window.location.origin;
                } catch (error) {
                    console.error('[home] 检查链接内部状态失败:', error);
                    isInternal = false;
                }

                if (isInternal) {
                    link.removeAttribute('target');
                }
            });
        } catch (error) {
            console.error('[home] 强制首页链接在新标签页打开失败:', error);
        }
    }

    // ==================== 打字机欢迎语 ====================

    /** 从 HTML 中提取纯文本（将 <br> 转为换行） */
    function normalizeWelcomeTextFromHtml(html) {
        const withNewlines = String(html || '').replace(/<br\s*\/?>/gi, '\n');
        const tmp = document.createElement('div');
        tmp.innerHTML = withNewlines;
        return (tmp.textContent || tmp.innerText || '').replace(/\r/g, '');
    }

    /** 根据视口宽度格式化欢迎语（小屏换行） */
    function formatWelcomeHtmlForViewport(text, isSmallScreen) {
        const normalized = String(text || '');
        if (isSmallScreen) {
            const lines = normalized.split('\n');
            const processed = lines.map((line) => {
                const collapsed = line.replace(/\s+/g, ' ').trim();
                return collapsed.replace(/ /g, '<br>');
            }).join('<br>');
            return processed.replace(/^(?:<br>)+|(?:<br>)+$/g, '');
        }
        return normalized.replace(/\n/g, '<br>');
    }

    /** 渲染欢迎语 */
    function renderWelcomeText(el, text) {
        if (!el) return;
        const html = formatWelcomeHtmlForViewport(text, window.innerWidth <= 720);
        el.innerHTML = html;
    }

    /** 停止打字机效果 */
    function stopWelcomeTypewriter() {
        welcomeTypewriterState.runId += 1;
        welcomeTypewriterState.isTyping = false;
        if (welcomeTypewriterState.timerId) {
            clearTimeout(welcomeTypewriterState.timerId);
            welcomeTypewriterState.timerId = null;
        }
    }

    /** 获取打字延迟（根据字符类型） */
    function getWelcomeTypingDelay(ch) {
        if (ch === '\n') return WELCOME_TYPING_NEWLINE_DELAY_MS;
        if (/[,，.。!！?？;；:：]/.test(ch)) return WELCOME_TYPING_PUNCTUATION_DELAY_MS;
        return WELCOME_TYPING_BASE_DELAY_MS;
    }

    /** 启动打字机效果 */
    function startWelcomeTypewriter() {
        try {
            if (!document.body?.classList.contains('home')) return;
            const el = document.querySelector('.welcome-text');
            if (!el) return;

            if (!el.dataset.originalHtml) el.dataset.originalHtml = el.innerHTML;
            const sourceText = normalizeWelcomeTextFromHtml(el.dataset.originalHtml || el.innerHTML);
            el.dataset.originalText = sourceText;

            stopWelcomeTypewriter();
            welcomeTypewriterState.fullText = sourceText;

            const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            if (reducedMotion || !sourceText) {
                welcomeTypewriterState.currentText = sourceText;
                renderWelcomeText(el, sourceText);
                return;
            }

            const runId = welcomeTypewriterState.runId;
            let index = 0;
            welcomeTypewriterState.isTyping = true;
            welcomeTypewriterState.currentText = '';
            renderWelcomeText(el, '');

            const tick = () => {
                if (runId !== welcomeTypewriterState.runId) return;

                index += 1;
                const nextText = sourceText.slice(0, index);
                welcomeTypewriterState.currentText = nextText;
                renderWelcomeText(el, nextText);

                if (index < sourceText.length) {
                    const nextChar = sourceText.charAt(index - 1);
                    welcomeTypewriterState.timerId = setTimeout(tick, getWelcomeTypingDelay(nextChar));
                } else {
                    welcomeTypewriterState.isTyping = false;
                    welcomeTypewriterState.timerId = null;
                }
            };

            welcomeTypewriterState.timerId = setTimeout(tick, WELCOME_TYPING_START_DELAY_MS);
        } catch (error) {
            console.error('[welcome] 启动打字机效果失败:', error);
        }
    }

    /** 小屏时调整欢迎语换行 */
    function adaptWelcomeText() {
        try {
            const el = document.querySelector('.welcome-text');
            if (!el) return;
            if (!el.dataset.originalHtml) el.dataset.originalHtml = el.innerHTML;
            if (!el.dataset.originalText) {
                el.dataset.originalText = normalizeWelcomeTextFromHtml(el.dataset.originalHtml || '');
            }

            if (welcomeTypewriterState.isTyping) {
                renderWelcomeText(el, welcomeTypewriterState.currentText || '');
            } else {
                renderWelcomeText(el, el.dataset.originalText || '');
            }
        } catch (error) {
            console.error('[welcome] 适配欢迎语失败:', error);
        }
    }

    // ==================== 博客卡片渲染 ====================

    /**
     * 创建博客卡片 DOM
     */
    function createBlogCard(blog) {
        const card = document.createElement('div');
        card.className = 'blog-card';

        const tags = Array.isArray(blog.tags) ? blog.tags : [];
        card.innerHTML = `
            <div class="blog-image">
                <img src="assets/images/lantern_festival.png" alt="${blog.title}">
                ${blog.type ? `<div class="blog-type-overlay"><span class="blog-type">${escapeHtml(blog.type)}</span></div>` : ''}
                <div class="tags">
                    ${tags.map((tag, index) => `<span class="tag" data-level="${index}" data-path="${encodeURIComponent(JSON.stringify(blog.tags))}">${tag}</span>`).join('')}
                </div>
            </div>
            <div class="blog-content">
                <h3 class="blog-title">${escapeHtml(blog.title)}</h3>
                <p class="blog-excerpt">${blog.excerpt}</p>
                <div class="blog-meta">
                    <span class="date" data-date="${blog.date}">${formatDate(blog.date)}</span>
                </div>
            </div>
        `;

        // 标签点击跳转到分类页
        card.querySelectorAll('.tag').forEach((el) => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const level = Number(el.dataset.level || 0);
                const path = el.dataset.path ? JSON.parse(decodeURIComponent(el.dataset.path)) : null;
                if (!path) return;

                const selectedTags = [];
                for (let i = 0; i <= level; i++) selectedTags[i] = path[i] || null;
                for (let i = level + 1; i < 3; i++) selectedTags[i] = null;

                const tagsParam = JSON.stringify(selectedTags);
                const nextUrl = `categories.html?tags=${encodeURIComponent(tagsParam)}`;
                navigateWithTransition(nextUrl);
            });
        });

        // 卡片点击跳转文章详情
        card.addEventListener('click', () => {
            navigateWithTransition(`blog-detail.html?id=${blog.id}`);
        });

        return card;
    }

    /**
     * 创建"最近更新"卡片（显示学习和娱乐各最新一篇）
     */
    function createRecentUpdatesCard(allBlogs) {
        if (!Array.isArray(allBlogs) || allBlogs.length === 0) return null;

        const sorted = allBlogs.slice().sort((a, b) => {
            const da = a?.date ? new Date(a.date).getTime() : 0;
            const db = b?.date ? new Date(b.date).getTime() : 0;
            return db - da;
        });

        const latestStudy = sorted.find((blog) => getHomeCategoryKey(blog) === HOME_CATEGORY_RULES.learningKey) || null;
        const latestEntertainment = sorted.find((blog) => getHomeCategoryKey(blog) === HOME_CATEGORY_RULES.entertainmentKey) || null;

        const recentBlogs = [latestStudy, latestEntertainment].filter(Boolean);
        if (recentBlogs.length === 0) return null;

        const card = document.createElement('div');
        card.className = 'recent-updates-card';
        card.style.gridColumn = '1 / -1';

        const itemsHtml = recentBlogs
            .map((blog) => {
                const categoryKey = getHomeCategoryKey(blog);
                const fallbackCategoryText = categoryKey === HOME_CATEGORY_RULES.learningKey ? '学习' : '娱乐';
                const tags = Array.isArray(blog.tags)
                    ? blog.tags
                        .map(
                            (t, index) =>
                                `<span class="tag" data-level="${index}" data-path="${encodeURIComponent(JSON.stringify(blog.tags))}">${escapeHtml(t)}</span>`
                        )
                        .join('')
                    : '';
                const img = 'assets/images/lantern_festival.png';
                const typeHtml = blog.type
                    ? `<div class="blog-type-overlay"><span class="blog-type">${escapeHtml(blog.type)}</span></div>`
                    : '';

                return `
                    <div class="recent-item" data-id="${blog.id}">
                        <div class="recent-item-category-rail">
                            <span class="recent-item-category" data-i18n="${categoryKey}">${fallbackCategoryText}</span>
                        </div>
                        <div class="recent-item-main">
                            <h3 class="blog-title recent-item-title">${escapeHtml(blog.title)}</h3>
                            <p class="blog-excerpt recent-item-excerpt">${escapeHtml(blog.excerpt || '')}</p>
                            <div class="blog-meta recent-item-meta">
                                <span class="date" data-date="${blog.date}">${formatDate(blog.date)}</span>
                            </div>
                        </div>
                        <div class="recent-item-side">
                            <div class="blog-image recent-thumb">
                                <img src="${img}" alt="${escapeHtml(blog.title)}">
                                ${typeHtml}
                                <div class="tags">${tags}</div>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join('');

        card.innerHTML = `
            <div class="recent-updates-header">
                <span class="recommended-title" data-i18n="home_recent_updates">最近更新</span>
            </div>
            <div class="recent-content">${itemsHtml}</div>
        `;

        // 点击事件
        card.addEventListener('click', (e) => {
            // 分类标签点击
            if (e.target.closest('.recent-item-category-rail')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // 标签点击
            const tagEl = e.target.closest('.tag');
            if (tagEl) {
                e.preventDefault();
                e.stopPropagation();
                const level = Number(tagEl.dataset.level || 0);
                const path = tagEl.dataset.path ? JSON.parse(decodeURIComponent(tagEl.dataset.path)) : null;
                if (path) {
                    const selectedTags = [];
                    for (let i = 0; i <= level; i++) selectedTags[i] = path[i] || null;
                    for (let i = level + 1; i < 3; i++) selectedTags[i] = null;
                    const tagsParam = JSON.stringify(selectedTags);
                    navigateWithTransition(`categories.html?tags=${encodeURIComponent(tagsParam)}`);
                }
                return;
            }

            // 文章点击
            const el = e.target.closest('.recent-item');
            if (el) {
                const id = el.getAttribute('data-id');
                if (id) navigateWithTransition(`blog-detail.html?id=${id}`);
            }
        });

        return card;
    }

    /**
     * 创建"推荐博客"标题卡片
     */
    function createRecommendedBlogsHeaderCard() {
        const card = document.createElement('div');
        card.className = 'recommended-blogs-card';
        card.style.gridColumn = '1 / -1';
        card.innerHTML = `<span class="recommended-title" data-i18n="home_recommended_blogs">推荐博客</span>`;
        return card;
    }

    /**
     * 创建占位卡片（当推荐博客数量为奇数时填充网格空白）
     */
    function createPlaceholderCard() {
        const card = document.createElement('div');
        card.className = 'blog-card-placeholder';
        card.setAttribute('aria-hidden', 'true');
        card.innerHTML = `
            <div class="placeholder-content">
                <div class="placeholder-icon">✦</div>
                <div class="placeholder-title" data-i18n="home_placeholder_title">更多内容准备中…</div>
                <div class="placeholder-subtitle" data-i18n="home_placeholder_subtitle">敬请期待</div>
                <div class="placeholder-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        // 应用国际化
        try {
            if (window.siteI18n?.applyTo) window.siteI18n.applyTo(card);
        } catch (error) {
            console.error('[placeholder] 应用国际化失败:', error);
        }
        return card;
    }

    /**
     * 初始化博客网格
     */
    function initBlogGrid() {
        const blogGrid = document.getElementById('blogGrid');
        if (!blogGrid) return;

        blogGrid.innerHTML = '';

        const all = Array.isArray(blogs) ? blogs : [];

        // 最近更新卡片
        const recentCard = createRecentUpdatesCard(all);
        if (recentCard) blogGrid.appendChild(recentCard);

        // 推荐博客标题
        const headerCard = createRecommendedBlogsHeaderCard();
        if (headerCard) blogGrid.appendChild(headerCard);

        // 推荐博客卡片
        const recommendedBlogs = all.filter((b) => b.recommended === true);
        recommendedBlogs.forEach((blog) => {
            blogGrid.appendChild(createBlogCard(blog));
        });

        // 两列布局下，奇数个推荐博客时补充占位卡片
        if (recommendedBlogs.length % 2 !== 0) {
            const placeholder = createPlaceholderCard();
            blogGrid.appendChild(placeholder);
        }

        // 查看更多按钮
        initViewMore(all.length, recommendedBlogs.length);

        // 国际化
        try {
            if (window.siteI18n?.applyTo) window.siteI18n.applyTo(blogGrid);
        } catch (error) {
            console.error('[blogGrid] 应用国际化失败:', error);
        }
    }

    /**
     * 初始化"查看更多"按钮
     */
    function initViewMore(totalCount, shownCount) {
        const wrap = document.getElementById('viewMoreWrap');
        const btn = document.getElementById('viewMoreBtn');
        if (!wrap || !btn) return;

        const hasMore = totalCount > shownCount;
        if (!hasMore) {
            wrap.style.display = 'none';
            return;
        }

        wrap.style.display = 'flex';
        const blogGrid = document.getElementById('blogGrid');

        function alignWidthToRecentCard() {
            const recentCard = blogGrid?.querySelector('.recent-updates-card');
            const fallbackCard = blogGrid?.querySelector('.blog-card');
            const target = recentCard || fallbackCard;
            if (target) {
                btn.style.width = Math.floor(target.getBoundingClientRect().width) + 'px';
            } else {
                btn.style.width = '';
            }
        }

        window.addEventListener('load', alignWidthToRecentCard);
        setTimeout(alignWidthToRecentCard, 120);
        window.addEventListener('resize', throttle(alignWidthToRecentCard, 150));

        btn.addEventListener('click', () => {
            navigateWithTransition('archive.html');
        });
    }

    // ==================== 公告系统 ====================

    /** 渲染公告横幅 */
    function renderAnnouncementBanner() {
        const host = document.getElementById('announcementModalContent');
        const announcementFab = document.getElementById('announcementFab');
        if (!host) return;

        function parseYmdAsLocalDate(value) {
            if (typeof value !== 'string') return null;
            const m = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (!m) return null;
            const y = Number(m[1]);
            const mon = Number(m[2]);
            const d = Number(m[3]);
            if (!Number.isFinite(y) || !Number.isFinite(mon) || !Number.isFinite(d)) return null;
            const date = new Date(y, mon - 1, d);
            if (date.getFullYear() !== y || date.getMonth() !== mon - 1 || date.getDate() !== d) return null;
            return date;
        }

        function isRecentAnnouncementDate(dateValue, maxDiffDays) {
            const target = parseYmdAsLocalDate(dateValue) || new Date(dateValue);
            if (!(target instanceof Date) || Number.isNaN(target.getTime())) return false;

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
            const diffDays = Math.abs(Math.round((today.getTime() - targetDay.getTime()) / 86400000));
            return diffDays <= maxDiffDays;
        }

        function renderAnnouncementMessageHtml(msg) {
            const lines = String(msg || '').split(/\r?\n/);
            return lines
                .map((line, idx) => {
                    const safe = escapeHtml(line);
                    if (!line.trim()) {
                        return '<div class="ann-line ann-line--blank" aria-hidden="true">&nbsp;</div>';
                    }
                    const classes = ['ann-line'];
                    if (idx === 0) classes.push('ann-line--headline');
                    if (line.includes('>>')) classes.push('ann-line--section');
                    return `<div class="${classes.join(' ')}">${safe}</div>`;
                })
                .join('');
        }

        fetch('data/announcements.json')
            .then((r) => r.json())
            .then((list) => {
                const arr = Array.isArray(list) ? list.slice() : [];
                arr.sort((a, b) => {
                    const da = a?.date ? new Date(a.date).getTime() : 0;
                    const db = b?.date ? new Date(b.date).getTime() : 0;
                    if (db !== da) return db - da;
                    const ia = Number(a?.id || 0);
                    const ib = Number(b?.id || 0);
                    return ib - ia;
                });

                const latest = arr[0];
                if (!latest?.message) {
                    announcementFab?.classList.remove('announcement-fab--recent-attention');
                    return;
                }

                const messageHtml = renderAnnouncementMessageHtml(latest.message);
                const isRecent = isRecentAnnouncementDate(latest.date, 3);
                announcementFab?.classList.toggle('announcement-fab--recent-attention', isRecent);

                const dateText = typeof window.formatDate === 'function' ? window.formatDate(latest.date) : (latest.date || '');

                host.innerHTML = `
                    <div class="announcement-banner announcement-banner--modal is-visible${isRecent ? ' announcement-banner--recent' : ''}">
                        <div class="announcement-left">
                            <div style="display:flex;align-items:center;gap:12px;">
                                <div class="announcement-icon" aria-hidden="true"><i class="fas fa-bullhorn"></i></div>
                                <div>
                                    <div class="announcement-kicker" id="announcement-modal-title">
                                        <span data-i18n="announcement_banner_title"></span>
                                        <span class="announcement-date date" data-date="${latest.date || ''}">${dateText}</span>
                                    </div>
                                    <div class="announcement-message">${messageHtml}</div>
                                </div>
                            </div>
                        </div>
                        <a class="announcement-btn" href="announcements.html">
                            <span data-i18n="announcement_view_all"></span>
                            <i class="fas fa-arrow-right" aria-hidden="true"></i>
                        </a>
                    </div>
                `;

                enforceHomeLinksOpenInNewTab(host);
                try {
                    if (window.siteI18n?.applyTo) window.siteI18n.applyTo(host);
                } catch (error) {
                    console.error('[announcement] 应用国际化失败:', error);
                }

                // 弹窗打开时调度自动滚动
                try {
                    const modal = document.getElementById('announcementModal');
                    if (modal?.classList.contains('is-open') && typeof host.__scheduleAnnouncementAutoScroll === 'function') {
                        host.__scheduleAnnouncementAutoScroll();
                    }
                } catch (error) {
                    console.error('[announcement] 安排自动滚动失败:', error);
                }
            })
            .catch(() => {
                announcementFab?.classList.remove('announcement-fab--recent-attention');
            });
    }

    /** 初始化公告弹窗 */
    function initAnnouncementModal() {
        const trigger = document.getElementById('announcementFab');
        const modal = document.getElementById('announcementModal');
        const closeBtn = document.getElementById('announcementModalClose');
        const noticeShownKey = 'homeAnnouncementModalShown_v1';
        const reloadCarryKey = 'homeAnnouncementModalReloadCarry_v1';

        if (!trigger || !modal || !closeBtn) return;

        try { modal.inert = true; } catch (error) {
            console.error('[modal] 设置模态框 inert 失败:', error);
        }

        let scrollStartTimer = null;
        let modalOpenAt = 0;

        function isReloadNavigation() {
            try {
                const navEntry = performance.getEntriesByType?.('navigation');
                if (navEntry?.[0]?.type) return navEntry[0].type === 'reload';
            } catch (error) {
                console.error('[modal] 检查重载导航失败:', error);
            }
            try {
                return performance?.navigation?.type === 1;
            } catch (error) {
                console.error('[modal] 检查导航类型失败:', error);
            }
            return false;
        }

        function isFromSameSitePage() {
            try {
                const ref = document.referrer;
                if (!ref) return false;
                const refUrl = new URL(ref, window.location.href);
                return refUrl.origin === window.location.origin;
            } catch (error) {
                console.error('[modal] 检查来源页面失败:', error);
                return false;
            }
        }

        function scheduleAutoScrollForCurrentOpen() {
            try {
                const host = document.getElementById('announcementModalContent');
                if (!host) return;
                if (scrollStartTimer) {
                    clearTimeout(scrollStartTimer);
                    scrollStartTimer = null;
                }
                const elapsed = modalOpenAt ? Date.now() - modalOpenAt : 0;
                const remaining = Math.max(0, ANNOUNCEMENT_SCROLL_DELAY_MS - elapsed);
                scrollStartTimer = setTimeout(() => {
                    if (!modal.classList.contains('is-open')) return;
                    requestAnimationFrame(() => {
                        try { startAnnouncementAutoScroll(host); } catch (error) {
                            console.error('[announcement] 开始自动滚动失败:', error);
                        }
                    });
                }, remaining);
            } catch (error) {
                console.error('[announcement] 安排自动滚动失败:', error);
            }
        }

        function openModal() {
            try { modal.inert = false; } catch (error) {
                console.error('[modal] 设置模态框 inert 失败:', error);
            }
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('announcement-modal-open');
            modalOpenAt = Date.now();
            scheduleAutoScrollForCurrentOpen();
        }

        function closeModal() {
            if (scrollStartTimer) {
                clearTimeout(scrollStartTimer);
                scrollStartTimer = null;
            }
            try {
                const host = document.getElementById('announcementModalContent');
                stopAnnouncementAutoScroll(host);
            } catch (error) {
                console.error('[announcement] 停止自动滚动失败:', error);
            }
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
            try { modal.inert = true; } catch (error) {
                console.error('[modal] 设置模态框 inert 失败:', error);
            }
            document.body.classList.remove('announcement-modal-open');
        }

        const host = document.getElementById('announcementModalContent');
        if (host) host.__scheduleAnnouncementAutoScroll = scheduleAutoScrollForCurrentOpen;

        trigger.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Escape' || e.key === 'Esc') && modal.classList.contains('is-open')) {
                closeModal();
            }
        });

        // 首次进入自动弹窗（站内导航不弹）
        try {
            const carriedFromUnload = sessionStorage.getItem(reloadCarryKey) === '1';
            const isReload = isReloadNavigation();
            const fromSameSite = isFromSameSitePage();

            if (carriedFromUnload && isReload) {
                localStorage.setItem(noticeShownKey, '1');
            }

            const alreadyShown = localStorage.getItem(noticeShownKey) === '1';
            if (!alreadyShown && !fromSameSite) {
                localStorage.setItem(noticeShownKey, '1');
                setTimeout(openModal, 0);
            }

            if (carriedFromUnload) {
                sessionStorage.removeItem(reloadCarryKey);
            }
        } catch (error) {
            console.error('[modal] 处理公告显示状态失败:', error);
        }

        window.addEventListener('beforeunload', () => {
            try { sessionStorage.setItem(reloadCarryKey, '1'); } catch (error) {
                console.error('[modal] 设置重载携带状态失败:', error);
            }
            try { localStorage.removeItem(noticeShownKey); } catch (error) {
                console.error('[modal] 移除公告显示状态失败:', error);
            }
        });
    }

    /**
     * 公告自动滚动（使用 CSS 动画）
     */
    function startAnnouncementAutoScroll(bannerEl, opts) {
        if (!bannerEl) return;
        const msg = bannerEl.querySelector('.announcement-message');
        if (!msg) return;

        stopAnnouncementAutoScroll(bannerEl);

        if (msg.scrollHeight <= msg.clientHeight) return;

        const speed = opts?.speed ?? 20;
        const pauseMs = opts?.pauseMs ?? 1000;

        const originalHtml = msg.innerHTML;
        const lines = Array.from(msg.querySelectorAll('.ann-line'));
        if (lines.length <= 1) return;

        const fixedLineHtml = lines[0].outerHTML;
        const scrollingHtml = lines.slice(1).map((line) => line.outerHTML).join('');
        if (!scrollingHtml.trim()) return;

        msg.innerHTML = '';
        msg.classList.add('announcement-message--split');

        const fixedLine = document.createElement('div');
        fixedLine.className = 'announcement-fixed-line';
        fixedLine.innerHTML = fixedLineHtml;

        const viewport = document.createElement('div');
        viewport.className = 'announcement-scroll-viewport';

        const inner = document.createElement('div');
        inner.className = 'announcement-scroll-inner';
        const spacer = '<div class="announcement-scroll-sep" aria-hidden="true"></div>';
        inner.innerHTML = scrollingHtml + spacer + scrollingHtml;

        viewport.appendChild(inner);
        msg.appendChild(fixedLine);
        msg.appendChild(viewport);

        const singleHeight = inner.scrollHeight / 2;
        const viewportHeight = viewport.clientHeight;
        if (singleHeight <= viewportHeight + 1) {
            msg.__autoScroll = { styleEl: null, animName: null, originalHtml: originalHtml };
            return;
        }

        const tScroll = Math.max(0.8, singleHeight / speed);
        const totalDuration = tScroll + pauseMs / 1000;
        const p = (tScroll / totalDuration) * 100;

        const animName = 'annScroll_' + Date.now();
        const keyframes = `@keyframes ${animName} { 0% { transform: translateY(0); } ${p}% { transform: translateY(-50%); } 100% { transform: translateY(-50%); } }`;

        const styleEl = document.createElement('style');
        styleEl.type = 'text/css';
        styleEl.textContent = keyframes;
        document.head.appendChild(styleEl);

        inner.style.willChange = 'transform';
        inner.style.animation = `${animName} ${totalDuration}s linear infinite`;

        msg.__autoScroll = { styleEl, animName, originalHtml };
    }

    function stopAnnouncementAutoScroll(bannerEl) {
        if (!bannerEl) return;
        const msg = bannerEl.querySelector('.announcement-message');
        if (!msg?.__autoScroll) return;

        try {
            const state = msg.__autoScroll;
            if (state.styleEl?.parentNode) state.styleEl.parentNode.removeChild(state.styleEl);
            if (typeof state.originalHtml === 'string') msg.innerHTML = state.originalHtml;
            msg.classList.remove('announcement-message--split');
            msg.__autoScroll = null;
        } catch (error) {
            console.error('[announcement] 停止自动滚动失败:', error);
        }
    }

    // ==================== 设置面板（含音乐播放器） ====================

    /** 初始化设置面板 */
    function initSettingsModal() {
        const trigger = document.getElementById('settingsFab');
        const modal = document.getElementById('settingsModal');
        const closeBtn = document.getElementById('settingsModalClose');
        const tabs = document.querySelectorAll('.settings-tab');
        const sections = document.querySelectorAll('.settings-section');
        const settingsPanel = document.querySelector('.settings-panel');

        if (!trigger || !modal || !closeBtn) return;
        try { modal.inert = true; } catch (error) {
            console.error('[modal] 设置模态框 inert 失败:', error);
        }

        // ---- 音乐播放器 ----
        window.backgroundAudio = new Audio('music/澎湃.mp3');
        window.backgroundAudio.volume = 0.2;
        window.backgroundAudio.loop = true;
        window.musicEnabled = false;

        const playPauseBtn = document.getElementById('play-pause-btn');
        const stopBtn = document.getElementById('stop-btn');
        const musicSelect = document.getElementById('music-select');
        const volumeSlider = document.getElementById('volume-slider');
        const volumeValue = document.getElementById('volume-value');
        const progressSlider = document.getElementById('progress-slider');
        const progressValue = document.getElementById('progress-value');
        const playPauseText = document.getElementById('play-pause-text');
        const musicFloatFab = document.getElementById('musicFloatFab');
        const musicFloatFabIcon = musicFloatFab?.querySelector('i');

        let musicFloatHideTimer = null;
        let isSeeking = false;

        // ---- 辅助函数 ----
        function hasSelectedTrack() {
            return !!musicSelect?.value;
        }

        function stopAndClearSelectedTrack() {
            try { window.backgroundAudio.pause(); } catch (error) {
                console.error('[music] 暂停音频失败:', error);
            }
            try { window.backgroundAudio.currentTime = 0; } catch (error) {
                console.error('[music] 设置音频当前时间失败:', error);
            }
            try { window.backgroundAudio.removeAttribute('src'); } catch (error) {
                console.error('[music] 移除音频源失败:', error);
            }
            try { window.backgroundAudio.src = ''; } catch (error) {
                console.error('[music] 设置音频源失败:', error);
            }
            try { window.backgroundAudio.load(); } catch (error) {
                console.error('[music] 加载音频失败:', error);
            }
            hideMusicFloatFab();
        }

        function hideMusicFloatFab() {
            if (!musicFloatFab) return;
            if (musicFloatHideTimer) clearTimeout(musicFloatHideTimer);
            musicFloatFab.classList.remove('is-visible', 'is-paused');
            musicFloatFab.setAttribute('aria-hidden', 'true');
            musicFloatFab.hidden = true;
        }

        function showMusicFloatFab(isPaused) {
            if (!musicFloatFab) return;
            if (musicFloatHideTimer) clearTimeout(musicFloatHideTimer);
            musicFloatFab.hidden = false;
            musicFloatFab.classList.add('is-visible');
            musicFloatFab.classList.toggle('is-paused', !!isPaused);
            musicFloatFab.setAttribute('aria-hidden', 'false');
            musicFloatFab.setAttribute('aria-label', isPaused ? '继续播放音乐' : '关闭音乐');
            if (musicFloatFabIcon) {
                musicFloatFabIcon.className = isPaused ? 'fas fa-play' : 'fas fa-pause';
            }
            if (isPaused) {
                musicFloatHideTimer = setTimeout(() => {
                    hideMusicFloatFab();
                }, 3000);
            }
        }

        function formatTime(seconds) {
            if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
            const total = Math.floor(seconds);
            const minute = Math.floor(total / 60);
            const second = total % 60;
            return String(minute).padStart(2, '0') + ':' + String(second).padStart(2, '0');
        }

        function updateProgressUI() {
            const duration = Number.isFinite(window.backgroundAudio.duration) ? window.backgroundAudio.duration : 0;
            const currentTime = Number.isFinite(window.backgroundAudio.currentTime) ? window.backgroundAudio.currentTime : 0;
            if (progressSlider && !isSeeking) {
                progressSlider.value = duration > 0 ? ((currentTime / duration) * 100).toFixed(2) : '0';
            }
            if (progressValue) {
                progressValue.textContent = formatTime(currentTime) + ' / ' + formatTime(duration);
            }
        }

        function updatePlayPauseButton() {
            let iconClass = 'fas fa-play';
            let text = getI18nText('settings_play', '播放');

            if (!window.musicEnabled) {
                iconClass = 'fas fa-play';
                text = getI18nText('settings_enable_music', '启用音乐');
            } else if (window.backgroundAudio.paused) {
                iconClass = 'fas fa-play';
                text = getI18nText('settings_play', '播放');
            } else {
                iconClass = 'fas fa-pause';
                text = getI18nText('settings_pause', '暂停');
            }

            const icon = playPauseBtn?.querySelector('i');
            if (icon) icon.className = iconClass;
            if (playPauseText) playPauseText.textContent = text;
        }

        // ---- 启用音乐（用户交互触发） ----
        function enableMusic(event) {
            if (isNavigationIntentEvent(event)) return;

            if (!window.musicEnabled) {
                if (!hasSelectedTrack()) {
                    stopAndClearSelectedTrack();
                    updateProgressUI();
                    updatePlayPauseButton();
                    return;
                }

                if (!window.backgroundAudio) {
                    window.backgroundAudio = new Audio('music/澎湃.mp3');
                    window.backgroundAudio.volume = 0.2;
                    window.backgroundAudio.loop = true;
                }

                window.backgroundAudio
                    .play()
                    .then(() => {
                        window.musicEnabled = true;
                        document.removeEventListener('click', enableMusic);
                        document.removeEventListener('keydown', enableMusic);
                        updatePlayPauseButton();
                    })
                    .catch(() => {
                        setTimeout(() => {
                            if (!window.musicEnabled) {
                                window.backgroundAudio.load();
                                window.backgroundAudio.play().catch((error) => {
                                    console.error('[music] 播放音频失败:', error);
                                });
                            }
                        }, 100);
                    });
            }
        }

        function isNavigationIntentEvent(event) {
            try {
                if (!event) return false;
                if (event.defaultPrevented) return true;
                if (smoothNavNavigating) return true;

                const targetEl = event.target?.closest?.('a[href], button, [role="button"]');
                if (!targetEl) return false;

                if (targetEl.matches('a[href]')) {
                    const href = String(targetEl.getAttribute('href') || '').trim();
                    return !!href && href !== '#' && !/^javascript:/i.test(href);
                }

                if (targetEl.matches('#viewMoreBtn, #home-profile-card')) return true;
                if (targetEl.closest?.('.blog-card, .recent-item')) return true;
                return false;
            } catch (error) {
                console.error('[home] 检查导航意图事件失败:', error);
                return false;
            }
        }

        // ---- 绑定音乐事件 ----
        document.addEventListener('click', enableMusic);
        document.addEventListener('keydown', enableMusic);

        // ---- 音乐播放器事件 ----
        window.backgroundAudio.addEventListener('play', updatePlayPauseButton);
        window.backgroundAudio.addEventListener('pause', updatePlayPauseButton);
        window.backgroundAudio.addEventListener('timeupdate', updateProgressUI);
        window.backgroundAudio.addEventListener('loadedmetadata', updateProgressUI);
        window.backgroundAudio.addEventListener('durationchange', updateProgressUI);
        window.backgroundAudio.addEventListener('ended', updateProgressUI);

        window.backgroundAudio.addEventListener('play', () => showMusicFloatFab(false));
        window.backgroundAudio.addEventListener('pause', () => {
            if (!window.musicEnabled) {
                hideMusicFloatFab();
                return;
            }
            showMusicFloatFab(true);
        });

        musicFloatFab?.addEventListener('click', () => {
            if (!hasSelectedTrack()) {
                stopAndClearSelectedTrack();
                updateProgressUI();
                updatePlayPauseButton();
                return;
            }
            if (!window.musicEnabled) {
                enableMusic();
                return;
            }
            if (window.backgroundAudio.paused) {
                window.backgroundAudio.play().catch((error) => {
                    console.error('[music] 播放音频失败:', error);
                });
                return;
            }
            window.backgroundAudio.pause();
        });

        // ---- 设置面板控件 ----
        if (musicSelect) {
            musicSelect.value = '澎湃.mp3';
            musicSelect.addEventListener('change', () => {
                if (musicSelect.value) {
                    window.backgroundAudio.src = 'music/' + musicSelect.value;
                    window.backgroundAudio.play().catch((error) => {
                        console.error('[music] 播放音频失败:', error);
                    });
                } else {
                    stopAndClearSelectedTrack();
                }
                updateProgressUI();
                updatePlayPauseButton();
            });
        }

        if (volumeSlider) {
            volumeSlider.value = window.backgroundAudio.volume.toString();
            if (volumeValue) volumeValue.textContent = Math.round(window.backgroundAudio.volume * 100) + '%';

            volumeSlider.addEventListener('input', () => {
                const volume = parseFloat(volumeSlider.value);
                if (volumeValue) volumeValue.textContent = Math.round(volume * 100) + '%';
                window.backgroundAudio.volume = volume;
            });
        }

        playPauseBtn?.addEventListener('click', () => {
            if (!hasSelectedTrack()) {
                stopAndClearSelectedTrack();
                updateProgressUI();
                updatePlayPauseButton();
                return;
            }
            if (!window.musicEnabled) {
                enableMusic();
            } else if (window.backgroundAudio.paused) {
                window.backgroundAudio.play().catch((error) => {
                    console.error('[music] 播放音频失败:', error);
                });
            } else {
                window.backgroundAudio.pause();
            }
            updatePlayPauseButton();
        });

        stopBtn?.addEventListener('click', () => {
            window.backgroundAudio.pause();
            window.backgroundAudio.currentTime = 0;
            updateProgressUI();
            updatePlayPauseButton();
        });

        if (progressSlider) {
            progressSlider.addEventListener('input', () => {
                isSeeking = true;
                const duration = Number.isFinite(window.backgroundAudio.duration) ? window.backgroundAudio.duration : 0;
                const ratio = parseFloat(progressSlider.value) / 100;
                const previewTime = duration > 0 ? ratio * duration : 0;
                if (progressValue) {
                    progressValue.textContent = formatTime(previewTime) + ' / ' + formatTime(duration);
                }
            });

            progressSlider.addEventListener('change', () => {
                const duration = Number.isFinite(window.backgroundAudio.duration) ? window.backgroundAudio.duration : 0;
                const ratio = parseFloat(progressSlider.value) / 100;
                if (duration > 0) {
                    window.backgroundAudio.currentTime = Math.min(duration, Math.max(0, ratio * duration));
                }
                isSeeking = false;
                updateProgressUI();
            });
        }

        // ---- 语言设置 ----
        const languageInputs = document.querySelectorAll('input[name="language"]');

        function syncLanguageSelection() {
            const currentLang = getCurrentSiteLang();
            languageInputs.forEach((input) => {
                input.checked = input.value === currentLang;
            });
        }

        function setLanguageInputsEnabled(enabled) {
            languageInputs.forEach((input) => {
                input.disabled = !enabled;
            });
        }

        syncLanguageSelection();
        setLanguageInputsEnabled(false);

        languageInputs.forEach((input) => {
            input.addEventListener('change', () => {
                if (!modal.classList.contains('is-open')) {
                    syncLanguageSelection();
                    return;
                }
                if (input.checked && window.siteI18n?.setLang) {
                    window.siteI18n.setLang(input.value);
                }
            });
        });

        // ---- 弹窗控制 ----
        function openModal() {
            try { modal.inert = false; } catch (error) {
                console.error('[modal] 设置模态框 inert 失败:', error);
            }
            modal.classList.add('is-open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('settings-modal-open');
            setLanguageInputsEnabled(true);
        }

        function closeModal() {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
            try { modal.inert = true; } catch (error) {
                console.error('[modal] 设置模态框 inert 失败:', error);
            }
            document.body.classList.remove('settings-modal-open');
            setLanguageInputsEnabled(false);
            try { trigger.focus(); } catch (error) {
                console.error('[modal] 恢复触发元素焦点失败:', error);
            }
        }

        function updateSettingsPanelHeight(targetSection, immediate) {
            if (!settingsPanel || !targetSection) return;
            const nextHeight = Math.max(1, targetSection.scrollHeight || targetSection.offsetHeight || 0);
            if (!nextHeight) return;

            if (immediate) {
                settingsPanel.style.height = nextHeight + 'px';
                return;
            }

            const currentHeight = Math.max(1, Math.round(settingsPanel.getBoundingClientRect().height)) || nextHeight;
            settingsPanel.style.height = currentHeight + 'px';
            void settingsPanel.offsetHeight;
            settingsPanel.style.height = nextHeight + 'px';
        }

        function activateSettingsSection(tabName, options) {
            if (!tabName) return;
            const opts = options || {};
            let targetSection = null;

            tabs.forEach((t) => {
                const isActive = t.dataset.tab === tabName;
                t.classList.toggle('active', isActive);
                t.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });

            sections.forEach((section) => {
                const isActive = section.id === tabName + '-section';
                section.classList.toggle('active', isActive);
                section.setAttribute('aria-hidden', isActive ? 'false' : 'true');
                if (isActive) targetSection = section;
            });

            if (targetSection) {
                updateSettingsPanelHeight(targetSection, !!opts.immediate);
            }
        }

        // ---- 标签切换 ----
        tabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                activateSettingsSection(tab.dataset.tab);
            });
        });

        const initialActiveTab = Array.from(tabs).find((t) => t.classList.contains('active'));
        if (initialActiveTab?.dataset?.tab) {
            activateSettingsSection(initialActiveTab.dataset.tab, { immediate: true });
        }

        // ---- 事件绑定 ----
        trigger.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        document.addEventListener('keydown', (e) => {
            if ((e.key === 'Escape' || e.key === 'Esc') && modal.classList.contains('is-open')) {
                closeModal();
            }
        });

        // ---- 语言切换时更新 ----
        document.addEventListener('site:languageChanged', () => {
            updatePlayPauseButton();
            syncLanguageSelection();
        });

        updatePlayPauseButton();
        hideMusicFloatFab();
    }

    // ==================== 联系方式交互 ====================

    /** 初始化联系方式（微信/QQ 弹出复制） */
    function initProfileContacts() {
        const wechatBtn = document.getElementById('wechat-btn') || document.getElementById('wechat-btn--about');
        const qqBtn = document.getElementById('qq-btn') || document.getElementById('qq-btn--about');
        const popup = document.getElementById('contact-popup');
        const wechatSpan = document.getElementById('contact-wechat') || document.getElementById('contact-wechat--about');
        const qqSpan = document.getElementById('contact-qq') || document.getElementById('contact-qq--about');
        const githubLink = document.getElementById('github-link');
        let toastTimer = null;

        if (githubLink) {
            githubLink.href = 'https://github.com/by-be-young';
            githubLink.target = '_blank';
            githubLink.rel = 'noopener noreferrer';
        }

        if (!popup) return;
        if (popup.parentElement !== document.body) document.body.appendChild(popup);

        let lastTrigger = null;

        function repositionPopupFor(triggerBtn) {
            if (!triggerBtn) return;
            if (!popup.classList.contains('show')) return;

            const rect = triggerBtn.getBoundingClientRect();
            popup.style.left = '-9999px';
            popup.style.top = '-9999px';
            void popup.offsetWidth;

            const popupRect = popup.getBoundingClientRect();
            const gap = 8;
            let left = Math.round(rect.left + rect.width / 2 - popupRect.width / 2);
            left = Math.max(8, Math.min(left, window.innerWidth - popupRect.width - 8));

            let top = Math.round(rect.bottom + gap);
            if (top + popupRect.height > window.innerHeight - 8) {
                top = Math.round(rect.top - popupRect.height - gap);
                if (top < 8) top = Math.max(8, window.innerHeight - popupRect.height - 8);
            }

            popup.style.left = left + 'px';
            popup.style.top = top + 'px';
        }

        const repositionIfVisible = throttle(() => {
            if (lastTrigger) repositionPopupFor(lastTrigger);
        }, 50);

        window.addEventListener('resize', repositionIfVisible);
        window.addEventListener('scroll', repositionIfVisible, true);

        function hidePopup() {
            popup.classList.remove('show');
            lastTrigger = null;
        }

        function getCopyToast() {
            let toast = document.getElementById('contact-copy-toast');
            if (toast) return toast;

            toast = document.createElement('div');
            toast.id = 'contact-copy-toast';
            toast.className = 'contact-copy-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            document.body.appendChild(toast);
            return toast;
        }

        function showCopyToast(message, isError) {
            const toast = getCopyToast();
            toast.textContent = message;
            toast.classList.toggle('is-error', !!isError);
            toast.classList.add('show');

            if (toastTimer) {
                clearTimeout(toastTimer);
                toastTimer = null;
            }

            toastTimer = setTimeout(() => {
                toast.classList.remove('show');
                toastTimer = null;
            }, 1800);
        }

        async function copyToClipboard(text) {
            const value = String(text || '').trim();
            if (!value) return false;

            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(value);
                    return true;
                }
            } catch (error) {
                console.error('[clipboard] 写入剪贴板失败:', error);
            }

            try {
                const textarea = document.createElement('textarea');
                textarea.value = value;
                textarea.setAttribute('readonly', 'readonly');
                textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
                document.body.appendChild(textarea);
                textarea.select();
                const ok = document.execCommand('copy');
                textarea.remove();
                return !!ok;
            } catch (error) {
                console.error('[clipboard] 复制到剪贴板失败:', error);
                return false;
            }
        }

        function copyContactNumber(kind, value) {
            const number = String(value || '').trim();
            if (!number) return;

            const label = kind === 'wechat' ? getI18nText('contact_wechat', '微信') : getI18nText('contact_qq', 'QQ');
            const copied = getI18nText('image_copied', '已复制');
            const failed = getI18nText('image_copy_failed', '复制失败');

            copyToClipboard(number).then((ok) => {
                if (ok) showCopyToast(`${label} ${copied}`);
                else showCopyToast(`${label} ${failed}`, true);
            });
        }

        function showPopupFor(triggerBtn, text) {
            if (!triggerBtn) return;
            if (popup.classList.contains('show') && lastTrigger === triggerBtn) {
                hidePopup();
                return;
            }

            popup.innerHTML = `<div class="contact-item"><div class="number-line">${text || ''}</div></div>`;

            popup.style.left = '-9999px';
            popup.style.top = '-9999px';
            popup.classList.add('show');
            void popup.offsetWidth;
            repositionPopupFor(triggerBtn);
            lastTrigger = triggerBtn;
        }

        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (!popup) return;
            if (e.target.closest('#contact-popup') || e.target.closest('#wechat-btn') || e.target.closest('#qq-btn')) return;
            hidePopup();
        });

        document.addEventListener('keydown', (e) => {
            if (!popup) return;
            if (e.key === 'Escape' || e.key === 'Esc') {
                if (popup.classList.contains('show')) hidePopup();
            }
        });

        wechatBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            const value = wechatSpan?.textContent || '';
            showPopupFor(wechatBtn, value);
            copyContactNumber('wechat', value);
        });

        qqBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            const value = qqSpan?.textContent || '';
            showPopupFor(qqBtn, value);
            copyContactNumber('qq', value);
        });
    }

    // ==================== 日期更新 ====================

    /** 更新页面上所有日期显示 */
    function updateDates() {
        try {
            document.querySelectorAll('.date[data-date]').forEach((el) => {
                const d = el.getAttribute('data-date');
                if (d) el.textContent = formatDate(d);
            });
        } catch (error) {
            console.error('[date] 更新日期显示失败:', error);
        }
    }

    // ==================== 延迟加载背景图片 ====================

    window.addEventListener('load', function () {
        try {
            document.querySelectorAll('[data-bg]').forEach((el) => {
                const src = el.getAttribute('data-bg');
                if (!src) return;
                const img = new Image();
                img.onload = function () {
                    el.style.backgroundImage = `url('${src}')`;
                    el.classList.add('bg-loaded');
                };
                img.src = src;
            });
        } catch (error) {
            console.error('[background] 延迟加载背景图片失败:', error);
        }
    });

    // ==================== Busuanzi 统计 ====================

    (function initBusuanzi() {
        try {
            const ids = ['busuanzi_today_pv', 'busuanzi_today_uv', 'busuanzi_site_pv', 'busuanzi_site_uv', 'busuanzi_page_pv', 'busuanzi_page_uv'];

            ids.forEach((id) => {
                if (!document.getElementById(id)) {
                    const sp = document.createElement('span');
                    sp.id = id;
                    sp.style.display = 'none';
                    sp.textContent = '加载中...';
                    document.body.appendChild(sp);
                }
            });

            const sources = [
                'https://cdn.busuanzi.cc/busuanzi/3.6.9/busuanzi.min.js',
                'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'
            ];

            function loadWithFallback(index) {
                if (index >= sources.length) {
                    console.warn('Busuanzi 脚本加载失败');
                    pollAndLog();
                    return;
                }

                const s = document.createElement('script');
                s.src = sources[index];
                s.defer = true;
                s.onload = pollAndLog;
                s.onerror = () => loadWithFallback(index + 1);
                document.head.appendChild(s);
            }

            function pollAndLog() {
                let attempts = 0;
                const maxAttempts = 50;
                const tid = setInterval(() => {
                    attempts++;
                    const vals = ids.map((id) => {
                        const el = document.getElementById(id);
                        return el ? el.textContent.trim() : '';
                    });
                    const ready = vals.some((v) => v && v !== '加载中...' && v !== 'n/a');

                    if (ready || attempts >= maxAttempts) {
                        clearInterval(tid);
                        const map = {};
                        ids.forEach((id, i) => { map[id] = vals[i] || 'n/a'; });
                        console.log(
                            '站点统计 — 今日访问:',
                            map['busuanzi_today_pv'],
                            ', 今日访客:',
                            map['busuanzi_today_uv'],
                            ', 总访问:',
                            map['busuanzi_site_pv'],
                            ', 总访客:',
                            map['busuanzi_site_uv'],
                            ', 本页阅读:',
                            map['busuanzi_page_pv'],
                            ', 本页访客:',
                            map['busuanzi_page_uv']
                        );
                    }
                }, 100);
            }

            loadWithFallback(0);
        } catch (error) {
            console.error('[busuanzi] 初始化失败:', error);
        }
    })();

    // ==================== DOMContentLoaded 入口 ====================

    document.addEventListener('DOMContentLoaded', function () {
        // ---- 页面过渡与涟漪 ----
        initSmoothPageTransition();
        initMacaronClickRipple();

        // ---- 隐藏滚动条 ----
        try {
            const body = document.body;
            if (body?.classList.contains('home') || body?.classList.contains('categories-page') || body?.classList.contains('quick-links-page')) {
                document.documentElement.classList.add('hide-scrollbar');
                document.body.classList.add('hide-scrollbar');
            }
        } catch (error) {
            console.error('[home] 隐藏滚动条失败:', error);
        }

        // ---- GitHub 链接 ----
        const githubLink = document.getElementById('github-link');
        if (githubLink) {
            githubLink.href = 'https://github.com/by-be-young';
            githubLink.target = '_blank';
            githubLink.rel = 'noopener noreferrer';
        }

        // ---- 加载博客数据 ----
        loadBlogs(() => {
            if (document.getElementById('blogGrid')) {
                initBlogGrid();
            }
        });

        // ---- 语言切换时更新统计 ----
        document.addEventListener('site:languageChanged', updateProfileStats);

        // ---- 首页特有功能 ----
        try {
            if (document.body?.classList.contains('home')) {
                enforceHomeLinksOpenInNewTab();
                initAnnouncementModal();
                initSettingsModal();
                renderAnnouncementBanner();
            }
        } catch (error) {
            console.error('[home] 初始化首页特有功能失败:', error);
        }

        // ---- 导航栏 ----
        initNavigation();

        // ---- 滚动监听 ----
        initScroll();

        // ---- 联系方式 ----
        try { initProfileContacts(); } catch (error) {
            console.error('[profile] 初始化个人资料卡片失败:', error);
        }

        // ---- 打字机欢迎语 ----
        try { startWelcomeTypewriter(); } catch (error) {
            console.error('[welcome] 初始化欢迎语失败:', error);
        }
        window.addEventListener('resize', throttle(() => {
            try { adaptWelcomeText(); } catch (error) {
                console.error('[welcome] 适应欢迎文本失败:', error);
            }
        }, 150));

        // ---- 个人资料卡片点击跳转关于页 ----
        try {
            const profileCard = document.getElementById('home-profile-card');
            if (profileCard) {
                profileCard.style.cursor = 'pointer';
                profileCard.addEventListener('click', function (e) {
                    if (e.target.closest('a, button, input, .contact-btn')) return;
                    navigateWithTransition('about.html');
                });
            }
        } catch (error) {
            console.error('[profile] 初始化个人资料卡片失败:', error);
        }
    });

    // ---- 语言切换时更新日期和欢迎语 ----
    document.addEventListener('site:languageChanged', function () {
        updateDates();

        try {
            const el = document.querySelector('.welcome-text');
            if (el) {
                el.dataset.originalHtml = el.innerHTML;
                el.dataset.originalText = normalizeWelcomeTextFromHtml(el.dataset.originalHtml || '');
                startWelcomeTypewriter();
            }
        } catch (error) {
            console.error('[welcome] 更新欢迎语失败:', error);
        }
    });

    // ---- 暴露全局函数 ----
    window.formatDate = formatDate;
    window.updateDates = updateDates;
    window.startWelcomeTypewriter = startWelcomeTypewriter;
    window.adaptWelcomeText = adaptWelcomeText;
    window.navigateWithTransition = navigateWithTransition;
    window.initProfileContacts = initProfileContacts;
})();