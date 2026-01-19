// 博客数据
let blogs = [];

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function updateProfileStats() {
    const articleCountEl = document.getElementById('article-count');
    const tagCountEl = document.getElementById('tag-count');
    if (!articleCountEl && !tagCountEl) return;

    // 文章数
    const articleCount = Array.isArray(blogs) ? blogs.length : 0;

    // 标签去重
    const tagSet = new Set();
    (Array.isArray(blogs) ? blogs : []).forEach(blog => {
        if (Array.isArray(blog.tags)) {
            blog.tags.forEach(tag => tagSet.add(tag));
        }
    });
    const tagCount = tagSet.size;

    if (articleCountEl) articleCountEl.textContent = articleCount;
    if (tagCountEl) tagCountEl.textContent = tagCount;
}

function loadBlogs(callback) {
    fetch('data/blogs.json')
        .then(res => res.json())
        .then(data => {
            blogs = data;
            updateProfileStats();
            if (typeof callback === 'function') callback();
        });
}

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function () {
    // Hide scrollbars on selected pages while keeping content scrollable
    try {
        var b = document.body;
        if (b && (b.classList.contains('home') || b.classList.contains('categories-page') || b.classList.contains('quick-links-page'))) {
            document.documentElement.classList.add('hide-scrollbar');
            document.body.classList.add('hide-scrollbar');
        }
    } catch (e) { }
    // 设置github链接
    var githubLink = document.getElementById('github-link');
    if (githubLink) {
        githubLink.href = 'https://github.com/by-be-young';
        githubLink.target = '_blank';
        githubLink.rel = 'noopener noreferrer';
    }

    // 加载数据后再更新统计 & 渲染列表，避免初始值总是 0
    loadBlogs(function () {
        if (document.getElementById('blogGrid')) {
            initBlogGrid();
        }
    });

    // 首页公告栏（显示最新公告）
    try {
        if (document.body && document.body.classList.contains('home')) {
            renderAnnouncementBanner();
        }
    } catch (e) { }

    // 轮播图已移除，背景固定为静态图片（原第二张）

    // initStickySidebar 已移除，不再固定侧边栏

    // 初始化导航栏
    initNavigation();

    // 初始化滚动监听
    initScroll();
    // 初始化个人联系方式交互
    try { initProfileContacts && initProfileContacts(); } catch (e) { }

    // 适配欢迎语换行（小屏时将空格替换为换行）
    try { adaptWelcomeText && adaptWelcomeText(); } catch (e) { }
    window.addEventListener('resize', throttle(function () { try { adaptWelcomeText && adaptWelcomeText(); } catch (e) { } }, 150));

    // make the entire profile card clickable (navigate to about), but
    // ignore clicks on internal interactive elements (links, buttons)
    try {
        const profileCard = document.getElementById('home-profile-card');
        if (profileCard) {
            profileCard.style.cursor = 'pointer';
            profileCard.addEventListener('click', function (e) {
                // if clicked element or its ancestor is an anchor, button, input, or has .contact-btn, do nothing
                if (e.target.closest('a, button, input, .contact-btn')) return;
                // otherwise navigate
                window.location.href = 'about.html';
            });
        }
    } catch (e) { }
});

