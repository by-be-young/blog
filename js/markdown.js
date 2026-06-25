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

// 规范化有序列表缩进：去掉有序列表标记（即"1." "2."等）前的 1-3 个空格/制表符，
// 避免因缩进导致 marked 将其解析为普通段落而非有序列表项。
// 跳过围栏代码块，保留 4+ 缩进的（即缩进代码块）。
function normalizeOrderedListIndentation(md) {
    if (!md || typeof md !== 'string') return md || '';
    const blocks = [];
    let idx = 0;
    const protected = md.replace(/```[\s\S]*?```/g, function (m) {
        const key = '@@CODELIST_' + (idx++) + '@@';
        blocks.push(m);
        return key;
    });
    const result = protected.replace(/^[ \t]{1,3}(\d+[\.\)])/gm, '$1');
    return result.replace(/@@CODELIST_(\d+)@@/g, function (_, n) { return blocks[parseInt(n, 10)] || ''; });
}

function transformObsidianImageEmbeds(markdown) {
    if (typeof markdown !== 'string' || !markdown) return markdown || '';

    return markdown.replace(/!\[\[([^\]\n]+)\]\]/g, function (match, inner) {
        const raw = String(inner || '').trim();
        if (!raw) return match;

        const parts = raw.split('|');
        const targetRaw = (parts[0] || '').trim();
        if (!targetRaw) return match;

        const target = targetRaw.replace(/\\/g, '/');
        if (!/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(target)) return match;

        let alt = (parts[1] || '').trim();
        if (!alt) alt = target.split('/').pop().replace(/\.[^.]+$/, '');

        let src = target;
        const hasKnownPrefix = /^(?:https?:\/\/|\/|\.{1,2}\/|assets\/|blogs\/)/i.test(src);
        const isBareFilename = src.indexOf('/') === -1;

        // Obsidian commonly stores unnamed attachments under blogs/图片/
        if (!hasKnownPrefix && isBareFilename) {
            src = `/blogs/图片/${src}`;
        }

        return `![${alt}](${src})`;
    });
}

function applyRandomMacaronListMarkerColors(rootEl) {
    if (!rootEl) return;

    const macaronPalette = [
        '#f59ab5',
        '#74c4f7',
        '#86dfbe',
        '#f7bf8a',
        '#b29af2',
        '#eea9ef',
        '#8fd8fb',
        '#f6bddc'
    ];

    const listItems = Array.from(rootEl.querySelectorAll('ul li, ol li'));
    listItems.forEach(li => {
        const idx = Math.floor(Math.random() * macaronPalette.length);
        li.style.setProperty('--macaron-marker-color', macaronPalette[idx]);
    });
}

function ensureMermaidFullscreenViewer() {
    if (window.__mermaidFullscreenViewer) return window.__mermaidFullscreenViewer;

    let overlay = document.getElementById('mermaid-viewer-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mermaid-viewer-overlay';
        overlay.className = 'mermaid-viewer-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = [
            '<div class="mermaid-viewer-stage" role="dialog" aria-modal="true" aria-label="Mermaid 全屏预览">',
            '  <div class="mermaid-viewer-toolbar">',
            '    <button class="mermaid-viewer-close" type="button" aria-label="关闭全屏预览">&times;</button>',
            '  </div>',
            '  <div class="mermaid-viewer-content"></div>',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);
    }

    const contentEl = overlay.querySelector('.mermaid-viewer-content');
    const closeBtn = overlay.querySelector('.mermaid-viewer-close');
    const zoomState = {
        scale: 1,
        minScale: 0.4,
        maxScale: 4,
        baseWidth: 0,
        baseHeight: 0,
        svg: null
    };

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function applyZoom() {
        if (!zoomState.svg || !zoomState.baseWidth || !zoomState.baseHeight) return;
        const w = zoomState.baseWidth * zoomState.scale;
        const h = zoomState.baseHeight * zoomState.scale;
        zoomState.svg.style.width = w + 'px';
        zoomState.svg.style.height = h + 'px';
        zoomState.svg.style.maxWidth = 'none';
        zoomState.svg.style.maxHeight = 'none';
    }

    function resetZoom() {
        zoomState.scale = 1;
        zoomState.baseWidth = 0;
        zoomState.baseHeight = 0;
        zoomState.svg = null;
    }

    function close() {
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('mermaid-viewer-open');
        resetZoom();
        if (contentEl) contentEl.innerHTML = '';
    }

    function open(diagramEl) {
        if (!diagramEl) return false;
        const svg = diagramEl.querySelector('svg');
        if (!svg || !contentEl) return false;

        contentEl.innerHTML = '';
        const svgClone = svg.cloneNode(true);
        svgClone.removeAttribute('style');
        svgClone.removeAttribute('width');
        svgClone.removeAttribute('height');
        svgClone.style.width = 'auto';
        svgClone.style.height = 'auto';
        svgClone.style.maxWidth = '100%';
        svgClone.style.maxHeight = '100%';
        contentEl.appendChild(svgClone);

        zoomState.svg = svgClone;
        requestAnimationFrame(() => {
            if (!zoomState.svg) return;
            const rect = zoomState.svg.getBoundingClientRect();
            zoomState.baseWidth = rect.width || 0;
            zoomState.baseHeight = rect.height || 0;
            zoomState.scale = 1;
            applyZoom();
        });

        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('mermaid-viewer-open');
        return true;
    }

    if (!overlay.__mermaidViewerBound) {
        overlay.__mermaidViewerBound = '1';
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        if (contentEl) {
            contentEl.addEventListener('wheel', (e) => {
                if (!overlay.classList.contains('is-open')) return;
                if (!zoomState.svg || !zoomState.baseWidth || !zoomState.baseHeight) return;

                e.preventDefault();
                const factor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
                zoomState.scale = clamp(zoomState.scale * factor, zoomState.minScale, zoomState.maxScale);
                applyZoom();
            }, { passive: false });
        }
        if (closeBtn) closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
        });
    }

    window.__mermaidFullscreenViewer = { open, close };
    return window.__mermaidFullscreenViewer;
}

