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

    // 全局数学占位集合（会被各个段落共享）
    const displayMathBlocks = [];
    const inlineMathBlocks = [];

    // 从单一文本中抽取数学表达式并返回带占位符的文本（会向上面的数组追加）
    function extractMathFrom(text) {
        if (!text) return '';

        // 先处理显示数学 $$...$$（非贪婪）
        let tmp = text.replace(/\$\$[\s\S]*?\$\$/g, match => {
            const inner = match.slice(2, -2);
            const idx = displayMathBlocks.length;
            displayMathBlocks.push(inner);
            return `@@MATHD_${idx}@@`;
        });

        // 再处理内联数学 $...$（支持转义 \$）
        let out = '';
        for (let i = 0; i < tmp.length;) {
            const ch = tmp[i];
            if (ch === '$' && tmp[i + 1] !== '$' && tmp[i - 1] !== '\\') {
                let j = i + 1;
                let closed = false;
                while (j < tmp.length) {
                    if (tmp[j] === '$' && tmp[j - 1] !== '\\') { closed = true; break; }
                    j++;
                }
                if (closed) {
                    const inner = tmp.slice(i + 1, j);
                    const idx = inlineMathBlocks.length;
                    inlineMathBlocks.push(inner);
                    out += `@@MATHI_${idx}@@`;
                    i = j + 1;
                    continue;
                }
            }
            out += ch;
            i++;
        }
        return out;
    }

    // 先将文档按 [answer]...[\answer] 拆分为若干普通段与答案段，分别处理数学与预渲染答案内部 Markdown
    const answerRegex = /\[answer\]([\s\S]*?)\[\\answer\]/g;
    const segments = []; // {type: 'text'|'answer', content: string}
    let lastIdx = 0;
    let m; let answerIndex = 0;
    while ((m = answerRegex.exec(markdown)) !== null) {
        const before = markdown.slice(lastIdx, m.index);
        if (before) segments.push({ type: 'text', content: extractMathFrom(before) });

        const innerRaw = m[1] || '';
        // 为答案内部也抽取数学占位符（会追加到全局数组），并用 marked 预渲染为 HTML（保留数学占位符）
        const innerProtected = extractMathFrom(innerRaw);
        const innerHtml = (window.marked && typeof window.marked.parse === 'function') ? window.marked.parse(innerProtected) : innerProtected;
        segments.push({ type: 'answer', content: innerHtml, index: answerIndex++ });

        lastIdx = m.index + m[0].length;
    }
    // 追加尾部
    if (lastIdx < markdown.length) {
        const tail = markdown.slice(lastIdx);
        if (tail) segments.push({ type: 'text', content: extractMathFrom(tail) });
    }

    // 拼接为带答案占位符的受保护 Markdown（答案占位符为 @@ANSWERN_i@@）
    let combinedProtected = '';
    const answersHtml = [];
    segments.forEach(seg => {
        if (seg.type === 'text') combinedProtected += seg.content;
        else if (seg.type === 'answer') {
            answersHtml.push(seg.content || '');
            combinedProtected += `@@ANSWERN_${answersHtml.length - 1}@@`;
        }
    });

    // 使用 marked 解析整体（GFM）
    if (window.marked && typeof window.marked.setOptions === 'function') window.marked.setOptions({ gfm: true });
    const htmlParsed = (window.marked && typeof window.marked.parse === 'function') ? window.marked.parse(combinedProtected) : combinedProtected;

    // 还原答案占位符为可折叠容器（内部 HTML 可能包含数学占位符）
    let html = htmlParsed.replace(/@@ANSWERN_(\d+)@@/g, (_, num) => {
        const i = parseInt(num, 10);
        const inner = answersHtml[i] || '';
        const contentId = `answer-content-${i}`;
        const toggleId = `answer-toggle-${i}`;
        // 使用无文本的图标按钮（SVG）并将内部 HTML 直接插入
        return `\n<div class="answer-block">\n  <div id="${contentId}" class="answer-content" hidden>\n    ${inner}\n  </div>\n  <button id="${toggleId}" class="answer-toggle" type="button" aria-expanded="false" aria-controls="${contentId}">\n    <svg class="answer-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">\n      <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n    </svg>\n  </button>\n</div>\n`;
    });

    // 还原数学占位符为占位 DOM 元素，用于后续 KaTeX 渲染
    html = html
        .replace(/@@MATHD_(\d+)@@/g, (_, num) => {
            const i = parseInt(num, 10);
            const src = displayMathBlocks[i] || '';
            return `<span class="math-display-placeholder" data-math="${encodeURIComponent(src)}"></span>`;
        })
        .replace(/@@MATHI_(\d+)@@/g, (_, num) => {
            const i = parseInt(num, 10);
            const src = inlineMathBlocks[i] || '';
            return `<span class="math-inline-placeholder" data-math="${encodeURIComponent(src)}"></span>`;
        });

    contentElement.innerHTML = html;

    // 使用 KaTeX API 对占位元素逐个渲染（若 KaTeX 可用）
    try {
        if (window.katex && typeof window.katex.render === 'function') {
            Array.from(contentElement.querySelectorAll('.math-display-placeholder')).forEach(el => {
                const src = decodeURIComponent(el.getAttribute('data-math') || '');
                const span = document.createElement('span');
                try { window.katex.render(src, span, { displayMode: true, throwOnError: false }); el.parentNode.replaceChild(span, el); }
                catch (e) { el.textContent = `$$${src}$$`; }
            });
            Array.from(contentElement.querySelectorAll('.math-inline-placeholder')).forEach(el => {
                const src = decodeURIComponent(el.getAttribute('data-math') || '');
                const span = document.createElement('span');
                try { window.katex.render(src, span, { displayMode: false, throwOnError: false }); el.parentNode.replaceChild(span, el); }
                catch (e) { el.textContent = `$${src}$`; }
            });
        } else if (window.renderMathInElement) {
            renderMathInElement(contentElement, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }] });
        }
    } catch (e) { console.warn('math render error', e); }

    // Ensure asset URLs (especially images) resolve correctly onGitHub Pages
    rewriteMarkdownAssetUrls(contentElement);

    // Make any links that point to other blog details open in a new tab
    try {
        Array.from(contentElement.querySelectorAll('a')).forEach(a => {
            try {
                const href = a.getAttribute('href') || '';
                if (href.indexOf('blog-detail.html') !== -1) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
            } catch (e) { }
        });
    } catch (e) { }

    // 高亮代码块
    if (window.hljs) { document.querySelectorAll('pre code').forEach(block => { window.hljs.highlightElement(block); }); }

    enhanceCodeBlocks(contentElement);
    try { if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') window.siteI18n.applyTo(contentElement); } catch (e) { }

    // 绑定答案折叠交互：平滑过渡、无文本图标按钮、aria 支持
    (function bindAnswerToggles() {
        const toggles = Array.from(contentElement.querySelectorAll('.answer-block .answer-toggle'));
        toggles.forEach(btn => {
            const contentId = btn.getAttribute('aria-controls');
            const contentEl = contentElement.querySelector(`#${contentId}`);
            if (!contentEl) return;

            // 初始化样式
            contentEl.style.overflow = 'hidden';
            contentEl.style.transition = 'max-height 260ms ease, opacity 220ms ease';
            contentEl.style.maxHeight = '0px';
            contentEl.style.opacity = '0';
            contentEl.hidden = true;

            btn.addEventListener('click', () => {
                const expanded = btn.classList.toggle('is-open');
                btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');

                if (expanded) {
                    // 展开：先确保显示以便读取 scrollHeight
                    contentEl.hidden = false;
                    // 在下一帧设置为实际高度以触发过渡
                    requestAnimationFrame(() => {
                        contentEl.style.maxHeight = contentEl.scrollHeight + 'px';
                        contentEl.style.opacity = '1';
                    });
                    // 在过渡结束后清理 maxHeight 以便支持内部尺寸变化
                    const onEnd = () => { contentEl.style.maxHeight = ''; contentEl.removeEventListener('transitionend', onEnd); };
                    contentEl.addEventListener('transitionend', onEnd);
                } else {
                    // 收起：先将 maxHeight 固定为当前高度，再触发到 0
                    const cur = contentEl.scrollHeight;
                    contentEl.style.maxHeight = cur + 'px';
                    requestAnimationFrame(() => {
                        contentEl.style.maxHeight = '0px';
                        contentEl.style.opacity = '0';
                    });
                    const onEndHide = () => { contentEl.hidden = true; contentEl.removeEventListener('transitionend', onEndHide); };
                    contentEl.addEventListener('transitionend', onEndHide);
                }
            });
        });
    })();
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