function renderAnnouncementBanner() {
    const host = document.getElementById('announcementBanner');
    if (!host) return;

    fetch('data/announcements.json')
        .then(r => r.json())
        .then(list => {
            const arr = Array.isArray(list) ? list.slice() : [];
            // pick the most recent announcement by date (defensive: JSON order may vary)
            arr.sort((a, b) => {
                const da = a && a.date ? new Date(a.date).getTime() : 0;
                const db = b && b.date ? new Date(b.date).getTime() : 0;
                if (db !== da) return db - da;
                const ia = Number(a && a.id ? a.id : 0);
                const ib = Number(b && b.id ? b.id : 0);
                return ib - ia;
            });
            const latest = arr[0];
            if (!latest || !latest.message) return;

            const dateText = (typeof window.formatDate === 'function') ? window.formatDate(latest.date) : (latest.date || '');

            host.innerHTML = `
                <div class="announcement-left">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div class="announcement-icon" aria-hidden="true"><i class="fas fa-bullhorn"></i></div>
                        <div>
                            <div class="announcement-kicker">
                                <span data-i18n="announcement_banner_title"></span>
                                <span class="announcement-date date" data-date="${latest.date || ''}">${dateText}</span>
                            </div>
                                            <div class="announcement-message">${escapeHtml(latest.message).replace(/\n/g, '<br/>')}</div>
                        </div>
                    </div>
                </div>
                <a class="announcement-btn" href="announcements.html">
                    <span data-i18n="announcement_view_all"></span>
                    <i class="fas fa-arrow-right" aria-hidden="true"></i>
                </a>
            `;

            host.classList.add('is-visible');
            try { if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') window.siteI18n.applyTo(host); } catch (e) { }
            // 启动横幅正文自动滚动（如果超出高度则向下滚动，滚动到底部停顿后回到顶部重启）
            try { startAnnouncementAutoScroll(host); } catch (e) { }
            // 确保不再注册阻塞滚轮的处理器（避免 preventDefault 导致滚动卡顿）
            try {
                const msgEl = host.querySelector('.announcement-message');
                if (msgEl && msgEl.__wheelHandler) {
                    try { msgEl.removeEventListener('wheel', msgEl.__wheelHandler); } catch (e) { }
                    msgEl.__wheelHandler = null;
                }
            } catch (e) { }
        })
        .catch(() => {
            // no banner on errors
        });

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
}

// 首页公告：自动滚动实现
// 首页公告：自动滚动实现（使用 CSS 动画，平滑且性能好）
function startAnnouncementAutoScroll(bannerEl, opts) {
    if (!bannerEl) return;
    const msg = bannerEl.querySelector('.announcement-message');
    if (!msg) return;

    // 清理以前的滚动实例（包括动态 style）
    try {
        if (msg.__autoScroll) {
            if (msg.__autoScroll.styleEl && msg.__autoScroll.styleEl.parentNode) msg.__autoScroll.styleEl.parentNode.removeChild(msg.__autoScroll.styleEl);
            msg.__autoScroll = null;
        }
    } catch (e) { }

    // 仅当内容溢出时启用自动滚动
    if (msg.scrollHeight <= msg.clientHeight) return;

    const speed = (opts && opts.speed) ? opts.speed : 50; // px per second (faster and smoother)
    const pauseMs = (opts && opts.pauseMs) ? opts.pauseMs : 1000; // pause at bottom

    // 将内容复制一份，使用 transform 动画平滑滚动
    const originalHtml = msg.innerHTML;
    // create inner wrapper containing two copies
    const inner = document.createElement('div');
    inner.className = 'announcement-scroll-inner';
    // spacer to separate loops slightly
    // 用可见分割线隔断两份内容
    const spacer = '<div class="announcement-scroll-sep" aria-hidden="true"></div>';
    inner.innerHTML = originalHtml + spacer + originalHtml;

    // replace content
    msg.innerHTML = '';
    msg.appendChild(inner);

    // compute height of a single copy
    const singleHeight = inner.scrollHeight / 2;
    // compute scroll duration based on speed
    const tScroll = Math.max(0.8, singleHeight / speed); // seconds
    const totalDuration = tScroll + (pauseMs / 1000);
    const p = (tScroll / totalDuration) * 100;

    // create unique keyframes name
    const animName = 'annScroll_' + Date.now();
    const keyframes = `@keyframes ${animName} { 0% { transform: translateY(0); } ${p}% { transform: translateY(-50%); } 100% { transform: translateY(-50%); } }`;

    const styleEl = document.createElement('style');
    styleEl.type = 'text/css';
    styleEl.textContent = keyframes;
    document.head.appendChild(styleEl);

    inner.style.willChange = 'transform';
    inner.style.animation = `${animName} ${totalDuration}s linear infinite`;

    // store references for cleanup if needed
    msg.__autoScroll = { styleEl: styleEl, animName: animName };
}

// （已删除轮播实现）

// 初始化个人联系方式交互（显示/隐藏微信与QQ）
function initProfileContacts() {
    const wechatBtn = document.getElementById('wechat-btn');
    const qqBtn = document.getElementById('qq-btn');
    const popup = document.getElementById('contact-popup');
    const wechatSpan = document.getElementById('contact-wechat');
    const qqSpan = document.getElementById('contact-qq');
    const githubLink = document.getElementById('github-link');
    if (githubLink) {
        githubLink.href = 'https://github.com/by-be-young';
        githubLink.target = '_blank';
        githubLink.rel = 'noopener noreferrer';
    }

    function hidePopup() {
        if (popup) popup.style.display = 'none';
    }

    document.addEventListener('click', (e) => {
        if (!popup) return;
        if (e.target.closest('.contact-links')) return; // click inside
        hidePopup();
    });

    if (wechatBtn) {
        wechatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!popup) return;
            // toggle
            if (popup.style.display === 'block') { popup.style.display = 'none'; return; }
            if (wechatSpan) {
                // show only wechat number line
                popup.innerHTML = `<div class="contact-item"><div class="number-line">${wechatSpan.textContent || ''}</div></div>`;
                popup.style.display = 'block';
            }
        });
    }
    if (qqBtn) {
        qqBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!popup) return;
            if (popup.style.display === 'block') { popup.style.display = 'none'; return; }
            if (qqSpan) {
                popup.innerHTML = `<div class="contact-item"><div class="number-line">${qqSpan.textContent || ''}</div></div>`;
                popup.style.display = 'block';
            }
        });
    }
}

