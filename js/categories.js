// 分类页面多级分类渲染
let blogsData = [];
let allBlogsData = [];
let selectedTags = [];
let selectedTypeFilter = 'all';

function escapeHtml(s) {
    return String(s).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const MAX_LEVELS = 3;
const wheelTimers = new Map();
const programmaticUntil = new Map();

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function getCategoriesHomeCategoryKey(blog) {
    if (typeof getHomeCategoryKey === 'function') {
        return getHomeCategoryKey(blog);
    }

    if (blog && typeof blog.category === 'string' && blog.category.trim()) {
        const normalized = blog.category.trim();
        if (normalized === '学习') return 'home_category_learning';
        if (normalized === '娱乐') return 'home_category_entertainment';
    }

    const tags = Array.isArray(blog && blog.tags) ? blog.tags : [];
    const firstTag = typeof tags[0] === 'string' ? tags[0].trim() : '';
    if (firstTag === '二上' || firstTag === '二下') return 'home_category_learning';
    return 'home_category_entertainment';
}

function isLearningBlog(blog) {
    return getCategoriesHomeCategoryKey(blog) === 'home_category_learning';
}

function applyTypeFilterToBlogs(sourceBlogs, mode) {
    if (!Array.isArray(sourceBlogs)) return [];
    if (mode === 'learning') return sourceBlogs.filter(isLearningBlog);
    if (mode === 'non-learning') return sourceBlogs.filter(blog => !isLearningBlog(blog));
    return sourceBlogs.slice();
}

function initCategoriesTypeFilterUI(onChange) {
    const filterRoot = document.getElementById('categoriesTypeFilterToggle');
    if (!filterRoot) return null;

    const buttons = Array.from(filterRoot.querySelectorAll('.archive-filter-btn'));
    if (buttons.length === 0) return null;

    function updateActiveBackground(activeBtn) {
        if (!activeBtn) return;
        const rootRect = filterRoot.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        const top = btnRect.top - rootRect.top;
        filterRoot.style.setProperty('--filter-bg-top', `${top}px`);
        filterRoot.style.setProperty('--filter-bg-height', `${btnRect.height}px`);
    }

    function setActive(mode, shouldEmit) {
        let activeBtn = null;
        buttons.forEach(btn => {
            const active = btn.dataset.filter === mode;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-checked', active ? 'true' : 'false');
            if (active) activeBtn = btn;
        });
        updateActiveBackground(activeBtn || buttons[0]);
        if (shouldEmit && typeof onChange === 'function') onChange(mode);
    }

    function shiftActiveByWheel(step) {
        const currentIndex = Math.max(0, buttons.findIndex(btn => btn.classList.contains('active')));
        const nextIndex = Math.min(buttons.length - 1, Math.max(0, currentIndex + step));
        if (nextIndex === currentIndex) return;
        const nextBtn = buttons[nextIndex];
        setActive(nextBtn.dataset.filter || 'all', true);
    }

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            setActive(btn.dataset.filter || 'all', true);
        });
    });

    filterRoot.addEventListener('wheel', (e) => {
        if (!e || !Number.isFinite(e.deltaY) || e.deltaY === 0) return;
        e.preventDefault();
        shiftActiveByWheel(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    window.addEventListener('resize', () => {
        const activeBtn = buttons.find(btn => btn.classList.contains('active')) || buttons[0];
        updateActiveBackground(activeBtn);
    });

    setActive('all', false);

    return {
        setActive
    };
}

function buildTagTree() {
    const tagTree = {};
    blogsData.forEach(blog => {
        const tags = Array.isArray(blog.tags) ? blog.tags.slice(0, MAX_LEVELS) : [];
        if (!tags.length) return;

        let node = tagTree;
        tags.forEach((tag, i) => {
            const isLeaf = i === tags.length - 1;
            if (!node[tag]) node[tag] = isLeaf ? [] : {};
            if (isLeaf) node[tag].push(blog);
            else node = node[tag];
        });
    });
    return tagTree;
}

function getTagsAtLevel(tagTree, level) {
    // 返回指定层级的候选标签列表。
    // 新逻辑：若任何上一级未选（为 null/undefined），则不展示下一级具体选项（只显示占位）。
    if (!tagTree) return [];
    if (level === 0) return Object.keys(tagTree);

    // 如果上层中存在未选项，则返回空数组（表示只有占位）
    for (let i = 0; i < level; i++) {
        if (selectedTags[i] == null) return [];
    }

    // 沿选中路径查找对应子项并返回键名
    let node = tagTree;
    for (let i = 0; i < level; i++) {
        const key = selectedTags[i];
        node = node && typeof node === 'object' ? node[key] : null;
        if (!node || Array.isArray(node)) return [];
    }
    return Object.keys(node || {});
}

function getSelectedIndex(tags, level) {
    if (!tags.length) return -1;
    const sel = selectedTags[level];
    if (!sel) return 0;
    const idx = tags.indexOf(sel);
    return idx >= 0 ? idx : 0;
}

function adjustWheelPadding(wheelEl) {
    const first = wheelEl.querySelector('.wheel-item');
    if (!first) return;
    const itemH = first.getBoundingClientRect().height || 54;
    const wheelH = wheelEl.getBoundingClientRect().height;
    // 考虑顶部/底部渐变遮罩高度，确保居中项不会被遮罩覆盖
    let overlayH = 78;
    try {
        const cs = window.getComputedStyle(wheelEl);
        const val = cs.getPropertyValue('--wheel-overlay-height');
        if (val) {
            const px = parseInt(val.trim(), 10);
            if (!Number.isNaN(px)) overlayH = px;
        }
    } catch (e) { /* ignore */ }
    const basePad = Math.round(wheelH / 2 - itemH / 2);
    const pad = Math.max(0, Math.max(basePad, overlayH));
    wheelEl.style.paddingTop = `${pad}px`;
    wheelEl.style.paddingBottom = `${pad}px`;
}

function getWheelCenterY(wheelEl) {
    return wheelEl.scrollTop + wheelEl.clientHeight / 2;
}

function findClosestWheelIndex(wheelEl) {
    const items = Array.from(wheelEl.querySelectorAll('.wheel-item'));
    if (!items.length) return -1;
    const centerY = getWheelCenterY(wheelEl);
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const itemCenter = it.offsetTop + it.offsetHeight / 2;
        const dist = Math.abs(itemCenter - centerY);
        if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
        }
    }
    return bestIdx;
}

