// 博客数据
let blogs = [];

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

    // 初始化轮播图
    initSlideshow();

    // initStickySidebar 已移除，不再固定侧边栏

    // 初始化导航栏
    initNavigation();

    // 初始化滚动监听
    initScroll();
    // 初始化个人联系方式交互
    try { initProfileContacts && initProfileContacts(); } catch (e) { }
});

// 轮播图初始化
function initSlideshow() {
    const slides = document.querySelectorAll('.slide');
    if (!slides || slides.length === 0) return;
    let currentSlide = 0;

    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        if (slides[index]) {
            slides[index].classList.add('active');
        }
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }

    // 每5秒切换一次
    setInterval(nextSlide, 5000);

    // 初始显示第一张
    showSlide(0);
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
            <h3 class="blog-title">${blog.title}</h3>
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
        window.location.href = `blog-detail.html?id=${blog.id}`;
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

// 已移除 initStickySidebar 相关代码

// 导航栏初始化
function initNavigation() {
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.querySelector('.nav-menu');

    if (toggle) {
        toggle.addEventListener('click', () => {
            menu.classList.toggle('active');
        });
    }

    // 点击链接关闭菜单（移动端）
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.remove('active');
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
(function () {
    try {
        // 在页面中创建用于 busuanzi 填充的隐藏元素
        var _bv_site_pv = document.createElement('span'); _bv_site_pv.className = 'busuanzi_value_site_pv'; _bv_site_pv.style.display = 'none';
        var _bv_site_uv = document.createElement('span'); _bv_site_uv.className = 'busuanzi_value_site_uv'; _bv_site_uv.style.display = 'none';
        var _bv_page_pv = document.createElement('span'); _bv_page_pv.className = 'busuanzi_value_page_pv'; _bv_page_pv.style.display = 'none';
        document.body.appendChild(_bv_site_pv);
        document.body.appendChild(_bv_site_uv);
        document.body.appendChild(_bv_page_pv);

        // 加载 Busuanzi 脚本（官方 CDN，协议相对）
        var bs = document.createElement('script');
        bs.src = '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
        bs.async = true;
        bs.onload = function () { pollAndLog(); };
        bs.onerror = function () { console.warn('Busuanzi 脚本加载失败'); pollAndLog(); };
        document.head.appendChild(bs);

        // 轮询直到 busuanzi 填充了数字或超时，然后打印到控制台
        function pollAndLog() {
            var attempts = 0, maxAttempts = 50; // 最多等待约 5 秒
            var tid = setInterval(function () {
                attempts++;
                var sitePv = _bv_site_pv.textContent.trim();
                var siteUv = _bv_site_uv.textContent.trim();
                var pagePv = _bv_page_pv.textContent.trim();
                if (sitePv || siteUv || pagePv || attempts >= maxAttempts) {
                    clearInterval(tid);
                    console.log('站点统计 — 总访问量(site_pv):', sitePv || 'n/a', ', 访客数(site_uv):', siteUv || 'n/a', ', 本页阅读(page_pv):', pagePv || 'n/a');
                }
            }, 100);
        }
    } catch (e) {
        console.warn('Busuanzi 控制台打印错误', e);
    }
})();