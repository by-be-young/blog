// about.js - 能够根据语言加载对应的 about 页面 Markdown 内容
(function () {
    // 为指定语言加载 about 页面 Markdown 内容
    function loadMarkdownForLang(lang) {
        const candidates = [
            `data/about.${lang}.md`,
            `data/about.${lang}.markdown`,
            `data/about.md.${lang}`,
            `data/about.md`
        ];
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

    // 初始化个人资料中的文章数和标签数
    function initProfileCounts() {
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
            } catch (e) { }
        }).catch(() => { });
    }

    // 主逻辑
    document.addEventListener('DOMContentLoaded', function () {
        // 初始加载
        const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'ja';
        // 加载对应语言的 about Markdown 内容
        loadMarkdownForLang(lang).then(found => {
            const mdEl = document.getElementById('markdown-content');
            if (!mdEl) return;
            if (found && found.text) {
                window.__mdSourcePath = found.path || '';
                mdEl.textContent = found.text;
            } else {
                mdEl.textContent = '';
            }
            try { renderMarkdownContent(); } catch (e) { /* ignore */ }
        });

        // 监听语言切换事件
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
        // 初始化个人资料中的文章数和标签数
        initProfileCounts();
    });
})();
