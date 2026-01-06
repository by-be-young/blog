(function () {
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function sortAnnouncements(a, b) {
        const da = new Date(a && a.date ? a.date : 0).getTime();
        const db = new Date(b && b.date ? b.date : 0).getTime();
        if (db !== da) return db - da;
        const ia = Number(a && a.id ? a.id : 0);
        const ib = Number(b && b.id ? b.id : 0);
        return ib - ia;
    }

    function ensureVisibleAnimations(root) {
        const items = Array.from(root.querySelectorAll('.ann-item'));
        if (items.length === 0) return;

        if (!('IntersectionObserver' in window)) {
            items.forEach(it => it.classList.add('is-visible'));
            return;
        }

        const obs = new IntersectionObserver((entries) => {
            entries.forEach(en => {
                if (en.isIntersecting) {
                    en.target.classList.add('is-visible');
                    obs.unobserve(en.target);
                }
            });
        }, { threshold: 0.12 });

        items.forEach(it => obs.observe(it));
    }

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

        arr.forEach((a, idx) => {
            const msg = a && a.message ? String(a.message) : '';
            const date = a && a.date ? String(a.date) : '';
            if (!msg) return;

            if (idx === 0) {
                const item = document.createElement('div');
                item.className = 'ann-item ann-item--top';
                item.innerHTML = `
                    <div class="ann-mid">
                        <div class="ann-dot" aria-hidden="true"></div>
                        <div class="ann-time"><span class="date" data-date="${escapeHtml(date)}"></span></div>
                    </div>
                    <div class="ann-card">
                        <div class="ann-message">${escapeHtml(msg)}</div>
                    </div>
                `;
                timeline.appendChild(item);
                return;
            }

            const side = (idx % 2 === 1) ? 'left' : 'right';
            const item = document.createElement('div');
            item.className = `ann-item ann-item--${side}`;
            if (side === 'left') {
                item.innerHTML = `
                    <div class="ann-card"><div class="ann-message">${escapeHtml(msg)}</div></div>
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
                    <div class="ann-card"><div class="ann-message">${escapeHtml(msg)}</div></div>
                `;
            }
            timeline.appendChild(item);
        });

        // apply i18n & date formatting
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

    document.addEventListener('DOMContentLoaded', function () {
        fetch('data/announcements.json')
            .then(r => r.json())
            .then(renderTimeline)
            .catch(() => renderTimeline([]));
    });
})();
