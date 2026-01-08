(function () {
    // 简单的搜索面板与逻辑（全站与详情页两种模式）
    let blogsCache = null;

    function createPanel() {
        if (document.querySelector('.search-panel')) return;
        const isDetail = document.body.classList.contains('blog-detail-page');
        const panel = document.createElement('div');
        panel.className = 'search-panel' + (isDetail ? ' right-sidebar' : '');
        panel.innerHTML = `
            <div class="search-wrap" role="dialog" aria-label="site-search">
                <div class="search-row">
                    <div class="search-input">
                        <input type="search" placeholder="" data-i18n="search_placeholder" aria-label="搜索输入" id="global-search-input">
                    </div>
                    <div class="search-actions">
                        <button class="search-close-btn" id="search-close" data-i18n="search_close"></button>
                    </div>
                </div>
                <div class="search-results" id="search-results" role="list"></div>
            </div>
        `;
        document.body.appendChild(panel);

        // Apply i18n to newly created panel so placeholders/titles are correct immediately
        try { if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') window.siteI18n.applyTo(panel); } catch (e) { }
        // Ensure any date displays or i18n-sensitive fragments inside the panel are formatted
        try { if (typeof updateSearchPanelI18n === 'function') updateSearchPanelI18n(); } catch (e) { }

        // close
        panel.querySelector('#search-close').addEventListener('click', () => { hidePanel(); });

        // input events: realtime with debounce + enter to confirm
        const input = panel.querySelector('#global-search-input');
        const debounced = debounce((val) => {
            const v = (val || '').trim();
            if (v.length > 0) doSearch(v);
            else {
                const resultsEl = panel.querySelector('#search-results'); if (resultsEl) resultsEl.innerHTML = '';
            }
        }, 220);
        input.addEventListener('input', (e) => { debounced(e.target.value); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSearch(input.value.trim());
        });
    }

    function showPanel() {
        createPanel();
        const panel = document.querySelector('.search-panel');
        const nav = document.querySelector('.navbar');
        const top = nav ? nav.offsetHeight : 60;
        // reset input and results when opening
        const input = panel.querySelector('#global-search-input');
        const resultsEl = panel.querySelector('#search-results');
        if (input) {
            input.value = '';
        }
        if (resultsEl) resultsEl.innerHTML = '';
        // clear any existing highlights in detail page
        try {
            if (document.body.classList.contains('blog-detail-page')) {
                const content = document.getElementById('markdown-content');
                if (content) clearHighlights(content);
            }
        } catch (e) { }

        // position differently if right-sidebar
        if (panel.classList.contains('right-sidebar')) {
            // align top with the left TOC top where possible, leave a small gap
            let desiredTop = top + 12; // base gap below navbar
            try {
                const toc = document.querySelector('.blog-toc');
                if (toc) {
                    const tocTop = toc.getBoundingClientRect().top; // relative to viewport
                    // use the larger of tocTop and base gap to avoid overlap
                    if (typeof tocTop === 'number' && !isNaN(tocTop)) desiredTop = Math.max(desiredTop, Math.round(tocTop));
                }
            } catch (e) { }

            panel.style.top = desiredTop + 'px';
            panel.style.right = '18px';
            panel.style.left = 'auto';
            panel.style.height = `calc(100vh - ${desiredTop}px - 18px)`;
            panel.style.width = '360px';
            // add body class so main content can shift left to avoid overlap
            try { document.body.classList.add('search-sidebar-open'); } catch (e) { }
        } else {
            panel.style.top = top + 'px';
            // ensure popup doesn't have lingering right/height
            panel.style.right = '';
            panel.style.left = '';
            panel.style.height = '';
            panel.style.width = '';
        }

        panel.classList.add('active');
        // bring panel to front when shown
        try { if (typeof window.__bringToFront === 'function') window.__bringToFront(panel); } catch (e) { }
        // focus input
        if (input) input.focus();
    }

    function hidePanel() {
        const panel = document.querySelector('.search-panel');
        if (!panel) return;
        panel.classList.remove('active');
        // remove body class if present
        try { document.body.classList.remove('search-sidebar-open'); } catch (e) { }
        // 如果在文章详情页，关闭面板时清除正文中的高亮
        try {
            if (document.body.classList.contains('blog-detail-page')) {
                const content = document.getElementById('markdown-content');
                if (content) clearHighlights(content);
            }
        } catch (e) {
            // ignore
        }
    }

    function getQueryParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    function doSearch(keyword) {
        const panel = document.querySelector('.search-panel');
        if (!panel) return;
        const resultsEl = panel.querySelector('#search-results');
        resultsEl.innerHTML = '';
        if (!keyword) return;
        // If on blog-detail page => do local article search
        if (document.body.classList.contains('blog-detail-page')) {
            doDetailSearch(keyword, resultsEl);
            return;
        }
        // Global search across blogs.json
        ensureBlogsLoaded().then(blogList => {
            const q = keyword.toLowerCase();
            const results = [];
            blogList.forEach(b => {
                let score = 0;
                const t = (b.title || '').toLowerCase();
                const ex = (b.excerpt || '').toLowerCase();
                const tags = Array.isArray(b.tags) ? b.tags.join(' ').toLowerCase() : '';
                if (t.includes(q)) score += 10;
                if (ex.includes(q)) score += 6;
                if (tags.includes(q)) score += 8;
                if (score > 0) results.push({ blog: b, score, source: determineMatchSource(b, q) });
            });
            results.sort((a, b) => b.score - a.score);
            if (results.length === 0) {
                const no = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[window.siteI18n.getLang()] || {}).search_no_results : '未找到匹配结果';
                resultsEl.innerHTML = `<div class="search-item">${no}</div>`;
                return;
            }
            results.forEach(r => {
                const div = document.createElement('div');
                div.className = 'search-item';
                const title = document.createElement('div'); title.className = 'title';
                title.textContent = r.blog.title || '';
                if (r.blog.type) {
                    const tspan = document.createElement('span');
                    tspan.className = 'blog-type';
                    tspan.textContent = r.blog.type;
                    // keep title and type inline
                    title.appendChild(tspan);
                }
                const meta = document.createElement('div'); meta.className = 'meta';
                // date span (language-aware formatting via window.formatDate)
                const dateSpan = document.createElement('span');
                // 标记为 result-date（搜索面板专用）并同时保留通用的 date 类，
                // 以便 main.js 的 updateDates() 在语言切换时也能刷新它们。
                dateSpan.className = 'result-date date';
                if (r.blog.date) dateSpan.setAttribute('data-date', r.blog.date);
                try {
                    dateSpan.textContent = (typeof window.formatDate === 'function' ? window.formatDate(r.blog.date) : (r.blog.date || ''));
                } catch (e) { dateSpan.textContent = (r.blog.date || ''); }
                meta.appendChild(dateSpan);
                if (r.blog.tags && r.blog.tags.length) {
                    const tagsDiv = document.createElement('div'); tagsDiv.className = 'meta-tags'; tagsDiv.textContent = ' • ' + r.blog.tags.join(', ');
                    meta.appendChild(tagsDiv);
                }
                const snippet = document.createElement('div'); snippet.className = 'snippet'; snippet.textContent = r.blog.excerpt || '';
                div.appendChild(title); div.appendChild(meta); div.appendChild(snippet);
                div.addEventListener('click', () => {
                    // navigate to blog-detail with q param so target page can highlight
                    const url = `blog-detail.html?id=${r.blog.id}&q=${encodeURIComponent(keyword)}`;
                    const w = window.open(url, '_blank', 'noopener,noreferrer');
                    try { if (w) w.opener = null; } catch (e) { /* ignore */ }
                });
                resultsEl.appendChild(div);
            });
        });
    }

    // simple debounce util
    function debounce(fn, wait) {
        let t = null;
        return function () {
            const args = arguments;
            clearTimeout(t);
            t = setTimeout(() => { fn.apply(null, args); }, wait);
        };
        // ensure any visible dates/titles respond to current language
        try { if (document.querySelector('.search-panel')) updateSearchPanelI18n(); } catch (e) { }
    }

    function determineMatchSource(b, q) {
        const t = (b.title || '').toLowerCase();
        const ex = (b.excerpt || '').toLowerCase();
        const tags = Array.isArray(b.tags) ? b.tags.join(' ').toLowerCase() : '';
        if (t.includes(q)) return 'title';
        if (tags.includes(q)) return 'tag';
        if (ex.includes(q)) return 'excerpt';
        return 'body';
    }

    function ensureBlogsLoaded() {
        if (blogsCache) return Promise.resolve(blogsCache);
        return fetch('data/blogs.json').then(r => r.json()).then(data => { blogsCache = data; return data; }).catch(() => []);
    }

    // Detail page search: search within rendered markdown content
    function doDetailSearch(keyword, resultsEl) {
        const contentEl = document.getElementById('markdown-content');
        if (!contentEl) return;
        // remove old highlights
        clearHighlights(contentEl);
        const q = keyword;
        const matches = highlightQueryInElement(contentEl, q);
        if (!matches || matches.length === 0) {
            const map = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[window.siteI18n.getLang()] || {}) : {};
            const noDetail = map.search_no_results_detail || '未在本文中找到匹配';
            resultsEl.innerHTML = '<div class="search-item">' + noDetail + '</div>';
            return;
        }
        // helper: escape html
        function escapeHtml(s) {
            return String(s).replace(/[&<>\"]/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
            });
        }

        function makeSnippetForMatch(el, radius) {
            radius = typeof radius === 'number' ? radius : 60;
            const matchText = (el.textContent || '').trim();
            const parent = el.parentElement;
            try {
                if (parent) {
                    const clone = parent.cloneNode(true);
                    // replace common KaTeX/math nodes with a placeholder so snippets show 【公式】
                    const mathNodes = clone.querySelectorAll('.katex, .katex-display, script[type^="math"], .math');
                    mathNodes.forEach(n => {
                        try {
                            if (n.parentNode) n.parentNode.replaceChild(document.createTextNode('【公式】'), n);
                        } catch (e) { /* ignore */ }
                    });
                    // Prefer using recorded parent text/index when available to pinpoint the exact occurrence.
                    const recordedParentText = (el.dataset.parentText || (parent.textContent || '')).trim();
                    const cleaned = recordedParentText;
                    const lowerClean = cleaned.toLowerCase();
                    const matchLower = matchText.toLowerCase();

                    let idx = -1;
                    const dataIdx = parseInt(el.dataset.parentIndex || '-1', 10);
                    // collect all occurrence positions of matchLower in lowerClean
                    const positions = [];
                    if (matchLower.length > 0) {
                        let p = lowerClean.indexOf(matchLower, 0);
                        while (p !== -1) {
                            positions.push(p);
                            p = lowerClean.indexOf(matchLower, p + 1);
                        }
                    }
                    if (positions.length === 0) {
                        idx = -1;
                    } else {
                        // prefer using recorded occurrence index when available
                        const occ = parseInt(el.dataset.occurrence || '-1', 10);
                        if (!isNaN(occ) && occ >= 0 && occ < positions.length) {
                            idx = positions[occ];
                        } else if (!isNaN(dataIdx) && dataIdx >= 0) {
                            // choose the occurrence whose index is closest to recorded dataIdx
                            let best = positions[0];
                            let bestDist = Math.abs(best - dataIdx);
                            for (let i = 1; i < positions.length; i++) {
                                const d = Math.abs(positions[i] - dataIdx);
                                if (d < bestDist) { bestDist = d; best = positions[i]; }
                            }
                            idx = best;
                        } else {
                            idx = positions[0];
                        }
                    }

                    if (idx === -1) {
                        // fallback to using the element's own text
                        const txt = (el.textContent || '').trim();
                        const snippet = txt.slice(0, radius * 2);
                        return escapeHtml(snippet);
                    }

                    const start = Math.max(0, idx - radius);
                    const end = Math.min(cleaned.length, idx + matchText.length + radius);
                    let before = cleaned.slice(start, idx);
                    let match = cleaned.slice(idx, idx + matchText.length);
                    let after = cleaned.slice(idx + matchText.length, end);
                    let out = '';
                    if (start > 0) out += '...';
                    out += escapeHtml(before) + '<span class="match-highlight">' + escapeHtml(match) + '</span>' + escapeHtml(after);
                    if (end < cleaned.length) out += '...';
                    return out;
                }
            } catch (e) {
                // ignore and fallback
            }
            // ultimate fallback
            const fallbackTxt = (el.textContent || '').trim();
            return escapeHtml(fallbackTxt.slice(0, radius * 2));
        }

        matches.forEach((el, idx) => {
            const div = document.createElement('div');
            div.className = 'search-item';
            const title = document.createElement('div'); title.className = 'title';
            // mark this title as a detail-match so we can update its label on language change
            title.dataset.matchIndex = String(idx + 1);
            const map = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[window.siteI18n.getLang()] || {}) : {};
            const matchLabel = (map.match_label || '匹配 {n}').replace('{n}', String(idx + 1));
            title.textContent = matchLabel;
            const snippet = document.createElement('div'); snippet.className = 'snippet';
            snippet.innerHTML = makeSnippetForMatch(el, 80);
            div.appendChild(title); div.appendChild(snippet);
            div.addEventListener('click', () => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // flash
                el.classList.add('active-match');
                setTimeout(() => el.classList.remove('active-match'), 800);
            });
            resultsEl.appendChild(div);
        });
    }

    // Update search panel i18n-sensitive parts when language changes
    function updateSearchPanelI18n() {
        try {
            // update result dates
            document.querySelectorAll('.result-date[data-date]').forEach(el => {
                const d = el.getAttribute('data-date');
                if (!d) return;
                try {
                    el.textContent = (typeof window.formatDate === 'function') ? window.formatDate(d) : d;
                } catch (e) { el.textContent = d; }
            });
            // update detail-match titles
            document.querySelectorAll('.search-item .title[data-match-index]').forEach(el => {
                const idx = el.getAttribute('data-match-index');
                if (!idx) return;
                const map = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[window.siteI18n.getLang()] || {}) : {};
                el.textContent = (map.match_label || '匹配 {n}').replace('{n}', String(idx));
            });
            // also apply translations to any elements inside the search panel (placeholders, buttons)
            try {
                const panel = document.querySelector('.search-panel');
                if (panel && window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
                    window.siteI18n.applyTo(panel);
                }
                // If the results area currently shows the no-results message, update its text as well
                const resultsEl = document.getElementById('search-results');
                if (resultsEl && resultsEl.children.length === 1) {
                    const first = resultsEl.children[0];
                    // if it's a plain no-result item (no .title inside), update text
                    if (!first.querySelector('.title')) {
                        const map = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[window.siteI18n.getLang()] || {}) : {};
                        const noDetail = map.search_no_results_detail || '未在本文中找到匹配';
                        first.textContent = noDetail;
                    }
                }
            } catch (e) { }
        } catch (e) { }
    }

    // react to language changes
    if (!window.__searchI18nBound) {
        window.__searchI18nBound = true;
        document.addEventListener('site:languageChanged', updateSearchPanelI18n);
    }

    function clearHighlights(root) {
        const spans = Array.from(root.querySelectorAll('span.search-match'));
        spans.forEach(s => {
            const parent = s.parentNode;
            parent.replaceChild(document.createTextNode(s.textContent), s);
            parent.normalize();
        });
    }

    function highlightQueryInElement(root, query) {
        if (!query) return [];
        const q = query.replace(/[.*+?^${}()|[\]\\]/g, '');
        const re = new RegExp(q, 'ig');
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        const created = [];
        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            // include all text nodes (including whitespace-only) to keep accurate offsets
            textNodes.push(node);
        }
        // keep track of cumulative character offset of processed text nodes per code-block root
        const blockOffsets = new WeakMap();
        textNodes.forEach(tn => {
            const parent = tn.parentNode;
            if (!parent) return;
            // Determine the block root (prefer nearest <pre>, otherwise nearest <code>, otherwise the immediate parent)
            const blockRoot = parent.closest && (parent.closest('pre') || parent.closest('code')) || parent;
            // Allow matching inside code blocks and inline code so code content is searchable
            const val = tn.nodeValue;
            const blockText = (blockRoot && blockRoot.textContent) ? blockRoot.textContent : (parent.textContent || '');
            const offset = blockOffsets.get(blockRoot) || 0; // number of chars before this text node in blockRoot
            // ensure regex starts from beginning for each text node
            re.lastIndex = 0;
            let match;
            let lastIndex = 0;
            const frag = document.createDocumentFragment();
            let found = false;
            while ((match = re.exec(val)) !== null) {
                found = true;
                const before = val.slice(lastIndex, match.index);
                if (before) frag.appendChild(document.createTextNode(before));
                const span = document.createElement('span');
                span.className = 'search-match match-highlight';
                span.textContent = match[0];
                span.setAttribute('tabindex', '-1');
                // compute absolute index of this match within blockRoot's full text using node offset + local index
                const absIdx = offset + match.index;
                span.dataset.parentIndex = String(absIdx);
                span.dataset.parentText = blockText;
                frag.appendChild(span);
                created.push(span);
                lastIndex = match.index + match[0].length;
            }
            if (found) {
                const after = val.slice(lastIndex);
                if (after) frag.appendChild(document.createTextNode(after));
                parent.replaceChild(frag, tn);
            }
            // update offset: this text node contributes its length to subsequent nodes in same blockRoot
            blockOffsets.set(blockRoot, offset + val.length);
        });
        return created;
    }

    // Handle nav search button clicks
    function bindNavButtons() {
        document.querySelectorAll('.nav-search-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const panel = document.querySelector('.search-panel');
                if (panel && panel.classList.contains('active')) {
                    hidePanel();
                } else {
                    showPanel();
                    // ensure search panel appears above language dropdown, etc.
                    try { if (typeof window.__bringToFront === 'function') window.__bringToFront(panel); } catch (e) { }
                }
            });
        });
    }

    // bring panel to front when user interacts with it
    document.addEventListener('mousedown', (e) => {
        const panel = document.querySelector('.search-panel');
        if (!panel) return;
        if (panel.contains(e.target)) {
            try { if (typeof window.__bringToFront === 'function') window.__bringToFront(panel); } catch (err) { }
        }
    });

    // On blog-detail page: if ?q=keyword present, highlight after markdown render
    function tryApplyQueryFromUrl() {
        const q = getQueryParam('q');
        if (!q) return;
        // Wait until content rendered (markdown.js triggers render on DOMContentLoaded)
        const tryRun = () => {
            const content = document.getElementById('markdown-content');
            if (content && content.children.length > 0) {
                // highlight and scroll to first match
                const matches = highlightQueryInElement(content, q);
                if (matches && matches.length > 0) {
                    matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                return true;
            }
            return false;
        };
        // Try immediately or poll a few times
        if (!tryRun()) {
            let attempts = 0;
            const id = setInterval(() => {
                attempts++;
                if (tryRun() || attempts > 10) clearInterval(id);
            }, 200);
        }
    }

    // init on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
        bindNavButtons();
        createPanel();
        // If on detail page and q param present, apply
        if (document.body.classList.contains('blog-detail-page')) {
            tryApplyQueryFromUrl();
        }

        // close panel on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hidePanel();
        });

        // click outside to close (but not when clicking inside panel)
        document.addEventListener('click', (e) => {
            const panel = document.querySelector('.search-panel');
            const btn = e.target.closest('.nav-search-btn');
            if (btn) return; // handled by button
            if (!panel) return;
            if (!panel.contains(e.target)) {
                // do not close when clicking on navbar
                if (e.target.closest('.navbar')) return;
                hidePanel();
            }
        });
    });
})();
