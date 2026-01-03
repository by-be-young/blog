// about.js - load localized about markdown and initialize profile counts
(function () {
    function loadMarkdownForLang(lang) {
        const candidates = [
            `data/about.${lang}.md`,
            `data/about.${lang}.markdown`,
            `data/about.md.${lang}`,
            `data/about.md`
        ];
        // try candidates sequentially
        return candidates.reduce((p, path) => {
            return p.then(found => {
                if (found) return Promise.resolve(found);
                return fetch(path, { cache: 'no-store' }).then(res => {
                    if (res.ok) return res.text().then(txt => ({ path, text: txt }));
                    return null;
                }).catch(() => null);
            });
        }, Promise.resolve(null));
    }

    function initProfileCounts() {
        // count articles and tags from data/blogs.json
        fetch('data/blogs.json').then(r => r.json()).then(blogs => {
            try {
                const articleCount = Array.isArray(blogs) ? blogs.length : 0;
                const tags = new Set();
                (blogs || []).forEach(b => { if (Array.isArray(b.tags)) b.tags.forEach(t => tags.add(t)); });
                const tagCount = tags.size;
                const acEls = document.querySelectorAll('#article-count--about, #article-count');
                acEls.forEach(el => el.textContent = String(articleCount));
                const tcEls = document.querySelectorAll('#tag-count--about, #tag-count');
                tcEls.forEach(el => el.textContent = String(tagCount));
            } catch (e) { /* ignore */ }
        }).catch(() => { });
    }

    document.addEventListener('DOMContentLoaded', function () {
        const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'ja';
        loadMarkdownForLang(lang).then(found => {
            const mdEl = document.getElementById('markdown-content');
            if (!mdEl) return;
            if (found && found.text) {
                // set source path for asset URL rewriting
                window.__mdSourcePath = found.path || '';
                mdEl.textContent = found.text;
            } else {
                // fallback message localized via i18n
                mdEl.textContent = '';
            }
            // render markdown (markdown.js)
            try { renderMarkdownContent(); } catch (e) { /* ignore */ }
        });

        // ensure i18n applies to dynamic content when language changes
        document.addEventListener('site:languageChanged', function () {
            const lang2 = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'ja';
            loadMarkdownForLang(lang2).then(found => {
                const mdEl = document.getElementById('markdown-content');
                if (!mdEl) return;
                if (found && found.text) {
                    window.__mdSourcePath = found.path || '';
                    mdEl.textContent = found.text;
                }
                try { renderMarkdownContent(); } catch (e) { }
            });
        });

        initProfileCounts();
    });
})();