function renderMermaidDiagrams(rootEl) {
    if (!rootEl) return;

    function collapseBody(container, bodyEl) {
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

    function expandBody(container, bodyEl) {
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

    function updateViewButton(btn, isCodeMode) {
        if (!btn) return;
        const icon = btn.querySelector('i');
        const label = btn.querySelector('.mermaid-view-label');
        if (isCodeMode) {
            if (icon) icon.className = 'far fa-image';
            if (label) label.textContent = '图片';
            btn.setAttribute('aria-label', '显示图片');
        } else {
            if (icon) icon.className = 'fas fa-code';
            if (label) label.textContent = '代码';
            btn.setAttribute('aria-label', '显示代码');
        }
    }

    const mermaidCodeBlocks = Array.from(rootEl.querySelectorAll('pre > code.language-mermaid, pre > code.lang-mermaid')).filter(codeEl => {
        // Skip source-view code blocks inside already-enhanced Mermaid cards.
        return !codeEl.closest('.mermaid-block');
    });

    mermaidCodeBlocks.forEach(codeEl => {
        const preEl = codeEl.parentElement;
        if (!preEl || !preEl.parentElement) return;

        const source = (codeEl.textContent || '').trim();

        const block = document.createElement('div');
        block.className = 'codeblock mermaid-block';

        const header = document.createElement('div');
        header.className = 'codeblock__header';

        const langEl = document.createElement('div');
        langEl.className = 'codeblock__lang';
        langEl.textContent = 'MERMAID';

        const actions = document.createElement('div');
        actions.className = 'codeblock__actions';

        const btnCopy = document.createElement('button');
        btnCopy.type = 'button';
        btnCopy.className = 'codeblock__btn mermaid-copy-btn';
        btnCopy.innerHTML = '<i class="far fa-copy"></i><span class="code-copy-label">复制</span>';

        const btnView = document.createElement('button');
        btnView.type = 'button';
        btnView.className = 'codeblock__btn mermaid-view-btn';
        btnView.innerHTML = '<i class="fas fa-code"></i><span class="mermaid-view-label">代码</span>';
        updateViewButton(btnView, false);

        const btnFullscreen = document.createElement('button');
        btnFullscreen.type = 'button';
        btnFullscreen.className = 'codeblock__btn mermaid-full-btn';
        btnFullscreen.setAttribute('aria-label', '全屏');
        btnFullscreen.innerHTML = '<i class="fas fa-expand"></i><span class="mermaid-full-label">全屏</span>';

        const btnToggle = document.createElement('button');
        btnToggle.type = 'button';
        btnToggle.className = 'codeblock__btn mermaid-toggle-btn';
        btnToggle.innerHTML = '<i class="fas fa-chevron-up"></i><span class="code-toggle-label">收起</span>';

        actions.appendChild(btnCopy);
        actions.appendChild(btnView);
        actions.appendChild(btnFullscreen);
        actions.appendChild(btnToggle);

        header.appendChild(langEl);
        header.appendChild(actions);

        const body = document.createElement('div');
        body.className = 'codeblock__body mermaid-block__body';

        const diagramWrap = document.createElement('div');
        diagramWrap.className = 'mermaid-block__diagram-wrap';
        const diagram = document.createElement('div');
        diagram.className = 'mermaid mermaid-block__diagram';
        diagram.textContent = source;
        diagramWrap.appendChild(diagram);

        const sourceWrap = document.createElement('div');
        sourceWrap.className = 'mermaid-block__source';
        sourceWrap.hidden = true;
        const sourcePre = document.createElement('pre');
        const sourceCode = document.createElement('code');
        sourceCode.className = 'language-mermaid';
        sourceCode.textContent = source;
        sourcePre.appendChild(sourceCode);
        sourceWrap.appendChild(sourcePre);

        body.appendChild(diagramWrap);
        body.appendChild(sourceWrap);

        block.appendChild(header);
        block.appendChild(body);

        preEl.parentElement.replaceChild(block, preEl);

        let lastToggleAt = 0;

        btnCopy.addEventListener('click', async () => {
            const ok = await copyTextToClipboard(source);
            if (!ok) return;

            btnCopy.classList.add('is-copied');
            const label = btnCopy.querySelector('.code-copy-label');
            if (label) label.textContent = '已复制';
            window.setTimeout(() => {
                btnCopy.classList.remove('is-copied');
                const s = btnCopy.querySelector('.code-copy-label');
                if (s) s.textContent = '复制';
            }, 900);
        });

        btnView.addEventListener('click', () => {
            const isCodeMode = block.classList.toggle('is-source-mode');
            sourceWrap.hidden = !isCodeMode;
            diagramWrap.hidden = isCodeMode;
            updateViewButton(btnView, isCodeMode);
            if (!isCodeMode && diagram.getAttribute('data-mermaid-rendered') !== '1' && diagram.getAttribute('data-mermaid-rendering') !== '1') {
                renderMermaidDiagrams(rootEl);
            }
        });

        btnFullscreen.addEventListener('click', () => {
            const viewer = ensureMermaidFullscreenViewer();
            const opened = viewer.open(diagram);
            if (!opened && diagram.getAttribute('data-mermaid-rendering') !== '1') {
                renderMermaidDiagrams(rootEl);
                setTimeout(() => {
                    const v = ensureMermaidFullscreenViewer();
                    v.open(diagram);
                }, 120);
            }
        });

        btnToggle.addEventListener('click', () => {
            const now = Date.now();
            if (now - lastToggleAt < 200) return;
            lastToggleAt = now;

            const willCollapse = !block.classList.contains('is-collapsed');
            if (willCollapse) collapseBody(block, body);
            else expandBody(block, body);

            const icon = btnToggle.querySelector('i');
            const label = btnToggle.querySelector('.code-toggle-label');
            if (willCollapse) {
                if (icon) icon.className = 'fas fa-chevron-down';
                if (label) label.textContent = '展开';
                btnToggle.setAttribute('aria-label', '展开');
            } else {
                if (icon) icon.className = 'fas fa-chevron-up';
                if (label) label.textContent = '收起';
                btnToggle.setAttribute('aria-label', '收起');
            }
        });
    });

    const mermaidNodes = Array.from(rootEl.querySelectorAll('.mermaid-block__diagram:not([data-mermaid-rendered="1"]):not([data-mermaid-rendering="1"])'));
    if (!mermaidNodes.length) return;

    mermaidNodes.forEach(node => node.setAttribute('data-mermaid-rendering', '1'));

    if (!window.mermaid) {
        const currentRetry = Number(rootEl.dataset.mermaidRetryCount || '0');
        if (currentRetry < 5) {
            rootEl.dataset.mermaidRetryCount = String(currentRetry + 1);
            setTimeout(() => renderMermaidDiagrams(rootEl), 120);
        }
        return;
    }

    rootEl.dataset.mermaidRetryCount = '0';

    try {
        if (!window.__mermaidInitialized) {
            window.mermaid.initialize({
                startOnLoad: false,
                securityLevel: 'loose',
                theme: 'default'
            });
            window.__mermaidInitialized = true;
        }

        if (typeof window.mermaid.run === 'function') {
            const result = window.mermaid.run({ nodes: mermaidNodes });
            Promise.resolve(result).then(() => {
                mermaidNodes.forEach(node => {
                    node.setAttribute('data-mermaid-rendered', '1');
                    node.removeAttribute('data-mermaid-rendering');
                });
            }).catch((err) => {
                mermaidNodes.forEach(node => node.removeAttribute('data-mermaid-rendering'));
                console.warn('mermaid run error', err);
            });
        } else if (typeof window.mermaid.init === 'function') {
            window.mermaid.init(undefined, mermaidNodes);
            mermaidNodes.forEach(node => {
                node.setAttribute('data-mermaid-rendered', '1');
                node.removeAttribute('data-mermaid-rendering');
            });
        }
    } catch (e) {
        mermaidNodes.forEach(node => node.removeAttribute('data-mermaid-rendering'));
        console.warn('mermaid render error', e);
    }
}

function setupBlogDetailImageViewer(rootEl) {
    if (!rootEl) return;
    if (!document.body || !document.body.classList.contains('blog-detail-page')) return;
    const isAboutPage = document.body.classList.contains('about-page');
    if (isAboutPage) {
        const staleOverlay = document.getElementById('image-viewer-overlay');
        if (staleOverlay && staleOverlay.parentNode) {
            staleOverlay.parentNode.removeChild(staleOverlay);
        }
        document.body.classList.remove('image-viewer-open');
        return;
    }

    let overlay = document.getElementById('image-viewer-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'image-viewer-overlay';
        overlay.className = 'image-viewer-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        const viewerToolButtons = [
            '    <button class="image-viewer-tool image-viewer-download" type="button" aria-label="下载图片"><i class="fas fa-download" aria-hidden="true"></i><span class="image-viewer-tool-label">下载</span></button>',
            '    <button class="image-viewer-tool image-viewer-copy" type="button" aria-label="复制图片"><i class="fas fa-copy" aria-hidden="true"></i><span class="image-viewer-tool-label">复制</span></button>'
        ].join('');
        overlay.innerHTML = [
            '<div class="image-viewer-stage" role="dialog" aria-modal="true" aria-label="图片查看器">',
            '  <button class="image-viewer-nav image-viewer-prev" type="button" aria-label="上一张">&#10094;</button>',
            '  <button class="image-viewer-nav image-viewer-next" type="button" aria-label="下一张">&#10095;</button>',
            '  <div class="image-viewer-toolbar">',
            '    <span class="image-viewer-counter">1 / 1</span>',
            viewerToolButtons,
            '    <button class="image-viewer-close" type="button" aria-label="关闭图片查看器">&times;</button>',
            '  </div>',
            '  <img class="image-viewer-image" alt="" draggable="false" />',
            '</div>'
        ].join('');
        document.body.appendChild(overlay);

        const stage = overlay.querySelector('.image-viewer-stage');
        const prevBtn = overlay.querySelector('.image-viewer-prev');
        const nextBtn = overlay.querySelector('.image-viewer-next');
        const closeBtn = overlay.querySelector('.image-viewer-close');
        const counterEl = overlay.querySelector('.image-viewer-counter');
        const downloadBtn = overlay.querySelector('.image-viewer-download');
        const copyBtn = overlay.querySelector('.image-viewer-copy');
        const imageEl = overlay.querySelector('.image-viewer-image');

        const state = {
            items: [],
            index: 0,
            scale: 1,
            tx: 0,
            ty: 0,
            dragging: false,
            dragStartX: 0,
            dragStartY: 0,
            dragOriginX: 0,
            dragOriginY: 0
        };
        overlay.__viewerState = state;

        function getViewerI18n() {
            try {
                const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function')
                    ? window.siteI18n.getLang()
                    : 'zh';
                const all = (window.siteI18n && window.siteI18n.translations) ? window.siteI18n.translations : null;
                const map = (all && all[lang]) ? all[lang] : {};
                return {
                    download: map.image_download || '下载',
                    copy: map.image_copy || '复制',
                    copied: map.image_copied || '已复制',
                    copyFailed: map.image_copy_failed || '复制失败'
                };
            } catch (e) {
                return {
                    download: '下载',
                    copy: '复制',
                    copied: '已复制',
                    copyFailed: '复制失败'
                };
            }
        }

        function applyViewerI18n() {
            const t = getViewerI18n();
            if (downloadBtn) {
                const label = downloadBtn.querySelector('.image-viewer-tool-label');
                if (label) label.textContent = t.download;
                else downloadBtn.textContent = t.download;
                downloadBtn.setAttribute('aria-label', t.download);
            }
            if (copyBtn) {
                const label = copyBtn.querySelector('.image-viewer-tool-label');
                if (label) label.textContent = t.copy;
                else copyBtn.textContent = t.copy;
                copyBtn.setAttribute('aria-label', t.copy);
            }
        }

        function clamp(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        function applyTransform() {
            if (!imageEl) return;
            imageEl.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
            imageEl.style.cursor = state.dragging ? 'grabbing' : (state.scale > 1 ? 'grab' : 'zoom-in');
        }

        function resetTransform() {
            state.scale = 1;
            state.tx = 0;
            state.ty = 0;
            applyTransform();
        }

        function getDownloadName(item) {
            if (!item || !item.src) return 'image';
            try {
                const clean = String(item.src).split('#')[0].split('?')[0];
                const filename = clean.split('/').pop();
                return filename || 'image';
            } catch (e) {
                return 'image';
            }
        }

        function updateNav() {
            const len = state.items.length;
            const oneBased = len > 0 ? state.index + 1 : 0;
            if (counterEl) counterEl.textContent = `${oneBased} / ${len}`;

            if (prevBtn) {
                prevBtn.disabled = len <= 1;
                prevBtn.classList.toggle('is-disabled', len <= 1);
            }
            if (nextBtn) {
                nextBtn.disabled = len <= 1;
                nextBtn.classList.toggle('is-disabled', len <= 1);
            }
        }

        function renderCurrent() {
            if (!imageEl || !state.items.length) return;
            const item = state.items[state.index];
            imageEl.setAttribute('src', item.src);
            imageEl.setAttribute('alt', item.alt || '图片预览');
            resetTransform();
            updateNav();
        }

        function showAt(index) {
            if (!state.items.length) return;
            const len = state.items.length;
            const normalized = (index + len) % len;
            state.index = normalized;
            renderCurrent();
        }

        function openViewer(index) {
            if (!state.items.length) return;
            showAt(index || 0);
            overlay.classList.add('is-open');
            overlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('image-viewer-open');
        }

        function closeViewer() {
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('image-viewer-open');
            state.dragging = false;
            resetTransform();
        }

        async function copyCurrentImage() {
            const item = state.items[state.index];
            if (!item || !item.src || !copyBtn) return;
            const t = getViewerI18n();
            const label = copyBtn.querySelector('.image-viewer-tool-label');

            function setCopyText(text) {
                if (label) label.textContent = text;
                else copyBtn.textContent = text;
            }
            try {
                if (!(navigator.clipboard && window.ClipboardItem)) {
                    throw new Error('clipboard unavailable');
                }
                const res = await fetch(item.src);
                if (!res.ok) throw new Error('fetch failed');
                const blob = await res.blob();
                const mime = blob.type || 'image/png';
                await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
                setCopyText(t.copied);
            } catch (e) {
                setCopyText(t.copyFailed);
            }
            window.setTimeout(function () {
                const nextT = getViewerI18n();
                setCopyText(nextT.copy);
            }, 1200);
        }

        function downloadCurrentImage() {
            const item = state.items[state.index];
            if (!item || !item.src) return;
            const a = document.createElement('a');
            a.href = item.src;
            a.download = getDownloadName(item);
            a.rel = 'noopener noreferrer';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        overlay.__openViewerAt = openViewer;
        overlay.__setViewerItems = function (items) {
            state.items = Array.isArray(items) ? items : [];
            if (state.index >= state.items.length) state.index = 0;
            updateNav();
        };

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay || e.target === stage) closeViewer();
        });

        if (closeBtn) closeBtn.addEventListener('click', closeViewer);
        if (prevBtn) prevBtn.addEventListener('click', function () { showAt(state.index - 1); });
        if (nextBtn) nextBtn.addEventListener('click', function () { showAt(state.index + 1); });
        if (downloadBtn) downloadBtn.addEventListener('click', downloadCurrentImage);
        if (copyBtn) copyBtn.addEventListener('click', copyCurrentImage);

        applyViewerI18n();
        document.addEventListener('site:languageChanged', applyViewerI18n);

        document.addEventListener('keydown', function (e) {
            if (!overlay.classList.contains('is-open')) return;
            if (e.key === 'Escape') {
                closeViewer();
                return;
            }
            if (e.key === 'ArrowLeft') {
                showAt(state.index - 1);
                return;
            }
            if (e.key === 'ArrowRight') {
                showAt(state.index + 1);
            }
        });

        if (imageEl) {
            imageEl.addEventListener('wheel', function (e) {
                if (!overlay.classList.contains('is-open')) return;
                e.preventDefault();
                const ratio = e.deltaY < 0 ? 1.14 : 1 / 1.14;
                const nextScale = clamp(state.scale * ratio, 1, 5);
                if (nextScale === state.scale) return;
                state.scale = nextScale;
                if (state.scale === 1) {
                    state.tx = 0;
                    state.ty = 0;
                }
                applyTransform();
            }, { passive: false });

            imageEl.addEventListener('mousedown', function (e) {
                if (!overlay.classList.contains('is-open')) return;
                if (state.scale <= 1) return;
                state.dragging = true;
                state.dragStartX = e.clientX;
                state.dragStartY = e.clientY;
                state.dragOriginX = state.tx;
                state.dragOriginY = state.ty;
                applyTransform();
                e.preventDefault();
            });

            imageEl.addEventListener('dragstart', function (e) {
                e.preventDefault();
            });
        }

        window.addEventListener('mousemove', function (e) {
            if (!state.dragging || !overlay.classList.contains('is-open')) return;
            state.tx = state.dragOriginX + (e.clientX - state.dragStartX);
            state.ty = state.dragOriginY + (e.clientY - state.dragStartY);
            applyTransform();
        });

        window.addEventListener('mouseup', function () {
            if (!state.dragging) return;
            state.dragging = false;
            applyTransform();
        });
    }

    const images = Array.from(rootEl.querySelectorAll('img')).filter(img => {
        const src = (img.getAttribute('src') || '').trim();
        if (!src) return false;
        if (img.closest('.image-viewer-overlay')) return false;
        return true;
    }).map(img => ({
        element: img,
        src: img.currentSrc || img.getAttribute('src') || '',
        alt: img.getAttribute('alt') || '图片预览'
    })).filter(item => !!item.src);

    const items = images.map(item => ({ src: item.src, alt: item.alt }));
    if (typeof overlay.__setViewerItems === 'function') {
        overlay.__setViewerItems(items);
    }

    images.forEach((item, idx) => {
        const img = item.element;
        img.classList.add('md-zoomable-image');
        if (!img.hasAttribute('tabindex')) img.setAttribute('tabindex', '0');
        if (!img.hasAttribute('role')) img.setAttribute('role', 'button');
        img.setAttribute('aria-label', '点击查看大图');

        if (img.dataset.viewerBound === '1') return;
        img.dataset.viewerBound = '1';

        const openViewer = function (e) {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (typeof overlay.__openViewerAt === 'function') {
                overlay.__openViewerAt(idx);
            }
        };

        img.addEventListener('click', openViewer);
        img.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                openViewer(e);
            }
        });
    });
}

