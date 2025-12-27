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

// 博客网格初始化
function initBlogGrid() {
    const blogGrid = document.getElementById('blogGrid');
    if (!blogGrid) return;
    blogGrid.innerHTML = '';

    // 渲染所有博客卡片（blogs 已在 DOMContentLoaded 中加载）
    (Array.isArray(blogs) ? blogs : []).forEach(blog => {
        const blogCard = createBlogCard(blog);
        blogGrid.appendChild(blogCard);
    });
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
                <span class="date">${formatDate(blog.date)}</span>
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
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

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