function applyWheelVisuals(wheelEl) {
    const items = Array.from(wheelEl.querySelectorAll('.wheel-item'));
    if (!items.length) return;
    const centerY = getWheelCenterY(wheelEl);
    const itemH = items[0].offsetHeight || 54;

    for (const it of items) {
        const itemCenter = it.offsetTop + it.offsetHeight / 2;
        const d = itemCenter - centerY;
        const steps = d / itemH;
        const abs = Math.abs(steps);

        const opacity = clamp(1 - abs * 0.28, 0, 1);
        const scale = clamp(1 - abs * 0.08, 0.78, 1);
        const rotateX = clamp(steps * 10, -50, 50);
        const blur = clamp(abs * 0.6, 0, 2.2);

        it.style.opacity = `${opacity}`;
        it.style.transform = `rotateX(${rotateX}deg) translateZ(${(1 - abs) * 10}px) scale(${scale})`;
        it.style.filter = `blur(${blur}px)`;
    }

    const idx = findClosestWheelIndex(wheelEl);
    items.forEach((it, i) => it.classList.toggle('is-center', i === idx));

    // 更新覆盖三列的选中框（如果在一个 .categories-wheel-row 下，复用同一个框）
    try {
        const wheelRow = wheelEl.closest('.categories-wheel-row');
        if (wheelRow) {
            let frame = wheelRow.querySelector('.wheel-selected-frame');
            if (!frame) {
                frame = document.createElement('div');
                frame.className = 'wheel-selected-frame';
                frame.setAttribute('aria-hidden', 'true');
                wheelRow.appendChild(frame);
            }

            // 若框为首次插入（render 时标记），在首次设置位置时禁用 transition
            const isInitial = frame.dataset.initial === 'true';
            if (isInitial) {
                frame.style.transition = 'none';
            }

            const wheelRect = wheelEl.getBoundingClientRect();
            const rowRect = wheelRow.getBoundingClientRect();
            const centerY_in_row = (wheelRect.top - rowRect.top) + (wheelEl.clientHeight / 2);
            // 使选中框略高一些以增强视觉（额外高度由 extraHeight 控制）
            const extraHeight = 8; // px，可按需调整
            const frameH = Math.round(itemH + extraHeight);
            const topPx = Math.round(centerY_in_row - frameH / 2);

            frame.style.height = `${frameH}px`;
            frame.style.top = `${topPx}px`;

            if (isInitial) {
                // 清除标记并在下一帧恢复 CSS 中定义的过渡
                delete frame.dataset.initial;
                window.requestAnimationFrame(() => {
                    frame.style.transition = '';
                });
            }
        }
    } catch (err) {
        // 安全降级：若位置计算失败，不阻塞主流程
        // console.warn('wheel frame update failed', err);
    }
}

