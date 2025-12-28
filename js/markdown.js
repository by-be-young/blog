// 使用 marked.js 进行 Markdown 解析
// 需在 HTML 中引入 marked.js：https://cdn.jsdelivr.net/npm/marked/marked.min.js

function stripFrontMatter(markdown) {
    if (typeof markdown !== 'string' || !markdown) return '';
    const text = markdown.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return text;

    // 仅当文件第一行就是 --- 时，按 front matter 处理
    if (lines[0].trim() !== '---') return text;

    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            // 去掉 front matter 块（含结束分隔符），并顺便吃掉紧随其后的一个空行
            const rest = lines.slice(i + 1).join('\n');
            return rest.replace(/^\s*\n/, '');
        }
    }

    // 没找到结束分隔符则不处理
    return text;
}

function getSiteBasePath() {
    // e.g. '/blog/blog-detail.html' -> '/blog/'
    const pathname = window.location && window.location.pathname ? window.location.pathname : '/';
    const idx = pathname.lastIndexOf('/');
    return idx >= 0 ? pathname.slice(0, idx + 1) : '/';
}

function rewriteMarkdownAssetUrls(rootEl) {
    if (!rootEl) return;

    const sourcePath = (window.__mdSourcePath && String(window.__mdSourcePath)) || '';
    const sourceDir = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1) : '';

    const siteBasePath = getSiteBasePath();
    const origin = window.location && window.location.origin ? window.location.origin : '';

    const mdBase = origin + siteBasePath + sourceDir.replace(/^\/+/, '');
    const siteBaseNoSlash = siteBasePath.endsWith('/') ? siteBasePath.slice(0, -1) : siteBasePath;

    rootEl.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src');
        if (!src) return;

        // Keep absolute/external/data URLs intact
        if (/^(https?:|data:|blob:)/i.test(src)) return;
        if (src.startsWith('#')) return;

        try {
            // If src is root-absolute, prefix with repo base path (e.g. '/blog')
            if (src.startsWith('/')) {
                const prefixed = (siteBaseNoSlash || '') + src;
                img.setAttribute('src', new URL(prefixed, origin).href);
                return;
            }

            // Otherwise resolve relative to the markdown file directory
            img.setAttribute('src', new URL(src, mdBase).href);
        } catch (e) {
            // ignore malformed URLs
        }
    });
}

function renderMarkdownContent() {
    const contentElement = document.getElementById('markdown-content');
    if (!contentElement) return;

    const markdown = stripFrontMatter(contentElement.textContent || '');
    // 使用 marked 解析（显式开启 GFM，确保表格等语法可用）
    if (window.marked && typeof window.marked.setOptions === 'function') {
        window.marked.setOptions({
            gfm: true
        });
    }
    const html = window.marked ? window.marked.parse(markdown) : markdown;

    contentElement.innerHTML = html;

    // Ensure asset URLs (especially images) resolve correctly on GitHub Pages
    rewriteMarkdownAssetUrls(contentElement);

    // 渲染数学公式（KaTeX）
    if (window.renderMathInElement) {
        renderMathInElement(contentElement, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false }
            ]
        });
    }

    // 高亮代码块
    if (window.hljs) {
        document.querySelectorAll('pre code').forEach(block => {
            window.hljs.highlightElement(block);
        });
    }

    enhanceCodeBlocks(contentElement);
    // Apply i18n to dynamically created elements inside markdown (e.g., codeblock labels)
    try { if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') window.siteI18n.applyTo(contentElement); } catch (e) { }
}

function normalizeLangLabel(raw) {
    const s = (raw || '').toString().trim().toLowerCase();
    if (!s) return 'CODE';

    const map = {
        'c++': 'CPP',
        'cpp': 'CPP',
        'cxx': 'CPP',
        'cc': 'CPP',
        'c': 'C',
        'python': 'PY',
        'py': 'PY',
        'javascript': 'JS',
        'js': 'JS',
        'typescript': 'TS',
        'ts': 'TS',
        'java': 'JAVA',
        'go': 'GO',
        'rust': 'RUST',
        'bash': 'BASH',
        'sh': 'BASH',
        'shell': 'BASH',
        'json': 'JSON',
        'html': 'HTML',
        'xml': 'XML',
        'css': 'CSS',
        'markdown': 'MD',
        'md': 'MD',
        'sql': 'SQL',
        'yaml': 'YAML',
        'yml': 'YAML'
    };
    return map[s] || s.toUpperCase();
}

function detectLanguageFromCodeEl(codeEl) {
    if (!codeEl) return '';
    const className = (codeEl.getAttribute('class') || '').trim();
    if (!className) return '';
    const classes = className.split(/\s+/).filter(Boolean);

    for (const c of classes) {
        if (c.startsWith('language-')) return c.slice('language-'.length);
        if (c.startsWith('lang-')) return c.slice('lang-'.length);
    }
    return '';
}

async function copyTextToClipboard(text) {
    const t = (text || '').toString();
    if (!t) return false;

    try {
        if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(t);
            return true;
        }
    } catch (e) {
        // fallback below
    }

    try {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return !!ok;
    } catch (e) {
        return false;
    }
}

