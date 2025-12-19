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
}

if (document.getElementById('markdown-content')) {
    document.addEventListener('DOMContentLoaded', renderMarkdownContent);
}