function scrollItemIntoCenter(wheelEl, index, behavior = 'smooth') {
    const items = Array.from(wheelEl.querySelectorAll('.wheel-item'));
    if (!items.length) return;
    const idx = clamp(index, 0, items.length - 1);
    const it = items[idx];
    const target = it.offsetTop + it.offsetHeight / 2 - wheelEl.clientHeight / 2;
    programmaticUntil.set(wheelEl, Date.now() + 220);
    wheelEl.scrollTo({ top: target, behavior });
}

function setSelectedTag(level, tag) {
    const current = selectedTags[level];
    if (current === tag) return false;

    selectedTags = selectedTags.slice(0, level);
    if (tag != null) selectedTags[level] = tag;
    return true;
}

function scheduleSnap(wheelEl, onSnap) {
    const prev = wheelTimers.get(wheelEl);
    if (prev) window.clearTimeout(prev);
    wheelTimers.set(wheelEl, window.setTimeout(() => {
        const idx = findClosestWheelIndex(wheelEl);
        scrollItemIntoCenter(wheelEl, idx, 'smooth');
        if (typeof onSnap === 'function') onSnap(idx);
    }, 140));
}

function bindWheelInteractions(wheelEl, level, tags) {
    const now = Date.now();

    applyWheelVisuals(wheelEl);

    wheelEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY;
        wheelEl.scrollTop += delta * 0.55;
    }, { passive: false });

    wheelEl.addEventListener('scroll', () => {
        const until = programmaticUntil.get(wheelEl) || 0;
        applyWheelVisuals(wheelEl);
        if (Date.now() < until) return;
        scheduleSnap(wheelEl, (idx) => {
            const tag = tags[idx];
            const changed = setSelectedTag(level, tag);
            if (changed) {
                renderCategories();
                renderBlogList();
            }
        });
    });

    wheelEl.addEventListener('click', (e) => {
        const target = e.target.closest('.wheel-item');
        if (!target) return;
        const idx = Number(target.dataset.index);
        if (Number.isNaN(idx)) return;
        scrollItemIntoCenter(wheelEl, idx, 'smooth');
        const changed = setSelectedTag(level, tags[idx]);
        if (changed) {
            renderCategories();
            renderBlogList();
        }
        try {
            wheelEl.focus({ preventScroll: true });
        } catch (e) {
            // 某些旧浏览器可能不支持 preventScroll 选项，退回到默认行为
            wheelEl.focus();
        }
    });

    wheelEl.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const idx = findClosestWheelIndex(wheelEl);
        const next = idx + (e.key === 'ArrowDown' ? 1 : -1);
        scrollItemIntoCenter(wheelEl, next, 'smooth');
        const newIdx = clamp(next, 0, tags.length - 1);
        const changed = setSelectedTag(level, tags[newIdx]);
        if (changed) {
            renderCategories();
            renderBlogList();
        }
    });

    // 初次渲染后对齐到当前选项
    if (now) {
        const selectedIndex = getSelectedIndex(tags, level);
        window.requestAnimationFrame(() => {
            adjustWheelPadding(wheelEl);
            scrollItemIntoCenter(wheelEl, selectedIndex, 'auto');
            applyWheelVisuals(wheelEl);
        });
    }
}

