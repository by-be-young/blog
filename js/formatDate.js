(function () {
    // 如果页面已提供 formatDate（如 main.js），则不覆盖
    if (typeof window.formatDate === 'function') return;

    function formatDateImpl(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        try {
            const lang = window.siteI18n && typeof window.siteI18n.getLang === 'function' ? window.siteI18n.getLang() : 'zh';
            if (lang === 'en') {
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            } else if (lang === 'ja') {
                const y = date.getFullYear();
                const m = date.getMonth() + 1;
                const d = date.getDate();
                let era = '';
                if (y >= 2019) {
                    const reiwa = y - 2018;
                    era = reiwa === 1 ? '（令和元年）' : `（令和${reiwa}年）`;
                }
                return `${y}年${m}月${d}日 ${era}`;
            } else {
                return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
            }
        } catch (e) {
            return date.toLocaleDateString();
        }
    }

    function updateDates() {
        try {
            document.querySelectorAll('.date[data-date], .result-date[data-date]').forEach(el => {
                const d = el.getAttribute('data-date');
                if (d) el.textContent = formatDateImpl(d);
            });
        } catch (e) { /* noop */ }
    }

    window.formatDate = formatDateImpl;

    document.addEventListener('site:languageChanged', function () {
        try { updateDates(); } catch (e) { }
    });
    document.addEventListener('DOMContentLoaded', function () {
        try { updateDates(); } catch (e) { }
    });
})();