// 博客网格初始化
function initBlogGrid() {
    const blogGrid = document.getElementById('blogGrid');
    if (!blogGrid) return;
    blogGrid.innerHTML = '';

    // 仅渲染被标记为推荐的博客卡片
    const all = Array.isArray(blogs) ? blogs : [];
    const recommendedBlogs = all.filter(b => b.recommended === true);
    recommendedBlogs.forEach(blog => {
        const blogCard = createBlogCard(blog);
        blogGrid.appendChild(blogCard);
    });

    // 初始化“查看更多”交互（如果存在未显示的文章）
    initViewMore(all.length, recommendedBlogs.length);
}

function initViewMore(totalCount, shownCount) {
    const wrap = document.getElementById('viewMoreWrap');
    const btn = document.getElementById('viewMoreBtn');
    if (!wrap || !btn) return;

    // 只有当存在未显示的文章时才启用按钮
    const hasMore = totalCount > shownCount;
    if (!hasMore) {
        wrap.style.display = 'none';
        return;
    }
    // 显示在卡片下方：将按钮宽度与第一个卡片对齐，并在窗口缩放时调整
    wrap.style.display = 'flex';
    const blogGrid = document.getElementById('blogGrid');

    function alignWidthToFirstCard() {
        const firstCard = blogGrid && blogGrid.querySelector('.blog-card');
        if (firstCard) {
            const w = firstCard.getBoundingClientRect().width;
            btn.style.width = Math.floor(w) + 'px';
        } else {
            btn.style.width = '';
        }
    }

    // 初始对齐（在资源加载后执行一次以避免图片加载导致的布局变更）
    window.addEventListener('load', alignWidthToFirstCard);
    setTimeout(alignWidthToFirstCard, 120);
    window.addEventListener('resize', throttle(alignWidthToFirstCard, 150));

    btn.addEventListener('click', () => {
        window.location.href = 'archive.html';
    });
}

// 简单节流函数
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

// 在小屏时将欢迎语中的空格替换为换行；恢复时还原原始内容
function adaptWelcomeText() {
    try {
        const el = document.querySelector('.welcome-text');
        if (!el) return;
        // 保存初始 HTML 与“纯文本（保留换行）”形式，供恢复与处理使用
        if (!el.dataset.originalHtml) el.dataset.originalHtml = el.innerHTML;
        // 为了可靠保留原始翻译中的换行符（<br> 或 \n），我们从 originalHtml 中将 <br> 替换为 \n，然后去除其他 HTML 标签
        if (!el.dataset.originalText) {
            const html = el.dataset.originalHtml || '';
            // 将 <br> 转为换行，再利用临时元素取得纯文本，保留换行
            const withNewlines = html.replace(/<br\s*\/?\>/gi, '\n');
            const tmp = document.createElement('div');
            tmp.innerHTML = withNewlines;
            el.dataset.originalText = (tmp.textContent || tmp.innerText || '').replace(/\r/g, '');
        }

        const originalHtml = el.dataset.originalHtml;
        const originalText = el.dataset.originalText;
        const small = window.innerWidth <= 720;
        if (small) {
            // 保留原有换行（\n），但将每行内的空格替换为 <br>
            const lines = (originalText || '').split('\n');
            const processed = lines.map(line => {
                const collapsed = line.replace(/\s+/g, ' ').trim();
                return collapsed.replace(/ /g, '<br>');
            }).join('<br>');
            el.innerHTML = (processed && processed.replace(/^(?:<br>)+|(?:<br>)+$/g, '').length) ? processed : originalHtml;
        } else {
            // 恢复由 i18n 提供的原始 HTML（包含原始的 <br>）
            el.innerHTML = originalHtml;
        }
    } catch (e) { /* ignore errors */ }
}