function renderCategories() {
    const tagTree = buildTagTree();

    const container = document.getElementById('categoriesContainer');
    // 防止清空重建时容器高度塌陷引起页面微移：先固定当前高度
    const prevH = container.getBoundingClientRect().height || container.offsetHeight || 0;
    if (prevH > 0) container.style.minHeight = `${prevH}px`;
    container.innerHTML = '';

    // 在窄屏下移除/隐藏筛选标题（由 DOM 层面不创建），以满足“不要筛选框标题”的需求
    const isNarrow = (typeof window !== 'undefined') ? window.innerWidth <= 948 : false;
    if (!isNarrow) {
        const panelTitle = document.createElement('div');
        panelTitle.className = 'categories-panel-title';
        panelTitle.setAttribute('data-i18n', 'categories_filter_title');
        container.appendChild(panelTitle);
    }

    const wheelRow = document.createElement('div');
    wheelRow.className = 'categories-wheel-row';
    container.appendChild(wheelRow);
    // 预创建覆盖三列的选中框，避免首次动态创建时引起布局跳动
    const preFrame = document.createElement('div');
    preFrame.className = 'wheel-selected-frame';
    preFrame.setAttribute('aria-hidden', 'true');
    // 标记首次插入，首次位置设置时禁用过渡以避免跳动
    preFrame.dataset.initial = 'true';
    wheelRow.appendChild(preFrame);

    // labels localized via i18n
    const lang = (window.siteI18n && window.siteI18n.getLang) ? window.siteI18n.getLang() : 'zh';
    const t = (window.siteI18n && window.siteI18n.translations) ? window.siteI18n.translations[lang] || window.siteI18n.translations['zh'] : null;
    const labels = t ? [t.label_domain, t.label_subject, t.label_topic] : ['领域', '科目', '主题'];

    // 先按层级顺序计算每层可用标签（未选择时为并集），并保留 selectedTags 原有状态。
    const tagsPerLevel = [];
    for (let level = 0; level < MAX_LEVELS; level++) {
        tagsPerLevel[level] = getTagsAtLevel(tagTree, level) || [];
    }

    // 本地化“全部”占位文本，优先使用已解析的 t
    const placeholderBase = (t && t.filter_all) ? t.filter_all : (window.siteI18n && window.siteI18n.translations && window.siteI18n.translations[lang] && window.siteI18n.translations[lang].filter_all) || '全部';
    const placeholderLabel = `${placeholderBase}`;

    // 逐列渲染（保证三列均显示，缺项时显示占位）
    for (let level = 0; level < MAX_LEVELS; level++) {
        const tags = tagsPerLevel[level] || [];

        const wrap = document.createElement('div');
        wrap.className = 'categories-wheel-wrap';

        const label = document.createElement('div');
        label.className = 'categories-wheel-label';
        const keyNames = ['label_domain', 'label_subject', 'label_topic'];
        const keyName = keyNames[level] || 'label_domain';
        label.setAttribute('data-i18n', keyName);
        // provide immediate fallback text while i18n.applyTo runs
        label.textContent = labels[level] || (window.siteI18n && window.siteI18n.translations ? (window.siteI18n.translations[window.siteI18n.getLang()] || {})[keyName] : keyName);
        wrap.appendChild(label);

        const wheel = document.createElement('div');
        wheel.className = 'categories-wheel';
        wheel.setAttribute('role', 'listbox');
        wheel.setAttribute('tabindex', '0');
        wheel.setAttribute('aria-label', `${labels[level]}筛选`);

        // 在窄屏下收窄滚轮高度以减少筛选框总体高度
        if (isNarrow) {
            wheel.style.height = '220px';
            wheel.style.setProperty('--wheel-overlay-height', '42px');
        }

        // 在每列前插入一个占位项（表示未选择 / 全部），以 index 0 呈现
        const displayTags = [null].concat(tags);
        displayTags.forEach((tag, idx) => {
            const item = document.createElement('div');
            item.className = 'wheel-item' + ((selectedTags[level] == null && idx === 0) || (selectedTags[level] === tag) ? ' is-selected' : '');
            // 对于占位（null）项，使用 data-i18n 标记以支持动态语言切换；同时设置即时文本作为回退
            if (tag == null) {
                item.setAttribute('data-i18n', 'filter_all');
                item.textContent = placeholderLabel;
            } else {
                item.textContent = tag;
            }
            item.dataset.index = String(idx);
            wheel.appendChild(item);
        });

        wrap.appendChild(wheel);
        wheelRow.appendChild(wrap);

        // 绑定交互：传入 displayTags（含占位 null）以便 index 对应正确
        bindWheelInteractions(wheel, level, displayTags);
    }

    // 重建完成后恢复高度约束
    container.style.minHeight = '';
    // apply i18n to newly created elements
    if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
        try { window.siteI18n.applyTo(container); } catch (e) { /* ignore */ }
    }
    try { updateSidebarSticky && updateSidebarSticky(); } catch (e) { }
}

