/**
 * Markdown 渲染模块
 * 功能：解析 Markdown 内容并渲染为 HTML，支持：
 * - Front Matter 剥离
 * - 数学公式（KaTeX）
 * - Mermaid 图表
 * - 自定义块（问答、选项、任务）
 * - 代码块增强（行号、复制、折叠）
 * - 图片查看器
 * - 内部链接锚点
 * - 国际化支持
 */
(function () {
    'use strict';

    // ==================== 配置常量 ====================
    /** 代码块折叠/展开动画时长（ms） */
    const CODE_ANIMATION_MS = 280;
    /** Mermaid 渲染重试次数 */
    const MERMAID_RETRY_MAX = 5;
    /** 图片查看器缩放范围 */
    const IMAGE_SCALE_MIN = 1;
    const IMAGE_SCALE_MAX = 5;
    const IMAGE_SCALE_STEP = 1.14;

    // ==================== 工具函数 ====================

    /** HTML 转义 */
    function escapeHtml(value) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;'
        };
        return String(value).replace(/[&<>"]/g, ch => map[ch]);
    }

    /** 获取当前语言 */
    function getLang() {
        try {
            if (window.siteI18n?.getLang) {
                return window.siteI18n.getLang();
            }
        } catch (error) {
            console.error('[i18n] 获取当前语言失败:', error);
        }
        return 'zh';
    }

    /** 获取国际化文本 */
    function t(key, fallback) {
        try {
            const i18n = window.siteI18n;
            const lang = getLang();
            const map = i18n?.translations?.[lang] || {};
            if (Object.prototype.hasOwnProperty.call(map, key) && map[key] != null) {
                return map[key];
            }
        } catch (error) {
            console.error('[i18n] 获取国际化文本失败:', error);
            console.debug('[i18n] 失败时的 key:', key);
        }
        return fallback;
    }

    /** 获取站点基础路径 */
    function getSiteBasePath() {
        const pathname = window.location?.pathname || '/';
        const idx = pathname.lastIndexOf('/');
        return idx >= 0 ? pathname.slice(0, idx + 1) : '/';
    }

    /** 防抖 */
    function debounce(fn, wait) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(null, args), wait);
        };
    }

    /** 复制文本到剪贴板 */
    async function copyTextToClipboard(text) {
        const t = String(text || '');
        if (!t) return false;

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(t);
                return true;
            }
        } catch (error) {
            console.error('[clipboard] 复制文本到剪贴板失败:', error);
        }

        try {
            const ta = document.createElement('textarea');
            ta.value = t;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;left:-9999px;top:0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return !!ok;
        } catch (error) {
            console.error('[clipboard] 复制文本到剪贴板失败:', error);
            return false;
        }
    }

    // ==================== Front Matter 剥离 ====================

    /**
     * 剥离 Markdown 文件开头的 Front Matter（--- 包裹的 YAML 头部）
     */
    function stripFrontMatter(markdown) {
        if (typeof markdown !== 'string' || !markdown) return '';

        const text = markdown.replace(/^\uFEFF/, '');
        const lines = text.split(/\r?\n/);
        if (lines.length === 0) return text;

        // 仅当第一行是 --- 时处理
        if (lines[0].trim() !== '---') return text;

        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                const rest = lines.slice(i + 1).join('\n');
                return rest.replace(/^\s*\n/, '');
            }
        }

        return text;
    }

    // ==================== 资源 URL 重写 ====================

    /**
     * 重写 Markdown 中的资源 URL（图片、链接等）
     * 将相对路径转换为绝对路径，支持站点根目录资源
     */
    function rewriteMarkdownAssetUrls(rootEl) {
        if (!rootEl) return;

        const sourcePath = String(window.__mdSourcePath || '');
        const sourceDir = sourcePath.includes('/')
            ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1)
            : '';

        const siteBasePath = getSiteBasePath();
        const origin = window.location?.origin || '';
        const mdBase = origin + siteBasePath + sourceDir.replace(/^\/+/, '');
        const siteBaseNoSlash = siteBasePath.endsWith('/')
            ? siteBasePath.slice(0, -1)
            : siteBasePath;

        function toAbsoluteBySiteRoot(pathLike) {
            const prefixed = (siteBaseNoSlash || '') + '/' + String(pathLike).replace(/^\/+/, '');
            return new URL(prefixed, origin).href;
        }

        rootEl.querySelectorAll('img').forEach((img) => {
            const rawSrc = img.getAttribute('src');
            if (!rawSrc) return;

            const src = String(rawSrc).trim().replace(/\\/g, '/');
            if (!src) return;

            // 保留绝对/外部/Data URL
            if (/^(https?:|data:|blob:|\/\/)/i.test(src)) return;
            if (src.startsWith('#')) return;

            try {
                // 根目录绝对路径
                if (src.startsWith('/')) {
                    const prefixed = (siteBaseNoSlash || '') + src;
                    img.setAttribute('src', new URL(prefixed, origin).href);
                    return;
                }

                // assets/ 资源统一解析到站点根目录
                if (/^(?:\.\/|\.\.\/)*assets\//i.test(src) || /^assets\//i.test(src)) {
                    const normalized = src.replace(/^(?:\.\/|\.\.\/)+/, '');
                    img.setAttribute('src', toAbsoluteBySiteRoot(normalized));
                    return;
                }

                // 相对路径解析到 Markdown 文件所在目录
                img.setAttribute('src', new URL(src, mdBase).href);
            } catch (error) {
                console.error('[markdown] 重写资源 URL 失败:', error);
            }
        });
    }

    // ==================== Markdown 预处理 ====================

    /**
    * 规范化有序列表缩进
    * 去掉 "1." "2." 等标记前的 1-3 个空格，防止 marked 解析为普通段落
    */
    function normalizeOrderedListIndentation(md) {
        if (!md || typeof md !== 'string') return md || '';

        var blocks = [];
        var idx = 0;

        // 保护围栏代码块
        var escaped = md.replace(/```[\s\S]*?```/g, function (m) {
            var key = '@@CODELIST_' + idx++ + '@@';
            blocks.push(m);
            return key;
        });

        var result = escaped.replace(/^[ \t]{1,3}(\d+[\.\)])/gm, '$1');

        return result.replace(/@@CODELIST_(\d+)@@/g, function (_, n) {
            return blocks[parseInt(n, 10)] || '';
        });
    }

    /**
     * 转换 Obsidian 风格的图片嵌入 [[image.png]]
     */
    function transformObsidianImageEmbeds(markdown) {
        if (typeof markdown !== 'string' || !markdown) return markdown || '';

        return markdown.replace(/!\[\[([^\]\n]+)\]\]/g, (match, inner) => {
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

            // Obsidian 默认将附件存储在 blogs/图片/ 下
            if (!hasKnownPrefix && isBareFilename) {
                src = `/blogs/图片/${src}`;
            }

            return `![${alt}](${src})`;
        });
    }

    // ==================== 列表标记颜色 ====================

    /**
     * 为列表项随机分配马卡龙色系标记颜色
     */
    function applyRandomMacaronListMarkerColors(rootEl) {
        if (!rootEl) return;

        const palette = [
            '#f59ab5', '#74c4f7', '#86dfbe', '#f7bf8a',
            '#b29af2', '#eea9ef', '#8fd8fb', '#f6bddc'
        ];

        rootEl.querySelectorAll('ul li, ol li').forEach((li) => {
            const idx = Math.floor(Math.random() * palette.length);
            li.style.setProperty('--macaron-marker-color', palette[idx]);
        });
    }

    // ==================== Mermaid 图表 ====================

    /**
     * 渲染 Mermaid 图表
     * 支持折叠、代码/视图切换、全屏预览
     */
    function renderMermaidDiagrams(rootEl) {
        if (!rootEl) return;

        // ---- 折叠/展开辅助 ----
        function collapseBody(container, bodyEl) {
            if (!container || !bodyEl) return;

            // 清理旧事件监听
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
            bodyEl.style.cssText = `
                overflow: hidden;
                transition: height ${CODE_ANIMATION_MS}ms ease, opacity 220ms ease;
                height: ${currentHeight}px;
                opacity: 1;
            `;

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

            // 清理旧事件监听
            if (bodyEl.__collapseEndHandler) {
                bodyEl.removeEventListener('transitionend', bodyEl.__collapseEndHandler);
                bodyEl.__collapseEndHandler = null;
            }
            if (bodyEl.__expandEndHandler) {
                bodyEl.removeEventListener('transitionend', bodyEl.__expandEndHandler);
                bodyEl.__expandEndHandler = null;
            }

            bodyEl.hidden = false;
            bodyEl.style.cssText = `
                overflow: hidden;
                transition: height ${CODE_ANIMATION_MS}ms ease, opacity 220ms ease;
                height: 0px;
                opacity: 0;
            `;

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

        // ---- 查找 Mermaid 代码块 ----
        const mermaidCodeBlocks = Array.from(
            rootEl.querySelectorAll('pre > code.language-mermaid, pre > code.lang-mermaid')
        ).filter((codeEl) => !codeEl.closest('.mermaid-block'));

        mermaidCodeBlocks.forEach((codeEl) => {
            const preEl = codeEl.parentElement;
            if (!preEl || !preEl.parentElement) return;

            const source = (codeEl.textContent || '').trim();

            // 构建包装结构
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

            actions.append(btnCopy, btnView, btnFullscreen, btnToggle);
            header.append(langEl, actions);

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

            body.append(diagramWrap, sourceWrap);
            block.append(header, body);

            preEl.parentElement.replaceChild(block, preEl);

            // ---- 事件绑定 ----
            let lastToggleAt = 0;

            btnCopy.addEventListener('click', async () => {
                const ok = await copyTextToClipboard(source);
                if (!ok) return;

                btnCopy.classList.add('is-copied');
                const label = btnCopy.querySelector('.code-copy-label');
                if (label) label.textContent = '已复制';

                setTimeout(() => {
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

                if (!isCodeMode && diagram.getAttribute('data-mermaid-rendered') !== '1' &&
                    diagram.getAttribute('data-mermaid-rendering') !== '1') {
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
                if (willCollapse) {
                    collapseBody(block, body);
                } else {
                    expandBody(block, body);
                }

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

        // ---- 渲染 Mermaid 图表 ----
        const mermaidNodes = Array.from(
            rootEl.querySelectorAll('.mermaid-block__diagram:not([data-mermaid-rendered="1"]):not([data-mermaid-rendering="1"])')
        );
        if (!mermaidNodes.length) return;

        mermaidNodes.forEach((node) => node.setAttribute('data-mermaid-rendering', '1'));

        if (!window.mermaid) {
            const currentRetry = Number(rootEl.dataset.mermaidRetryCount || '0');
            if (currentRetry < MERMAID_RETRY_MAX) {
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
                Promise.resolve(result)
                    .then(() => {
                        mermaidNodes.forEach((node) => {
                            node.setAttribute('data-mermaid-rendered', '1');
                            node.removeAttribute('data-mermaid-rendering');
                        });
                    })
                    .catch((err) => {
                        mermaidNodes.forEach((node) => node.removeAttribute('data-mermaid-rendering'));
                        console.warn('mermaid run error', err);
                    });
            } else if (typeof window.mermaid.init === 'function') {
                window.mermaid.init(undefined, mermaidNodes);
                mermaidNodes.forEach((node) => {
                    node.setAttribute('data-mermaid-rendered', '1');
                    node.removeAttribute('data-mermaid-rendering');
                });
            }
        } catch (e) {
            mermaidNodes.forEach((node) => node.removeAttribute('data-mermaid-rendering'));
            console.warn('mermaid render error', e);
        }
    }

    /**
     * 创建 Mermaid 全屏查看器
     */
    function ensureMermaidFullscreenViewer() {
        if (window.__mermaidFullscreenViewer) return window.__mermaidFullscreenViewer;

        let overlay = document.getElementById('mermaid-viewer-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mermaid-viewer-overlay';
            overlay.className = 'mermaid-viewer-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.innerHTML = `
                <div class="mermaid-viewer-stage" role="dialog" aria-modal="true" aria-label="Mermaid 全屏预览">
                    <div class="mermaid-viewer-toolbar">
                        <button class="mermaid-viewer-close" type="button" aria-label="关闭全屏预览">&times;</button>
                    </div>
                    <div class="mermaid-viewer-content"></div>
                </div>
            `;
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
            svgClone.style.cssText = 'width:auto;height:auto;max-width:100%;max-height:100%';
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

        // ---- 事件绑定 ----
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

            if (closeBtn) {
                closeBtn.addEventListener('click', close);
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
            });
        }

        window.__mermaidFullscreenViewer = { open, close };
        return window.__mermaidFullscreenViewer;
    }

    // ==================== 图片查看器 ====================

    /**
     * 设置文章详情页图片查看器
     * 支持缩放、拖拽、导航、下载、复制
     */
    function setupBlogDetailImageViewer(rootEl) {
        if (!rootEl) return;
        if (!document.body?.classList.contains('blog-detail-page')) return;

        // 关于页面不启用
        if (document.body.classList.contains('about-page')) {
            const staleOverlay = document.getElementById('image-viewer-overlay');
            if (staleOverlay?.parentNode) {
                staleOverlay.parentNode.removeChild(staleOverlay);
            }
            document.body.classList.remove('image-viewer-open');
            return;
        }

        let overlay = document.getElementById('image-viewer-overlay');
        if (!overlay) {
            overlay = createImageViewerOverlay();
        }

        const state = overlay.__viewerState || {
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

        // 收集图片
        const images = Array.from(rootEl.querySelectorAll('img'))
            .filter((img) => {
                const src = (img.getAttribute('src') || '').trim();
                if (!src) return false;
                if (img.closest('.image-viewer-overlay')) return false;
                return true;
            })
            .map((img) => ({
                element: img,
                src: img.currentSrc || img.getAttribute('src') || '',
                alt: img.getAttribute('alt') || '图片预览'
            }))
            .filter((item) => !!item.src);

        const items = images.map((item) => ({ src: item.src, alt: item.alt }));

        if (overlay.__setViewerItems) {
            overlay.__setViewerItems(items);
        }

        // 为每个图片绑定点击事件
        images.forEach((item, idx) => {
            const img = item.element;
            img.classList.add('md-zoomable-image');
            if (!img.hasAttribute('tabindex')) img.setAttribute('tabindex', '0');
            if (!img.hasAttribute('role')) img.setAttribute('role', 'button');
            img.setAttribute('aria-label', '点击查看大图');

            if (img.dataset.viewerBound === '1') return;
            img.dataset.viewerBound = '1';

            const openViewer = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (typeof overlay.__openViewerAt === 'function') {
                    overlay.__openViewerAt(idx);
                }
            };

            img.addEventListener('click', openViewer);
            img.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    openViewer(e);
                }
            });
        });
    }

    /**
     * 创建图片查看器覆盖层 DOM
     */
    function createImageViewerOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'image-viewer-overlay';
        overlay.className = 'image-viewer-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        overlay.innerHTML = `
            <div class="image-viewer-stage" role="dialog" aria-modal="true" aria-label="图片查看器">
                <button class="image-viewer-nav image-viewer-prev" type="button" aria-label="上一张">&#10094;</button>
                <button class="image-viewer-nav image-viewer-next" type="button" aria-label="下一张">&#10095;</button>
                <div class="image-viewer-toolbar">
                    <span class="image-viewer-counter">1 / 1</span>
                    <button class="image-viewer-tool image-viewer-download" type="button" aria-label="下载图片">
                        <i class="fas fa-download" aria-hidden="true"></i>
                        <span class="image-viewer-tool-label">下载</span>
                    </button>
                    <button class="image-viewer-tool image-viewer-copy" type="button" aria-label="复制图片">
                        <i class="fas fa-copy" aria-hidden="true"></i>
                        <span class="image-viewer-tool-label">复制</span>
                    </button>
                    <button class="image-viewer-close" type="button" aria-label="关闭图片查看器">&times;</button>
                </div>
                <img class="image-viewer-image" alt="" draggable="false" />
            </div>
        `;

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

        // ---- 工具函数 ----
        function getViewerI18n() {
            try {
                const lang = getLang();
                const map = window.siteI18n?.translations?.[lang] || {};
                return {
                    download: map.image_download || '下载',
                    copy: map.image_copy || '复制',
                    copied: map.image_copied || '已复制',
                    copyFailed: map.image_copy_failed || '复制失败'
                };
            } catch (error) {
                console.error('[markdown] 获取图片查看器国际化文本失败:', error);
                return { download: '下载', copy: '复制', copied: '已复制', copyFailed: '复制失败' };
            }
        }

        function applyViewerI18n() {
            const t = getViewerI18n();
            const labels = [
                { el: downloadBtn, label: t.download },
                { el: copyBtn, label: t.copy }
            ];
            labels.forEach(({ el, label }) => {
                if (!el) return;
                const span = el.querySelector('.image-viewer-tool-label');
                if (span) span.textContent = label;
                el.setAttribute('aria-label', label);
            });
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
            if (!item?.src) return 'image';
            try {
                const clean = String(item.src).split('#')[0].split('?')[0];
                return clean.split('/').pop() || 'image';
            } catch (error) {
                console.error('[markdown] 获取下载文件名失败:', error);
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
            const normalized = ((index % len) + len) % len;
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
            if (!item?.src || !copyBtn) return;

            const t = getViewerI18n();
            const label = copyBtn.querySelector('.image-viewer-tool-label');

            function setCopyText(text) {
                if (label) label.textContent = text;
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
            } catch (error) {
                console.error('[markdown] 复制图片到剪贴板失败:', error);
                setCopyText(t.copyFailed);
            }

            setTimeout(() => {
                const nextT = getViewerI18n();
                setCopyText(nextT.copy);
            }, 1200);
        }

        function downloadCurrentImage() {
            const item = state.items[state.index];
            if (!item?.src) return;

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

        // ---- 事件绑定 ----
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === stage) closeViewer();
        });

        closeBtn?.addEventListener('click', closeViewer);
        prevBtn?.addEventListener('click', () => showAt(state.index - 1));
        nextBtn?.addEventListener('click', () => showAt(state.index + 1));
        downloadBtn?.addEventListener('click', downloadCurrentImage);
        copyBtn?.addEventListener('click', copyCurrentImage);

        applyViewerI18n();
        document.addEventListener('site:languageChanged', applyViewerI18n);

        document.addEventListener('keydown', (e) => {
            if (!overlay.classList.contains('is-open')) return;
            if (e.key === 'Escape') { closeViewer(); return; }
            if (e.key === 'ArrowLeft') { showAt(state.index - 1); return; }
            if (e.key === 'ArrowRight') { showAt(state.index + 1); }
        });

        // ---- 图片拖拽与缩放 ----
        if (imageEl) {
            imageEl.addEventListener('wheel', (e) => {
                if (!overlay.classList.contains('is-open')) return;
                e.preventDefault();
                const ratio = e.deltaY < 0 ? IMAGE_SCALE_STEP : 1 / IMAGE_SCALE_STEP;
                const nextScale = clamp(state.scale * ratio, IMAGE_SCALE_MIN, IMAGE_SCALE_MAX);
                if (nextScale === state.scale) return;
                state.scale = nextScale;
                if (state.scale === 1) {
                    state.tx = 0;
                    state.ty = 0;
                }
                applyTransform();
            }, { passive: false });

            imageEl.addEventListener('mousedown', (e) => {
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

            imageEl.addEventListener('dragstart', (e) => e.preventDefault());
        }

        // 全局鼠标事件
        window.addEventListener('mousemove', (e) => {
            if (!state.dragging || !overlay.classList.contains('is-open')) return;
            state.tx = state.dragOriginX + (e.clientX - state.dragStartX);
            state.ty = state.dragOriginY + (e.clientY - state.dragStartY);
            applyTransform();
        });

        window.addEventListener('mouseup', () => {
            if (!state.dragging) return;
            state.dragging = false;
            applyTransform();
        });

        return overlay;
    }

    // ==================== 代码块增强 ====================

    /**
     * 增强代码块：添加行号、复制按钮、折叠/展开
     */
    function enhanceCodeBlocks(rootEl) {
        if (!rootEl) return;

        // ---- 折叠/展开辅助 ----
        function collapseCodeBlock(container, bodyEl) {
            if (!container || !bodyEl) return;

            // 清理旧事件
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
            bodyEl.style.cssText = `
                overflow: hidden;
                transition: height ${CODE_ANIMATION_MS}ms ease, opacity 220ms ease;
                height: ${currentHeight}px;
                opacity: 1;
            `;

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
            bodyEl.style.cssText = `
                overflow: hidden;
                transition: height ${CODE_ANIMATION_MS}ms ease, opacity 220ms ease;
                height: 0px;
                opacity: 0;
            `;

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

        // ---- 语言检测 ----
        function normalizeLangLabel(raw) {
            const s = String(raw || '').trim().toLowerCase();
            if (!s) return 'CODE';

            const map = {
                'c++': 'CPP', 'cpp': 'CPP', 'cxx': 'CPP', 'cc': 'CPP',
                'c': 'C',
                'python': 'PY', 'py': 'PY',
                'javascript': 'JS', 'js': 'JS',
                'typescript': 'TS', 'ts': 'TS',
                'java': 'JAVA',
                'go': 'GO',
                'rust': 'RUST',
                'bash': 'BASH', 'sh': 'BASH', 'shell': 'BASH',
                'json': 'JSON',
                'html': 'HTML',
                'xml': 'XML',
                'css': 'CSS',
                'markdown': 'MD', 'md': 'MD',
                'sql': 'SQL',
                'yaml': 'YAML', 'yml': 'YAML'
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

        // ---- 处理每个代码块 ----
        const pres = Array.from(rootEl.querySelectorAll('pre'));
        pres.forEach((pre) => {
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

            actions.append(btnCopy, btnToggle);
            header.append(langEl, actions);

            const body = document.createElement('div');
            body.className = 'codeblock__body';

            // 将原 pre 移动到容器内
            const preParent = pre.parentNode;
            if (!preParent) return;
            preParent.insertBefore(container, pre);
            body.appendChild(pre);
            container.append(header, body);

            body.style.cssText = 'overflow:hidden;opacity:1';

            // 添加行号
            addCodeBlockLineNumbers(body, pre, code);

            let lastToggleAt = 0;

            // ---- 复制按钮 ----
            btnCopy.addEventListener('click', async () => {
                const text = code.innerText || code.textContent || '';
                const ok = await copyTextToClipboard(text);
                if (!ok) return;

                btnCopy.classList.add('is-copied');
                const span = btnCopy.querySelector('span');
                if (span) span.textContent = t('code_copied', '已复制');

                setTimeout(() => {
                    btnCopy.classList.remove('is-copied');
                    const s = btnCopy.querySelector('.code-copy-label');
                    if (s) s.textContent = t('code_copy', '复制');
                }, 900);
            });

            // ---- 折叠/展开按钮 ----
            btnToggle.addEventListener('click', () => {
                const now = Date.now();
                if (now - lastToggleAt < 200) return;
                lastToggleAt = now;

                const collapsed = !container.classList.contains('is-collapsed');
                if (collapsed) {
                    collapseCodeBlock(container, body);
                } else {
                    expandCodeBlock(container, body);
                }

                const icon = btnToggle.querySelector('i');
                const label = btnToggle.querySelector('span');
                if (collapsed) {
                    if (icon) icon.className = 'fas fa-chevron-down';
                    if (label) label.textContent = t('code_expand', '展开');
                } else {
                    if (icon) icon.className = 'fas fa-chevron-up';
                    if (label) label.textContent = t('code_collapse', '收起');
                }
            });
        });

        // ---- 国际化更新 ----
        function updateCodeBlockI18n() {
            try {
                document.querySelectorAll('.codeblock:not(.mermaid-block)').forEach((container) => {
                    const btns = container.querySelectorAll('.codeblock__btn');
                    const btnCopy = btns[0];
                    const btnToggle = btns[1];

                    if (btnCopy) {
                        const span = btnCopy.querySelector('.code-copy-label');
                        if (span) span.textContent = t('code_copy', '复制');
                    }

                    if (btnToggle) {
                        const span = btnToggle.querySelector('.code-toggle-label');
                        const icon = btnToggle.querySelector('i');
                        const collapsed = container.classList.contains('is-collapsed');
                        if (span) {
                            span.textContent = collapsed ? t('code_expand', '展开') : t('code_collapse', '收起');
                        }
                        if (icon) {
                            icon.className = collapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
                        }
                    }
                });
            } catch (error) {
                console.error('[i18n] 更新代码块国际化文本失败:', error);
            }
        }

        if (!window.__codeblockI18nBound) {
            window.__codeblockI18nBound = true;
            document.addEventListener('site:languageChanged', updateCodeBlockI18n);
        }

        updateCodeBlockI18n();
    }

    /**
     * 为代码块添加行号
     */
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

        if (preEl.parentNode === bodyEl) {
            bodyEl.removeChild(preEl);
        }
        content.append(gutter, preEl);
        bodyEl.appendChild(content);
    }

    // ==================== 主渲染函数 ====================

    /**
     * 渲染 Markdown 内容到 #markdown-content 元素
     */
    function renderMarkdownContent() {
        const contentElement = document.getElementById('markdown-content');
        if (!contentElement) return;

        const rawMarkdown = stripFrontMatter(contentElement.textContent || '');

        // ---- 内部引用占位 ----
        const internalRefPlaceholders = [];

        function stashInternalRefs(markdownText) {
            if (!markdownText) return '';
            return markdownText.replace(/\[\[#([^\]\n]+)\]\]/g, (match, inner) => {
                const idx = internalRefPlaceholders.length;
                internalRefPlaceholders.push({ raw: String(inner || '').trim() });
                return `@@INTERNALREF_${idx}@@`;
            });
        }

        // ---- 数学表达式提取 ----
        const displayMathBlocks = [];
        const inlineMathBlocks = [];

        function extractMathFrom(text) {
            if (!text) return '';

            // 保护代码块
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

            // 显示数学 $$...$$
            let tmp = protectedText.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
                const inner = match.slice(2, -2);
                const idx = displayMathBlocks.length;
                displayMathBlocks.push(inner);
                return `@@MATHD_${idx}@@`;
            });

            // 内联数学 $...$（转义 \$ 跳过）
            let out = '';
            for (let i = 0; i < tmp.length; i++) {
                const ch = tmp[i];
                if (ch === '$' && tmp[i + 1] !== '$' && tmp[i - 1] !== '\\') {
                    let j = i + 1;
                    let closed = false;
                    while (j < tmp.length) {
                        if (tmp[j] === '$' && tmp[j - 1] !== '\\') {
                            closed = true;
                            break;
                        }
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
            }

            // 恢复代码块
            return out.replace(/@@CODE_(\d+)@@/g, (_, num) => {
                const i = parseInt(num, 10);
                return codeBlocks[i] || '';
            });
        }

        // ---- 自定义块解析 ----
        function buildOptionsHtml(optionsText) {
            if (!optionsText) return '<div class="md-options"></div>';

            const rawLines = optionsText.split(/\r?\n/);
            const explicitKeyPattern = /^\s*([A-Ga-g])\s*[\)）\.：:\-]?\s*(.*)$/;
            const hasExplicitKeys = rawLines.some((line) => explicitKeyPattern.test(line));
            const optionItems = [];

            if (hasExplicitKeys) {
                let current = null;
                rawLines.forEach((line) => {
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
                rawLines.forEach((line) => {
                    if (!line.trim()) return;
                    optionItems.push({
                        key: String.fromCharCode('A'.charCodeAt(0) + autoIndex),
                        content: line.trim()
                    });
                    autoIndex++;
                });
            }

            const parts = ['<div class="md-options">'];
            optionItems.forEach((item) => {
                const optionProtected = extractMathFrom((item.content || '').trim());
                const optionHtmlRaw = window.marked?.parse?.(optionProtected) || optionProtected;
                parts.push(`
                    <div class="md-option" role="button" tabindex="0" data-key="${item.key}">
                        <strong class="md-option-key">${item.key}</strong>
                        <div class="md-option-text">${optionHtmlRaw}</div>
                    </div>
                `);
            });
            parts.push('</div>');
            return parts.join('\n');
        }

        function processCustomBlocks(markdownText) {
            if (!markdownText) return markdownText;

            // 先处理 question 和 options
            const questionsHtml = [];
            const optionsHtml = [];

            function processInnerForQuestionsAndOptions(innerText) {
                if (!innerText) return '';

                let step = innerText.replace(/\[question\]([\s\S]*?)\[\\question\]/g, (_, qinner) => {
                    const innerProtected = extractMathFrom(qinner);
                    const innerHtml = window.marked?.parse?.(innerProtected) || innerProtected;
                    const idx = questionsHtml.length;
                    questionsHtml.push(innerHtml);
                    return `@@QUESTION_${idx}@@`;
                });

                step = step.replace(/\[options\]([\s\S]*?)\[\\options\]/g, (_, optInner) => {
                    const idx = optionsHtml.length;
                    optionsHtml.push(buildOptionsHtml(optInner));
                    return `@@OPTION_${idx}@@`;
                });

                return step;
            }

            let transformed = processInnerForQuestionsAndOptions(markdownText);

            // 处理 task
            transformed = transformed.replace(/\[task\]([\s\S]*?)\[\\task\]/g, (_, inner) => {
                return '\n<div class="md-task">' + inner + '</div>\n';
            });

            // 处理答案块
            const answerRegex = /\[(answer|analysis)\]([\s\S]*?)\[\\\1\]/g;
            const segments = [];
            let lastIdx = 0;
            let m;

            while ((m = answerRegex.exec(transformed)) !== null) {
                const before = transformed.slice(lastIdx, m.index);
                if (before) segments.push({ type: 'text', content: extractMathFrom(before) });

                const tag = m[1];
                const innerRaw = m[2] || '';
                const innerProtected = extractMathFrom(innerRaw);
                const innerHtml = window.marked?.parse?.(innerProtected) || innerProtected;
                segments.push({ type: 'anspart', sub: tag, raw: innerRaw, content: innerHtml });

                lastIdx = m.index + m[0].length;
            }

            if (lastIdx < transformed.length) {
                const tail = transformed.slice(lastIdx);
                if (tail) segments.push({ type: 'text', content: extractMathFrom(tail) });
            }

            // 合并 answer + analysis
            let combinedProtected = '';
            const answersHtml = [];

            function extractAnswerKeys(rawText) {
                const raw = String(rawText || '').trim();
                if (!raw) return [];

                const compact = raw.replace(/[\s,，;；、/|·\-\.\)）\:]*/g, '');
                if (compact && /^[A-G]+$/i.test(compact)) {
                    return compact.toUpperCase().split('').filter((k, i, arr) => arr.indexOf(k) === i);
                }
                return [];
            }

            function resolveAnswerMeta(rawText) {
                const raw = String(rawText || '');
                const keys = extractAnswerKeys(raw);
                if (keys.length) {
                    return { keys, mode: keys.length > 1 ? 'multi' : 'single' };
                }

                let letter = '';
                const singleLetter = raw.trim().match(/^([A-Ga-g])\s*[\)\.]?\s*$/);
                if (singleLetter) {
                    letter = singleLetter[1].toUpperCase();
                } else {
                    const kw = raw.match(/(?:答案|结论|Answer)[:：\s]*([A-Ga-g])/i);
                    if (kw) letter = kw[1].toUpperCase();
                    else {
                        const firstLine = raw.split(/\r?\n/)[0] || '';
                        const m2 = firstLine.match(/^\s*([A-Ga-g])[\)）\.：:\-]?/);
                        if (m2) letter = m2[1].toUpperCase();
                    }
                }
                return { keys: letter ? [letter] : [], mode: 'single' };
            }

            for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                if (seg.type === 'text') {
                    combinedProtected += seg.content;
                    continue;
                }
                if (seg.type === 'anspart' && seg.sub === 'answer') {
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
                        if (s2.type === 'text' && (s2.content || '').trim() === '') continue;
                        break;
                    }

                    if (j < segments.length && segments[j].type === 'anspart' && segments[j].sub === 'analysis') {
                        i = j;
                    }

                    answersHtml.push({
                        answerHtml: seg.content || '',
                        analysisHtml,
                        answerRaw: seg.raw || ''
                    });
                    combinedProtected += `@@ANSWERN_${answersHtml.length - 1}@@`;
                    continue;
                }
                if (seg.type === 'anspart' && seg.sub === 'analysis') {
                    combinedProtected += seg.content || '';
                }
            }

            // Marked 解析
            if (window.marked?.setOptions) {
                window.marked.setOptions({ gfm: true });
            }
            let html = window.marked?.parse?.(combinedProtected) || combinedProtected;

            // 还原答案占位符
            html = html.replace(/@@ANSWERN_(\d+)@@/g, (_, num) => {
                const i = parseInt(num, 10);
                const obj = answersHtml[i] || { answerHtml: '', analysisHtml: '', answerRaw: '' };
                const contentId = `answer-content-${i}`;
                const submitId = `answer-submit-${i}`;
                const answerMeta = resolveAnswerMeta(obj.answerRaw || '');
                const answerKeys = answerMeta.keys || [];
                const isMultiChoice = answerMeta.mode === 'multi';
                const answerKeysAttr = answerKeys.join(',');

                const actionHtml = isMultiChoice ? `
                    <div class="answer-actions">
                        <div class="answer-actions-row">
                            <span class="answer-type-badge" data-i18n="multi_choice_label" aria-hidden="true">多选题</span>
                            <button id="${submitId}" class="answer-submit" type="button" aria-expanded="false" aria-controls="${contentId}">
                                <span class="answer-submit-label" data-i18n="submit_answer">提交答案</span>
                                <span class="answer-submit-icon" aria-hidden="true">√</span>
                            </button>
                        </div>
                        <button class="answer-toggle" type="button" aria-expanded="false" aria-controls="${contentId}">
                            <svg class="answer-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                ` : `
                    <button id="${submitId}" class="answer-toggle" type="button" aria-expanded="false" aria-controls="${contentId}">
                        <svg class="answer-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                `;

                return `
                    <div class="answer-block${isMultiChoice ? ' is-multiple' : ''}" data-answer="${answerKeys[0] || ''}" data-answer-keys="${answerKeysAttr}" data-answer-mode="${answerMeta.mode}">
                        ${actionHtml}
                        <div id="${contentId}" class="answer-content" hidden>
                            <div class="answer-inner">
                                <div class="answer-header"><strong data-i18n="answer_label">答案</strong>: <span class="answer-letter">${obj.answerHtml || ''}</span></div>
                                <div class="answer-analysis">${obj.analysisHtml || ''}</div>
                            </div>
                        </div>
                    </div>
                `;
            });

            // 还原 question 和 options
            html = html.replace(/@@QUESTION_(\d+)@@/g, (_, num) => {
                const i = parseInt(num, 10);
                return `\n<div class="md-question">${questionsHtml[i] || ''}</div>\n`;
            });

            html = html.replace(/@@OPTION_(\d+)@@/g, (_, num) => {
                const i = parseInt(num, 10);
                return optionsHtml[i] || '';
            });

            return html;
        }

        // ---- 预处理 + 解析 ----
        const markdown = transformObsidianImageEmbeds(
            normalizeOrderedListIndentation(
                stashInternalRefs(rawMarkdown)
            )
        );

        let html = processCustomBlocks(markdown);

        // 还原数学占位符
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

        // ==================== 后处理 ====================

        // ---- 任务标签标注 ----
        function annotateTaskLabels(root) {
            if (!root) return;

            const children = Array.from(root.children);
            if (!children.length) return;

            let h1Index = 0;
            let h2Index = 0;
            let h3Index = 0;
            const taskInfos = [];
            let separatorDepth = 0;
            let inheritedDepth = 0;

            children.forEach((el) => {
                if (!el?.tagName) return;
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

                if (el.classList?.contains('md-task')) {
                    const depth = Math.max(separatorDepth, inheritedDepth);
                    taskInfos.push({
                        element: el,
                        fullKey: [h1Index, h2Index, h3Index].join('-'),
                        depth
                    });
                    separatorDepth = 0;
                    inheritedDepth = depth;
                    return;
                }

                separatorDepth = 0;
                inheritedDepth = 0;
            });

            function getDisplayKey(fullKey, depth) {
                const parts = fullKey.split('-').map(Number);
                if (depth > 0) {
                    let stripped = 0;
                    for (let i = parts.length - 1; i >= 0 && stripped < depth; i--) {
                        if (parts[i] > 0 && i > 0) {
                            parts[i] = 0;
                            stripped++;
                        }
                    }
                }
                return parts.filter((num) => num > 0).join('-');
            }

            const displayKeyGroups = new Map();
            taskInfos.forEach((info) => {
                const key = getDisplayKey(info.fullKey, info.depth);
                if (!displayKeyGroups.has(key)) displayKeyGroups.set(key, []);
                displayKeyGroups.get(key).push(info);
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
            const container = root?.nodeType === 1 ? root : contentElement;
            const label = t('exercise_label', '例题');
            container.querySelectorAll('.md-task').forEach((task) => {
                task.dataset.taskLabelText = label;
            });
        }

        annotateTaskLabels(contentElement);
        refreshExerciseLabels(contentElement);

        // ---- 标题 ID 与内部引用 ----
        (function assignHeadingIdsAndLinkifyRefs(root) {
            if (!root) return;

            const STAR_SUFFIX_RE = /(?:【\s*[!！]\s*】|\[\s*[!！]\s*\]|［\s*[!！]\s*］)\s*$/;

            function stripStarSuffix(text) {
                return String(text || '').replace(STAR_SUFFIX_RE, '').trim();
            }

            function hasStarSuffix(text) {
                return STAR_SUFFIX_RE.test(String(text || ''));
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

            root.querySelectorAll('h1, h2, h3').forEach((h) => {
                try {
                    const rawText = (h.textContent || '').trim();
                    if (!rawText) return;

                    const cleanText = stripStarSuffix(rawText) || rawText;
                    h.dataset.headingPlainText = cleanText;

                    if (hasStarSuffix(rawText)) {
                        if (!h.dataset.starDecorated) {
                            h.textContent = cleanText;
                            const star = document.createElement('span');
                            star.className = 'heading-star-marker';
                            star.setAttribute('aria-hidden', 'true');
                            star.textContent = '★';
                            h.appendChild(star);
                            h.dataset.starDecorated = '1';
                            h.dataset.starMarked = '1';
                        }
                    }

                    let id = h.id?.trim() || slugify(cleanText) || 'heading';
                    const base = id;
                    let c = used.get(base) || 0;
                    while (document.getElementById(id)) {
                        c += 1;
                        id = base + '-' + c;
                    }
                    used.set(base, c);
                    h.id = id;

                    map.set(rawText, id);
                    map.set(cleanText, id);
                    map.set(slugify(rawText), id);
                    map.set(slugify(cleanText), id);
                } catch (error) {
                    console.error('[heading] 处理标题失败:', error);
                }
            });

            // 替换内部引用
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];
            while (walker.nextNode()) textNodes.push(walker.currentNode);

            const placeholderPattern = /@@INTERNALREF_(\d+)@@/g;
            textNodes.forEach((node) => {
                const parentTag = node.parentElement?.tagName?.toLowerCase() || '';
                if (['a', 'code', 'pre', 'textarea'].includes(parentTag)) return;

                const txt = node.nodeValue || '';
                if (!txt || (txt.indexOf('[#') === -1 && txt.indexOf('@@INTERNALREF_') === -1)) return;

                let m;
                let lastIndex = 0;
                const parts = [];

                placeholderPattern.lastIndex = 0;
                while ((m = placeholderPattern.exec(txt)) !== null) {
                    const before = txt.slice(lastIndex, m.index);
                    if (before) parts.push(document.createTextNode(before));

                    const idx = parseInt(m[1], 10);
                    const ref = internalRefPlaceholders[idx] || { raw: '' };
                    const refText = String(ref.raw || '').trim();
                    const normalizedTitle = refText.replace(/`+/g, '').trim();
                    const targetId = map.get(refText) || map.get(slugify(refText)) ||
                        map.get(normalizedTitle) || map.get(slugify(normalizedTitle));

                    if (targetId) {
                        const a = document.createElement('a');
                        a.setAttribute('href', '#' + targetId);
                        a.className = 'internal-ref';
                        a.textContent = normalizedTitle || refText;
                        parts.push(a);
                    } else {
                        parts.push(document.createTextNode(`[[#${refText}]]`));
                    }

                    lastIndex = m.index + m[0].length;
                }

                if (parts.length) {
                    const tail = txt.slice(lastIndex);
                    if (tail) parts.push(document.createTextNode(tail));
                    const frag = document.createDocumentFragment();
                    parts.forEach((p) => frag.appendChild(p));
                    node.parentNode.replaceChild(frag, node);
                }
            });
        })(contentElement);

        // ---- 内部引用点击处理 ----
        (function bindInternalRefClicks() {
            function findTocAnchorForId(id) {
                if (!id) return null;
                try {
                    if (window.CSS?.escape) {
                        return document.querySelector('#toc-list a[href="#' + CSS.escape(id) + '"]');
                    }
                    return document.querySelector('#toc-list a[href="#' + id.replace(/"/g, '\\"') + '"]');
                } catch (error) {
                    console.error('[markdown] 定位到 TOC 锚点失败:', error);
                    return null;
                }
            }

            document.addEventListener('click', (e) => {
                try {
                    const a = e.target?.closest?.('a.internal-ref[href^="#"]');
                    if (!a) return;
                    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

                    e.preventDefault();
                    e.stopPropagation();

                    const href = (a.getAttribute('href') || '').trim();
                    if (!href || href.charAt(0) !== '#') return;
                    const id = href.slice(1);

                    const tocAnchor = findTocAnchorForId(id);
                    if (tocAnchor) {
                        tocAnchor.click();
                        return;
                    }

                    const header = document.getElementById(id);
                    if (!header) return;

                    const nav = document.querySelector('.navbar');
                    const navHeight = nav ? nav.offsetHeight : 0;
                    const y = header.getBoundingClientRect().top + window.scrollY - navHeight - 10;

                    if (window.__scrollingToTOC) return;
                    window.__scrollingToTOC = true;
                    const distance = Math.abs(y - window.scrollY);
                    const lockMs = Math.max(650, Math.min(2200, Math.round(distance * 0.9)));
                    window.scrollTo({ top: y, behavior: 'smooth' });
                    setTimeout(() => { window.__scrollingToTOC = false; }, lockMs);
                    try { history.replaceState(null, '', '#' + id); } catch (error) {
                        console.error('[navigation] 更新历史记录失败:', error);
                    }
                } catch (error) {
                    console.error('[navigation] 处理内部链接失败:', error);
                }
            }, true);
        })();

        // ---- KaTeX 渲染 ----
        try {
            if (window.katex?.render) {
                contentElement.querySelectorAll('.math-display-placeholder').forEach((el) => {
                    const src = decodeURIComponent(el.getAttribute('data-math') || '');
                    const span = document.createElement('span');
                    try {
                        window.katex.render(src, span, { displayMode: true, throwOnError: false });
                        el.parentNode.replaceChild(span, el);
                    } catch (error) {
                        console.error('[math] 渲染块级数学公式失败:', error);
                        el.textContent = `$$${src}$$`;
                    }
                });

                contentElement.querySelectorAll('.math-inline-placeholder').forEach((el) => {
                    const src = decodeURIComponent(el.getAttribute('data-math') || '');
                    const span = document.createElement('span');
                    try {
                        window.katex.render(src, span, { displayMode: false, throwOnError: false });
                        el.parentNode.replaceChild(span, el);
                    } catch (error) {
                        console.error('[math] 渲染行内数学公式失败:', error);
                        el.textContent = `$${src}$`;
                    }
                });
            } else if (window.renderMathInElement) {
                window.renderMathInElement(contentElement, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
                    ]
                });
            }
        } catch (error) {
            console.error('[math] 渲染数学公式失败:', error);
        }

        // ---- 资源重写 ----
        rewriteMarkdownAssetUrls(contentElement);

        // ---- Mermaid 渲染 ----
        renderMermaidDiagrams(contentElement);

        // ---- 图片查看器 ----
        setupBlogDetailImageViewer(contentElement);

        // ---- 列表颜色 ----
        applyRandomMacaronListMarkerColors(contentElement);

        // ---- 外部链接新窗口 ----
        contentElement.querySelectorAll('a').forEach((a) => {
            const href = a.getAttribute('href') || '';
            if (href.includes('blog-detail.html')) {
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener noreferrer');
            }
        });

        // ---- 代码高亮 ----
        if (window.hljs) {
            contentElement.querySelectorAll('pre code:not(.language-mermaid):not(.lang-mermaid)').forEach((block) => {
                window.hljs.highlightElement(block);
            });
        }

        // ---- 代码块增强 ----
        enhanceCodeBlocks(contentElement);

        // ---- 国际化 ----
        try {
            if (window.siteI18n?.applyTo) {
                window.siteI18n.applyTo(contentElement);
            }
        } catch (error) {
            console.error('[i18n] 应用国际化文本失败:', error);
        }

        // ==================== 答案折叠交互 ====================

        function expandAnswerBlock(answerBlock) {
            if (!answerBlock) return;
            const contentEl = answerBlock.querySelector('.answer-content');
            const toggle = answerBlock.querySelector('.answer-toggle');
            if (!contentEl) return;

            toggle?.classList.add('is-open');
            answerBlock.classList.add('is-open');
            toggle?.setAttribute('aria-expanded', 'true');

            contentEl.hidden = false;
            contentEl.style.cssText = 'overflow:hidden;transition:max-height 260ms ease,opacity 220ms ease';
            requestAnimationFrame(() => {
                contentEl.style.maxHeight = contentEl.scrollHeight + 'px';
                contentEl.style.opacity = '1';
            });

            const onEnd = () => {
                contentEl.style.maxHeight = '';
                contentEl.removeEventListener('transitionend', onEnd);
            };
            contentEl.addEventListener('transitionend', onEnd);

            // 锁定选项组
            try {
                const task = answerBlock.closest?.('.md-task');
                if (task) {
                    task.querySelectorAll('.md-options').forEach((g) => setOptionsLocked(g, true));
                }
            } catch (error) {
                console.error('[answer] 锁定选项组失败:', error);
            }
        }

        function collapseAnswerBlock(answerBlock) {
            if (!answerBlock) return;
            const contentEl = answerBlock.querySelector('.answer-content');
            const toggle = answerBlock.querySelector('.answer-toggle');
            if (!contentEl) return;

            toggle?.classList.remove('is-open');
            answerBlock.classList.remove('is-open');
            toggle?.setAttribute('aria-expanded', 'false');

            const cur = contentEl.scrollHeight;
            contentEl.style.maxHeight = cur + 'px';
            requestAnimationFrame(() => {
                contentEl.style.maxHeight = '0px';
                contentEl.style.opacity = '0';
            });

            const onEndHide = () => {
                contentEl.hidden = true;
                contentEl.removeEventListener('transitionend', onEndHide);
            };
            contentEl.addEventListener('transitionend', onEndHide);

            // 解锁选项组
            try {
                const task = answerBlock.closest?.('.md-task');
                if (task) {
                    const anyChosen = task.querySelectorAll('.md-option.is-correct, .md-option.is-wrong').length > 0;
                    if (!anyChosen) {
                        task.querySelectorAll('.md-options').forEach((g) => setOptionsLocked(g, false));
                    }
                }
            } catch (error) {
                console.error('[answer] 解锁选项组失败:', error);
            }
        }

        function setOptionsLocked(optionsGroup, locked) {
            if (!optionsGroup) return;
            optionsGroup.classList.toggle('is-locked', locked);
            optionsGroup.querySelectorAll('.md-option').forEach((btn) => {
                btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
                btn.setAttribute('tabindex', locked ? '-1' : '0');
                btn.classList.toggle('is-locked', locked);
            });
        }

        function getAnswerKeysFromBlock(answerBlock) {
            if (!answerBlock) return [];
            const attr = (answerBlock.getAttribute('data-answer-keys') || '').trim();
            if (attr) return attr.split(',').map((k) => k.trim().toUpperCase()).filter(Boolean);

            const single = (answerBlock.getAttribute('data-answer') || '').trim().toUpperCase();
            if (single) {
                const keys = single.replace(/[^A-G,]/g, '').split(',');
                return keys.filter(Boolean);
            }
            return [];
        }

        // ---- 绑定答案折叠按钮 ----
        contentElement.querySelectorAll('.answer-block .answer-toggle').forEach((btn) => {
            const contentId = btn.getAttribute('aria-controls');
            const contentEl = contentElement.querySelector(`#${contentId}`);
            const answerBlock = btn.closest('.answer-block');
            if (!contentEl || !answerBlock) return;

            // 初始化状态
            contentEl.style.cssText = 'overflow:hidden;transition:max-height 260ms ease,opacity 220ms ease';
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
                if (expanded) {
                    expandAnswerBlock(answerBlock);
                } else {
                    collapseAnswerBlock(answerBlock);
                }
            });
        });

        // ---- 多选题提交 ----
        contentElement.querySelectorAll('.answer-block .answer-submit').forEach((btn) => {
            const answerBlock = btn.closest('.answer-block');
            if (!answerBlock || answerBlock.getAttribute('data-answer-mode') !== 'multi') return;

            const task = answerBlock.closest?.('.md-task');
            if (task) task.classList.add('is-multiple-choice');

            btn.addEventListener('click', () => {
                const freshTask = answerBlock.closest?.('.md-task');
                const answerKeys = getAnswerKeysFromBlock(answerBlock);
                const correctSet = new Set(answerKeys);

                const options = freshTask?.querySelectorAll('.md-option') ||
                    contentElement.querySelectorAll('.md-option');

                const selected = Array.from(options).filter((opt) => opt.classList.contains('is-selected'));
                const selectedKeys = selected
                    .map((opt) => (opt.getAttribute('data-key') || '').toUpperCase().trim())
                    .filter(Boolean);
                const selectedSet = new Set(selectedKeys);

                const isCorrect = correctSet.size > 0 &&
                    selectedSet.size === correctSet.size &&
                    Array.from(selectedSet).every((key) => correctSet.has(key));

                options.forEach((opt) => {
                    const key = (opt.getAttribute('data-key') || '').toUpperCase().trim();
                    const isSelected = opt.classList.contains('is-selected');
                    const shouldBeCorrect = correctSet.has(key);
                    opt.classList.remove('is-correct', 'is-wrong');

                    if (isSelected && shouldBeCorrect) opt.classList.add('is-correct');
                    else if (isSelected && !shouldBeCorrect) opt.classList.add('is-wrong');
                    else if (shouldBeCorrect) opt.classList.add('is-correct');
                });

                const questionBlock = freshTask?.querySelector('.md-question');
                if (questionBlock) {
                    questionBlock.classList.remove('is-question-correct', 'is-question-wrong');
                    questionBlock.classList.add(isCorrect ? 'is-question-correct' : 'is-question-wrong');
                }
                if (freshTask) freshTask.dataset.answerState = isCorrect ? 'correct' : 'wrong';

                if (freshTask) {
                    freshTask.querySelectorAll('.md-options').forEach((g) => setOptionsLocked(g, true));
                }

                expandAnswerBlock(answerBlock);
                btn.classList.add('is-submitted');
                btn.setAttribute('aria-disabled', 'true');
                btn.disabled = true;
                btn.textContent = '已提交';
                updateTaskStatsSummary();
            });
        });

        // ---- 选项点击 ----
        function handleOptionActivate(btn) {
            const optionsGroup = btn.closest('.md-options');
            if (optionsGroup?.classList.contains('is-locked')) return;

            const task = btn.closest?.('.md-task');
            const answerBlock = task?.querySelector('.answer-block');

            if (!answerBlock) {
                let cur = btn.parentElement;
                while (cur) {
                    let sib = cur.nextElementSibling;
                    while (sib) {
                        if (sib.classList?.contains('answer-block')) {
                            const found = sib;
                            break;
                        }
                        sib = sib.nextElementSibling;
                    }
                    if (sib) break;
                    cur = cur.parentElement;
                }
            }

            if (!answerBlock) return;

            const answerKeys = getAnswerKeysFromBlock(answerBlock);
            const isMultiChoice = answerBlock.getAttribute('data-answer-mode') === 'multi' || answerKeys.length > 1;
            const key = (btn.getAttribute('data-key') || '').toUpperCase();
            if (!key) return;

            if (isMultiChoice) {
                btn.classList.toggle('is-selected');
                btn.setAttribute('aria-pressed', btn.classList.contains('is-selected') ? 'true' : 'false');
                return;
            }

            if (btn.classList.contains('is-correct') || btn.classList.contains('is-wrong')) return;

            const found = answerKeys[0] || '';
            const isCorrect = found === key;

            if (isCorrect) {
                btn.classList.add('is-correct');
                const q = task?.querySelector('.md-question') || contentElement.querySelector('.md-question');
                if (q) {
                    q.classList.remove('is-question-correct', 'is-question-wrong');
                    q.classList.add('is-question-correct');
                }
                if (task) task.dataset.answerState = 'correct';
                if (task) task.querySelectorAll('.md-options').forEach((g) => setOptionsLocked(g, true));
            } else {
                btn.classList.add('is-wrong');
                const q = task?.querySelector('.md-question') || contentElement.querySelector('.md-question');
                if (q) {
                    q.classList.remove('is-question-correct', 'is-question-wrong');
                    q.classList.add('is-question-wrong');
                }
                if (task) task.dataset.answerState = 'wrong';
                if (task) task.querySelectorAll('.md-options').forEach((g) => setOptionsLocked(g, true));

                // 展开答案
                const toggle = answerBlock.querySelector('.answer-toggle');
                if (toggle && !toggle.classList.contains('is-open')) {
                    expandAnswerBlock(answerBlock);
                }

                // 高亮正确答案
                if (found) {
                    const correctBtn = task?.querySelector(`.md-option[data-key="${found}"]`) ||
                        contentElement.querySelector(`.md-option[data-key="${found}"]`);
                    if (correctBtn) correctBtn.classList.add('is-correct');
                }
            }

            updateTaskStatsSummary();
        }

        contentElement.querySelectorAll('.md-option').forEach((btn) => {
            btn.addEventListener('click', () => handleOptionActivate(btn));
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOptionActivate(btn);
                }
            });
        });

        // ---- 任务统计 ----
        function updateTaskStatsSummary() {
            const tasks = Array.from(contentElement.querySelectorAll('.md-task'));
            if (!tasks.length) return;

            const total = tasks.length;
            let answered = 0;
            let correct = 0;

            tasks.forEach((task) => {
                const state = (task.dataset.answerState || '').trim();
                if (state === 'correct') { answered++; correct++; } else if (state === 'wrong') { answered++; }
            });

            const rate = answered > 0 ? Math.round((correct / answered) * 100) : 0;
            const hasRate = answered > 0;

            tasks.forEach((task) => {
                task.classList.add('has-task-stats');
                let statsEl = task.querySelector('.md-task-stats');
                if (!statsEl) {
                    statsEl = document.createElement('div');
                    statsEl.className = 'md-task-stats';
                    task.appendChild(statsEl);
                }

                statsEl.innerHTML = `
                    <span class="md-task-stats-main">
                        <span class="md-task-stats-label" data-i18n="stats_correct_count">答对数：</span>
                        <span class="md-task-stats-value">${correct}</span>
                        <span class="md-task-stats-label" data-i18n="stats_answered_count">/总答题数：</span>
                        <span class="md-task-stats-value">${answered}</span>
                        <span class="md-task-stats-label" data-i18n="stats_total_count">/总题数：</span>
                        <span class="md-task-stats-value">${total}</span>
                    </span>
                    ${hasRate ? `
                        <span class="md-task-stats-rate">
                            <span class="md-task-stats-label" data-i18n="stats_accuracy">正确率：</span>
                            <span class="md-task-stats-value">${rate}%</span>
                        </span>
                    ` : ''}
                `;

                statsEl.classList.toggle('is-rate-hidden', !hasRate);
                task.classList.toggle('is-rate-hidden', !hasRate);

                try {
                    if (window.siteI18n?.applyTo) window.siteI18n.applyTo(statsEl);
                } catch (error) {
                    console.error('[i18n] 更新任务统计国际化文本失败:', error);
                }
            });
        }

        updateTaskStatsSummary();

        // ---- 语言切换 ----
        document.addEventListener('site:languageChanged', () => {
            try {
                refreshExerciseLabels(contentElement);
                if (window.siteI18n?.applyTo) window.siteI18n.applyTo(contentElement);
                updateTaskStatsSummary();
            } catch (error) {
                console.error('[i18n] 更新内容国际化文本失败:', error);
            }
        });
    }

    // ==================== 启动 ====================

    if (document.getElementById('markdown-content')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', renderMarkdownContent);
        } else {
            renderMarkdownContent();
        }
    }

    // 暴露渲染函数供外部调用
    window.renderMarkdownContent = renderMarkdownContent;
})();