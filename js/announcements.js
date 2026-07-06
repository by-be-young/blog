/**
 * 公告页面模块
 * 功能：加载并渲染公告时间轴，支持桌面端左右交替布局和移动端卡片布局，
 * 带有滚动进入动画和日期格式化。
 */
(function () {
    'use strict';

    // ==================== 配置常量 ====================
    const MOBILE_TIMELINE_QUERY = '(max-width: 880px)';
    const INTERSECTION_THRESHOLD = 0.12;

    // ==================== 状态变量 ====================
    let announcementsCache = [];

    // ==================== 工具函数 ====================

    /** 判断是否为移动端布局 */
    function isMobileTimeline() {
        try {
            return window.matchMedia(MOBILE_TIMELINE_QUERY).matches;
        } catch (_) {
            return window.innerWidth <= 880;
        }
    }

    /** HTML 转义 */
    function escapeHtml(s) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return String(s).replace(/[&<>"']/g, (c) => map[c] || c);
    }

    /** 获取当前语言 */
    function getLang() {
        try {
            return window.siteI18n?.getLang?.() || 'zh';
        } catch (_) {
            return 'zh';
        }
    }

    /** 格式化日期（使用全局格式化函数或回退） */
    function formatDate(dateString) {
        if (typeof window.formatDate === 'function') {
            return window.formatDate(dateString);
        }
        try {
            const date = new Date(dateString);
            const lang = getLang();
            if (lang === 'en') {
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            }
            if (lang === 'ja') {
                return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
            }
            return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (_) {
            return dateString || '';
        }
    }

    // ==================== 公告渲染 ====================

    /**
     * 将公告文本按行渲染为结构化 HTML
     * @param {string} msg - 公告文本
     * @returns {object} { className, html }
     */
    function renderMessageHtml(msg) {
        const lines = String(msg || '').split(/\r?\n/);
        const lineHtml = lines.map((line, idx) => {
            const text = escapeHtml(line);
            if (!line.trim()) {
                return '<div class="ann-line ann-line--blank" aria-hidden="true">&nbsp;</div>';
            }
            const classes = ['ann-line'];
            if (idx === 0) classes.push('ann-line--headline');
            if (line.includes('>>')) classes.push('ann-line--section');
            return `<div class="${classes.join(' ')}">${text}</div>`;
        });

        if (lineHtml.length <= 1) {
            return {
                className: 'ann-message',
                html: lineHtml.join('')
            };
        }

        return {
            className: 'ann-message ann-message--split',
            html: `
                <div class="ann-message-fixed">${lineHtml[0]}</div>
                <div class="ann-message-scroll">${lineHtml.slice(1).join('')}</div>
            `
        };
    }

    /**
     * 公告排序：按日期降序，日期相同按 ID 降序
     */
    function sortAnnouncements(a, b) {
        const da = new Date(a?.date || 0).getTime();
        const db = new Date(b?.date || 0).getTime();
        if (db !== da) return db - da;
        const ia = Number(a?.id || 0);
        const ib = Number(b?.id || 0);
        return ib - ia;
    }

    /**
     * 使用 IntersectionObserver 触发滚动进入动画
     */
    function ensureVisibleAnimations(root) {
        const items = Array.from(root.querySelectorAll('.ann-item'));
        if (items.length === 0) return;

        // 顶/底部特殊项直接可见
        items.forEach((it) => {
            if (it.classList.contains('ann-item--top') || it.classList.contains('ann-item--bottom')) {
                it.classList.add('is-visible');
            }
        });

        if (!('IntersectionObserver' in window)) {
            items.forEach((it) => it.classList.add('is-visible'));
            return;
        }

        const obs = new IntersectionObserver(
            (entries) => {
                entries.forEach((en) => {
                    try {
                        const el = en.target;
                        if (el.classList.contains('ann-item--top') || el.classList.contains('ann-item--bottom')) return;
                        if (en.isIntersecting) {
                            el.classList.add('is-visible');
                        } else {
                            el.classList.remove('is-visible');
                        }
                    } catch (_) { /* ignore */ }
                });
            },
            { threshold: INTERSECTION_THRESHOLD }
        );

        items.forEach((it) => {
            if (it.classList.contains('ann-item--top') || it.classList.contains('ann-item--bottom')) return;
            obs.observe(it);
        });
    }

    /**
     * 渲染公告时间轴
     */
    function renderTimeline(list) {
        const timeline = document.getElementById('announcementsTimeline');
        const empty = document.getElementById('announcementsEmpty');
        if (!timeline) return;

        const arr = Array.isArray(list) ? list.slice() : [];
        arr.sort(sortAnnouncements);

        if (arr.length === 0) {
            if (empty) empty.style.display = '';
            timeline.innerHTML = '';
            return;
        }

        if (empty) empty.style.display = 'none';
        timeline.innerHTML = '';

        const mobileLayout = isMobileTimeline();

        arr.forEach((a, idx) => {
            const msg = a?.message ? String(a.message) : '';
            const date = a?.date ? String(a.date) : '';
            if (!msg) return;

            const messageRender = renderMessageHtml(msg);
            const dateHtml = `<span class="date" data-date="${escapeHtml(date)}"></span>`;

            // ---- 移动端布局 ----
            if (mobileLayout) {
                const item = document.createElement('div');
                item.className = 'ann-item ann-item--mobile is-visible';
                item.innerHTML = `
                    <div class="ann-mid">
                        <div class="ann-dot" aria-hidden="true"></div>
                        <div class="ann-time">${dateHtml}</div>
                    </div>
                    <div class="ann-card">
                        <div class="${messageRender.className}">${messageRender.html}</div>
                    </div>
                `;
                timeline.appendChild(item);
                return;
            }

            // ---- 桌面端布局 ----
            // 顶部（最新公告）
            if (idx === 0) {
                const item = document.createElement('div');
                item.className = 'ann-item ann-item--top is-visible';
                item.innerHTML = `
                    <div class="ann-mid">
                        <div class="ann-dot" aria-hidden="true"></div>
                        <div class="ann-time">${dateHtml}</div>
                    </div>
                    <div class="ann-card">
                        <div class="${messageRender.className}">${messageRender.html}</div>
                    </div>
                `;
                timeline.appendChild(item);
                return;
            }

            // 底部（最旧公告）
            if (idx === arr.length - 1) {
                const item = document.createElement('div');
                item.className = 'ann-item ann-item--bottom is-visible';
                item.innerHTML = `
                    <div class="ann-mid">
                        <div class="ann-dot" aria-hidden="true"></div>
                        <div class="ann-time">${dateHtml}</div>
                    </div>
                    <div class="ann-card">
                        <div class="${messageRender.className}">${messageRender.html}</div>
                    </div>
                `;
                timeline.appendChild(item);
                return;
            }

            // 中间项：左右交替
            const side = idx % 2 === 1 ? 'left' : 'right';
            const item = document.createElement('div');
            item.className = `ann-item ann-item--${side}`;

            if (side === 'left') {
                item.innerHTML = `
                    <div class="ann-card"><div class="${messageRender.className}">${messageRender.html}</div></div>
                    <div class="ann-mid">
                        <div class="ann-dot" aria-hidden="true"></div>
                        <div class="ann-time">${dateHtml}</div>
                    </div>
                    <div class="ann-spacer" aria-hidden="true"></div>
                `;
            } else {
                item.innerHTML = `
                    <div class="ann-spacer" aria-hidden="true"></div>
                    <div class="ann-mid">
                        <div class="ann-dot" aria-hidden="true"></div>
                        <div class="ann-time">${dateHtml}</div>
                    </div>
                    <div class="ann-card"><div class="${messageRender.className}">${messageRender.html}</div></div>
                `;
            }

            timeline.appendChild(item);
        });

        // ---- 后处理 ----
        // 应用国际化
        try {
            if (window.siteI18n?.applyTo) {
                window.siteI18n.applyTo(timeline);
            }
        } catch (_) { /* ignore */ }

        // 格式化日期
        try {
            timeline.querySelectorAll('.date[data-date]').forEach((el) => {
                const d = el.getAttribute('data-date');
                if (d) el.textContent = formatDate(d);
            });
        } catch (_) { /* ignore */ }

        // 触发进入动画
        ensureVisibleAnimations(timeline);
    }

    // ==================== 响应式重绘 ====================

    function initResizeHandler() {
        let lastMobileState = isMobileTimeline();

        function rerenderOnBreakpointChange() {
            const currentMobileState = isMobileTimeline();
            if (currentMobileState === lastMobileState) return;
            lastMobileState = currentMobileState;
            renderTimeline(announcementsCache);
        }

        window.addEventListener('resize', rerenderOnBreakpointChange, { passive: true });
    }

    // ==================== 语言切换更新 ====================

    document.addEventListener('site:languageChanged', () => {
        renderTimeline(announcementsCache);
    });

    // ==================== 初始化 ====================

    document.addEventListener('DOMContentLoaded', () => {
        initResizeHandler();

        fetch('data/announcements.json')
            .then((r) => r.json())
            .then((data) => {
                announcementsCache = Array.isArray(data) ? data : [];
                renderTimeline(announcementsCache);
            })
            .catch(() => {
                announcementsCache = [];
                renderTimeline([]);
            });
    });
})();