// 在窗口宽度跨越断点时重新渲染 categories，以保证标题/高度行为同步
try {
    (function () {
        window.__categories_last_width = window.innerWidth;
        window.addEventListener('resize', function () {
            const last = window.__categories_last_width || 0;
            const curr = window.innerWidth;
            const crossed = (last <= 948 && curr > 948) || (last > 948 && curr <= 948);
            window.__categories_last_width = curr;
            if (crossed) {
                try { renderCategories(); renderBlogList(); } catch (e) { /* ignore */ }
            }
        });
    })();
} catch (e) { /* ignore */ }

function renderBlogList() {
    const listDiv = document.getElementById('blogList');
    listDiv.innerHTML = '';
    let filtered = blogsData;
    for (let i = 0; i < selectedTags.length; i++) {
        if (!selectedTags[i]) continue;
        filtered = filtered.filter(blog => blog.tags[i] === selectedTags[i]);
    }
    filtered.forEach(blog => {
        const item = document.createElement('div');
        item.className = 'blog-item';
        // render left (title/excerpt) and right (tags)
        const tagsHtml = Array.isArray(blog.tags) ? blog.tags.map((t, i) => `<span class="blog-tag" data-level="${i}" data-path="${encodeURIComponent(JSON.stringify(blog.tags))}">${t}</span>`).join('') : '';
        item.innerHTML = `
            <a class="blog-link" href="blog-detail.html?id=${blog.id}" target="_blank" rel="noopener noreferrer">
                <div class="blog-left">
                    <div class="blog-title">
                        <span class="title-text">${escapeHtml(blog.title)}</span>
                        ${blog.type ? `<span class="blog-type">${escapeHtml(blog.type)}</span>` : ''}
                    </div>
                    <div class="blog-excerpt">${blog.excerpt || ''}</div>
                </div>
                <div class="blog-right">
                    <div class="blog-tags">${tagsHtml}</div>
                </div>
            </a>
        `;
        listDiv.appendChild(item);
        // 点击 blog-card 上的 tag：让对应层的滚轮滚到该 tag 并触发一次筛选
        const tagEls = item.querySelectorAll('.blog-tag');
        tagEls.forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const level = Number(el.dataset.level || 0);
                const path = el.dataset.path ? JSON.parse(decodeURIComponent(el.dataset.path)) : null;
                if (!path) return;

                // 设置上级为 path 中对应的值，下级设为占位（null / undefined）
                for (let i = 0; i <= level; i++) selectedTags[i] = path[i] || null;
                for (let i = level + 1; i < MAX_LEVELS; i++) selectedTags[i] = null;

                // 重新渲染后，renderCategories 会根据 selectedTags 将每列滚动到正确位置
                renderCategories();
                renderBlogList();
            });

            // 根据侧边栏高度与可视高度比较，动态启用/禁用粘性定位，避免覆盖博客列表
            function updateSidebarSticky() {
                try {
                    const sidebar = document.querySelector('.categories-sidebar');
                    if (!sidebar) return;
                    // 在窄屏单列模式下，不启用粘性定位
                    if (window.innerWidth <= 948) {
                        sidebar.classList.remove('no-sticky');
                        return;
                    }
                    const topOffset = 60 + 12; // 与 CSS 中的 top: calc(60px + 12px)
                    const avail = window.innerHeight - topOffset - 24; // 预留少量空间
                    const sidebarH = sidebar.getBoundingClientRect().height;
                    if (sidebarH > avail) {
                        sidebar.classList.add('no-sticky');
                    } else {
                        sidebar.classList.remove('no-sticky');
                    }
                } catch (e) { /* ignore */ }
            }

            // 初次加载与窗口尺寸变化时校准
            try {
                window.addEventListener('load', function () { try { updateSidebarSticky(); } catch (e) { } });
                window.addEventListener('resize', throttle(function () { try { updateSidebarSticky(); } catch (e) { } }, 160));
            } catch (e) { /* ignore */ }
        });
    });
    // 初始化 ResizeObserver 以便在单个卡片尺寸变化时动态调整 tags（无需刷新）
    try { initItemsResizeObserver && initItemsResizeObserver(); } catch (e) { }
    // 立即执行一次调整
    try { adjustTagsVisibility && adjustTagsVisibility(); } catch (e) { }
    if (!filtered.length) {
        try {
            const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'zh';
            const tr = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[lang] || {}) : {};
            listDiv.innerHTML = '<div style="color:#aaa;text-align:center;">' + (tr.categories_no_blogs || '暂无该分类下的博客') + '</div>';
        } catch (e) {
            listDiv.innerHTML = '<div style="color:#aaa;text-align:center;">暂无该分类下的博客</div>';
        }
    }
}