// 创建博客卡片
function createBlogCard(blog) {
    const card = document.createElement('div');
    card.className = 'blog-card';
    const tags = Array.isArray(blog.tags) ? blog.tags : [];
    card.innerHTML = `
        <div class="blog-image">
            <img src="assets/blog_bg.png" alt="${blog.title}">
        </div>
        <div class="blog-content">
            <h3 class="blog-title">${escapeHtml(blog.title)}${blog.type ? `<span class="blog-type">${escapeHtml(blog.type)}</span>` : ''}</h3>
            <p class="blog-excerpt">${blog.excerpt}</p>
            <div class="blog-meta">
                <span class="date" data-date="${blog.date}">${formatDate(blog.date)}</span>
                <div class="tags">
                    ${tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            </div>
        </div>
    `;

    card.addEventListener('click', () => {
        const url = `blog-detail.html?id=${blog.id}`;
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        try { if (w) w.opener = null; } catch (e) { /* ignore */ }
    });

    return card;
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    // language-aware formatting
    try {
        const lang = window.siteI18n && typeof window.siteI18n.getLang === 'function' ? window.siteI18n.getLang() : 'zh';
        if (lang === 'en') {
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } else if (lang === 'ja') {
            const y = date.getFullYear();
            const m = date.getMonth() + 1;
            const d = date.getDate();
            // 令和年计算（令和元年 = 2019）
            let era = '';
            if (y >= 2019) {
                const reiwa = y - 2018;
                era = reiwa === 1 ? '（令和元年）' : `（令和${reiwa}年）`;
            }
            return `${y}年${m}月${d}日 ${era}`;
        } else {
            return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    } catch (e) {
        return date.toLocaleDateString();
    }
}

// 更新页面上所有可感知的日期显示（在语言切换后调用）
function updateDates() {
    try {
        document.querySelectorAll('.date[data-date]').forEach(el => {
            const d = el.getAttribute('data-date');
            if (d) {
                el.textContent = formatDate(d);
            }
        });
    } catch (e) {
        console.warn('updateDates error', e);
    }
}

// 监听语言切换事件，自动刷新页面上的日期显示
document.addEventListener('site:languageChanged', function (e) {
    updateDates();
});

// 当语言切换时，更新 welcome-text 的原始缓存并重新应用适配逻辑
document.addEventListener('site:languageChanged', function (e) {
    try {
        const el = document.querySelector('.welcome-text');
        if (!el) return;
        // 更新原始 HTML/text 缓存为最新语言渲染后内容
        el.dataset.originalHtml = el.innerHTML;
        // 将 HTML 中的 <br> 转为 \n，再取纯文本以保留换行
        const withNewlines = (el.dataset.originalHtml || '').replace(/<br\s*\/?\>/gi, '\n');
        const tmp = document.createElement('div');
        tmp.innerHTML = withNewlines;
        el.dataset.originalText = (tmp.textContent || tmp.innerText || '').replace(/\r/g, '');
        // 立即重新应用适配（以维持当前窗口宽度下的换行规则）
        try { adaptWelcomeText && adaptWelcomeText(); } catch (err) { }
    } catch (e) { /* ignore */ }
});

// 已移除 initStickySidebar 相关代码

// 导航栏初始化
function initNavigation() {
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.querySelector('.nav-menu');

    if (toggle) {
        toggle.addEventListener('click', () => {
            if (!menu) return;
            const isActive = menu.classList.toggle('active');
            // ensure offcanvas mode body class to control backdrop and scroll
            if (isActive) {
                document.body.classList.add('offcanvas-open');
            } else {
                document.body.classList.remove('offcanvas-open');
            }
        });

        // create backdrop element (single instance) and wire click to close menu
        (function ensureBackdrop() {
            if (document.querySelector('.offcanvas-backdrop')) return;
            const b = document.createElement('div');
            b.className = 'offcanvas-backdrop';
            // only close when the backdrop itself is clicked
            b.addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (menu) menu.classList.remove('active');
                document.body.classList.remove('offcanvas-open');
            });
            // insert the backdrop before the navbar so the navbar (and its offcanvas menu)
            // remain after it in DOM order and receive pointer events above the backdrop
            try {
                const nav = document.querySelector('.navbar');
                if (nav && nav.parentNode) {
                    nav.parentNode.insertBefore(b, nav);
                } else {
                    document.body.appendChild(b);
                }
            } catch (e) {
                document.body.appendChild(b);
            }
        })();
    }

    // 根据窗口宽度切换 offcanvas 模式（用于中间区间将导航收进侧边栏）
    function updateMenuMode() {
        try {
            const w = window.innerWidth;
            if (!menu) return;
            // 当视口较窄或处于中间区间时启用 offcanvas（与 CSS 区间保持一致）
            if (w <= 1100) {
                menu.classList.add('offcanvas');
            } else {
                // disable offcanvas and ensure any open state is fully closed
                menu.classList.remove('offcanvas');
                menu.classList.remove('active');
                document.body.classList.remove('offcanvas-open');
            }
        } catch (e) { }
    }
    updateMenuMode();
    window.addEventListener('resize', throttle(updateMenuMode, 150));

    // 点击链接关闭菜单（移动端）
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            if (menu) menu.classList.remove('active');
            document.body.classList.remove('offcanvas-open');
        });
    });
}

