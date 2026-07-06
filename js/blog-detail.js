/**
 * 博客详情页目录（TOC）紧凑模式模块
 * 功能：在窄屏或容器宽度不足时，将侧边目录收起为悬浮按钮，
 * 点击后以覆盖面板形式展示目录，并带有弹出动画。
 */
(function () {
    'use strict';

    // ==================== 配置常量 ====================
    /** 触发紧凑模式的视口宽度阈值 */
    const COMPACT_VIEWPORT_THRESHOLD = 880;
    /** 触发紧凑模式的容器宽度阈值 */
    const COMPACT_CONTAINER_THRESHOLD = 980;
    /** 关闭动画延迟（ms） */
    const CLOSE_ANIMATION_DELAY_MS = 380;
    /** 模式切换防抖延迟（ms） */
    const RESIZE_DEBOUNCE_MS = 120;

    // ==================== DOM 引用 ====================
    const toc = document.getElementById('blog-toc');
    const container = document.querySelector('.blog-detail .container');

    // 如果目录或容器不存在则退出
    if (!toc || !container) return;

    // ==================== 创建 FAB 与覆盖层 ====================

    /** 悬浮按钮 */
    const fab = document.createElement('button');
    fab.id = 'toc-fab';
    fab.className = 'toc-fab floating-btn';
    fab.setAttribute('aria-label', '目录');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = '<i class="fas fa-list"></i>';

    // 优先插入浮动控制按钮组
    const floatWrap = document.getElementById('floating-controls');
    if (floatWrap) {
        floatWrap.insertBefore(fab, floatWrap.firstChild);
    } else {
        document.body.appendChild(fab);
    }

    /** 覆盖层 */
    const overlay = document.createElement('div');
    overlay.id = 'toc-overlay';
    overlay.className = 'toc-overlay';
    document.body.appendChild(overlay);

    let closeTimer = null;

    // ==================== 目录移动/还原 ====================

    const originalParent = toc.parentNode;
    const originalNext = toc.nextSibling;

    /**
     * 将目录移动到覆盖层中
     */
    function moveTocToOverlay() {
        if (overlay.contains(toc)) return;
        overlay.appendChild(toc);
        toc.classList.add('in-overlay');

        // 重置样式使其在覆盖层中自然布局
        toc.style.position = 'relative';
        toc.style.top = '';
        toc.style.left = '';
        toc.style.width = '';
        toc.style.zIndex = '';
        toc.style.boxShadow = '';
    }

    /**
     * 将目录恢复到侧边栏
     */
    function restoreTocToSidebar() {
        if (originalParent.contains(toc) && !toc.classList.contains('in-overlay')) return;

        if (originalNext) {
            originalParent.insertBefore(toc, originalNext);
        } else {
            originalParent.appendChild(toc);
        }

        toc.classList.remove('in-overlay');
        toc.style.position = '';
        toc.style.top = '';
        toc.style.left = '';
        toc.style.width = '';
        toc.style.zIndex = '';
        toc.style.boxShadow = '';
    }

    // ==================== 覆盖层控制 ====================

    /**
     * 判断覆盖层是否打开
     */
    function isOverlayOpen() {
        return overlay.style.display === 'flex';
    }

    /**
     * 更新弹出动画的位移向量（从 FAB 位置弹出）
     */
    function updatePopVector() {
        try {
            const fabRect = fab.getBoundingClientRect();
            const tocRect = toc.getBoundingClientRect();

            const fabX = fabRect.left + fabRect.width / 2;
            const fabY = fabRect.top + fabRect.height / 2;
            const tocX = tocRect.left + tocRect.width / 2;
            const tocY = tocRect.top + tocRect.height / 2;

            toc.style.setProperty('--toc-pop-dx', Math.round(fabX - tocX) + 'px');
            toc.style.setProperty('--toc-pop-dy', Math.round(fabY - tocY) + 'px');
        } catch (_) { /* ignore */ }
    }

    /**
     * 打开覆盖层
     */
    function openOverlay() {
        if (isOverlayOpen()) return;

        overlay.style.display = 'flex';
        moveTocToOverlay();
        overlay.classList.remove('is-active');
        toc.classList.remove('is-open');
        updatePopVector();

        // 强制重排确保过渡动画生效
        void toc.offsetWidth;

        overlay.classList.add('is-active');
        toc.classList.add('is-open');
        fab.setAttribute('aria-expanded', 'true');
    }

    /**
     * 完成关闭（移除所有状态）
     */
    function finishCloseOverlay() {
        if (closeTimer) {
            clearTimeout(closeTimer);
            closeTimer = null;
        }

        overlay.classList.remove('is-active');
        overlay.style.display = 'none';
        toc.classList.remove('is-open');
        restoreTocToSidebar();
    }

    /**
     * 关闭覆盖层
     * @param {boolean} immediate - 是否立即关闭（无动画）
     */
    function closeOverlay(immediate) {
        if (!isOverlayOpen()) return;

        if (immediate) {
            finishCloseOverlay();
            fab.setAttribute('aria-expanded', 'false');
            return;
        }

        updatePopVector();
        overlay.classList.remove('is-active');
        toc.classList.remove('is-open');

        if (closeTimer) clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
            if (!toc.classList.contains('is-open') && isOverlayOpen()) {
                finishCloseOverlay();
            }
        }, CLOSE_ANIMATION_DELAY_MS);

        fab.setAttribute('aria-expanded', 'false');
    }

    // ==================== 事件绑定 ====================

    // 过渡结束自动关闭
    toc.addEventListener('transitionend', (e) => {
        if (e.propertyName !== 'transform') return;
        if (toc.classList.contains('is-open')) return;
        if (!isOverlayOpen()) return;
        finishCloseOverlay();
    });

    // 点击背景关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeOverlay();
    });

    // 阻止点击目录内部时冒泡到背景
    toc.addEventListener('click', (e) => e.stopPropagation());

    // 点击目录内锚点链接时关闭
    toc.addEventListener('click', (e) => {
        const link = e.target?.closest?.('a[href^="#"]');
        if (link && isOverlayOpen()) {
            closeOverlay();
        }
    });

    // FAB 点击切换
    fab.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isOverlayOpen()) {
            closeOverlay();
        } else {
            openOverlay();
        }
    });

    // ==================== 模式检测与切换 ====================

    /**
     * 判断是否应进入紧凑模式
     */
    function shouldCompact() {
        try {
            const vw = window.innerWidth || document.documentElement.clientWidth;
            if (vw <= COMPACT_VIEWPORT_THRESHOLD) return true;

            const avail = container.clientWidth || 0;
            // 文章最大宽度 900 + 目录 300 + 间距 32 ≈ 1232
            if (avail < COMPACT_CONTAINER_THRESHOLD) return true;
        } catch (_) { /* ignore */ }
        return false;
    }

    let resizeTimer = null;

    /**
     * 更新模式（紧凑 / 正常）
     */
    function updateMode() {
        if (shouldCompact()) {
            document.body.classList.add('toc-compact-mode');
            fab.style.display = 'inline-flex';

            // 覆盖层打开时确保目录在覆盖层内
            if (isOverlayOpen()) {
                moveTocToOverlay();
            } else {
                restoreTocToSidebar();
            }
        } else {
            document.body.classList.remove('toc-compact-mode');
            fab.style.display = 'none';

            if (isOverlayOpen()) {
                closeOverlay(true);
            } else {
                restoreTocToSidebar();
            }
        }
    }

    // ==================== 窗口尺寸变化监听 ====================

    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(updateMode, RESIZE_DEBOUNCE_MS);
    });

    // ==================== 初始化 ====================

    // DOM 加载完成后初始化
    document.addEventListener('DOMContentLoaded', () => {
        // 延迟执行，等待目录生成
        setTimeout(updateMode, 80);

        // 使用 MutationObserver 监控目录内容变化（异步渲染完成后重新评估）
        try {
            const tocList = document.getElementById('toc-list');
            if (tocList) {
                const mo = new MutationObserver(() => {
                    updateMode();
                });
                mo.observe(tocList, { childList: true, subtree: true });
            }
        } catch (_) { /* ignore */ }
    });
})();