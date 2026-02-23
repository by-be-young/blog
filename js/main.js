// 博客数据
let blogs = [];

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function updateProfileStats() {
    const articleCountEl = document.getElementById('article-count');
    const tagCountEl = document.getElementById('tag-count');
    if (!articleCountEl && !tagCountEl) return;

    const articleCount = Array.isArray(blogs) ? blogs.length : 0;

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
    // 在选定页面隐藏滚动条，同时保持内容可滚动
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
            initAnnouncementModal();
            renderAnnouncementBanner();
            showGithubDeploymentNoticeOnce();
        }
    } catch (e) { }

    // 初始化导航栏
    initNavigation();

    // 初始化滚动监听
    initScroll();
    // 初始化个人联系方式交互
    try { initProfileContacts && initProfileContacts(); } catch (e) { }

    // 适配欢迎语换行（小屏时将空格替换为换行）
    try { adaptWelcomeText && adaptWelcomeText(); } catch (e) { }
    window.addEventListener('resize', throttle(function () { try { adaptWelcomeText && adaptWelcomeText(); } catch (e) { } }, 150));

    // 使整个个人资料卡片可点击（导航到关于页面），但忽略内部交互元素（链接、按钮）的点击
    try {
        const profileCard = document.getElementById('home-profile-card');
        if (profileCard) {
            profileCard.style.cursor = 'pointer';
            profileCard.addEventListener('click', function (e) {
                if (e.target.closest('a, button, input, .contact-btn')) return;
                window.location.href = 'about.html';
            });
        }
    } catch (e) { }
});

function renderAnnouncementBanner() {
    const host = document.getElementById('announcementModalContent');
    if (!host) return;

    fetch('data/announcements.json')
        .then(r => r.json())
        .then(list => {
            const arr = Array.isArray(list) ? list.slice() : [];
            // 按日期选择最新的公告（防御性：JSON 顺序可能变化）
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
                <div class="announcement-banner announcement-banner--modal is-visible">
                <div class="announcement-left">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div class="announcement-icon" aria-hidden="true"><i class="fas fa-bullhorn"></i></div>
                        <div>
                            <div class="announcement-kicker" id="announcement-modal-title">
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
                </div>
            `;
            try { if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') window.siteI18n.applyTo(host); } catch (e) { }
            // 启动横幅正文自动滚动（如果超出高度则向下滚动，滚动到底部停顿后回到顶部重启）
            try { startAnnouncementAutoScroll(host); } catch (e) { }
            try {
                const msgEl = host.querySelector('.announcement-message');
                if (msgEl && msgEl.__wheelHandler) {
                    try { msgEl.removeEventListener('wheel', msgEl.__wheelHandler); } catch (e) { }
                    msgEl.__wheelHandler = null;
                }
            } catch (e) { }
        })
        .catch(() => {
            // 出错时不显示横幅
        });

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
}

function initAnnouncementModal() {
    const trigger = document.getElementById('announcementFab');
    const modal = document.getElementById('announcementModal');
    const closeBtn = document.getElementById('announcementModalClose');

    if (!trigger || !modal || !closeBtn) return;
    let scrollStartTimer = null;

    function openModal() {
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('announcement-modal-open');
        try {
            const host = document.getElementById('announcementModalContent');
            if (host) {
                if (scrollStartTimer) {
                    clearTimeout(scrollStartTimer);
                    scrollStartTimer = null;
                }
                scrollStartTimer = setTimeout(() => {
                    if (!modal.classList.contains('is-open')) return;
                    requestAnimationFrame(() => {
                        try { startAnnouncementAutoScroll(host); } catch (e) { }
                    });
                }, 3000);
            }
        } catch (e) { }
    }

    function closeModal() {
        if (scrollStartTimer) {
            clearTimeout(scrollStartTimer);
            scrollStartTimer = null;
        }
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('announcement-modal-open');
    }

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
}

function showGithubDeploymentNoticeOnce() {
    const host = (window.location && window.location.hostname ? window.location.hostname : '').toLowerCase();
    if (!host.includes('github.io')) return;

    const storageKey = 'homeDeploymentNoticeShown_v1';
    try {
        if (window.localStorage && window.localStorage.getItem(storageKey) === '1') return;
    } catch (e) { }

    const modal = document.createElement('div');
    modal.className = 'deployment-notice-modal is-open';
    modal.setAttribute('aria-hidden', 'false');

    const targetUrl = `http://47.95.159.93/`;
    modal.innerHTML = `
        <div class="deployment-notice-card" role="dialog" aria-modal="true" aria-labelledby="deployment-notice-title">
            <button class="deployment-notice-close" aria-label="关闭提示">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
            <h3 class="deployment-notice-title" id="deployment-notice-title">部署成功</h3>
            <p class="deployment-notice-text">该博客已经成功部署到服务器！点击链接即可跳转。感谢支持！</p>
            <a class="deployment-notice-link" href="${targetUrl}">点击这里跳转</a>
        </div>
    `;

    function closeNotice() {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
            if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
        }, 120);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeNotice();
    });

    const closeBtn = modal.querySelector('.deployment-notice-close');
    if (closeBtn) closeBtn.addEventListener('click', closeNotice);

    document.body.appendChild(modal);

    try {
        if (window.localStorage) {
            window.localStorage.setItem(storageKey, '1');
            window.addEventListener('beforeunload', () => {
                try { window.localStorage.removeItem(storageKey); } catch (e) { }
            }, { once: true });
        }
    } catch (e) { }
}