// 滚动监听
function initScroll() {
    const scrollDown = document.querySelector('.scroll-down');

    if (scrollDown) {
        scrollDown.addEventListener('click', () => {
            window.scrollTo({
                top: window.innerHeight,
                behavior: 'smooth'
            });
        });
    }
}

// 在 window.load 后延迟设置使用 data-bg 的背景图片，确保背景资源在页面关键资源加载后再请求
window.addEventListener('load', function () {
    try {
        const els = document.querySelectorAll('[data-bg]');
        els.forEach(el => {
            const src = el.getAttribute('data-bg');
            if (!src) return;
            const img = new Image();
            img.onload = function () {
                el.style.backgroundImage = `url('${src}')`;
                el.classList.add('bg-loaded');
            };
            // 触发浏览器去加载图片，但在 load 时才应用到元素上
            img.src = src;
        });
    } catch (e) {
        // 安静失败，不影响页面其它逻辑
        console.warn('defer-bg error', e);
    }
});

// Busuanzi 控制台打印（每次页面加载时在控制台输出站点总访问量、访客数、以及当前页面的阅读数）
(function () {
    try {
        var ids = ['busuanzi_today_pv', 'busuanzi_today_uv', 'busuanzi_site_pv', 'busuanzi_site_uv', 'busuanzi_page_pv', 'busuanzi_page_uv'];
        // 确保页面存在这些元素（隐藏），以便 Busuanzi 填充
        ids.forEach(function (id) {
            if (!document.getElementById(id)) {
                var sp = document.createElement('span');
                sp.id = id;
                sp.style.display = 'none';
                sp.textContent = '加载中...';
                document.body.appendChild(sp);
            }
        });

        // 加载官方 Busuanzi 脚本（使用官方 CDN）
        var s = document.createElement('script');
        s.src = '//cdn.busuanzi.cc/busuanzi/3.6.9/busuanzi.min.js';
        s.defer = true;
        s.onload = pollAndLog;
        s.onerror = function () { console.warn('Busuanzi 脚本加载失败'); pollAndLog(); };
        document.head.appendChild(s);

        function pollAndLog() {
            var attempts = 0, maxAttempts = 50; // 大约等待 5 秒
            var tid = setInterval(function () {
                attempts++;
                var vals = ids.map(function (id) {
                    var el = document.getElementById(id);
                    return el ? el.textContent.trim() : '';
                });
                var ready = vals.some(function (v) { return v && v !== '加载中...' && v !== 'n/a'; });
                if (ready || attempts >= maxAttempts) {
                    clearInterval(tid);
                    var map = {};
                    ids.forEach(function (id, i) { map[id] = vals[i] || 'n/a'; });
                    console.log('站点统计 — 今日访问(today_pv):', map['busuanzi_today_pv'], ', 今日访客(today_uv):', map['busuanzi_today_uv'], ', 总访问(site_pv):', map['busuanzi_site_pv'], ', 总访客(site_uv):', map['busuanzi_site_uv'], ', 本页阅读(page_pv):', map['busuanzi_page_pv'], ', 本页访客(page_uv):', map['busuanzi_page_uv']);
                }
            }, 100);
        }
    } catch (e) {
        console.warn('Busuanzi 控制台打印错误', e);
    }
})();
// (已移除旧版 busuanzi.pure.mini.js 的重复输出)