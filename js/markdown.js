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

function renderMarkdownContent() {
    const contentElement = document.getElementById('markdown-content');
    if (!contentElement) return;

    const markdown = stripFrontMatter(contentElement.textContent || '');
    // 使用 marked 解析
    const html = window.marked ? window.marked.parse(markdown) : markdown;

    contentElement.innerHTML = html;

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