// 使用 ResizeObserver 监听每个 .blog-item 的尺寸变化，触发 adjustTagsVisibility
function initItemsResizeObserver() {
    try {
        // disconnect previous observer
        if (window.__cat_ro) {
            try { window.__cat_ro.disconnect(); } catch (e) { }
            window.__cat_ro = null;
        }
        const items = Array.from(document.querySelectorAll('.blog-item'));
        if (!items.length) return;
        const onResize = throttle(function () {
            try { adjustTagsVisibility(); } catch (e) { }
        }, 120);
        const ro = new ResizeObserver(function (entries) {
            // entries contains which elements changed; we don't need per-entry work
            onResize();
        });
        items.forEach(it => {
            try { ro.observe(it); } catch (e) { }
        });
        window.__cat_ro = ro;
    } catch (e) { /* ignore */ }
}

// 根据卡片宽度决定是否显示 tags：当卡片宽度小于 threshold 时隐藏 tags
function adjustTagsVisibility() {
    try {
        const items = Array.from(document.querySelectorAll('.blog-item'));
        if (!items.length) return;
        // 计算阈值：基于设计需要放大一点，使用 520px 作为默认阈值
        const defaultThreshold = 520;
        // 如果 CSS 变量可用，可据此动态计算更合适的阈值
        let tagW = 90;
        try {
            const v = getComputedStyle(document.documentElement).getPropertyValue('--cat-tag-width');
            if (v) {
                const n = parseInt(v, 10);
                if (!Number.isNaN(n) && n > 0) tagW = n;
            }
        } catch (e) { }
        const threshold = Math.max(defaultThreshold, tagW * 3 + 160);

        items.forEach(it => {
            const right = it.querySelector('.blog-right');
            if (!right) return;
            const w = it.getBoundingClientRect().width;
            if (w <= threshold) {
                it.classList.add('tags-hidden');
            } else {
                it.classList.remove('tags-hidden');
            }
        });
    } catch (e) { /* ignore */ }
}

// 在窗口缩放时也更新 tag 可见性（节流）
try {
    window.addEventListener('resize', throttle(function () { try { adjustTagsVisibility(); } catch (e) { } }, 150));
} catch (e) { /* ignore */ }

fetch('data/blogs.json')
    .then(res => res.json())
    .then(blogs => {
        allBlogsData = Array.isArray(blogs) ? blogs : [];
        blogsData = applyTypeFilterToBlogs(allBlogsData, selectedTypeFilter);
        // 如果 URL 中包含 tags 参数（JSON），则用其初始化 selectedTags
        try {
            const url = new URL(window.location.href);
            const t = url.searchParams.get('tags');
            if (t) {
                const parsed = JSON.parse(t);
                if (Array.isArray(parsed)) {
                    // 保证长度不超过 MAX_LEVELS
                    selectedTags = parsed.slice(0, MAX_LEVELS).map(v => (v === null ? null : v));
                }
            }
        } catch (e) {
            // ignore malformed param
        }

        initCategoriesTypeFilterUI((mode) => {
            selectedTypeFilter = mode || 'all';
            selectedTags = [];
            blogsData = applyTypeFilterToBlogs(allBlogsData, selectedTypeFilter);
            renderCategories();
            renderBlogList();
        });

        renderCategories();
        renderBlogList();
    });

// ensure dynamically created category labels are updated when language changes
document.addEventListener('site:languageChanged', function () {
    try {
        const container = document.getElementById('categoriesContainer');
        if (container && window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
            window.siteI18n.applyTo(container);
        }
    } catch (e) {
        console.warn('categories language update failed', e);
    }
});
