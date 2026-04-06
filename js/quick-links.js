(function () {
    const DATA_URL = 'data/quick-links.json';
    const QUICK_LINKS_STAGGER_BREAKPOINT = 760;
    const QUICK_LINKS_CARD_STAGGER_MS = 85;
    let lastGridMinHeight = 0;
    let quickLinksRenderLockedUntil = 0;

    function lockQuickLinksRender(ms) {
        const ttl = Number(ms) || 0;
        const until = Date.now() + Math.max(0, ttl);
        if (until > quickLinksRenderLockedUntil) {
            quickLinksRenderLockedUntil = until;
        }
    }

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
        const MODAL_ANIMATION_MS = 320;

        function syncWheelAfterModalOpen() {
            try {
                const wheelEl = panel.querySelector('#quickLinksWheel');
                if (!wheelEl) return;
                adjustWheelPadding(wheelEl);
                lockQuickLinksRender(220);
                if (typeof wheelEl.__recenterToSelected === 'function') {
                    wheelEl.__recenterToSelected();
                } else {
                    const selected = wheelEl.querySelector('.quick-links-wheel-item.is-selected') || wheelEl.querySelector('.quick-links-wheel-item');
                    if (selected) {
                        scrollItemIntoCenter(wheelEl, selected, 'auto');
                    }
                    applyWheelVisuals(wheelEl);
                }
            } catch (e) { /* ignore */ }
        }

        function restorePanel() {
            if (!sidebar) return;
            if (panel.parentNode !== sidebar) {
                sidebar.appendChild(panel);
            }
        }

        function finalizeClose() {
            restorePanel();
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
                window.clearTimeout(closeTimer);
                closeTimer = null;
            }

            // 弹窗搬运+开启动画期间，临时锁住分类渲染，避免出现“先闪到其他分类再回到选中项”。
            lockQuickLinksRender(MODAL_ANIMATION_MS + 260);

            modalBody.appendChild(panel);

            modal.classList.remove('open');
            modal.classList.remove('closing');
            modal.classList.add('open-prep');
            modal.setAttribute('aria-hidden', 'false');
            fab.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = 'hidden';

            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(() => {
                    modal.classList.remove('open-prep');
                    modal.classList.add('open');
                    syncWheelAfterModalOpen();
                    window.setTimeout(syncWheelAfterModalOpen, 120);
                });
            });

            isOpen = true;
        }

        function closeModal(immediate) {
            if (!isOpen && !isAnimating) return;

            if (closeTimer) {
                window.clearTimeout(closeTimer);
                closeTimer = null;
            }

            isOpen = false;

            if (immediate) {
                modal.classList.remove('open');
                modal.classList.remove('open-prep');
                modal.classList.remove('closing');
                finalizeClose();
                return;
            }

            isAnimating = true;
            modal.classList.remove('open');
            modal.classList.remove('open-prep');
            modal.classList.add('closing');

            closeTimer = window.setTimeout(() => {
                finalizeClose();
            }, MODAL_ANIMATION_MS);
        }

        fab.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target && e.target.matches('[data-role="backdrop"]')) closeModal(false);
        });

        function updateMode() {
            const narrow = window.innerWidth <= 760;
            if (!narrow) {
                if (isOpen || isAnimating) closeModal(true);
                restorePanel();
                fab.style.display = 'none';
                return;
            }
            fab.style.display = 'inline-flex';
        }

        updateMode();
        window.addEventListener('resize', () => {
            updateMode();
        });
    }

    function initNavigation() {
        // If a global navigation initializer exists (from main.js), skip local init
        // to avoid duplicate event handlers which cause double-toggling.
        if (typeof window.initNavigation === 'function') return;

        const toggle = document.querySelector('.nav-toggle');
        const menu = document.querySelector('.nav-menu');

        if (toggle && menu) {
            toggle.addEventListener('click', () => {
                menu.classList.toggle('active');
            });

            document.querySelectorAll('.nav-menu a').forEach(link => {
                link.addEventListener('click', () => {
                    menu.classList.remove('active');
                });
            });
        }
    }

    function renderCards(gridEl, items) {
        const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        const enableStagger = window.innerWidth > QUICK_LINKS_STAGGER_BREAKPOINT && !reducedMotion;

        // 记录切换前高度，避免切换到更短内容时页面高度骤降造成滚动位置“跳变”
        try {
            const h = gridEl.getBoundingClientRect().height;
            if (Number.isFinite(h) && h > lastGridMinHeight) lastGridMinHeight = h;
        } catch (e) {
            // ignore
        }

        gridEl.innerHTML = '';

        if (!Array.isArray(items) || items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'link-empty';
            try {
                const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'zh';
                const tr = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[lang] || {}) : {};
                empty.textContent = tr.quick_no_links || '该分类下暂无链接。';
            } catch (e) { empty.textContent = '该分类下暂无链接。'; }
            gridEl.appendChild(empty);

            if (lastGridMinHeight > 0) {
                gridEl.style.minHeight = `${Math.round(lastGridMinHeight)}px`;
            }
            return;
        }

        const createdCards = [];
        items.forEach((item, index) => {
            const title = (item && item.title) ? String(item.title) : ((window.siteI18n && window.siteI18n.translations && window.siteI18n.translations[(window.siteI18n.getLang && window.siteI18n.getLang()) || 'zh'] && window.siteI18n.translations[window.siteI18n.getLang()].link_unnamed) || '未命名链接');
            const url = (item && item.url) ? String(item.url) : '#';
            const image = (item && item.image) ? String(item.image) : 'assets/images/background/bg1.png';

            const a = document.createElement('a');
            a.className = 'link-card';
            if (enableStagger) {
                a.classList.add('link-card-pre-enter');
                a.style.setProperty('--ql-card-delay', `${index * QUICK_LINKS_CARD_STAGGER_MS}ms`);
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

        if (enableStagger && createdCards.length > 0) {
            window.requestAnimationFrame(() => {
                createdCards.forEach(card => {
                    card.classList.add('link-card-enter-active');
                });
            });
        }

        // 渲染后如果内容更短，保持上一次高度，避免页面高度瞬变
        if (lastGridMinHeight > 0) {
            try {
                const newH = gridEl.getBoundingClientRect().height;
                if (Number.isFinite(newH) && newH < lastGridMinHeight) {
                    gridEl.style.minHeight = `${Math.round(lastGridMinHeight)}px`;
                } else {
                    lastGridMinHeight = newH;
                    gridEl.style.minHeight = '';
                }
            } catch (e) {
                gridEl.style.minHeight = `${Math.round(lastGridMinHeight)}px`;
            }
        }
    }

    function applyWheelVisuals(wheelEl) {
        const items = Array.from(wheelEl.querySelectorAll('.quick-links-wheel-item'));
        if (items.length === 0) return;

        // 使用滚动坐标系（scrollTop/offsetTop），避免元素 transform 反过来影响测量导致“翻转/压扁”
        const centerY = wheelEl.scrollTop + wheelEl.clientHeight / 2;

        items.forEach(item => {
            const itemCenter = item.offsetTop + item.offsetHeight / 2;
            const baseH = Math.max(item.offsetHeight, 1);
            const dy = (itemCenter - centerY) / baseH;
            const abs = Math.min(Math.abs(dy), 3);

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

    function scrollItemIntoCenter(wheelEl, itemEl, behavior) {
        if (!wheelEl || !itemEl) return;
        // 用容器 scrollTop 手动居中，避免 scrollIntoView 导致页面级滚动跳动
        const target = itemEl.offsetTop + itemEl.offsetHeight / 2 - wheelEl.clientHeight / 2;
        const top = Math.max(0, Math.min(target, wheelEl.scrollHeight - wheelEl.clientHeight));
        try {
            wheelEl.scrollTo({ top, behavior: behavior || 'smooth' });
        } catch (e) {
            wheelEl.scrollTop = top;
        }
    }

    function adjustWheelPadding(wheelEl) {
        if (!wheelEl) return;
        const firstItem = wheelEl.querySelector('.quick-links-wheel-item');
        if (!firstItem) return;

        const itemH = firstItem.getBoundingClientRect().height || firstItem.offsetHeight || 0;
        if (!itemH) return;

        const pad = Math.max(0, Math.round(wheelEl.clientHeight / 2 - itemH / 2));
        // 用 inline style 覆盖 CSS 固定 padding，避免分类数量/字体/高度变化导致居中异常
        wheelEl.style.paddingTop = `${pad}px`;
        wheelEl.style.paddingBottom = `${pad}px`;
    }

    function renderPage(data) {
        const wheelEl = document.getElementById('quickLinksWheel');
        const gridEl = document.getElementById('quickLinksGrid');
        if (!wheelEl || !gridEl) return;

        const prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        let gridSwitchToken = 0;

        const categories = data && Array.isArray(data.categories) ? data.categories : [];
        wheelEl.innerHTML = '';

        const itemsByKey = new Map();
        categories.forEach(cat => {
            if (!cat || !cat.key) return;
            itemsByKey.set(cat.key, Array.isArray(cat.items) ? cat.items : []);
        });

        const lang = (window.siteI18n && window.siteI18n.getLang) ? window.siteI18n.getLang() : 'zh';
        const tr = (window.siteI18n && window.siteI18n.translations) ? window.siteI18n.translations[lang] || window.siteI18n.translations['zh'] : {};

        const wheelItems = categories.map(cat => {
            const div = document.createElement('div');
            div.className = 'quick-links-wheel-item';
            div.dataset.key = cat.key;
            div.setAttribute('role', 'option');
            div.setAttribute('aria-selected', 'false');
            // use translation key based on category key: quick_<key>
            const keyNorm = String(cat.key || '').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            const transKey = `quick_${keyNorm}`;
            // set data-i18n so siteI18n.applyTo can translate dynamically
            div.setAttribute('data-i18n', transKey);
            // fallback content (will be replaced by applyTo if translation exists)
            div.textContent = cat.label || cat.key || 'link';
            return div;
        });

        wheelItems.forEach(el => wheelEl.appendChild(el));

        // apply i18n to wheel labels immediately
        if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
            try { window.siteI18n.applyTo(wheelEl); } catch (e) { /* ignore */ }
        }

        // 动态 padding：确保首尾项也能居中到高亮框
        adjustWheelPadding(wheelEl);

        // 默认优先选择 key 为 `personal`（个人）的分类，使页面进入时显示“个人”内容
        const preferredKey = 'personal';
        const found = wheelItems.findIndex(el => el.dataset.key === preferredKey);
        let activeIndex = -1;
        if (wheelItems.length > 0) {
            activeIndex = found !== -1 ? found : 0;
        }
        let snapTimer = null;
        let rafPending = false;
        let lastRenderAt = 0;
        let currentKey = null;
        let programmaticScrollUntil = 0;

        function updateFromIndex(nextIndex, shouldRender) {
            const selectedEl = setSelectedWheelIndex(wheelEl, nextIndex);
            if (!selectedEl) return;
            activeIndex = Array.from(wheelEl.querySelectorAll('.quick-links-wheel-item')).indexOf(selectedEl);
            if (shouldRender) {
                const key = selectedEl.dataset.key;
                // 防止同一分类重复渲染导致闪动
                if (key !== currentKey) {
                    currentKey = key;
                    renderCardsWithTransition(itemsByKey.get(key) || []);
                }
            }
        }

        function renderCardsWithTransition(items) {
            const doRender = () => renderCards(gridEl, items);

            // 无障碍降级：用户偏好减少动效时不做过渡。
            if (prefersReducedMotion || typeof gridEl.animate !== 'function') {
                doRender();
                return;
            }

            const token = ++gridSwitchToken;

            try {
                const animations = gridEl.getAnimations();
                if (Array.isArray(animations)) {
                    animations.forEach(anim => anim.cancel());
                }
            } catch (e) {
                // ignore
            }

            const fadeOut = gridEl.animate(
                [
                    { opacity: 1 },
                    { opacity: 0 }
                ],
                {
                    duration: 200,
                    easing: 'cubic-bezier(0.4, 0, 1, 1)',
                    fill: 'forwards'
                }
            );

            fadeOut.onfinish = () => {
                if (token !== gridSwitchToken) return;

                doRender();

                const fadeIn = gridEl.animate(
                    [
                        { opacity: 0 },
                        { opacity: 1 }
                    ],
                    {
                        duration: 320,
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        fill: 'both'
                    }
                );

                fadeIn.onfinish = () => {
                    if (token !== gridSwitchToken) return;
                    gridEl.style.opacity = '';
                };
            };
        }

        wheelEl.__recenterToSelected = function () {
            const selectedEl = wheelEl.querySelector('.quick-links-wheel-item.is-selected') || wheelEl.querySelector('.quick-links-wheel-item');
            if (!selectedEl) return;
            const idx = Array.from(wheelEl.querySelectorAll('.quick-links-wheel-item')).indexOf(selectedEl);
            if (idx < 0) return;
            updateFromIndex(idx, true);
            lockQuickLinksRender(240);
            programmaticScrollUntil = Date.now() + 260;
            scrollItemIntoCenter(wheelEl, selectedEl, 'auto');
            applyWheelVisuals(wheelEl);
        };

        function scheduleVisuals() {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                applyWheelVisuals(wheelEl);
            });
        }

        // 初始选中第一项并渲染
        if (activeIndex >= 0) {
            updateFromIndex(activeIndex, true);
            // 让初始项居中（避免首次进入时不在高亮框）
            const initialEl = wheelEl.querySelectorAll('.quick-links-wheel-item')[activeIndex];
            programmaticScrollUntil = Date.now() + 120;
            scrollItemIntoCenter(wheelEl, initialEl, 'auto');
            applyWheelVisuals(wheelEl);
        } else {
            renderCards(gridEl, []);
        }

        // 调整侧边粘性（立即）
        try { updateQuickLinksSticky && updateQuickLinksSticky(); } catch (e) { }

        // 滚动：实时更新视觉；停下后自动吸附并切换分类
        wheelEl.addEventListener('scroll', () => {
            scheduleVisuals();

            // 点击/键盘触发的平滑居中期间，避免 scroll 事件重复渲染造成右侧闪动
            const now0 = Date.now();
            const allowRender = now0 >= programmaticScrollUntil && now0 >= quickLinksRenderLockedUntil;

            const idx = findClosestWheelIndex(wheelEl);
            // 滚动过程中也保持“选中项”和“右侧内容”基本同步，但做轻量节流
            if (idx !== -1 && idx !== activeIndex) {
                const now = Date.now();
                const shouldRender = allowRender && (now - lastRenderAt) > 120;
                updateFromIndex(idx, shouldRender);
                if (shouldRender) lastRenderAt = now;
            }

            if (snapTimer) window.clearTimeout(snapTimer);
            snapTimer = window.setTimeout(() => {
                if (Date.now() < quickLinksRenderLockedUntil) return;
                const idx2 = findClosestWheelIndex(wheelEl);
                if (idx2 === -1) return;
                updateFromIndex(idx2, true);
                lastRenderAt = Date.now();
                const el = wheelEl.querySelectorAll('.quick-links-wheel-item')[idx2];
                programmaticScrollUntil = Date.now() + 240;
                scrollItemIntoCenter(wheelEl, el, 'smooth');
            }, 120);
        }, { passive: true });

        // Wheel 缩放：降低滚轮灵敏度（同时避免带动整页滚动）
        wheelEl.addEventListener('wheel', (e) => {
            // 仅处理垂直滚动
            if (typeof e.deltaY !== 'number' || e.deltaY === 0) return;
            e.preventDefault();

            // deltaMode: 0=px, 1=line, 2=page
            const base = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
            const scaled = base * 0.35;
            const clamped = Math.max(-90, Math.min(90, scaled));
            wheelEl.scrollTop += clamped;
        }, { passive: false });

        // 点击：滚到中心并触发选中
        wheelEl.addEventListener('click', (e) => {
            const target = e.target;
            if (!(target instanceof Element)) return;
            const itemEl = target.closest('.quick-links-wheel-item');
            if (!itemEl) return;
            const idx = Array.from(wheelEl.querySelectorAll('.quick-links-wheel-item')).indexOf(itemEl);
            if (idx === -1) return;
            updateFromIndex(idx, true);
            programmaticScrollUntil = Date.now() + 240;
            scrollItemIntoCenter(wheelEl, itemEl, 'smooth');
            wheelEl.focus();
        });

        // 键盘上下键：切换分类
        wheelEl.addEventListener('keydown', (e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            if (activeIndex < 0) return;
            e.preventDefault();
            const delta = e.key === 'ArrowUp' ? -1 : 1;
            const next = Math.max(0, Math.min(activeIndex + delta, wheelItems.length - 1));
            updateFromIndex(next, true);
            const el = wheelEl.querySelectorAll('.quick-links-wheel-item')[next];
            programmaticScrollUntil = Date.now() + 240;
            scrollItemIntoCenter(wheelEl, el, 'smooth');
        });

        // 尺寸变化时更新 3D 视觉
        window.addEventListener('resize', () => {
            adjustWheelPadding(wheelEl);
            scheduleVisuals();
            try { updateQuickLinksSticky && updateQuickLinksSticky(); } catch (e) { }
        });
        // update wheel labels when language changes
        document.addEventListener('site:languageChanged', function () {
            if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
                try { window.siteI18n.applyTo(wheelEl); } catch (e) { /* ignore */ }
            }
        });
    }

    // 控制侧边粘性：当侧边高度超过可视区域时禁用粘性，避免覆盖卡片
    function updateQuickLinksSticky() {
        try {
            const sidebar = document.querySelector('.quick-links-sidebar');
            if (!sidebar) return;
            // 仅在窄屏上下结构下启用粘性逻辑
            if (window.innerWidth > 760) {
                sidebar.classList.remove('no-sticky');
                return;
            }
            const topOffset = 60 + 12;
            const avail = window.innerHeight - topOffset - 24;
            const sidebarH = sidebar.getBoundingClientRect().height;
            if (sidebarH > avail) sidebar.classList.add('no-sticky');
            else sidebar.classList.remove('no-sticky');
        } catch (e) { /* ignore */ }
    }

    async function initQuickLinks() {
        try {
            const res = await fetch(DATA_URL, { cache: 'no-store' });
            const data = await res.json();
            renderPage(data);
        } catch (e) {
            const gridEl = document.getElementById('quickLinksGrid');
            if (gridEl) {
                try {
                    const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'zh';
                    const tr = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[lang] || {}) : {};
                    gridEl.innerHTML = '<div class="link-empty">' + (tr.quick_links_load_failed || '加载失败：请检查 data/quick-links.json') + '</div>';
                } catch (e) {
                    gridEl.innerHTML = '<div class="link-empty">加载失败：请检查 data/quick-links.json</div>';
                }
            }
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        initNavigation();
        initQuickLinksFab();
        initQuickLinks();
    });
})();