// 首页公告：自动滚动实现（使用 CSS 动画，平滑且性能好）
function startAnnouncementAutoScroll(bannerEl, opts) {
    if (!bannerEl) return;
    const msg = bannerEl.querySelector('.announcement-message');
    if (!msg) return;

    try {
        if (msg.__autoScroll) {
            if (msg.__autoScroll.styleEl && msg.__autoScroll.styleEl.parentNode) msg.__autoScroll.styleEl.parentNode.removeChild(msg.__autoScroll.styleEl);
            msg.__autoScroll = null;
        }
    } catch (e) { }

    if (msg.scrollHeight <= msg.clientHeight) return;

    const speed = (opts && opts.speed) ? opts.speed : 20;
    const pauseMs = (opts && opts.pauseMs) ? opts.pauseMs : 1000;

    const originalHtml = msg.innerHTML;
    const inner = document.createElement('div');
    inner.className = 'announcement-scroll-inner';
    const spacer = '<div class="announcement-scroll-sep" aria-hidden="true"></div>';
    inner.innerHTML = originalHtml + spacer + originalHtml;

    msg.innerHTML = '';
    msg.appendChild(inner);

    const singleHeight = inner.scrollHeight / 2;
    const tScroll = Math.max(0.8, singleHeight / speed);
    const totalDuration = tScroll + (pauseMs / 1000);
    const p = (tScroll / totalDuration) * 100;

    // 创建唯一的关键帧名称
    const animName = 'annScroll_' + Date.now();
    const keyframes = `@keyframes ${animName} { 0% { transform: translateY(0); } ${p}% { transform: translateY(-50%); } 100% { transform: translateY(-50%); } }`;

    const styleEl = document.createElement('style');
    styleEl.type = 'text/css';
    styleEl.textContent = keyframes;
    document.head.appendChild(styleEl);

    inner.style.willChange = 'transform';
    inner.style.animation = `${animName} ${totalDuration}s linear infinite`;

    // 存储引用以便需要时清理
    msg.__autoScroll = { styleEl: styleEl, animName: animName };
}

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

    if (!popup) return;

    // 如果 popup 被放在了侧栏内，移动到 body 以避免父级 transform/overflow 影响 fixed 定位
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

    const repositionIfVisible = throttle(() => { if (lastTrigger) repositionPopupFor(lastTrigger); }, 50);
    window.addEventListener('resize', repositionIfVisible);
    // 使用捕获来捕获任何祖先的滚动
    window.addEventListener('scroll', repositionIfVisible, true);

    function hidePopup() {
        popup.classList.remove('show');
        lastTrigger = null;
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

    // 点击外部关闭 — 将弹出框和触发按钮视为内部
    document.addEventListener('click', (e) => {
        if (!popup) return;
        if (e.target.closest('#contact-popup') || e.target.closest('#wechat-btn') || e.target.closest('#qq-btn')) return;
        hidePopup();
    });

    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
        if (!popup) return;
        if (e.key === 'Escape' || e.key === 'Esc') {
            if (popup.classList.contains('show')) hidePopup();
        }
    });

    if (wechatBtn) {
        wechatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showPopupFor(wechatBtn, (wechatSpan ? wechatSpan.textContent : '') || '');
        });
    }

    if (qqBtn) {
        qqBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showPopupFor(qqBtn, (qqSpan ? qqSpan.textContent : '') || '');
        });
    }
}

