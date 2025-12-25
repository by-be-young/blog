(function () {
    const DATA_URL = 'data/quick-links.json';
    let lastGridMinHeight = 0;

    function initNavigation() {
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
            empty.textContent = '该分类下暂无链接。';
            gridEl.appendChild(empty);

            if (lastGridMinHeight > 0) {
                gridEl.style.minHeight = `${Math.round(lastGridMinHeight)}px`;
            }
            return;
        }

        items.forEach(item => {
            const title = (item && item.title) ? String(item.title) : '未命名链接';
            const url = (item && item.url) ? String(item.url) : '#';
            const image = (item && item.image) ? String(item.image) : 'assets/blog_bg.png';

            const a = document.createElement('a');
            a.className = 'link-card';
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
        });

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

        const categories = data && Array.isArray(data.categories) ? data.categories : [];
        wheelEl.innerHTML = '';

        const itemsByKey = new Map();
        categories.forEach(cat => {
            if (!cat || !cat.key) return;
            itemsByKey.set(cat.key, Array.isArray(cat.items) ? cat.items : []);
        });

        const wheelItems = categories.map(cat => {
            const div = document.createElement('div');
            div.className = 'quick-links-wheel-item';
            div.dataset.key = cat.key;
            div.setAttribute('role', 'option');
            div.setAttribute('aria-selected', 'false');
            div.textContent = cat.label || cat.key;
            return div;
        });

        wheelItems.forEach(el => wheelEl.appendChild(el));

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
                    renderCards(gridEl, itemsByKey.get(key) || []);
                }
            }
        }

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

        // 滚动：实时更新视觉；停下后自动吸附并切换分类
        wheelEl.addEventListener('scroll', () => {
            scheduleVisuals();

            // 点击/键盘触发的平滑居中期间，避免 scroll 事件重复渲染造成右侧闪动
            const now0 = Date.now();
            const allowRender = now0 >= programmaticScrollUntil;

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
        });
    }

    async function initQuickLinks() {
        try {
            const res = await fetch(DATA_URL, { cache: 'no-store' });
            const data = await res.json();
            renderPage(data);
        } catch (e) {
            const gridEl = document.getElementById('quickLinksGrid');
            if (gridEl) {
                gridEl.innerHTML = '<div class="link-empty">加载失败：请检查 data/quick-links.json</div>';
            }
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        initNavigation();
        initQuickLinks();
    });
})();