function enhanceCodeBlocks(rootEl) {
    if (!rootEl) return;

    const pres = Array.from(rootEl.querySelectorAll('pre'));
    pres.forEach(pre => {
        const code = pre.querySelector('code');
        if (!code) return;
        if (pre.closest('.codeblock')) return;

        const langRaw = detectLanguageFromCodeEl(code);
        const langLabel = normalizeLangLabel(langRaw);

        const container = document.createElement('div');
        container.className = 'codeblock';

        const header = document.createElement('div');
        header.className = 'codeblock__header';

        const langEl = document.createElement('div');
        langEl.className = 'codeblock__lang';
        langEl.textContent = langLabel;

        const actions = document.createElement('div');
        actions.className = 'codeblock__actions';

        const btnCopy = document.createElement('button');
        btnCopy.type = 'button';
        btnCopy.className = 'codeblock__btn';
        btnCopy.innerHTML = '<i class="far fa-copy"></i><span class="code-copy-label"></span>';

        const btnToggle = document.createElement('button');
        btnToggle.type = 'button';
        btnToggle.className = 'codeblock__btn';
        btnToggle.innerHTML = '<i class="fas fa-chevron-up"></i><span class="code-toggle-label"></span>';

        actions.appendChild(btnCopy);
        actions.appendChild(btnToggle);

        header.appendChild(langEl);
        header.appendChild(actions);

        const body = document.createElement('div');
        body.className = 'codeblock__body';

        // Move existing <pre> into container body
        const preParent = pre.parentNode;
        if (!preParent) return;
        preParent.insertBefore(container, pre);
        body.appendChild(pre);
        container.appendChild(header);
        container.appendChild(body);

        addCodeBlockLineNumbers(body, pre, code);

        btnCopy.addEventListener('click', async () => {
            const text = code.innerText || code.textContent || '';
            const ok = await copyTextToClipboard(text);
            if (!ok) return;

            btnCopy.classList.add('is-copied');
            // localized temporary label
            try {
                const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'zh';
                const map = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[lang] || {}) : {};
                const span = btnCopy.querySelector('span');
                if (span) span.textContent = (map.code_copied || '已复制');
            } catch (e) { }
            window.setTimeout(() => {
                btnCopy.classList.remove('is-copied');
                try {
                    const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'zh';
                    const map = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[lang] || {}) : {};
                    const s = btnCopy.querySelector('.code-copy-label');
                    if (s) s.textContent = (map.code_copy || '复制');
                } catch (e) { }
            }, 900);
        });

        btnToggle.addEventListener('click', () => {
            const collapsed = container.classList.toggle('is-collapsed');
            const icon = btnToggle.querySelector('i');
            const label = btnToggle.querySelector('span');
            try {
                const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'zh';
                const map = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[lang] || {}) : {};
                if (collapsed) {
                    if (icon) icon.className = 'fas fa-chevron-down';
                    if (label) label.textContent = (map.code_expand || '展开');
                } else {
                    if (icon) icon.className = 'fas fa-chevron-up';
                    if (label) label.textContent = (map.code_collapse || '收起');
                }
            } catch (e) {
                if (collapsed) {
                    if (icon) icon.className = 'fas fa-chevron-down';
                    if (label) label.textContent = '展开';
                } else {
                    if (icon) icon.className = 'fas fa-chevron-up';
                    if (label) label.textContent = '收起';
                }
            }
        });
    });

    // Update codeblock labels according to current language and collapsed state
    function updateCodeBlockI18n() {
        try {
            const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'zh';
            const map = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[lang] || {}) : {};
            document.querySelectorAll('.codeblock').forEach(container => {
                const btns = container.querySelectorAll('.codeblock__btn');
                const btnCopyEl = btns[0];
                const btnToggleEl = btns[1];
                if (btnCopyEl) {
                    const span = btnCopyEl.querySelector('.code-copy-label');
                    if (span) span.textContent = (map.code_copy || '复制');
                }
                if (btnToggleEl) {
                    const span = btnToggleEl.querySelector('.code-toggle-label');
                    const icon = btnToggleEl.querySelector('i');
                    const collapsed = container.classList.contains('is-collapsed');
                    if (span) span.textContent = collapsed ? (map.code_expand || '展开') : (map.code_collapse || '收起');
                    if (icon) icon.className = collapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
                }
            });
        } catch (e) { }
    }

    // Bind language-change update once
    if (!window.__codeblockI18nBound) {
        window.__codeblockI18nBound = true;
        document.addEventListener('site:languageChanged', updateCodeBlockI18n);
    }

    // Initial update after enhancing
    updateCodeBlockI18n();
}

function addCodeBlockLineNumbers(bodyEl, preEl, codeEl) {
    if (!bodyEl || !preEl || !codeEl) return;
    if (bodyEl.querySelector('.codeblock__content')) return;

    const raw = (codeEl.textContent || '').replace(/\n$/, '');
    const lineCount = raw ? raw.split('\n').length : 1;
    const numbersText = Array.from({ length: lineCount }, (_, i) => String(i + 1)).join('\n');

    const content = document.createElement('div');
    content.className = 'codeblock__content';

    const gutter = document.createElement('pre');
    gutter.className = 'codeblock__gutter';
    gutter.setAttribute('aria-hidden', 'true');
    gutter.textContent = numbersText;

    preEl.classList.add('codeblock__pre');

    // Move pre into content container alongside gutter
    if (preEl.parentNode === bodyEl) {
        bodyEl.removeChild(preEl);
    }
    content.appendChild(gutter);
    content.appendChild(preEl);
    bodyEl.appendChild(content);
}

if (document.getElementById('markdown-content')) {
    document.addEventListener('DOMContentLoaded', renderMarkdownContent);
}