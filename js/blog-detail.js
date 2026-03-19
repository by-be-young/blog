(function () {
    // 控制博客详情页在窄屏时将目录收起为悬浮球，并在点击时作为覆盖面板打开目录（移动现有目录节点，保留已绑定事件）
    function $(sel, root) { return (root || document).querySelector(sel); }
    const toc = document.getElementById('blog-toc');
    const container = document.querySelector('.blog-detail .container');
    if (!toc || !container) return;

    // 创建 FAB 与覆盖容器
    const fab = document.createElement('button');
    fab.id = 'toc-fab';
    // reuse global floating button styles
    fab.className = 'toc-fab floating-btn';
    fab.setAttribute('aria-label', '目录');
    fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = '<i class="fas fa-list"></i>';
    // prefer inserting into existing floating controls stack for unified position
    const floatWrap = document.getElementById('floating-controls');
    if (floatWrap) floatWrap.insertBefore(fab, floatWrap.firstChild);
    else document.body.appendChild(fab);

    const overlay = document.createElement('div');
    overlay.id = 'toc-overlay';
    overlay.className = 'toc-overlay';
    document.body.appendChild(overlay);
    let closeTimer = null;

    // 保存原来位置以便还原
    const originalParent = toc.parentNode;
    const originalNext = toc.nextSibling;

    function moveTocToOverlay() {
        // 将 toc 移入 overlay 中展示
        if (overlay.contains(toc)) return;
        overlay.appendChild(toc);
        // mark as in-overlay so CSS hide rule won't hide it
        toc.classList.add('in-overlay');
        // ensure toc can size naturally inside overlay
        toc.style.position = 'relative';
        toc.style.top = '';
        toc.style.left = '';
        toc.style.width = '';
        toc.style.zIndex = '';
        toc.style.boxShadow = '';
    }
    function restoreTocToSidebar() {
        if (originalParent.contains(toc) && !toc.classList.contains('in-overlay')) return;
        if (originalNext) originalParent.insertBefore(toc, originalNext);
        else originalParent.appendChild(toc);
        // remove overlay marker so compact-mode hiding applies again
        toc.classList.remove('in-overlay');
        toc.style.position = '';
        toc.style.top = '';
        toc.style.left = '';
        toc.style.width = '';
        toc.style.zIndex = '';
        toc.style.boxShadow = '';
    }

    function openOverlay() {
        if (isOverlayOpen()) return;
        overlay.style.display = 'flex';
        moveTocToOverlay();
        overlay.classList.remove('is-active');
        toc.classList.remove('is-open');
        updatePopVector();
        // 强制重排，确保初始态生效后再触发过渡
        void toc.offsetWidth;
        overlay.classList.add('is-active');
        toc.classList.add('is-open');
        fab.setAttribute('aria-expanded', 'true');
    }
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
        closeTimer = setTimeout(function () {
            if (!toc.classList.contains('is-open') && isOverlayOpen()) {
                finishCloseOverlay();
            }
        }, 380);
        fab.setAttribute('aria-expanded', 'false');
    }

    function isOverlayOpen() {
        return overlay.style.display === 'flex';
    }

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
        } catch (e) { }
    }

    toc.addEventListener('transitionend', function (e) {
        if (e.propertyName !== 'transform') return;
        if (toc.classList.contains('is-open')) return;
        if (!isOverlayOpen()) return;
        finishCloseOverlay();
    });

    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeOverlay();
    });
    toc.addEventListener('click', function (e) { e.stopPropagation(); });
    toc.addEventListener('click', function (e) {
        const link = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (!link) return;
        if (isOverlayOpen()) closeOverlay();
    });
    fab.addEventListener('click', function (e) { e.stopPropagation(); if (isOverlayOpen()) closeOverlay(); else openOverlay(); });

    // mode detection
    function shouldCompact() {
        // 当视口窄或容器宽度不足时进入紧凑模式
        try {
            const vw = window.innerWidth || document.documentElement.clientWidth;
            if (vw <= 880) return true;
            const avail = container.clientWidth || 0;
            // 文章最大宽度 900 + toc 300 + gap 32 ~= 1232
            // 若容器小于 980 则收起目录
            if (avail < 980) return true;
        } catch (e) { }
        return false;
    }

    let resizeTimer = null;
    function updateMode() {
        if (shouldCompact()) {
            document.body.classList.add('toc-compact-mode');
            // 隐藏侧边原位置（CSS 通过 body.toc-compact-mode 隐藏 .blog-toc）
            // ensure FAB visible
            fab.style.display = 'inline-flex';
            // if overlay currently open, ensure toc is inside overlay
            if (isOverlayOpen()) moveTocToOverlay();
            else restoreTocToSidebar();
        } else {
            document.body.classList.remove('toc-compact-mode');
            fab.style.display = 'none';
            // close overlay if open
            if (isOverlayOpen()) closeOverlay(true);
            else restoreTocToSidebar();
        }
    }

    window.addEventListener('resize', function () {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(updateMode, 120);
    });

    // 初始化时等待短时，以便生成目录后检测
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(updateMode, 80);
        // 目录可能在异步渲染后才存在（generateTOC 在加载完成后异步调用），因此使用 MutationObserver 监控 toc-list 内容
        try {
            const tocList = document.getElementById('toc-list');
            if (tocList) {
                const mo = new MutationObserver(function (m) {
                    // 一旦目录填充，重新评估模式（确保移动/显示正确）
                    updateMode();
                });
                mo.observe(tocList, { childList: true, subtree: true });
            }
        } catch (e) { }
    });
})();
