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

    function toAbsoluteBySiteRoot(pathLike) {
        const prefixed = (siteBaseNoSlash || '') + '/' + String(pathLike).replace(/^\/+/, '');
        return new URL(prefixed, origin).href;
    }

    rootEl.querySelectorAll('img').forEach(img => {
        const rawSrc = img.getAttribute('src');
        if (!rawSrc) return;
        const src = String(rawSrc).trim().replace(/\\/g, '/');
        if (!src) return;

        // Keep absolute/external/data URLs intact
        if (/^(https?:|data:|blob:|\/\/)/i.test(src)) return;
        if (src.startsWith('#')) return;

        try {
            // If src is root-absolute, prefix with repo base path (e.g. '/blog')
            if (src.startsWith('/')) {
                const prefixed = (siteBaseNoSlash || '') + src;
                img.setAttribute('src', new URL(prefixed, origin).href);
                return;
            }

            // Compatibility: many articles use ../assets/... as site-root assets.
            // Resolve these to <siteBase>/assets/... instead of markdown-directory-relative.
            if (/^(?:\.\/|\.\.\/)*assets\//i.test(src)) {
                const normalized = src.replace(/^(?:\.\/|\.\.\/)+/, '');
                img.setAttribute('src', toAbsoluteBySiteRoot(normalized));
                return;
            }

            // Also support assets/... shorthand as site-root assets.
            if (/^assets\//i.test(src)) {
                img.setAttribute('src', toAbsoluteBySiteRoot(src));
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

        // Protect fenced/inline code first so shell variables like $num are not treated as math.
        const codeBlocks = [];
        const stashCode = (match) => {
            const idx = codeBlocks.length;
            codeBlocks.push(match);
            return `@@CODE_${idx}@@`;
        };

        let protectedText = text
            .replace(/```[\s\S]*?```/g, stashCode)
            .replace(/~~~[\s\S]*?~~~/g, stashCode)
            .replace(/`[^`\n]*`/g, stashCode);

        // 先处理显示数学 $$...$$（非贪婪）
        let tmp = protectedText.replace(/\$\$[\s\S]*?\$\$/g, match => {
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

        // Restore protected code as-is.
        return out.replace(/@@CODE_(\d+)@@/g, (_, num) => {
            const i = parseInt(num, 10);
            return codeBlocks[i] || '';
        });
    }

    function buildOptionsHtml(optionsText) {
        if (!optionsText) return '<div class="md-options"></div>';

        const rawLines = optionsText.split(/\r?\n/);
        const explicitKeyPattern = /^\s*([A-Ga-g])\s*[\)）\.：:\-]?\s*(.*)$/;
        const hasExplicitKeys = rawLines.some(line => explicitKeyPattern.test(line));
        const optionItems = [];

        if (hasExplicitKeys) {
            let current = null;
            rawLines.forEach(line => {
                const matched = line.match(explicitKeyPattern);
                if (matched) {
                    if (current) optionItems.push(current);
                    current = {
                        key: matched[1].toUpperCase(),
                        content: matched[2] || ''
                    };
                    return;
                }

                if (current) current.content += `\n${line}`;
            });

            if (current) optionItems.push(current);
        } else {
            let autoIndex = 0;
            rawLines.forEach(line => {
                if (!line.trim()) return;
                optionItems.push({
                    key: String.fromCharCode('A'.charCodeAt(0) + autoIndex),
                    content: line.trim()
                });
                autoIndex++;
            });
        }

        const parts = ['<div class="md-options">'];

        optionItems.forEach(item => {
            const optionProtected = extractMathFrom((item.content || '').trim());
            const optionHtmlRaw = (window.marked && typeof window.marked.parse === 'function')
                ? window.marked.parse(optionProtected)
                : optionProtected;
            const optionHtml = (optionHtmlRaw || '').trim();
            parts.push(
                `<div class="md-option" role="button" tabindex="0" data-key="${item.key}">` +
                `<strong class="md-option-key">${item.key}</strong>` +
                `<div class="md-option-text">${optionHtml}</div>` +
                `</div>`
            );
        });

        parts.push('</div>');
        return parts.join('\n');
    }

    // 自定义块转换：
    // [question]... [\question] -> <div class="md-question">...</div>
    // [options]... [\options] -> <div class="md-options">...多个 .md-option 按钮...</div>
    // 说明：如果选项本身不包含前缀字母，按出现顺序分配 A,B,C...（每组重置）
    function transformCustomBlocks(mdText) {
        if (!mdText) return mdText;

        // task -> 将整个 task 包裹为 md-task（先执行，以便内部保留原始标记供后续解析）
        mdText = mdText.replace(/\[task\]([\s\S]*?)\[\\task\]/g, function (_, inner) {
            return '\n<div class="md-task">' + inner + '</div>\n';
        });

        // question -> 保留内部 Markdown
        mdText = mdText.replace(/\[question\]([\s\S]*?)\[\\question\]/g, function (_, inner) {
            return '\n<div class="md-question">' + inner + '</div>\n';
        });

        // options -> 将选项转换为可交互块（支持显式字母前缀与多行 Markdown）
        mdText = mdText.replace(/\[options\]([\s\S]*?)\[\\options\]/g, function (_, inner) {
            return buildOptionsHtml(inner);
        });

        return mdText;
    }

    // 先将自定义块转换为 HTML 片段或占位符，随后再抽取数学表达式
    // questionsHtml 用于保存被解析后的 question HTML（保持内部 Markdown 能被 marked 处理）
    const questionsHtml = [];
    // helper: process a chunk for [question] and [options], returning transformed string
    function processInnerForQuestionsAndOptions(innerText) {
        if (!innerText) return '';
        // first handle questions into @@QUESTION_i@@ placeholders
        const step1 = innerText.replace(/\[question\]([\s\S]*?)\[\\question\]/g, function (_, qinner) {
            const innerProtected = extractMathFrom(qinner);
            const innerHtml = (window.marked && typeof window.marked.parse === 'function') ? window.marked.parse(innerProtected) : innerProtected;
            const idx = questionsHtml.length;
            questionsHtml.push(innerHtml);
            return `@@QUESTION_${idx}@@`;
        });

        // then handle options
        const step2 = step1.replace(/\[options\]([\s\S]*?)\[\\options\]/g, function (_, optInner) {
            return buildOptionsHtml(optInner);
        });
        return step2;
    }

    // 先在全局范围内处理 [question] 与 [options]（保留 [task] 与 [answer]/[analysis] 标签）
    let markdownTransformed = processInnerForQuestionsAndOptions(markdown);
    // 将 [task] 包裹为 md-task，以便最终渲染时作为题目卡片显示（内部已包含 @@QUESTION_x@@ 占位或 options HTML）
    markdownTransformed = markdownTransformed.replace(/\[task\]([\s\S]*?)\[\\task\]/g, function (_, inner) {
        return '\n<div class="md-task">' + inner + '</div>\n';
    });

    // 先将文档按 [answer] 或 [analysis] ...[\answer]/[\analysis] 拆分为若干普通段与答案/解析段，分别处理数学与预渲染答案内部 Markdown
    // 支持捕获标签名，以便 later 将连续的 [answer] + [\analysis] 合并为一个可折叠块
    const answerRegex = /\[(answer|analysis)\]([\s\S]*?)\[\\\1\]/g;
    const segments = []; // {type: 'text'|'anspart', sub?: 'answer'|'analysis', raw: string, content: string}
    let lastIdx = 0;
    let m; let answerIndex = 0;
    while ((m = answerRegex.exec(markdownTransformed)) !== null) {
        const before = markdownTransformed.slice(lastIdx, m.index);
        if (before) segments.push({ type: 'text', content: extractMathFrom(before) });

        const tag = m[1]; // 'answer' or 'analysis'
        const innerRaw = m[2] || '';
        // 为答案/解析内部也抽取数学占位符（会追加到全局数组），并用 marked 预渲染为 HTML（保留数学占位符）
        const innerProtected = extractMathFrom(innerRaw);
        const innerHtml = (window.marked && typeof window.marked.parse === 'function') ? window.marked.parse(innerProtected) : innerProtected;
        segments.push({ type: 'anspart', sub: tag, raw: innerRaw, content: innerHtml, index: answerIndex++ });

        lastIdx = m.index + m[0].length;
    }
    // 追加尾部
    if (lastIdx < markdownTransformed.length) {
        const tail = markdownTransformed.slice(lastIdx);
        if (tail) segments.push({ type: 'text', content: extractMathFrom(tail) });
    }

    // 将 segments 合并：对于连续的 answer + analysis 合并为一个 answersHtml 项
    // 拼接为带答案占位符的受保护 Markdown（答案占位符为 @@ANSWERN_i@@）
    let combinedProtected = '';
    const answersHtml = []; // 每项为 { answerHtml, analysisHtml, answerRaw }
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.type === 'text') {
            combinedProtected += seg.content;
            continue;
        }
        if (seg.type === 'anspart' && seg.sub === 'answer') {
            // lookahead for an analysis part, allowing intervening whitespace/text-only segments
            let analysisHtml = '';
            let analysisRaw = '';
            let j = i + 1;
            for (; j < segments.length; j++) {
                const s2 = segments[j];
                if (s2.type === 'anspart' && s2.sub === 'analysis') {
                    analysisHtml = s2.content || '';
                    analysisRaw = s2.raw || '';
                    break;
                }
                // skip text segments that are only whitespace
                if (s2.type === 'text') {
                    const txt = (s2.content || '').toString();
                    if (txt.trim() === '') continue; // ignore pure whitespace
                    // otherwise there is meaningful content between answer and analysis -> don't treat as paired
                    break;
                }
                // any other non-empty segment stops the search
                break;
            }
            if (j < segments.length && segments[j].type === 'anspart' && segments[j].sub === 'analysis') {
                i = j; // consume the analysis segment as well
            }
            answersHtml.push({ answerHtml: seg.content || '', analysisHtml: analysisHtml, answerRaw: (seg.raw || '') });
            combinedProtected += `@@ANSWERN_${answersHtml.length - 1}@@`;
            continue;
        }
        // 如果遇到单独的 analysis（无前置 answer），把它视为普通文本
        if (seg.type === 'anspart' && seg.sub === 'analysis') {
            combinedProtected += seg.content || '';
        }
    }

    // 使用 marked 解析整体（GFM）
    if (window.marked && typeof window.marked.setOptions === 'function') window.marked.setOptions({ gfm: true });
    const htmlParsed = (window.marked && typeof window.marked.parse === 'function') ? window.marked.parse(combinedProtected) : combinedProtected;

    // 还原答案占位符为可折叠容器（内部 HTML 可能包含数学占位符）
    let html = htmlParsed.replace(/@@ANSWERN_(\d+)@@/g, (_, num) => {
        const i = parseInt(num, 10);
        const obj = answersHtml[i] || { answerHtml: '', analysisHtml: '', answerRaw: '' };
        const contentId = `answer-content-${i}`;
        const toggleId = `answer-toggle-${i}`;

        // 更可靠地从原始 answerRaw 中解析正确字母（优先常见格式：单字母、以“答案/结论”开头或行首字母）
        let letter = '';
        const raw = (obj.answerRaw || '').toString();
        const rawTrim = raw.trim();
        // 1) 如果整段仅为单个字母（或带点/右括号），直接使用
        const singleLetter = rawTrim.match(/^([A-Ga-g])\s*[\)\.]?\s*$/);
        if (singleLetter) {
            letter = singleLetter[1].toUpperCase();
        } else {
            // 2) 查找明确关键词后的字母：答案、结论、Answer
            const kw = raw.match(/(?:答案|结论|Answer)[:：\s]*([A-Ga-g])/i);
            if (kw) letter = kw[1].toUpperCase();
            else {
                // 3) 首行以字母开头的形式
                const firstLine = raw.split(/\r?\n/)[0] || '';
                const m2 = firstLine.match(/^\s*([A-Ga-g])[\)）\.：:\-]?/);
                if (m2) letter = m2[1].toUpperCase();
                else {
                    // 4) 最后回退：首次出现的独立字母（谨慎匹配边界）
                    const m3 = raw.match(/([^A-Za-z0-9]|^)([A-Ga-g])([^A-Za-z0-9]|$)/);
                    if (m3) letter = m3[2].toUpperCase();
                }
            }
        }

        // 将 answerHtml 与 analysisHtml 放入一个容器，保存正确字母在 data-answer
        return `\n<div class="answer-block" data-answer="${letter}">\n  <div id="${contentId}" class="answer-content" hidden>\n    <div class="answer-inner">\n      <div class="answer-header"><strong>答案</strong>: <span class="answer-letter">${obj.answerHtml || ''}</span></div>\n      <div class="answer-analysis">${obj.analysisHtml || ''}</div>\n    </div>\n  </div>\n  <button id="${toggleId}" class="answer-toggle" type="button" aria-expanded="false" aria-controls="${contentId}">\n    <svg class="answer-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">\n      <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n    </svg>\n  </button>\n</div>\n`;
    });

    // 还原 question 占位符为解析后的 HTML
    html = html.replace(/@@QUESTION_(\d+)@@/g, (_, num) => {
        const i = parseInt(num, 10);
        const inner = questionsHtml[i] || '';
        return `\n<div class="md-question">${inner}</div>\n`;
    });

    // （task 已在 markdown 预处理阶段替换为 .md-task 包裹，故此处无需还原）

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

    // 绑定答案折叠交互：使用统一的 expand/collapse helper，保证答案与解析成组折叠
    function expandAnswerBlock(answerBlock) {
        if (!answerBlock) return;
        const contentEl = answerBlock.querySelector('.answer-content');
        const toggle = answerBlock.querySelector('.answer-toggle');
        if (!contentEl) return;
        if (toggle) toggle.classList.add('is-open');
        answerBlock.classList.add('is-open');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');

        contentEl.hidden = false;
        // ensure transition is set
        contentEl.style.overflow = 'hidden';
        contentEl.style.transition = 'max-height 260ms ease, opacity 220ms ease';
        requestAnimationFrame(() => {
            contentEl.style.maxHeight = contentEl.scrollHeight + 'px';
            contentEl.style.opacity = '1';
        });
        const onEnd = () => { contentEl.style.maxHeight = ''; contentEl.removeEventListener('transitionend', onEnd); };
        contentEl.addEventListener('transitionend', onEnd);
        // 当展开答案时，锁定该题的所有选项组（在同一 md-task 内）
        try {
            const ogs = findOptionsGroupsForAnswerBlock(answerBlock);
            if (ogs && ogs.length) ogs.forEach(og => setOptionsLocked(og, true));
        } catch (e) { }
    }

    function collapseAnswerBlock(answerBlock) {
        if (!answerBlock) return;
        const contentEl = answerBlock.querySelector('.answer-content');
        const toggle = answerBlock.querySelector('.answer-toggle');
        if (!contentEl) return;
        if (toggle) toggle.classList.remove('is-open');
        answerBlock.classList.remove('is-open');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');

        const cur = contentEl.scrollHeight;
        contentEl.style.maxHeight = cur + 'px';
        requestAnimationFrame(() => {
            contentEl.style.maxHeight = '0px';
            contentEl.style.opacity = '0';
        });
        const onEndHide = () => { contentEl.hidden = true; contentEl.removeEventListener('transitionend', onEndHide); };
        contentEl.addEventListener('transitionend', onEndHide);
        // 收起时如果未选择任何选项则解锁该题的所有选项组（在同一 md-task 内）
        try {
            const ogs = findOptionsGroupsForAnswerBlock(answerBlock);
            if (ogs && ogs.length) {
                const anyChosen = ogs.some(g => g.querySelector('.is-correct, .is-wrong'));
                if (!anyChosen) ogs.forEach(g => setOptionsLocked(g, false));
            }
        } catch (e) { }
    }

    // 在 answerBlock 周围查找属于同一 `md-task` 的所有 md-options 组（优先使用 task 范围）
    // 返回数组（可能为空），若无法确定则返回 null
    function findOptionsGroupsForAnswerBlock(answerBlock) {
        if (!answerBlock) return null;

        // 优先在同一 md-task 容器内查找所有 .md-options
        try {
            const task = answerBlock.closest && answerBlock.closest('.md-task') ? answerBlock.closest('.md-task') : null;
            if (task) {
                const groups = Array.from(task.querySelectorAll('.md-options'));
                if (groups.length) return groups;
            }
        } catch (e) { /* ignore */ }

        // 回退到原先的向前查找/祖先搜索，但仍返回数组以兼容调用点
        const res = [];
        let cur = answerBlock.previousElementSibling;
        while (cur) {
            if (cur.classList && cur.classList.contains('md-options')) { res.push(cur); break; }
            cur = cur.previousElementSibling;
        }
        if (res.length) return res;

        let p = answerBlock.parentElement;
        while (p) {
            try {
                const found = p.querySelector('.md-options');
                if (found) { res.push(found); break; }
            } catch (e) { }
            p = p.parentElement;
        }
        return res.length ? res : null;
    }

    // 锁定或解锁一个选项组（禁止/允许点击），并设置无障碍属性
    function setOptionsLocked(optionsGroup, locked) {
        if (!optionsGroup) return;
        if (locked) optionsGroup.classList.add('is-locked'); else optionsGroup.classList.remove('is-locked');
        Array.from(optionsGroup.querySelectorAll('.md-option')).forEach(b => {
            try {
                b.setAttribute('aria-disabled', locked ? 'true' : 'false');
                if (locked) b.setAttribute('tabindex', '-1'); else b.setAttribute('tabindex', '0');
            } catch (e) { }
            if (locked) b.classList.add('is-locked'); else b.classList.remove('is-locked');
        });
    }

    (function bindAnswerToggles() {
        const toggles = Array.from(contentElement.querySelectorAll('.answer-block .answer-toggle'));
        toggles.forEach(btn => {
            const contentId = btn.getAttribute('aria-controls');
            const contentEl = contentElement.querySelector(`#${contentId}`);
            const answerBlock = btn.closest('.answer-block');
            if (!contentEl || !answerBlock) return;

            // 初始化样式（以 answer-block 的 is-open 状态为准）
            contentEl.style.overflow = 'hidden';
            contentEl.style.transition = 'max-height 260ms ease, opacity 220ms ease';
            if (answerBlock.classList.contains('is-open')) {
                contentEl.hidden = false;
                contentEl.style.maxHeight = '';
                contentEl.style.opacity = '1';
                btn.classList.add('is-open');
                btn.setAttribute('aria-expanded', 'true');
            } else {
                contentEl.style.maxHeight = '0px';
                contentEl.style.opacity = '0';
                contentEl.hidden = true;
            }

            btn.addEventListener('click', () => {
                const expanded = btn.classList.toggle('is-open');
                if (expanded) expandAnswerBlock(answerBlock);
                else collapseAnswerBlock(answerBlock);
            });
        });
    })();
    // 绑定选项点击交互（基于 .md-option）
    (function bindOptionClicks() {
        const handleOptionActivate = (btn) => {
            // 如果所在选项组已被锁定（被选择或答案已展开），阻止点击
            const optionsGroup = btn.closest('.md-options');
            if (optionsGroup && optionsGroup.classList.contains('is-locked')) return;

            // 防止重复标记
            if (btn.classList.contains('is-correct') || btn.classList.contains('is-wrong')) return;

            const key = (btn.getAttribute('data-key') || '').toUpperCase();
            if (!key) return;

            // 首先尝试在同一 `.md-task` 容器内找到关联的 answer-block（保证 task 作用域）
            const task = btn.closest && btn.closest('.md-task') ? btn.closest('.md-task') : null;
            let answerBlock = null;
            if (task) answerBlock = task.querySelector('.answer-block');

            // 回退：向后查找下一个 .answer-block（原有逻辑）
            if (!answerBlock) {
                let cur = btn.parentElement;
                while (cur) {
                    let sib = cur.nextElementSibling;
                    while (sib) {
                        if (sib.classList && sib.classList.contains('answer-block')) { answerBlock = sib; break; }
                        sib = sib.nextElementSibling;
                    }
                    if (answerBlock) break;
                    cur = cur.parentElement;
                }
            }

            // 最后回退到全局第一个 answer-block
            if (!answerBlock) answerBlock = contentElement.querySelector('.answer-block');
            if (!answerBlock) return;

            const contentEl = answerBlock.querySelector('.answer-content');

            // 优先使用 data-answer（由解析器在生成占位时写入），否则回退到从文本中解析
            let found = (answerBlock.getAttribute('data-answer') || '').toUpperCase().replace(/[^A-G]/g, '').charAt(0) || null;
            if (!found) {
                const text = (contentEl && contentEl.textContent) ? contentEl.textContent : '';
                // 尝试从文本中解析正确选项（A-G）
                const m1 = text.match(/结论[:：]\s*([A-Ga-g])/i) || text.match(/([^A-Za-z0-9]|^)\b([A-Ga-g])\b\s*正确/i) || text.match(/^\s*([A-Ga-g])[\)）\.：:\-\s]/m);
                if (m1) found = (m1[1] || m1[2] || m1[0]).toString().trim().toUpperCase().replace(/[^A-G]/g, '').charAt(0);

                if (!found) {
                    const lines = text.split(/\r?\n/);
                    for (const ln of lines) {
                        const mm = ln.match(/^\s*([A-Ga-g])[^A-Za-z0-9]*正确/i);
                        if (mm) { found = mm[1].toUpperCase(); break; }
                    }
                }
            }

            // 标记样式与自动展开行为
            if (found && found === key) {
                btn.classList.add('is-correct');
                // 选择正确后锁定本题所有选项组（在 task 内）
                if (task) Array.from(task.querySelectorAll('.md-options')).forEach(g => setOptionsLocked(g, true));
                else if (optionsGroup) setOptionsLocked(optionsGroup, true);
            } else {
                btn.classList.add('is-wrong');
                // 自动展开答案块（使用统一 helper）
                const toggle = answerBlock.querySelector('.answer-toggle');
                if (toggle && !toggle.classList.contains('is-open')) expandAnswerBlock(answerBlock);
                // 锁定本题所有选项组（在 task 内），并高亮正确选项
                if (task) Array.from(task.querySelectorAll('.md-options')).forEach(g => setOptionsLocked(g, true));
                else if (optionsGroup) setOptionsLocked(optionsGroup, true);
                if (found) {
                    // 优先在同一 task 内查找对应的正确按钮，再回退到当前组或全局
                    let correctBtn = null;
                    if (task) correctBtn = task.querySelector(`.md-option[data-key="${found}"]`);
                    if (!correctBtn && optionsGroup) correctBtn = optionsGroup.querySelector(`.md-option[data-key="${found}"]`);
                    if (!correctBtn) correctBtn = contentElement.querySelector(`.md-option[data-key="${found}"]`);
                    if (correctBtn) correctBtn.classList.add('is-correct');
                }
            }
        };

        Array.from(contentElement.querySelectorAll('.md-option')).forEach(btn => {
            btn.addEventListener('click', () => handleOptionActivate(btn));
            btn.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleOptionActivate(btn);
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

    function collapseCodeBlock(container, bodyEl) {
        if (!container || !bodyEl) return;
        if (bodyEl.__expandEndHandler) {
            bodyEl.removeEventListener('transitionend', bodyEl.__expandEndHandler);
            bodyEl.__expandEndHandler = null;
        }
        if (bodyEl.__collapseEndHandler) {
            bodyEl.removeEventListener('transitionend', bodyEl.__collapseEndHandler);
            bodyEl.__collapseEndHandler = null;
        }
        bodyEl.hidden = false;
        const currentHeight = bodyEl.getBoundingClientRect().height || bodyEl.scrollHeight;
        bodyEl.style.overflow = 'hidden';
        bodyEl.style.transition = 'height 280ms ease, opacity 220ms ease';
        bodyEl.style.maxHeight = '';
        bodyEl.style.height = currentHeight + 'px';
        bodyEl.style.opacity = '1';
        void bodyEl.offsetHeight;
        requestAnimationFrame(() => {
            container.classList.add('is-collapsed');
            bodyEl.style.height = '0px';
            bodyEl.style.opacity = '0';
        });
        const onEnd = (e) => {
            if (e.propertyName !== 'height') return;
            bodyEl.hidden = true;
            bodyEl.style.height = '';
            bodyEl.removeEventListener('transitionend', onEnd);
            bodyEl.__collapseEndHandler = null;
        };
        bodyEl.__collapseEndHandler = onEnd;
        bodyEl.addEventListener('transitionend', onEnd);
    }

    function expandCodeBlock(container, bodyEl) {
        if (!container || !bodyEl) return;
        if (bodyEl.__collapseEndHandler) {
            bodyEl.removeEventListener('transitionend', bodyEl.__collapseEndHandler);
            bodyEl.__collapseEndHandler = null;
        }
        if (bodyEl.__expandEndHandler) {
            bodyEl.removeEventListener('transitionend', bodyEl.__expandEndHandler);
            bodyEl.__expandEndHandler = null;
        }
        bodyEl.hidden = false;
        bodyEl.style.overflow = 'hidden';
        bodyEl.style.transition = 'height 280ms ease, opacity 220ms ease';
        bodyEl.style.maxHeight = '';
        bodyEl.style.height = '0px';
        bodyEl.style.opacity = '0';
        void bodyEl.offsetHeight;
        container.classList.remove('is-collapsed');
        const targetHeight = bodyEl.scrollHeight;
        requestAnimationFrame(() => {
            bodyEl.style.height = targetHeight + 'px';
            bodyEl.style.opacity = '1';
        });
        const onEnd = (e) => {
            if (e.propertyName !== 'height') return;
            bodyEl.style.height = '';
            bodyEl.removeEventListener('transitionend', onEnd);
            bodyEl.__expandEndHandler = null;
        };
        bodyEl.__expandEndHandler = onEnd;
        bodyEl.addEventListener('transitionend', onEnd);
    }

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

        body.style.overflow = 'hidden';
        body.style.opacity = '1';

        let lastToggleAt = 0;

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
            const now = Date.now();
            if (now - lastToggleAt < 200) return;
            lastToggleAt = now;
            const collapsed = !container.classList.contains('is-collapsed');
            if (collapsed) collapseCodeBlock(container, body);
            else expandCodeBlock(container, body);
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