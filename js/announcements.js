// js/announcements.js - 用于加载和显示公告时间轴
(function () {
    const MOBILE_TIMELINE_QUERY = '(max-width: 880px)';
    let announcementsCache = [];

    function isMobileTimeline() {
        try {
            return window.matchMedia(MOBILE_TIMELINE_QUERY).matches;
        } catch (e) {
            return window.innerWidth <= 880;
        }
    }

    // 简单的 HTML 转义函数
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // 将公告文本按行转为结构化 HTML，便于首行与章节行定制样式
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

    // 公告排序函数：按日期降序排列，日期相同则按 ID 降序排列
    function sortAnnouncements(a, b) {
        const da = new Date(a && a.date ? a.date : 0).getTime();
        const db = new Date(b && b.date ? b.date : 0).getTime();
        if (db !== da) return db - da;
        const ia = Number(a && a.id ? a.id : 0);
        const ib = Number(b && b.id ? b.id : 0);
        return ib - ia;
    }

    // 确保动画在元素进入视口时触发
    function ensureVisibleAnimations(root) {
        const items = Array.from(root.querySelectorAll('.ann-item'));
        if (items.length === 0) return;

        if (!('IntersectionObserver' in window)) {
            items.forEach(it => it.classList.add('is-visible'));
            return;
        }
        // 使用 IntersectionObserver 监听可见性变化
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(en => {
                try {
                    const el = en.target;
                    if (el.classList.contains('ann-item--top') || el.classList.contains('ann-item--bottom')) return;
                    if (en.isIntersecting) el.classList.add('is-visible');
                    else el.classList.remove('is-visible');
                } catch (e) { }
            });
        }, { threshold: 0.12 });

        items.forEach(it => {
            if (it.classList.contains('ann-item--top') || it.classList.contains('ann-item--bottom')) return;
            obs.observe(it);
        });
    }

    // 渲染公告时间轴
    function renderTimeline(list) {
        const timeline = document.getElementById('announcementsTimeline');
        const empty = document.getElementById('announcementsEmpty');
        if (!timeline) return;

        const arr = Array.isArray(list) ? list.slice() : [];
        arr.sort(sortAnnouncements);

        if (arr.length === 0) {
            if (empty) empty.style.display = '';
            return;
        }

        if (empty) empty.style.display = 'none';
        timeline.innerHTML = '';

        const mobileLayout = isMobileTimeline();

        arr.forEach((a, idx) => {
            const msg = a && a.message ? String(a.message) : '';
            const date = a && a.date ? String(a.date) : '';
            if (!msg) return;
            const messageRender = renderMessageHtml(msg);

            if (mobileLayout) {
                const item = document.createElement('div');
                item.className = 'ann-item ann-item--mobile';
                item.innerHTML = `
                    <div class="ann-mid">
                        <div class="ann-dot" aria-hidden="true"></div>
                        <div class="ann-time"><span class="date" data-date="${escapeHtml(date)}"></span></div>
                    </div>
                    <div class="ann-card">
                        <div class="${messageRender.className}">${messageRender.html}</div>
                    </div>
                `;
                item.classList.add('is-visible');
                timeline.appendChild(item);
                return;
            }

            // 顶部的特殊处理
            if (idx === 0) {
                const item = document.createElement('div');
                item.className = 'ann-item ann-item--top';
                item.innerHTML = `
                    <div class="ann-mid">
                        <div class="ann-dot" aria-hidden="true"></div>
                        <div class="ann-time"><span class="date" data-date="${escapeHtml(date)}"></span></div>
                    </div>
                    <div class="ann-card">
                        <div class="${messageRender.className}">${messageRender.html}</div>
                    </div>
                `;
                item.classList.add('is-visible');
                timeline.appendChild(item);
                return;
            }
            // 底部特殊处理
            if (idx === arr.length - 1) {
                const item = document.createElement('div');
                item.className = 'ann-item ann-item--bottom';
                item.innerHTML = `
                    <div class="ann-mid">
                        <div class="ann-dot" aria-hidden="true"></div>
                        <div class="ann-time"><span class="date" data-date="${escapeHtml(date)}"></span></div>
                    </div>
                    <div class="ann-card">
                        <div class="${messageRender.className}">${messageRender.html}</div>
                    </div>
                `;
                item.classList.add('is-visible');
                timeline.appendChild(item);
                return;
            }
            // 左右交替显示
            const side = (idx % 2 === 1) ? 'left' : 'right';
            const item = document.createElement('div');
            item.className = `ann-item ann-item--${side}`;
            if (side === 'left') {
                item.innerHTML = `
                    <div class="ann-card"><div class="${messageRender.className}">${messageRender.html}</div></div>
                    <div class="ann-mid">
                        <div class="ann-dot" aria-hidden="true"></div>
                        <div class="ann-time"><span class="date" data-date="${escapeHtml(date)}"></span></div>
                    </div>
                    <div class="ann-spacer" aria-hidden="true"></div>
                `;
            } else {
                item.innerHTML = `
                    <div class="ann-spacer" aria-hidden="true"></div>
                    <div class="ann-mid">
                        <div class="ann-dot" aria-hidden="true"></div>
                        <div class="ann-time"><span class="date" data-date="${escapeHtml(date)}"></span></div>
                    </div>
                    <div class="ann-card"><div class="${messageRender.className}">${messageRender.html}</div></div>
                `;
            }
            timeline.appendChild(item);
        });

        // 应用国际化和日期格式化
        try { if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') window.siteI18n.applyTo(timeline); } catch (e) { }
        try {
            if (typeof window.formatDate === 'function') {
                timeline.querySelectorAll('.date[data-date]').forEach(el => {
                    const d = el.getAttribute('data-date');
                    if (d) el.textContent = window.formatDate(d);
                });
            }
        } catch (e) { }

        ensureVisibleAnimations(timeline);
    }
    // 主逻辑
    document.addEventListener('DOMContentLoaded', function () {
        let lastMobileState = isMobileTimeline();

        function rerenderOnBreakpointChange() {
            const currentMobileState = isMobileTimeline();
            if (currentMobileState === lastMobileState) return;
            lastMobileState = currentMobileState;
            renderTimeline(announcementsCache);
        }

        window.addEventListener('resize', rerenderOnBreakpointChange, { passive: true });

        fetch('data/announcements.json')
            .then(r => r.json())
            .then(data => {
                announcementsCache = Array.isArray(data) ? data : [];
                renderTimeline(announcementsCache);
            })
            .catch(() => {
                announcementsCache = [];
                renderTimeline([]);
            });
    });
})();