// 博客网格初始化
function initBlogGrid() {
    const blogGrid = document.getElementById('blogGrid');
    if (!blogGrid) return;
    blogGrid.innerHTML = '';

    // 所有博客数据
    const all = Array.isArray(blogs) ? blogs : [];

    // 先插入“最近更新”卡片（占满整行，位于公告横幅下方、其他博客卡片上方）
    try {
        const recentCard = createRecentUpdatesCard(all);
        if (recentCard) blogGrid.appendChild(recentCard);
    } catch (e) { /* 防御性：若生成失败则继续渲染其余卡片 */ }

    // 在“最近更新”下方插入“推荐博客”标题卡片（占满整行）
    try {
        const recommendedHeaderCard = createRecommendedBlogsHeaderCard();
        if (recommendedHeaderCard) blogGrid.appendChild(recommendedHeaderCard);
    } catch (e) { /* 防御性：若生成失败则继续渲染其余卡片 */ }

    // 仅渲染被标记为推荐的博客卡片（保持原有行为）
    const recommendedBlogs = all.filter(b => b.recommended === true);
    recommendedBlogs.forEach(blog => {
        const blogCard = createBlogCard(blog);
        blogGrid.appendChild(blogCard);
    });

    // 初始化“查看更多”交互（如果存在未显示的文章）
    initViewMore(all.length, recommendedBlogs.length);
}

function createRecommendedBlogsHeaderCard() {
    const card = document.createElement('div');
    card.className = 'recommended-blogs-card';
    card.style.gridColumn = '1 / -1';

    card.innerHTML = `
        <span class="recommended-title">推荐博客</span>
    `;

    return card;
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
        if (!el.dataset.originalHtml) el.dataset.originalHtml = el.innerHTML;
        if (!el.dataset.originalText) {
            const html = el.dataset.originalHtml || '';
            const withNewlines = html.replace(/<br\s*\/?\>/gi, '\n');
            const tmp = document.createElement('div');
            tmp.innerHTML = withNewlines;
            el.dataset.originalText = (tmp.textContent || tmp.innerText || '').replace(/\r/g, '');
        }

        const originalHtml = el.dataset.originalHtml;
        const originalText = el.dataset.originalText;
        const small = window.innerWidth <= 720;
        if (small) {
            const lines = (originalText || '').split('\n');
            const processed = lines.map(line => {
                const collapsed = line.replace(/\s+/g, ' ').trim();
                return collapsed.replace(/ /g, '<br>');
            }).join('<br>');
            el.innerHTML = (processed && processed.replace(/^(?:<br>)+|(?:<br>)+$/g, '').length) ? processed : originalHtml;
        } else {
            el.innerHTML = originalHtml;
        }
    } catch (e) { /* ignore errors */ }
}