function renderMarkdownContent() {
    const contentElement = document.getElementById('markdown-content');
    if (!contentElement) return;
    const rawMarkdown = stripFrontMatter(contentElement.textContent || '');
    const internalRefPlaceholders = [];

    function stashInternalRefs(markdownText) {
        if (!markdownText) return '';
        return markdownText.replace(/\[\[#([^\]\n]+)\]\]/g, function (match, inner) {
            const idx = internalRefPlaceholders.length;
            internalRefPlaceholders.push({ raw: String(inner || '').trim() });
            return `@@INTERNALREF_${idx}@@`;
        });
    }

    const markdown = transformObsidianImageEmbeds(normalizeOrderedListIndentation(stashInternalRefs(rawMarkdown)));

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
    const optionsHtml = [];
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
            const idx = optionsHtml.length;
            optionsHtml.push(buildOptionsHtml(optInner));
            return `@@OPTION_${idx}@@`;
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

    function extractAnswerKeys(rawText) {
        const raw = (rawText || '').toString().trim();
        if (!raw) return [];

        const compact = raw.replace(/[\s,，;；、/|·\-\.\)）\:]*/g, '');
        if (compact && /^[A-G]+$/i.test(compact)) {
            const keys = [];
            compact.toUpperCase().split('').forEach(key => {
                if (!keys.includes(key)) keys.push(key);
            });
            return keys;
        }

        return [];
    }

    function resolveAnswerMeta(rawText) {
        const raw = (rawText || '').toString();
        const extractedKeys = extractAnswerKeys(raw);
        if (extractedKeys.length) {
            return {
                keys: extractedKeys,
                mode: extractedKeys.length > 1 ? 'multi' : 'single'
            };
        }

        const rawTrim = raw.trim();
        let letter = '';
        const singleLetter = rawTrim.match(/^([A-Ga-g])\s*[\)\.]?\s*$/);
        if (singleLetter) {
            letter = singleLetter[1].toUpperCase();
        } else {
            const kw = raw.match(/(?:答案|结论|Answer)[:：\s]*([A-Ga-g])/i);
            if (kw) letter = kw[1].toUpperCase();
            else {
                const firstLine = raw.split(/\r?\n/)[0] || '';
                const m2 = firstLine.match(/^\s*([A-Ga-g])[\)）\.：:\-]?/);
                if (m2) letter = m2[1].toUpperCase();
                else {
                    const m3 = raw.match(/([^A-Za-z0-9]|^)([A-Ga-g])([^A-Za-z0-9]|$)/);
                    if (m3) letter = m3[2].toUpperCase();
                }
            }
        }

        return {
            keys: letter ? [letter] : [],
            mode: 'single'
        };
    }

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
        const submitId = `answer-submit-${i}`;
        const answerMeta = resolveAnswerMeta(obj.answerRaw || '');
        const answerKeys = answerMeta.keys || [];
        const isMultiChoice = answerMeta.mode === 'multi';
        const answerKeysAttr = answerKeys.join(',');
        const actionHtml = isMultiChoice
            ? `\n  <div class="answer-actions">\n    <div class="answer-actions-row">\n      <span class="answer-type-badge" data-i18n="multi_choice_label" aria-hidden="true">多选题</span>\n      <button id="${submitId}" class="answer-submit" type="button" aria-expanded="false" aria-controls="${contentId}">\n        <span class="answer-submit-label" data-i18n="submit_answer">提交答案</span>\n        <span class="answer-submit-icon" aria-hidden="true">√</span>\n      </button>\n    </div>\n    <button class="answer-toggle" type="button" aria-expanded="false" aria-controls="${contentId}">\n      <svg class="answer-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">\n        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n      </svg>\n    </button>\n  </div>`
            : `\n  <button id="${submitId}" class="answer-toggle" type="button" aria-expanded="false" aria-controls="${contentId}">\n    <svg class="answer-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">\n      <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>\n    </svg>\n  </button>`;

        // 将 answerHtml 与 analysisHtml 放入一个容器，保存正确答案字母在 data-answer-keys
        return `\n<div class="answer-block${isMultiChoice ? ' is-multiple' : ''}" data-answer="${answerKeys[0] || ''}" data-answer-keys="${answerKeysAttr}" data-answer-mode="${answerMeta.mode}">${actionHtml}\n  <div id="${contentId}" class="answer-content" hidden>\n    <div class="answer-inner">\n      <div class="answer-header"><strong data-i18n="answer_label">答案</strong>: <span class="answer-letter">${obj.answerHtml || ''}</span></div>\n      <div class="answer-analysis">${obj.analysisHtml || ''}</div>\n    </div>\n  </div>\n</div>\n`;
    });

    // 还原 question 占位符为解析后的 HTML
    html = html.replace(/@@QUESTION_(\d+)@@/g, (_, num) => {
        const i = parseInt(num, 10);
        const inner = questionsHtml[i] || '';
        return `\n<div class="md-question">${inner}</div>\n`;
    });

    // 还原 options 占位符为已生成的 HTML，避免其内部内容再次经过全局数学抽取
    html = html.replace(/@@OPTION_(\d+)@@/g, (_, num) => {
        const i = parseInt(num, 10);
        return optionsHtml[i] || '';
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

    function annotateTaskLabels(root) {
        if (!root) return;

        const allChildren = Array.from(root.children);
        if (!allChildren.length) return;

        let h1Index = 0;
        let h2Index = 0;
        let h3Index = 0;
        const taskInfos = []; // { element, fullKey, depth }
        let separatorDepth = 0;  // consecutive --- count, clamped to 0-2
        let inheritedDepth = 0;  // depth inherited from preceding task

        allChildren.forEach(el => {
            if (!el || !el.tagName) return;
            const tag = el.tagName.toLowerCase();

            if (tag === 'hr') {
                separatorDepth = Math.min(separatorDepth + 1, 2);
                return;
            }

            if (tag === 'h1') {
                h1Index += 1;
                h2Index = 0;
                h3Index = 0;
                separatorDepth = 0;
                inheritedDepth = 0;
                return;
            }
            if (tag === 'h2') {
                if (h1Index === 0) return;
                h2Index += 1;
                h3Index = 0;
                separatorDepth = 0;
                inheritedDepth = 0;
                return;
            }
            if (tag === 'h3') {
                if (h1Index === 0) return;
                h3Index += 1;
                separatorDepth = 0;
                inheritedDepth = 0;
                return;
            }

            if (el.classList && el.classList.contains('md-task')) {
                const depth = Math.max(separatorDepth, inheritedDepth);
                taskInfos.push({
                    element: el,
                    fullKey: [h1Index, h2Index, h3Index].join('-'),
                    depth: depth
                });
                separatorDepth = 0;
                inheritedDepth = depth;
                return;
            }

            // Any other element (paragraphs, lists, etc.) breaks the chain.
            separatorDepth = 0;
            inheritedDepth = 0;
        });

        // Compute display key for a task, stripping last N levels (depth 0-2).
        // The h1 level is never stripped.
        function getDisplayKey(fullKey, depth) {
            const parts = fullKey.split('-').map(Number);
            if (depth > 0) {
                let stripped = 0;
                for (let i = parts.length - 1; i >= 0 && stripped < depth; i--) {
                    if (parts[i] > 0) {
                        if (i === 0) break; // never strip h1
                        parts[i] = 0;
                        stripped++;
                    }
                }
            }
            return parts.filter(num => num > 0).join('-');
        }

        // Group tasks by display key to assign suffixes
        const displayKeyGroups = new Map();
        taskInfos.forEach(info => {
            const displayKey = getDisplayKey(info.fullKey, info.depth);
            if (!displayKeyGroups.has(displayKey)) {
                displayKeyGroups.set(displayKey, []);
            }
            displayKeyGroups.get(displayKey).push(info);
        });

        displayKeyGroups.forEach((group, key) => {
            group.forEach((info, index) => {
                info.element.dataset.taskLabel = key;
                info.element.dataset.taskSuffix = group.length > 1 ? ` （${index + 1}）` : '';
                info.element.dataset.taskIndex = String(index + 1);
                info.element.dataset.taskTotal = String(group.length);
            });
        });
    }

    function refreshExerciseLabels(root) {
        const container = root && (root.nodeType === 1) ? root : contentElement;
        const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'zh';
        const map = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[lang] || window.siteI18n.translations.zh || {}) : {};
        const exerciseLabel = map.exercise_label || '例题';
        Array.from(container.querySelectorAll('.md-task')).forEach(task => {
            task.dataset.taskLabelText = exerciseLabel;
        });
    }

    annotateTaskLabels(contentElement);
    refreshExerciseLabels(contentElement);

    // 为 h1/h2/h3 生成稳定且唯一的 id，并把 [[#标题]] 语法替换为指向对应标题的锚点链接（支持一级到三级标题）
    (function assignHeadingIdsAndLinkifyRefs(root) {
        if (!root) return;

        const STAR_SUFFIX_RE = /(?:【\s*[!！]\s*】|\[\s*[!！]\s*\]|［\s*[!！]\s*］)\s*$/;

        function stripStarSuffix(text) {
            return String(text || '').replace(STAR_SUFFIX_RE, '').trim();
        }

        function hasStarSuffix(text) {
            return STAR_SUFFIX_RE.test(String(text || ''));
        }

        function normalizeInternalRefText(text) {
            return stripStarSuffix(String(text || '').replace(/`+/g, '').trim());
        }

        function resolveRefTarget(rawTitle) {
            const title = String(rawTitle || '').trim();
            const normalizedTitle = normalizeInternalRefText(title);
            return {
                rawTitle: title,
                normalizedTitle: normalizedTitle,
                targetId: map.get(title) || map.get(slugify(title)) || map.get(normalizedTitle) || map.get(slugify(normalizedTitle)) || null
            };
        }

        function decorateHeadingStar(heading, cleanText) {
            if (!heading || heading.dataset.starDecorated === '1') return;

            // 优先只改末尾文本节点，尽量保留标题内现有内联结构。
            const nodes = Array.from(heading.childNodes || []);
            let updated = false;
            for (let i = nodes.length - 1; i >= 0; i--) {
                const n = nodes[i];
                if (n && n.nodeType === Node.TEXT_NODE) {
                    const next = String(n.nodeValue || '').replace(STAR_SUFFIX_RE, '').replace(/\s+$/, '');
                    if (next !== String(n.nodeValue || '')) {
                        n.nodeValue = next;
                        updated = true;
                        break;
                    }
                }
            }

            if (!updated) {
                heading.textContent = cleanText;
            }

            const star = document.createElement('span');
            star.className = 'heading-star-marker';
            star.setAttribute('aria-hidden', 'true');
            star.textContent = '★';
            heading.appendChild(star);
            heading.dataset.starDecorated = '1';
            heading.dataset.starMarked = '1';
        }

        function slugify(text) {
            return String(text || '')
                .trim()
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\-\u4e00-\u9fff]/g, '')
                .replace(/\-+/g, '-')
                .replace(/^\-|\-$/g, '');
        }

        const map = new Map();
        const used = new Map();
        Array.from(root.querySelectorAll('h1, h2, h3')).forEach(h => {
            try {
                const rawText = (h.textContent || '').trim();
                if (!rawText) return;
                const cleanText = stripStarSuffix(rawText) || rawText;
                h.dataset.headingPlainText = cleanText;

                if (hasStarSuffix(rawText)) {
                    decorateHeadingStar(h, cleanText);
                }

                let id = h.id && String(h.id).trim();
                if (!id) id = slugify(cleanText) || 'heading';
                // ensure unique
                const base = id;
                let c = used.get(base) || 0;
                while (document.getElementById(id)) { c += 1; id = base + '-' + c; }
                used.set(base, c);
                h.id = id;
                // 支持带标记与去标记标题两种写法
                map.set(rawText, id);
                map.set(cleanText, id);
                map.set(slugify(rawText), id);
                map.set(slugify(cleanText), id);
                map.set(normalizeInternalRefText(rawText), id);
                map.set(slugify(normalizeInternalRefText(rawText)), id);
            } catch (e) { }
        });

        // Replace internal-ref placeholders first; they were stashed before markdown parsing to avoid inline-code splitting.
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        const placeholderPattern = /@@INTERNALREF_(\d+)@@/g;
        const pattern = /\[\[#([^\]\n]+)\]\]/g;
        textNodes.forEach(node => {
            const parentTag = node.parentElement && node.parentElement.tagName ? node.parentElement.tagName.toLowerCase() : '';
            if (parentTag === 'a' || parentTag === 'code' || parentTag === 'pre' || parentTag === 'textarea') return;
            const txt = node.nodeValue || '';
            if (!txt || (txt.indexOf('[#') === -1 && txt.indexOf('@@INTERNALREF_') === -1)) return;
            let m; let lastIndex = 0; const parts = [];

            placeholderPattern.lastIndex = 0;
            while ((m = placeholderPattern.exec(txt)) !== null) {
                const before = txt.slice(lastIndex, m.index);
                if (before) parts.push(document.createTextNode(before));

                const idx = parseInt(m[1], 10);
                const ref = internalRefPlaceholders[idx] || { raw: '' };
                const resolved = resolveRefTarget(ref.raw);
                if (resolved.targetId) {
                    const a = document.createElement('a');
                    a.setAttribute('href', '#' + resolved.targetId);
                    a.className = 'internal-ref';
                    a.textContent = resolved.normalizedTitle || ref.raw;
                    parts.push(a);
                } else {
                    parts.push(document.createTextNode(`[[#${ref.raw}]]`));
                }
                lastIndex = m.index + m[0].length;
            }

            if (parts.length) {
                const tail = txt.slice(lastIndex);
                if (tail) parts.push(document.createTextNode(tail));
                const frag = document.createDocumentFragment();
                parts.forEach(p => frag.appendChild(p));
                node.parentNode.replaceChild(frag, node);
                return;
            }

            lastIndex = 0;
            while ((m = pattern.exec(txt)) !== null) {
                const before = txt.slice(lastIndex, m.index);
                if (before) parts.push(document.createTextNode(before));
                const resolved = resolveRefTarget((m[1] || '').trim());
                if (resolved.targetId) {
                    const a = document.createElement('a');
                    a.setAttribute('href', '#' + resolved.targetId);
                    a.className = 'internal-ref';
                    a.textContent = resolved.normalizedTitle || resolved.rawTitle;
                    parts.push(a);
                } else {
                    // fallback: leave original text if not found
                    parts.push(document.createTextNode(m[0]));
                }
                lastIndex = m.index + m[0].length;
            }
            if (lastIndex === 0) return; // no matches replaced
            const tail = txt.slice(lastIndex);
            if (tail) parts.push(document.createTextNode(tail));
            const frag = document.createDocumentFragment();
            parts.forEach(p => frag.appendChild(p));
            node.parentNode.replaceChild(frag, node);
        });
    })(contentElement);

    // 拦截内部引用链接点击，优先触发 TOC 中对应项的点击以复用已有平滑滚动/展开逻辑；回退到自定义平滑滚动并考虑导航栏高度
    (function bindInternalRefClicks() {
        function findTocAnchorForId(id) {
            if (!id) return null;
            try {
                if (window.CSS && typeof window.CSS.escape === 'function') {
                    return document.querySelector('#toc-list a[href="#' + CSS.escape(id) + '"]');
                }
                // fallback: simple selector (may fail for special chars)
                return document.querySelector('#toc-list a[href="#' + id.replace(/"/g, '\\"') + '"]');
            } catch (e) { return null; }
        }

        document.addEventListener('click', function (e) {
            try {
                const a = e.target && e.target.closest ? e.target.closest('a.internal-ref[href^="#"]') : null;
                if (!a) return;
                // ignore modified clicks
                if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                e.stopPropagation();

                const href = (a.getAttribute('href') || '').trim();
                if (!href || href.charAt(0) !== '#') return;
                const id = href.slice(1);

                const backState = window.__internalRefBackState || {};
                backState.scrollY = window.scrollY || 0;
                backState.hash = window.location.pathname + window.location.search + window.location.hash;
                backState.available = true;
                window.__internalRefBackState = backState;
                try {
                    window.dispatchEvent(new Event('internal-ref:back-state-change'));
                } catch (err) { }

                const tocAnchor = findTocAnchorForId(id);
                if (tocAnchor) {
                    try { tocAnchor.click(); return; } catch (e) { /* fall through */ }
                }

                // fallback smooth scroll with navbar offset
                const header = document.getElementById(id);
                if (!header) return;
                const nav = document.querySelector('.navbar');
                const navHeight = nav ? nav.offsetHeight : 0;
                const y = header.getBoundingClientRect().top + window.scrollY - navHeight - 10;
                // prevent recursive scroll handlers
                if (window.__scrollingToTOC) return;
                window.__scrollingToTOC = true;
                const distance = Math.abs(y - window.scrollY);
                const lockMs = Math.max(650, Math.min(2200, Math.round(distance * 0.9)));
                window.scrollTo({ top: y, behavior: 'smooth' });
                setTimeout(() => { window.__scrollingToTOC = false; }, lockMs);
                try { history.replaceState(null, '', '#' + id); } catch (e) { }
            } catch (e) { }
        }, true);
    })();

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
    renderMermaidDiagrams(contentElement);
    setupBlogDetailImageViewer(contentElement);
    applyRandomMacaronListMarkerColors(contentElement);

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
    if (window.hljs) {
        contentElement.querySelectorAll('pre code:not(.language-mermaid):not(.lang-mermaid)').forEach(block => {
            window.hljs.highlightElement(block);
        });
    }

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

    function getAnswerKeysFromBlock(answerBlock) {
        if (!answerBlock) return [];
        const answerKeysAttr = (answerBlock.getAttribute('data-answer-keys') || '').trim();
        if (answerKeysAttr) {
            return answerKeysAttr.split(',').map(key => key.trim().toUpperCase()).filter(Boolean);
        }

        const answerAttr = (answerBlock.getAttribute('data-answer') || '').trim().toUpperCase();
        if (!answerAttr) return [];
        if (answerAttr.indexOf(',') !== -1) {
            return answerAttr.split(',').map(key => key.trim().toUpperCase()).filter(Boolean);
        }
        const single = answerAttr.replace(/[^A-G]/g, '').charAt(0);
        return single ? [single] : [];
    }

    function getOptionScopeForAnswerBlock(answerBlock) {
        if (!answerBlock) return { task: null, optionsGroups: [], buttons: [] };

        const task = answerBlock.closest && answerBlock.closest('.md-task') ? answerBlock.closest('.md-task') : null;
        if (task) {
            return {
                task: task,
                optionsGroups: Array.from(task.querySelectorAll('.md-options')),
                buttons: Array.from(task.querySelectorAll('.md-option'))
            };
        }

        const optionsGroups = findOptionsGroupsForAnswerBlock(answerBlock) || [];
        const buttons = [];
        optionsGroups.forEach(group => {
            buttons.push(...Array.from(group.querySelectorAll('.md-option')));
        });
        return { task: null, optionsGroups: optionsGroups, buttons: buttons };
    }

    function setOptionSelected(btn, selected) {
        if (!btn) return;
        btn.classList.toggle('is-selected', !!selected);
        try {
            btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
        } catch (e) { }
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

    (function bindMultiChoiceSubmits() {
        const setQuestionStateClass = (questionEl, state) => {
            if (!questionEl || !questionEl.classList) return;
            questionEl.classList.remove('is-question-correct', 'is-question-wrong');
            if (state === 'correct') questionEl.classList.add('is-question-correct');
            if (state === 'wrong') questionEl.classList.add('is-question-wrong');
        };

        const submits = Array.from(contentElement.querySelectorAll('.answer-block .answer-submit'));
        submits.forEach(btn => {
            const answerBlock = btn.closest('.answer-block');
            if (!answerBlock || answerBlock.getAttribute('data-answer-mode') !== 'multi') return;

            const scope = getOptionScopeForAnswerBlock(answerBlock);
            if (scope.optionsGroups && scope.optionsGroups.length) {
                scope.optionsGroups.forEach(group => group.classList.add('is-multi-choice'));
            }
            if (scope.task) scope.task.classList.add('is-multiple-choice');

            btn.addEventListener('click', () => {
                const freshScope = getOptionScopeForAnswerBlock(answerBlock);
                const answerKeys = getAnswerKeysFromBlock(answerBlock);
                const correctSet = new Set(answerKeys);
                const selectedButtons = freshScope.buttons.filter(optionBtn => optionBtn.classList.contains('is-selected'));
                const selectedKeys = selectedButtons
                    .map(optionBtn => (optionBtn.getAttribute('data-key') || '').toUpperCase().trim())
                    .filter(Boolean);
                const selectedSet = new Set(selectedKeys);
                const isCorrect = correctSet.size > 0 && selectedSet.size === correctSet.size && Array.from(selectedSet).every(key => correctSet.has(key));

                const allButtons = freshScope.buttons.length ? freshScope.buttons : Array.from(contentElement.querySelectorAll('.md-option'));
                allButtons.forEach(optionBtn => {
                    const key = (optionBtn.getAttribute('data-key') || '').toUpperCase().trim();
                    const isSelected = optionBtn.classList.contains('is-selected');
                    const shouldBeCorrect = correctSet.has(key);
                    optionBtn.classList.remove('is-correct', 'is-wrong');
                    if (isSelected && shouldBeCorrect) optionBtn.classList.add('is-correct');
                    else if (isSelected && !shouldBeCorrect) optionBtn.classList.add('is-wrong');
                    else if (shouldBeCorrect) optionBtn.classList.add('is-correct');
                });

                const questionBlock = freshScope.task ? freshScope.task.querySelector('.md-question') : null;
                setQuestionStateClass(questionBlock, isCorrect ? 'correct' : 'wrong');
                if (freshScope.task) freshScope.task.dataset.answerState = isCorrect ? 'correct' : 'wrong';

                if (freshScope.optionsGroups && freshScope.optionsGroups.length) {
                    freshScope.optionsGroups.forEach(group => setOptionsLocked(group, true));
                }

                expandAnswerBlock(answerBlock);
                btn.classList.add('is-submitted');
                btn.setAttribute('aria-disabled', 'true');
                btn.disabled = true;
                btn.textContent = '已提交';
                updateTaskStatsSummary();
            });
        });
    })();

    const updateTaskStatsSummary = (function initTaskStatsSummary() {
        const tasks = Array.from(contentElement.querySelectorAll('.md-task'));
        if (!tasks.length) return function () { };

        const statsEntries = tasks.map(task => {
            task.classList.add('has-task-stats');
            let statsEl = task.querySelector('.md-task-stats');
            if (!statsEl) {
                statsEl = document.createElement('div');
                statsEl.className = 'md-task-stats';
                task.appendChild(statsEl);
            }
            return { task, statsEl };
        });

        const render = () => {
            const total = tasks.length;
            let answered = 0;
            let correct = 0;

            tasks.forEach(task => {
                const state = (task.dataset.answerState || '').trim();
                if (state === 'correct') {
                    answered += 1;
                    correct += 1;
                } else if (state === 'wrong') {
                    answered += 1;
                }
            });

            const rate = answered > 0 ? Math.round((correct / answered) * 100) : 0;
            const hasRate = answered > 0;
            const html =
                '<span class="md-task-stats-main">' +
                '<span class="md-task-stats-label" data-i18n="stats_correct_count">答对数：</span><span class="md-task-stats-value">' + correct + '</span>' +
                '<span class="md-task-stats-label" data-i18n="stats_answered_count">/总答题数：</span><span class="md-task-stats-value">' + answered + '</span>' +
                '<span class="md-task-stats-label" data-i18n="stats_total_count">/总题数：</span><span class="md-task-stats-value">' + total + '</span>' +
                '</span>' +
                (hasRate
                    ? ('<span class="md-task-stats-rate">' +
                        '<span class="md-task-stats-label" data-i18n="stats_accuracy">正确率：</span><span class="md-task-stats-value">' + rate + '%</span>' +
                        '</span>')
                    : '');

            statsEntries.forEach(({ task, statsEl }) => {
                statsEl.innerHTML = html;
                statsEl.classList.toggle('is-rate-hidden', !hasRate);
                if (task && task.classList) {
                    task.classList.toggle('is-rate-hidden', !hasRate);
                }
                try { if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') window.siteI18n.applyTo(statsEl); } catch (e) { }
            });
        };

        render();
        return render;
    })();

    try {
        document.addEventListener('site:languageChanged', function () {
            try {
                refreshExerciseLabels(contentElement);
                if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') window.siteI18n.applyTo(contentElement);
                updateTaskStatsSummary();
            } catch (e) { }
        });
    } catch (e) { }

    // 绑定选项点击交互（基于 .md-option）
    (function bindOptionClicks() {
        const setQuestionStateClass = (questionEl, state) => {
            if (!questionEl || !questionEl.classList) return;
            questionEl.classList.remove('is-question-correct', 'is-question-wrong');
            if (state === 'correct') questionEl.classList.add('is-question-correct');
            if (state === 'wrong') questionEl.classList.add('is-question-wrong');
        };

        const findQuestionForOption = (btn, task, optionsGroup) => {
            if (task) {
                const q = task.querySelector('.md-question');
                if (q) return q;
            }

            if (optionsGroup) {
                let sib = optionsGroup.previousElementSibling;
                while (sib) {
                    if (sib.classList && sib.classList.contains('md-question')) return sib;
                    sib = sib.previousElementSibling;
                }
            }

            return contentElement.querySelector('.md-question');
        };

        const handleOptionActivate = (btn) => {
            // 如果所在选项组已被锁定（被选择或答案已展开），阻止点击
            const optionsGroup = btn.closest('.md-options');
            if (optionsGroup && optionsGroup.classList.contains('is-locked')) return;

            // 首先尝试在同一 `.md-task` 容器内找到关联的 answer-block（保证 task 作用域）
            const task = btn.closest && btn.closest('.md-task') ? btn.closest('.md-task') : null;
            const questionBlock = findQuestionForOption(btn, task, optionsGroup);
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
            const answerKeys = getAnswerKeysFromBlock(answerBlock);
            const isMultiChoice = answerBlock.getAttribute('data-answer-mode') === 'multi' || answerKeys.length > 1;
            const key = (btn.getAttribute('data-key') || '').toUpperCase();
            if (!key) return;

            if (isMultiChoice) {
                setOptionSelected(btn, !btn.classList.contains('is-selected'));
                return;
            }

            // 防止重复标记
            if (btn.classList.contains('is-correct') || btn.classList.contains('is-wrong')) return;

            // 优先使用 data-answer（由解析器在生成占位时写入），否则回退到从文本中解析
            let found = answerKeys[0] || (answerBlock.getAttribute('data-answer') || '').toUpperCase().replace(/[^A-G]/g, '').charAt(0) || null;
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
                setQuestionStateClass(questionBlock, 'correct');
                if (task) task.dataset.answerState = 'correct';
                // 选择正确后锁定本题所有选项组（在 task 内）
                if (task) Array.from(task.querySelectorAll('.md-options')).forEach(g => setOptionsLocked(g, true));
                else if (optionsGroup) setOptionsLocked(optionsGroup, true);
            } else {
                btn.classList.add('is-wrong');
                setQuestionStateClass(questionBlock, 'wrong');
                if (task) task.dataset.answerState = 'wrong';
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

            updateTaskStatsSummary();
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
            document.querySelectorAll('.codeblock:not(.mermaid-block)').forEach(container => {
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