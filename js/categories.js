/**
 * 分类页面模块
 * 功能：多级分类筛选（领域 → 科目 → 主题），支持滚轮选择、标签点击跳转、
 * 类型过滤（学习/非学习）、移动端弹窗适配、响应式布局。
 */
(function () {
    'use strict';

    // ==================== 配置常量 ====================
    const MAX_LEVELS = 3;
    const DESKTOP_ENTRANCE_BREAKPOINT = 948;
    const BLOG_ITEM_STAGGER_MS = 72;
    const MODAL_ANIMATION_MS = 320;
    const WHEEL_SCROLL_FACTOR = 0.55;
    const WHEEL_SNAP_DELAY_MS = 140;
    const WHEEL_PROGRAMMATIC_LOCK_MS = 220;

    // ==================== 状态变量 ====================
    let blogsData = [];
    let allBlogsData = [];
    let selectedTags = [];
    let selectedTypeFilter = 'all';

    const wheelTimers = new Map();
    const programmaticUntil = new Map();

    // ==================== 工具函数 ====================

    /** HTML 转义 */
    function escapeHtml(s) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
        return String(s).replace(/[&<>"]/g, (c) => map[c] || c);
    }

    /** 数值钳制 */
    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
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

    // ==================== 首页分类规则（兼容 main.js） ====================

    function getCategoriesHomeCategoryKey(blog) {
        if (typeof getHomeCategoryKey === 'function') {
            return getHomeCategoryKey(blog);
        }

        if (blog?.category?.trim()) {
            const normalized = blog.category.trim();
            if (normalized === '学习') return 'home_category_learning';
            if (normalized === '娱乐') return 'home_category_entertainment';
        }

        const tags = Array.isArray(blog?.tags) ? blog.tags : [];
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
        if (mode === 'non-learning') return sourceBlogs.filter((blog) => !isLearningBlog(blog));
        return sourceBlogs.slice();
    }

    // ==================== 类型筛选 UI ====================

    function initCategoriesTypeFilterUI(onChange) {
        const filterRoot = document.getElementById('categoriesTypeFilterToggle');
        if (!filterRoot) return null;

        const buttons = Array.from(filterRoot.querySelectorAll('.archive-filter-btn'));
        if (buttons.length === 0) return null;

        function updateActiveBackground(activeBtn) {
            if (!activeBtn) return;
            const top = activeBtn.offsetTop;
            const height = activeBtn.offsetHeight;
            filterRoot.style.setProperty('--filter-bg-top', `${top}px`);
            filterRoot.style.setProperty('--filter-bg-height', `${height}px`);
        }

        function setActive(mode, shouldEmit) {
            let activeBtn = null;
            buttons.forEach((btn) => {
                const active = btn.dataset.filter === mode;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-checked', active ? 'true' : 'false');
                if (active) activeBtn = btn;
            });
            updateActiveBackground(activeBtn || buttons[0]);
            if (shouldEmit && typeof onChange === 'function') onChange(mode);
        }

        function shiftActiveByWheel(step) {
            const currentIndex = Math.max(0, buttons.findIndex((btn) => btn.classList.contains('active')));
            const nextIndex = Math.min(buttons.length - 1, Math.max(0, currentIndex + step));
            if (nextIndex === currentIndex) return;
            const nextBtn = buttons[nextIndex];
            setActive(nextBtn.dataset.filter || 'all', true);
        }

        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                setActive(btn.dataset.filter || 'all', true);
            });
        });

        filterRoot.addEventListener(
            'wheel',
            (e) => {
                if (!e?.deltaY) return;
                e.preventDefault();
                shiftActiveByWheel(e.deltaY > 0 ? 1 : -1);
            },
            { passive: false }
        );

        window.addEventListener('resize', () => {
            const activeBtn = buttons.find((btn) => btn.classList.contains('active')) || buttons[0];
            updateActiveBackground(activeBtn);
        });

        setActive('all', false);

        return { setActive };
    }

    // ==================== 移动端弹窗 ====================

    function initCategoriesFab(typeFilterController) {
        const fab = document.getElementById('categoriesFab');
        const modal = document.getElementById('categoriesModal');
        const modalBody = modal?.querySelector('.categories-filter-modal-body');
        const sidebar = document.querySelector('.categories-sidebar');
        const categoriesContainer = document.getElementById('categoriesContainer');
        const typeFilterPanel = document.getElementById('categoriesTypeFilterPanel');

        if (!fab || !modal || !modalBody || !categoriesContainer || !typeFilterPanel) return;

        let isOpen = false;
        let isAnimating = false;
        let closeTimer = null;

        function recenterWheelsInView() {
            try {
                const wheels = categoriesContainer.querySelectorAll('.categories-wheel');
                wheels.forEach((wheel) => {
                    adjustWheelPadding(wheel);
                    const items = Array.from(wheel.querySelectorAll('.wheel-item'));
                    if (!items.length) return;

                    let selectedIndex = items.findIndex((it) => it.classList.contains('is-selected'));
                    if (selectedIndex < 0) selectedIndex = findClosestWheelIndex(wheel);
                    if (selectedIndex < 0) return;

                    const it = items[selectedIndex];
                    const targetTop = Math.max(0, it.offsetTop + it.offsetHeight / 2 - wheel.clientHeight / 2);
                    wheel.scrollTop = targetTop;
                    applyWheelVisuals(wheel);
                });
            } catch (_) { /* ignore */ }
        }

        function restoreToSidebar() {
            if (!sidebar) return;
            sidebar.appendChild(categoriesContainer);
            sidebar.appendChild(typeFilterPanel);
        }

        function finalizeClose() {
            restoreToSidebar();
            modal.classList.remove('closing');
            modal.setAttribute('aria-hidden', 'true');
            fab.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = '';
            isAnimating = false;
            closeTimer = null;
        }

        function openModal() {
            if (isOpen || isAnimating) return;
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }

            // 打开时重置为"全部博客"
            if (typeFilterController?.setActive) {
                typeFilterController.setActive('all', true);
            }

            modalBody.appendChild(categoriesContainer);
            modalBody.appendChild(typeFilterPanel);

            modal.classList.remove('open', 'closing');
            modal.classList.add('open-prep');
            modal.setAttribute('aria-hidden', 'false');
            fab.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = 'hidden';

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    modal.classList.remove('open-prep');
                    modal.classList.add('open');

                    if (typeFilterController?.setActive) {
                        typeFilterController.setActive('all', false);
                    }

                    recenterWheelsInView();
                    setTimeout(recenterWheelsInView, 120);
                });
            });

            isOpen = true;
        }

        function closeModal(immediate = false) {
            if (!isOpen && !isAnimating) return;

            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }

            isOpen = false;

            if (immediate) {
                modal.classList.remove('open', 'open-prep', 'closing');
                finalizeClose();
                return;
            }

            isAnimating = true;
            modal.classList.remove('open', 'open-prep');
            modal.classList.add('closing');

            closeTimer = setTimeout(() => {
                finalizeClose();
            }, MODAL_ANIMATION_MS);
        }

        fab.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target?.matches('[data-role="backdrop"]')) closeModal();
        });

        function updateMode() {
            const w = window.innerWidth;
            if (w > DESKTOP_ENTRANCE_BREAKPOINT) {
                if (isOpen || isAnimating) closeModal(true);
                restoreToSidebar();
                fab.style.display = 'none';
            } else {
                fab.style.display = 'inline-flex';
            }
        }

        updateMode();
        window.addEventListener('resize', throttle(updateMode, 150));
    }

    // ==================== 分类树构建 ====================

    function buildTagTree() {
        const tagTree = {};
        blogsData.forEach((blog) => {
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
        if (!tagTree) return [];
        if (level === 0) return Object.keys(tagTree);

        // 上级未选择时返回空（显示占位）
        for (let i = 0; i < level; i++) {
            if (selectedTags[i] == null) return [];
        }

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

    function setSelectedTag(level, tag) {
        const current = selectedTags[level];
        if (current === tag) return false;

        selectedTags = selectedTags.slice(0, level);
        if (tag != null) selectedTags[level] = tag;
        return true;
    }

    // ==================== 滚轮交互 ====================

    function adjustWheelPadding(wheelEl) {
        const first = wheelEl.querySelector('.wheel-item');
        if (!first) return;

        const itemH = first.getBoundingClientRect().height || 54;
        const wheelH = wheelEl.getBoundingClientRect().height;

        let overlayH = 78;
        try {
            const cs = window.getComputedStyle(wheelEl);
            const val = cs.getPropertyValue('--wheel-overlay-height');
            if (val) {
                const px = parseInt(val.trim(), 10);
                if (!Number.isNaN(px)) overlayH = px;
            }
        } catch (_) { /* ignore */ }

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

        items.forEach((it, i) => {
            const itemCenter = it.offsetTop + it.offsetHeight / 2;
            const dist = Math.abs(itemCenter - centerY);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
            }
        });

        return bestIdx;
    }

    function applyWheelVisuals(wheelEl) {
        const items = Array.from(wheelEl.querySelectorAll('.wheel-item'));
        if (!items.length) return;

        const centerY = getWheelCenterY(wheelEl);
        const itemH = items[0].offsetHeight || 54;

        items.forEach((it) => {
            const itemCenter = it.offsetTop + it.offsetHeight / 2;
            const d = itemCenter - centerY;
            const steps = d / itemH;
            const abs = Math.abs(steps);

            const opacity = clamp(1 - abs * 0.28, 0, 1);
            const scale = clamp(1 - abs * 0.08, 0.78, 1);
            const rotateX = clamp(steps * 10, -50, 50);
            const blur = clamp(abs * 0.6, 0, 2.2);

            it.style.opacity = String(opacity);
            it.style.transform = `rotateX(${rotateX}deg) translateZ(${(1 - abs) * 10}px) scale(${scale})`;
            it.style.filter = `blur(${blur}px)`;
        });

        const idx = findClosestWheelIndex(wheelEl);
        items.forEach((it, i) => it.classList.toggle('is-center', i === idx));

        // 更新选中框
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

                const isInitial = frame.dataset.initial === 'true';
                if (isInitial) frame.style.transition = 'none';

                function getOffsetTopWithin(node, ancestor) {
                    let top = 0;
                    let el = node;
                    while (el && el !== ancestor) {
                        top += el.offsetTop || 0;
                        el = el.offsetParent;
                    }
                    return top;
                }

                const centerYInRow = getOffsetTopWithin(wheelEl, wheelRow) + wheelEl.clientHeight / 2;
                const extraHeight = 8;
                const frameH = Math.round(itemH + extraHeight);
                const topPx = Math.round(centerYInRow - frameH / 2);

                frame.style.height = `${frameH}px`;
                frame.style.top = `${topPx}px`;

                if (isInitial) {
                    delete frame.dataset.initial;
                    requestAnimationFrame(() => {
                        frame.style.transition = '';
                    });
                }
            }
        } catch (_) { /* ignore */ }
    }

    function scrollItemIntoCenter(wheelEl, index, behavior = 'smooth') {
        const items = Array.from(wheelEl.querySelectorAll('.wheel-item'));
        if (!items.length) return;

        const idx = clamp(index, 0, items.length - 1);
        const it = items[idx];
        const target = it.offsetTop + it.offsetHeight / 2 - wheelEl.clientHeight / 2;

        programmaticUntil.set(wheelEl, Date.now() + WHEEL_PROGRAMMATIC_LOCK_MS);
        wheelEl.scrollTo({ top: target, behavior });
    }

    function scheduleSnap(wheelEl, onSnap) {
        const prev = wheelTimers.get(wheelEl);
        if (prev) clearTimeout(prev);

        wheelTimers.set(
            wheelEl,
            setTimeout(() => {
                const idx = findClosestWheelIndex(wheelEl);
                scrollItemIntoCenter(wheelEl, idx, 'smooth');
                if (typeof onSnap === 'function') onSnap(idx);
            }, WHEEL_SNAP_DELAY_MS)
        );
    }

    function bindWheelInteractions(wheelEl, level, tags) {
        applyWheelVisuals(wheelEl);

        wheelEl.addEventListener(
            'wheel',
            (e) => {
                e.preventDefault();
                wheelEl.scrollTop += e.deltaY * WHEEL_SCROLL_FACTOR;
            },
            { passive: false }
        );

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
            } catch (_) {
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

        // 初始对齐
        const selectedIndex = getSelectedIndex(tags, level);
        requestAnimationFrame(() => {
            adjustWheelPadding(wheelEl);
            scrollItemIntoCenter(wheelEl, selectedIndex, 'auto');
            applyWheelVisuals(wheelEl);
        });
    }

    // ==================== 渲染分类 ====================

    function renderCategories() {
        const tagTree = buildTagTree();
        const container = document.getElementById('categoriesContainer');

        // 保持高度防止跳动
        const prevH = container.getBoundingClientRect().height || container.offsetHeight || 0;
        if (prevH > 0) container.style.minHeight = `${prevH}px`;

        container.innerHTML = '';

        const isNarrow = window.innerWidth <= DESKTOP_ENTRANCE_BREAKPOINT;

        // 标题（仅宽屏）
        if (!isNarrow) {
            const panelTitle = document.createElement('div');
            panelTitle.className = 'categories-panel-title';
            panelTitle.setAttribute('data-i18n', 'categories_filter_title');
            container.appendChild(panelTitle);
        }

        const wheelRow = document.createElement('div');
        wheelRow.className = 'categories-wheel-row';
        container.appendChild(wheelRow);

        // 预创建选中框
        const preFrame = document.createElement('div');
        preFrame.className = 'wheel-selected-frame';
        preFrame.setAttribute('aria-hidden', 'true');
        preFrame.dataset.initial = 'true';
        wheelRow.appendChild(preFrame);

        // 本地化标签
        const lang = getLang();
        const tr = window.siteI18n?.translations?.[lang] || {};
        const labels = [tr.label_domain, tr.label_subject, tr.label_topic] || ['领域', '科目', '主题'];
        const placeholderBase = tr.filter_all || '全部';
        const placeholderLabel = placeholderBase;

        // 计算每层标签
        const tagsPerLevel = [];
        for (let level = 0; level < MAX_LEVELS; level++) {
            tagsPerLevel[level] = getTagsAtLevel(tagTree, level) || [];
        }

        // 渲染三列
        for (let level = 0; level < MAX_LEVELS; level++) {
            const tags = tagsPerLevel[level] || [];

            const wrap = document.createElement('div');
            wrap.className = 'categories-wheel-wrap';

            const label = document.createElement('div');
            label.className = 'categories-wheel-label';
            const keyNames = ['label_domain', 'label_subject', 'label_topic'];
            label.setAttribute('data-i18n', keyNames[level]);
            label.textContent = labels[level] || keyNames[level];
            wrap.appendChild(label);

            const wheel = document.createElement('div');
            wheel.className = 'categories-wheel';
            wheel.setAttribute('role', 'listbox');
            wheel.setAttribute('tabindex', '0');
            wheel.setAttribute('aria-label', `${labels[level]}筛选`);

            if (isNarrow) {
                wheel.style.height = '220px';
                wheel.style.setProperty('--wheel-overlay-height', '42px');
            }

            // 占位项（null 表示"全部"）
            const displayTags = [null, ...tags];
            displayTags.forEach((tag, idx) => {
                const item = document.createElement('div');
                item.className = 'wheel-item';
                const isSelected = (selectedTags[level] == null && idx === 0) || (selectedTags[level] === tag);
                if (isSelected) item.classList.add('is-selected');

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

            bindWheelInteractions(wheel, level, displayTags);
        }

        container.style.minHeight = '';

        // 应用国际化
        try {
            if (window.siteI18n?.applyTo) window.siteI18n.applyTo(container);
        } catch (_) { /* ignore */ }

        try { updateSidebarSticky(); } catch (_) { /* ignore */ }
    }

    // ==================== 侧边栏粘性控制 ====================

    function updateSidebarSticky() {
        try {
            const sidebar = document.querySelector('.categories-sidebar');
            if (!sidebar) return;

            if (window.innerWidth <= DESKTOP_ENTRANCE_BREAKPOINT) {
                sidebar.classList.remove('no-sticky');
                return;
            }

            const topOffset = 60 + 12;
            const avail = window.innerHeight - topOffset - 24;
            const sidebarH = sidebar.getBoundingClientRect().height;

            sidebar.classList.toggle('no-sticky', sidebarH > avail);
        } catch (_) { /* ignore */ }
    }

    // ==================== 响应式重绘 ====================

    try {
        (function () {
            window.__categories_last_width = window.innerWidth;
            window.addEventListener('resize', () => {
                const last = window.__categories_last_width || 0;
                const curr = window.innerWidth;
                const crossed = (last <= DESKTOP_ENTRANCE_BREAKPOINT && curr > DESKTOP_ENTRANCE_BREAKPOINT) ||
                    (last > DESKTOP_ENTRANCE_BREAKPOINT && curr <= DESKTOP_ENTRANCE_BREAKPOINT);
                window.__categories_last_width = curr;
                if (crossed) {
                    try { renderCategories(); } catch (_) { /* ignore */ }
                }
            });
        })();
    } catch (_) { /* ignore */ }

    // ==================== 博客列表渲染 ====================

    function renderBlogList() {
        const listDiv = document.getElementById('blogList');
        listDiv.innerHTML = '';

        let filtered = blogsData;

        // 按选中标签筛选
        for (let i = 0; i < selectedTags.length; i++) {
            if (!selectedTags[i]) continue;
            filtered = filtered.filter((blog) => blog.tags[i] === selectedTags[i]);
        }

        const shouldAnimateEntrance = (() => {
            const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            return window.innerWidth > DESKTOP_ENTRANCE_BREAKPOINT && !reducedMotion;
        })();

        filtered.forEach((blog, index) => {
            const item = document.createElement('div');
            item.className = 'blog-item';

            if (shouldAnimateEntrance) {
                item.classList.add('blog-item-enter');
                item.style.setProperty('--enter-delay', `${index * BLOG_ITEM_STAGGER_MS}ms`);
            }

            const tagsHtml = Array.isArray(blog.tags)
                ? blog.tags
                    .map(
                        (t, i) =>
                            `<span class="blog-tag" data-level="${i}" data-path="${encodeURIComponent(JSON.stringify(blog.tags))}">${t}</span>`
                    )
                    .join('')
                : '';

            item.innerHTML = `
                <a class="blog-link" href="blog-detail.html?id=${blog.id}">
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

            // 标签点击跳转
            item.querySelectorAll('.blog-tag').forEach((el) => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const level = Number(el.dataset.level || 0);
                    const path = el.dataset.path ? JSON.parse(decodeURIComponent(el.dataset.path)) : null;
                    if (!path) return;

                    for (let i = 0; i <= level; i++) selectedTags[i] = path[i] || null;
                    for (let i = level + 1; i < MAX_LEVELS; i++) selectedTags[i] = null;

                    renderCategories();
                    renderBlogList();
                });
            });
        });

        // 空状态
        if (!filtered.length) {
            const emptyText = getI18nText('categories_no_blogs', '暂无该分类下的博客');
            listDiv.innerHTML = `<div style="color:#aaa;text-align:center;">${emptyText}</div>`;
        }

        // 标签可见性调整
        try { adjustTagsVisibility(); } catch (_) { /* ignore */ }
    }

    // ==================== 标签可见性自适应 ====================

    function adjustTagsVisibility() {
        try {
            const items = Array.from(document.querySelectorAll('.blog-item'));
            if (!items.length) return;

            const defaultThreshold = 520;
            let tagW = 90;
            try {
                const v = getComputedStyle(document.documentElement).getPropertyValue('--cat-tag-width');
                if (v) {
                    const n = parseInt(v, 10);
                    if (!Number.isNaN(n) && n > 0) tagW = n;
                }
            } catch (_) { /* ignore */ }

            const threshold = Math.max(defaultThreshold, tagW * 3 + 160);

            items.forEach((it) => {
                const right = it.querySelector('.blog-right');
                if (!right) return;
                const w = it.getBoundingClientRect().width;
                it.classList.toggle('tags-hidden', w <= threshold);
            });
        } catch (_) { /* ignore */ }
    }

    function initItemsResizeObserver() {
        try {
            if (window.__cat_ro) {
                try { window.__cat_ro.disconnect(); } catch (_) { /* ignore */ }
                window.__cat_ro = null;
            }

            const items = Array.from(document.querySelectorAll('.blog-item'));
            if (!items.length) return;

            const onResize = throttle(() => {
                try { adjustTagsVisibility(); } catch (_) { /* ignore */ }
            }, 120);

            const ro = new ResizeObserver(() => onResize());
            items.forEach((it) => {
                try { ro.observe(it); } catch (_) { /* ignore */ }
            });
            window.__cat_ro = ro;
        } catch (_) { /* ignore */ }
    }

    // 窗口缩放时更新
    window.addEventListener('resize', throttle(() => {
        try { adjustTagsVisibility(); } catch (_) { /* ignore */ }
    }, 150));

    // ==================== 初始化 ====================

    fetch('data/blogs.json')
        .then((res) => res.json())
        .then((blogs) => {
            allBlogsData = Array.isArray(blogs) ? blogs : [];
            blogsData = applyTypeFilterToBlogs(allBlogsData, selectedTypeFilter);

            // URL 参数初始化
            try {
                const url = new URL(window.location.href);
                const t = url.searchParams.get('tags');
                if (t) {
                    const parsed = JSON.parse(t);
                    if (Array.isArray(parsed)) {
                        selectedTags = parsed.slice(0, MAX_LEVELS).map((v) => (v === null ? null : v));
                    }
                }
            } catch (_) { /* ignore */ }

            const typeFilterController = initCategoriesTypeFilterUI((mode) => {
                selectedTypeFilter = mode || 'all';
                selectedTags = [];
                blogsData = applyTypeFilterToBlogs(allBlogsData, selectedTypeFilter);
                renderCategories();
                renderBlogList();
            });

            try { initCategoriesFab(typeFilterController); } catch (_) { /* ignore */ }

            renderCategories();
            renderBlogList();

            // ResizeObserver 监听卡片尺寸变化
            try { initItemsResizeObserver(); } catch (_) { /* ignore */ }

            // 粘性控制
            try {
                window.addEventListener('load', () => { try { updateSidebarSticky(); } catch (_) { /* ignore */ } });
                window.addEventListener('resize', throttle(() => { try { updateSidebarSticky(); } catch (_) { /* ignore */ } }, 160));
            } catch (_) { /* ignore */ }
        })
        .catch(() => {
            const listDiv = document.getElementById('blogList');
            if (listDiv) {
                listDiv.innerHTML = '<div style="color:#aaa;text-align:center;">数据加载失败</div>';
            }
        });

    // 语言切换时更新
    document.addEventListener('site:languageChanged', () => {
        try {
            const container = document.getElementById('categoriesContainer');
            if (container && window.siteI18n?.applyTo) {
                window.siteI18n.applyTo(container);
            }
        } catch (_) { /* ignore */ }
    });
})();