// 创建博客卡片
// 创建“最近更新”卡片，放在博客网格顶部（占满整行）
function createRecentUpdatesCard(allBlogs) {
    if (!Array.isArray(allBlogs) || allBlogs.length === 0) return null;

    // 按更新时间降序（防御性：若无 date 字段则视为最旧）
    const sorted = allBlogs.slice().sort((a, b) => {
        const da = a && a.date ? new Date(a.date).getTime() : 0;
        const db = b && b.date ? new Date(b.date).getTime() : 0;
        return db - da;
    });

    // 只取最近 1 条
    const latest = sorted[0];
    if (!latest) return null;

    const card = document.createElement('div');
    card.className = 'recent-updates-card';
    // 让该卡片占据网格整行（与公告横幅宽度一致）
    card.style.gridColumn = '1 / -1';

    const tags = Array.isArray(latest.tags) ? latest.tags.map((t, index) => `<span class="tag" data-level="${index}" data-path="${encodeURIComponent(JSON.stringify(latest.tags))}">${escapeHtml(t)}</span>`).join('') : '';
    // 首页最近更新卡片与普通博客卡片保持同图片路径策略
    const img = 'assets/images/lantern_festival.png';
    const typeHtml = latest.type ? `<div class="blog-type-overlay"><span class="blog-type">${escapeHtml(latest.type)}</span></div>` : '';

    const itemsHtml = `
        <div class="recent-item" data-id="${latest.id}">
            <div class="recent-item-main">
                <h3 class="blog-title recent-item-title">${escapeHtml(latest.title)}</h3>
                <p class="blog-excerpt recent-item-excerpt">${latest.excerpt || ''}</p>
                <div class="blog-meta recent-item-meta"><span class="date" data-date="${latest.date}">${formatDate(latest.date)}</span></div>
            </div>
            <div class="recent-item-side">
                <div class="blog-image recent-thumb">
                    <img src="${img}" alt="${escapeHtml(latest.title)}">
                    ${typeHtml}
                    <div class="tags">${tags}</div>
                </div>
            </div>
        </div>
    `;

    card.innerHTML = `
        <div class="recent-label"><span>最近更新</span></div>
        <div class="recent-content">${itemsHtml}</div>
    `;

    // 点击行为与普通卡片一致：打开对应文章（针对最近列表的每一项）
    card.addEventListener('click', (e) => {
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
                window.location.href = `categories.html?tags=${encodeURIComponent(tagsParam)}`;
            }
            return;
        }

        const el = e.target.closest('.recent-item');
        if (!el) return;
        const id = el.getAttribute('data-id');
        if (id) {
            const url = `blog-detail.html?id=${id}`;
            const w = window.open(url, '_blank', 'noopener,noreferrer');
            try { if (w) w.opener = null; } catch (err) { }
        }
    });

    return card;
}

function createBlogCard(blog) {
    const card = document.createElement('div');
    card.className = 'blog-card';
    const tags = Array.isArray(blog.tags) ? blog.tags : [];
    card.innerHTML = `
        <div class="blog-image">
            <img src="assets/images/lantern_festival.png" alt="${blog.title}">
            ${blog.type ? `<div class="blog-type-overlay"><span class="blog-type">${escapeHtml(blog.type)}</span></div>` : ''}
            <div class="tags">
                ${tags.map((tag, index) => `<span class="tag" data-level="${index}" data-path="${encodeURIComponent(JSON.stringify(blog.tags))}">${tag}</span>`).join('')}</div>
        </div>
        <div class="blog-content">
            <h3 class="blog-title">${escapeHtml(blog.title)}</h3>
            <p class="blog-excerpt">${blog.excerpt}</p>
            <div class="blog-meta">
                <span class="date" data-date="${blog.date}">${formatDate(blog.date)}</span>
            </div>
        </div>
    `;

    // 为标签添加点击事件，完全复用分类页面的逻辑
    const tagElements = card.querySelectorAll('.tag');
    tagElements.forEach(el => {
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
            window.location.href = `categories.html?tags=${encodeURIComponent(tagsParam)}`;
        });
    });

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
    // 语言感知格式化
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

// 导航栏初始化
function initNavigation() {
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.querySelector('.nav-menu');

    if (toggle) {
        toggle.addEventListener('click', () => {
            if (!menu) return;
            const isActive = menu.classList.toggle('active');
            if (isActive) {
                document.body.classList.add('offcanvas-open');
            } else {
                document.body.classList.remove('offcanvas-open');
            }
        });

        // 创建背景元素（单实例）并连接点击以关闭菜单
        (function ensureBackdrop() {
            if (document.querySelector('.offcanvas-backdrop')) return;
            const b = document.createElement('div');
            b.className = 'offcanvas-backdrop';
            // 仅在点击背景本身时关闭
            b.addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (menu) menu.classList.remove('active');
                document.body.classList.remove('offcanvas-open');
            });
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
            var attempts = 0, maxAttempts = 50;
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