/**
 * 快速链接（Quick Links）模块
 * 功能：分类展示链接卡片，支持轮播式分类切换、响应式布局、
 * 移动端浮动按钮弹窗、3D 滚轮视觉效果。
 */
(function () {
    'use strict';

    // ==================== 配置常量 ====================
    const DATA_URL = 'data/quick-links.json';
    /** 启用卡片入场动画的最小宽度阈值 */
    const STAGGER_BREAKPOINT = 760;
    /** 卡片入场错峰延迟基数（ms） */
    const CARD_STAGGER_MS = 85;
    /** 模态框动画时长（ms） */
    const MODAL_ANIMATION_MS = 320;
    /** 滚轮缩放系数（降低灵敏度） */
    const WHEEL_SCALE = 0.35;

    // ==================== 状态变量 ====================
    let lastGridMinHeight = 0;
    let quickLinksRenderLockedUntil = 0;

    // ==================== 渲染锁 ====================

    /**
     * 锁定渲染，防止在动画期间频繁切换分类导致闪动
     * @param {number} ms - 锁定持续时间（毫秒）
     */
    function lockQuickLinksRender(ms) {
        const until = Date.now() + Math.max(0, Number(ms) || 0);
        if (until > quickLinksRenderLockedUntil) {
            quickLinksRenderLockedUntil = until;
        }
    }

    // ==================== 导航初始化 ====================

    /**
     * 初始化导航菜单切换（仅在未全局初始化时执行）
     */
    function initNavigation() {
        // 若 main.js 已初始化全局导航，则跳过避免重复绑定
        if (typeof window.initNavigation === 'function') return;

        const toggle = document.querySelector('.nav-toggle');
        const menu = document.querySelector('.nav-menu');

        if (toggle && menu) {
            toggle.addEventListener('click', () => {
                menu.classList.toggle('active');
            });

            document.querySelectorAll('.nav-menu a').forEach((link) => {
                link.addEventListener('click', () => {
                    menu.classList.remove('active');
                });
            });
        }
    }

    // ==================== 移动端浮动按钮 ====================

    /**
     * 初始化移动端快速链接浮动按钮与弹窗
     */
    function initQuickLinksFab() {
        const fab = document.getElementById('quickLinksFab');
        const modal = document.getElementById('quickLinksModal');
        const modalBody = modal ? modal.querySelector('.quick-links-modal-body') : null;
        const sidebar = document.querySelector('.quick-links-sidebar');
        const panel = document.querySelector('.quick-links-panel');

        if (!fab || !modal || !modalBody || !panel) return;

        let isOpen = false;
        let isAnimating = false;
        let closeTimer = null;

        // ===== 弹窗打开后同步滚轮状态 =====
        function syncWheelAfterModalOpen() {
            try {
                const wheelEl = panel.querySelector('#quickLinksWheel');
                if (!wheelEl) return;
                adjustWheelPadding(wheelEl);
                lockQuickLinksRender(220);

                if (typeof wheelEl.__recenterToSelected === 'function') {
                    wheelEl.__recenterToSelected();
                } else {
                    const selected = wheelEl.querySelector('.quick-links-wheel-item.is-selected') ||
                        wheelEl.querySelector('.quick-links-wheel-item');
                    if (selected) {
                        scrollItemIntoCenter(wheelEl, selected, 'auto');
                    }
                    applyWheelVisuals(wheelEl);
                }
            } catch (_) { /* ignore */ }
        }

        /** 将面板恢复到侧边栏 */
        function restorePanel() {
            if (!sidebar) return;
            if (panel.parentNode !== sidebar) {
                sidebar.appendChild(panel);
            }
        }

        /** 最终关闭清理 */
        function finalizeClose() {
            restorePanel();
            modal.classList.remove('closing');
            modal.setAttribute('aria-hidden', 'true');
            fab.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = '';
            isAnimating = false;
            closeTimer = null;
        }

        /** 打开弹窗 */
        function openModal() {
            if (isOpen || isAnimating) return;
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }

            // 弹窗搬运+动画期间锁定渲染
            lockQuickLinksRender(MODAL_ANIMATION_MS + 260);

            // 将面板移动到弹窗体内
            modalBody.appendChild(panel);

            modal.classList.remove('open', 'closing');
            modal.classList.add('open-prep');
            modal.setAttribute('aria-hidden', 'false');
            fab.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = 'hidden';

            // 双 RAF 确保过渡动画生效
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    modal.classList.remove('open-prep');
                    modal.classList.add('open');
                    syncWheelAfterModalOpen();
                    setTimeout(syncWheelAfterModalOpen, 120);
                });
            });

            isOpen = true;
        }

        /** 关闭弹窗 */
        function closeModal(immediate) {
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

        // ---- 事件绑定 ----
        fab.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target && e.target.matches('[data-role="backdrop"]')) {
                closeModal(false);
            }
        });

        // ---- 响应式：窄屏显示 FAB，宽屏恢复面板到侧边栏 ----
        function updateMode() {
            const isNarrow = window.innerWidth <= STAGGER_BREAKPOINT;
            if (!isNarrow) {
                if (isOpen || isAnimating) closeModal(true);
                restorePanel();
                fab.style.display = 'none';
                return;
            }
            fab.style.display = 'inline-flex';
        }

        updateMode();
        window.addEventListener('resize', updateMode);
    }

    // ==================== 卡片渲染 ====================

    /**
     * 渲染链接卡片网格
     * @param {HTMLElement} gridEl - 网格容器
     * @param {Array} items - 链接项数组
     */
    function renderCards(gridEl, items) {
        const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        const enableStagger = window.innerWidth > STAGGER_BREAKPOINT && !reducedMotion;

        // 记录切换前高度，避免内容变短时页面高度骤降
        try {
            const h = gridEl.getBoundingClientRect().height;
            if (Number.isFinite(h) && h > lastGridMinHeight) {
                lastGridMinHeight = h;
            }
        } catch (_) { /* ignore */ }

        gridEl.innerHTML = '';

        // 空状态
        if (!Array.isArray(items) || items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'link-empty';

            try {
                const lang = window.siteI18n?.getLang?.() || 'zh';
                const tr = window.siteI18n?.translations?.[lang] || {};
                empty.textContent = tr.quick_no_links || '该分类下暂无链接。';
            } catch (_) {
                empty.textContent = '该分类下暂无链接。';
            }

            gridEl.appendChild(empty);

            if (lastGridMinHeight > 0) {
                gridEl.style.minHeight = `${Math.round(lastGridMinHeight)}px`;
            }
            return;
        }

        const createdCards = [];

        items.forEach((item, index) => {
            const title = item?.title
                ? String(item.title)
                : (window.siteI18n?.translations?.[window.siteI18n?.getLang?.() || 'zh']?.link_unnamed || '未命名链接');
            const url = item?.url ? String(item.url) : '#';
            const image = item?.image ? String(item.image) : 'assets/images/background/bg1.png';

            const a = document.createElement('a');
            a.className = 'link-card';
            if (enableStagger) {
                a.classList.add('link-card-pre-enter');
                a.style.setProperty('--ql-card-delay', `${index * CARD_STAGGER_MS}ms`);
            }
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';

            a.innerHTML = `
                <div class="link-card-media">
                    <img src="${image}" alt="${title}">
                </div>
                <div class="link-card-body">
                    <div class="link-card-title">${title}</div>
                    <div class="link-card-url">${url}</div>
                </div>
            `;

            gridEl.appendChild(a);
            if (enableStagger) createdCards.push(a);
        });

        // 入场动画
        if (enableStagger && createdCards.length > 0) {
            requestAnimationFrame(() => {
                createdCards.forEach((card) => {
                    card.classList.add('link-card-enter-active');
                });
            });
        }

        // 保持最小高度，防止页面跳动
        if (lastGridMinHeight > 0) {
            try {
                const newH = gridEl.getBoundingClientRect().height;
                if (Number.isFinite(newH) && newH < lastGridMinHeight) {
                    gridEl.style.minHeight = `${Math.round(lastGridMinHeight)}px`;
                } else {
                    lastGridMinHeight = newH;
                    gridEl.style.minHeight = '';
                }
            } catch (_) {
                gridEl.style.minHeight = `${Math.round(lastGridMinHeight)}px`;
            }
        }
    }

    // ==================== 滚轮 3D 视觉 ====================

    /**
     * 应用滚轮 3D 视觉效果（倾斜、缩放、模糊、透明度）
     */
    function applyWheelVisuals(wheelEl) {
        const items = Array.from(wheelEl.querySelectorAll('.quick-links-wheel-item'));
        if (items.length === 0) return;

        const centerY = wheelEl.scrollTop + wheelEl.clientHeight / 2;

        items.forEach((item) => {
            const itemCenter = item.offsetTop + item.offsetHeight / 2;
            const baseH = Math.max(item.offsetHeight, 1);
            const dy = (itemCenter - centerY) / baseH;
            const abs = Math.min(Math.abs(dy), 3);

            // 选中项特殊处理
            if (item.classList.contains('is-selected')) {
                item.style.opacity = '1';
                item.style.transform = 'translateZ(0) scale(1.06)';
                item.style.filter = 'none';
                return;
            }

            const rotate = Math.max(-28, Math.min(28, dy * 12));
            const scale = 1 - abs * 0.08;
            const opacity = 1 - abs * 0.22;
            const blur = abs * 0.18;

            item.style.opacity = String(Math.max(0.25, opacity));
            item.style.transform = `translateZ(0) rotateX(${rotate}deg) scale(${scale})`;
            item.style.filter = blur > 0.02 ? `blur(${blur}px)` : 'none';
        });
    }

    /**
     * 查找最接近滚轮中心的项索引
     */
    function findClosestWheelIndex(wheelEl) {
        const items = Array.from(wheelEl.querySelectorAll('.quick-links-wheel-item'));
        if (items.length === 0) return -1;

        const centerY = wheelEl.scrollTop + wheelEl.clientHeight / 2;
        let bestIdx = 0;
        let bestDist = Infinity;

        items.forEach((item, idx) => {
            const itemCenter = item.offsetTop + item.offsetHeight / 2;
            const dist = Math.abs(itemCenter - centerY);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = idx;
            }
        });

        return bestIdx;
    }

    /**
     * 设置选中的滚轮项
     * @returns {HTMLElement|null} 选中的元素
     */
    function setSelectedWheelIndex(wheelEl, index) {
        const items = Array.from(wheelEl.querySelectorAll('.quick-links-wheel-item'));
        if (items.length === 0) return null;

        const safe = Math.max(0, Math.min(index, items.length - 1));

        items.forEach((item, idx) => {
            const selected = idx === safe;
            item.classList.toggle('is-selected', selected);
            item.setAttribute('aria-selected', selected ? 'true' : 'false');
        });

        applyWheelVisuals(wheelEl);
        return items[safe] || null;
    }

    /**
     * 将指定项滚动到滚轮容器中心
     */
    function scrollItemIntoCenter(wheelEl, itemEl, behavior) {
        if (!wheelEl || !itemEl) return;

        const target = itemEl.offsetTop + itemEl.offsetHeight / 2 - wheelEl.clientHeight / 2;
        const top = Math.max(0, Math.min(target, wheelEl.scrollHeight - wheelEl.clientHeight));

        try {
            wheelEl.scrollTo({ top, behavior: behavior || 'smooth' });
        } catch (_) {
            wheelEl.scrollTop = top;
        }
    }

    /**
     * 调整滚轮内边距，使首尾项可居中
     */
    function adjustWheelPadding(wheelEl) {
        if (!wheelEl) return;

        const firstItem = wheelEl.querySelector('.quick-links-wheel-item');
        if (!firstItem) return;

        const itemH = firstItem.getBoundingClientRect().height || firstItem.offsetHeight || 0;
        if (!itemH) return;

        const pad = Math.max(0, Math.round(wheelEl.clientHeight / 2 - itemH / 2));
        wheelEl.style.paddingTop = `${pad}px`;
        wheelEl.style.paddingBottom = `${pad}px`;
    }

    // ==================== 侧边粘性控制 ====================

    /**
     * 更新侧边栏粘性：当侧边高度超过可视区域时禁用粘性
     */
    function updateQuickLinksSticky() {
        try {
            const sidebar = document.querySelector('.quick-links-sidebar');
            if (!sidebar) return;

            // 仅在窄屏上下结构下启用
            if (window.innerWidth > STAGGER_BREAKPOINT) {
                sidebar.classList.remove('no-sticky');
                return;
            }

            const topOffset = 60 + 12;
            const avail = window.innerHeight - topOffset - 24;
            const sidebarH = sidebar.getBoundingClientRect().height;

            sidebar.classList.toggle('no-sticky', sidebarH > avail);
        } catch (_) { /* ignore */ }
    }

    // ==================== 页面主渲染 ====================

    /**
     * 渲染快速链接页面
     */
    function renderPage(data) {
        const wheelEl = document.getElementById('quickLinksWheel');
        const gridEl = document.getElementById('quickLinksGrid');
        if (!wheelEl || !gridEl) return;

        const prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        let gridSwitchToken = 0;

        const categories = data && Array.isArray(data.categories) ? data.categories : [];
        wheelEl.innerHTML = '';

        // 构建分类数据映射
        const itemsByKey = new Map();
        categories.forEach((cat) => {
            if (!cat?.key) return;
            itemsByKey.set(cat.key, Array.isArray(cat.items) ? cat.items : []);
        });

        // 创建滚轮项
        const wheelItems = categories.map((cat) => {
            const div = document.createElement('div');
            div.className = 'quick-links-wheel-item';
            div.dataset.key = cat.key;
            div.setAttribute('role', 'option');
            div.setAttribute('aria-selected', 'false');

            const keyNorm = String(cat.key || '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            div.setAttribute('data-i18n', `quick_${keyNorm}`);
            div.textContent = cat.label || cat.key || 'link';

            return div;
        });

        wheelItems.forEach((el) => wheelEl.appendChild(el));

        // 应用国际化
        if (window.siteI18n?.applyTo) {
            try { window.siteI18n.applyTo(wheelEl); } catch (_) { /* ignore */ }
        }

        adjustWheelPadding(wheelEl);

        // 默认选中 'personal' 分类
        const preferredKey = 'personal';
        const found = wheelItems.findIndex((el) => el.dataset.key === preferredKey);
        let activeIndex = wheelItems.length > 0 ? (found !== -1 ? found : 0) : -1;

        let snapTimer = null;
        let rafPending = false;
        let lastRenderAt = 0;
        let currentKey = null;
        let programmaticScrollUntil = 0;

        // ---- 核心更新函数 ----
        function updateFromIndex(nextIndex, shouldRender) {
            const selectedEl = setSelectedWheelIndex(wheelEl, nextIndex);
            if (!selectedEl) return;

            activeIndex = Array.from(wheelEl.querySelectorAll('.quick-links-wheel-item')).indexOf(selectedEl);

            if (shouldRender) {
                const key = selectedEl.dataset.key;
                if (key !== currentKey) {
                    currentKey = key;
                    renderCardsWithTransition(itemsByKey.get(key) || []);
                }
            }
        }

        function renderCardsWithTransition(items) {
            const doRender = () => renderCards(gridEl, items);

            if (prefersReducedMotion || typeof gridEl.animate !== 'function') {
                doRender();
                return;
            }

            const token = ++gridSwitchToken;

            // 取消进行中的动画
            try {
                gridEl.getAnimations().forEach((anim) => anim.cancel());
            } catch (_) { /* ignore */ }

            // 淡出
            const fadeOut = gridEl.animate(
                [{ opacity: 1 }, { opacity: 0 }],
                { duration: 200, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }
            );

            fadeOut.onfinish = () => {
                if (token !== gridSwitchToken) return;

                doRender();

                // 淡入
                const fadeIn = gridEl.animate(
                    [{ opacity: 0 }, { opacity: 1 }],
                    { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
                );

                fadeIn.onfinish = () => {
                    if (token !== gridSwitchToken) return;
                    gridEl.style.opacity = '';
                };
            };
        }

        // ---- 暴露重新居中方法 ----
        wheelEl.__recenterToSelected = function () {
            const selectedEl = wheelEl.querySelector('.quick-links-wheel-item.is-selected') ||
                wheelEl.querySelector('.quick-links-wheel-item');
            if (!selectedEl) return;

            const idx = Array.from(wheelEl.querySelectorAll('.quick-links-wheel-item')).indexOf(selectedEl);
            if (idx < 0) return;

            updateFromIndex(idx, true);
            lockQuickLinksRender(240);
            programmaticScrollUntil = Date.now() + 260;
            scrollItemIntoCenter(wheelEl, selectedEl, 'auto');
            applyWheelVisuals(wheelEl);
        };

        // ---- 视觉更新调度 ----
        function scheduleVisuals() {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                applyWheelVisuals(wheelEl);
            });
        }

        // ---- 初始渲染 ----
        if (activeIndex >= 0) {
            updateFromIndex(activeIndex, true);
            const initialEl = wheelItems[activeIndex];
            programmaticScrollUntil = Date.now() + 120;
            scrollItemIntoCenter(wheelEl, initialEl, 'auto');
            applyWheelVisuals(wheelEl);
        } else {
            renderCards(gridEl, []);
        }

        try { updateQuickLinksSticky(); } catch (_) { /* ignore */ }

        // ---- 滚轮事件 ----
        wheelEl.addEventListener('scroll', () => {
            scheduleVisuals();

            const now = Date.now();
            const allowRender = now >= programmaticScrollUntil && now >= quickLinksRenderLockedUntil;

            const idx = findClosestWheelIndex(wheelEl);
            if (idx !== -1 && idx !== activeIndex) {
                const shouldRender = allowRender && (now - lastRenderAt) > 120;
                updateFromIndex(idx, shouldRender);
                if (shouldRender) lastRenderAt = now;
            }

            if (snapTimer) clearTimeout(snapTimer);
            snapTimer = setTimeout(() => {
                if (Date.now() < quickLinksRenderLockedUntil) return;

                const idx2 = findClosestWheelIndex(wheelEl);
                if (idx2 === -1) return;

                updateFromIndex(idx2, true);
                lastRenderAt = Date.now();

                const el = wheelItems[idx2];
                programmaticScrollUntil = Date.now() + 240;
                scrollItemIntoCenter(wheelEl, el, 'smooth');
            }, 120);
        }, { passive: true });

        // ---- 滚轮缩放（降低灵敏度） ----
        wheelEl.addEventListener('wheel', (e) => {
            if (typeof e.deltaY !== 'number' || e.deltaY === 0) return;
            e.preventDefault();

            const base = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            const scaled = base * WHEEL_SCALE;
            const clamped = Math.max(-90, Math.min(90, scaled));
            wheelEl.scrollTop += clamped;
        }, { passive: false });

        // ---- 点击选中 ----
        wheelEl.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;

            const itemEl = target.closest('.quick-links-wheel-item');
            if (!itemEl) return;

            const idx = wheelItems.indexOf(itemEl);
            if (idx === -1) return;

            updateFromIndex(idx, true);
            programmaticScrollUntil = Date.now() + 240;
            scrollItemIntoCenter(wheelEl, itemEl, 'smooth');
            wheelEl.focus();
        });

        // ---- 键盘导航 ----
        wheelEl.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            if (activeIndex < 0) return;

            e.preventDefault();
            const delta = e.key === 'ArrowUp' ? -1 : 1;
            const next = Math.max(0, Math.min(activeIndex + delta, wheelItems.length - 1));

            updateFromIndex(next, true);
            const el = wheelItems[next];
            programmaticScrollUntil = Date.now() + 240;
            scrollItemIntoCenter(wheelEl, el, 'smooth');
        });

        // ---- 窗口调整 ----
        window.addEventListener('resize', () => {
            adjustWheelPadding(wheelEl);
            scheduleVisuals();
            try { updateQuickLinksSticky(); } catch (_) { /* ignore */ }
        });

        // ---- 语言切换 ----
        document.addEventListener('site:languageChanged', () => {
            if (window.siteI18n?.applyTo) {
                try { window.siteI18n.applyTo(wheelEl); } catch (_) { /* ignore */ }
            }
        });
    }

    // ==================== 数据加载 ====================

    /**
     * 加载快速链接数据并渲染
     */
    async function initQuickLinks() {
        try {
            const res = await fetch(DATA_URL, { cache: 'no-store' });
            const data = await res.json();
            renderPage(data);
        } catch (_) {
            const gridEl = document.getElementById('quickLinksGrid');
            if (!gridEl) return;

            try {
                const lang = window.siteI18n?.getLang?.() || 'zh';
                const tr = window.siteI18n?.translations?.[lang] || {};
                gridEl.innerHTML = `<div class="link-empty">${tr.quick_links_load_failed || '加载失败：请检查 data/quick-links.json'}</div>`;
            } catch (_) {
                gridEl.innerHTML = '<div class="link-empty">加载失败：请检查 data/quick-links.json</div>';
            }
        }
    }

    // ==================== 启动 ====================

    document.addEventListener('DOMContentLoaded', () => {
        initNavigation();
        initQuickLinksFab();
        initQuickLinks();
    });
})();