/**
 * 关于页面模块
 * 
 * 功能说明：
 * 1. 根据当前语言加载对应的 about 页面 Markdown 内容
 * 2. 在内容加载完成后使用 marked 渲染 Markdown
 * 3. 刷新个人资料中的文章数、标签数和总字数统计
 * 4. 支持语言切换时重新加载内容
 * 
 * 依赖：
 * - marked.js (Markdown 解析库)
 * - i18n.js (国际化支持)
 * 
 * @module about
 */

(function () {
    'use strict';

    // ==================== 状态变量 ====================

    /** @type {Array} 缓存的博客数据，用于统计字数 */
    var aboutBlogs = [];

    /** @type {Promise<number>|null} 总字数计算 Promise */
    var aboutTotalWordsPromise = null;

    /** @type {boolean} 标记是否正在渲染，防止重复调用 */
    var isRendering = false;

    // ==================== 工具函数 ====================

    /**
     * 获取当前网站语言
     * 
     * @returns {string} 语言代码（'zh' | 'en' | 'ja'）
     */
    function getCurrentSiteLang() {
        try {
            if (window.siteI18n && typeof window.siteI18n.getLang === 'function') {
                return window.siteI18n.getLang();
            }
        } catch (_) {
            /* 忽略异常 */
        }

        try {
            return localStorage.getItem('site_language') || 'zh';
        } catch (_) {
            return 'zh';
        }
    }

    /**
     * HTML 转义
     * 
     * @param {string} text - 需要转义的文本
     * @returns {string} 转义后的 HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 格式化字数统计显示
     * 
     * @param {number|string} totalWords - 总字数
     * @returns {string} 格式化后的字数显示
     */
    function formatProfileWordCount(totalWords) {
        var words = Number.isFinite(Number(totalWords)) ? Number(totalWords) : 0;
        var lang = getCurrentSiteLang();

        if (lang === 'zh') {
            return (words / 10000).toFixed(1) + 'w';
        }

        return Math.round(words / 1000).toLocaleString('en-US') + 'k';
    }

    /**
     * 统计 Markdown 文本中的有效字符数
     * 
     * @param {string} markdownText - Markdown 格式的文本
     * @returns {number} 有效字符数
     */
    function countBlogCharacters(markdownText) {
        var raw = String(markdownText || '');
        var stripped = raw
            .replace(/```[\s\S]*?```/g, ' ')
            .replace(/`[^`\n]*`/g, ' ')
            .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
            .replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1')
            .replace(/<[^>]+>/g, ' ')
            .replace(/[#>*~\-]/g, ' ')
            .replace(/\s+/g, '');
        return stripped.length;
    }

    // ==================== 数据加载 ====================

    /**
     * 为指定语言加载 about 页面的 Markdown 内容
     * 
     * 按优先级尝试多个可能的文件路径
     * 
     * @param {string} lang - 语言代码（'zh' | 'en' | 'ja'）
     * @returns {Promise<{ path: string, text: string } | null>}
     */
    function loadMarkdownForLang(lang) {
        var candidates = [
            'data/about.' + lang + '.md',
            'data/about.' + lang + '.markdown',
            'data/about.md.' + lang,
            'data/about.md'
        ];

        return candidates.reduce(function (p, path) {
            return p.then(function (found) {
                if (found) return Promise.resolve(found);

                return fetch(path, { cache: 'no-store' })
                    .then(function (res) {
                        if (res.ok) {
                            return res.text().then(function (text) {
                                return { path: path, text: text };
                            });
                        }
                        return null;
                    })
                    .catch(function () { return null; });
            });
        }, Promise.resolve(null));
    }

    /**
     * 获取所有博客的总字数
     * 
     * @returns {Promise<number>} 总字数
     */
    function getTotalWords() {
        if (aboutTotalWordsPromise) return aboutTotalWordsPromise;

        var contentFiles = (Array.isArray(aboutBlogs) ? aboutBlogs : [])
            .map(function (blog) { return blog && blog.contentFile; })
            .filter(Boolean);

        aboutTotalWordsPromise = Promise.all(
            contentFiles.map(function (path) {
                var encodedPath = encodeURI(path);
                return fetch(encodedPath)
                    .then(function (res) { return (res.ok ? res.text() : ''); })
                    .catch(function () { return ''; });
            })
        ).then(function (contents) {
            return contents.reduce(function (sum, text) { return sum + countBlogCharacters(text); }, 0);
        });

        return aboutTotalWordsPromise;
    }

    // ==================== Markdown 渲染 ====================

    /**
     * 剥离 Front Matter（--- 包裹的 YAML 头部）
     * 
     * @param {string} markdown - 原始 Markdown 文本
     * @returns {string} 剥离 Front Matter 后的内容
     */
    function stripFrontMatter(markdown) {
        if (typeof markdown !== 'string' || !markdown) return '';

        var text = markdown.replace(/^\uFEFF/, '');
        var lines = text.split(/\r?\n/);
        if (lines.length === 0) return text;

        // 仅当第一行是 --- 时处理
        if (lines[0].trim() !== '---') return text;

        for (var i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '---') {
                var rest = lines.slice(i + 1).join('\n');
                return rest.replace(/^\s*\n/, '');
            }
        }

        return text;
    }

    /**
     * 渲染 Markdown 内容到页面
     * 
     * 使用 marked 库将 Markdown 解析为 HTML
     * 
     * @param {string} content - Markdown 原始内容
     * @param {HTMLElement} container - 目标容器元素
     */
    function renderMarkdown(content, container) {
        if (!content || !container) return;

        // 剥离 Front Matter
        var cleanContent = stripFrontMatter(content);

        try {
            // 使用 marked 解析 Markdown
            var html = '';

            if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
                html = marked.parse(cleanContent);
            } else if (typeof marked !== 'undefined' && typeof marked === 'function') {
                // 兼容旧版本 marked
                html = marked(cleanContent);
            } else {
                // marked 不可用，显示原始内容
                html = '<pre style="white-space:pre-wrap;padding:20px;background:#f5f5f5;border-radius:8px;">' +
                    escapeHtml(cleanContent) + '</pre>';
                console.warn('marked 库未加载，显示原始 Markdown 内容');
            }

            container.innerHTML = html;

            // 尝试应用国际化
            try {
                if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
                    window.siteI18n.applyTo(container);
                }
            } catch (_) {
                /* 忽略国际化应用失败 */
            }
        } catch (err) {
            console.error('Markdown 渲染失败:', err);
            container.innerHTML = '<p style="color:#c0392b;">内容渲染失败，请稍后重试。</p>';
        }
    }

    // ==================== 页面内容加载 ====================

    /**
     * 加载并渲染 About 页面内容
     * 
     * @param {string} lang - 目标语言代码
     */
    function loadAndRenderAbout(lang) {
        // 防止重复渲染
        if (isRendering) return;
        isRendering = true;

        loadMarkdownForLang(lang)
            .then(function (found) {
                var mdEl = document.getElementById('markdown-content');
                if (!mdEl) {
                    isRendering = false;
                    return;
                }

                if (found && found.text) {
                    // 渲染 Markdown
                    renderMarkdown(found.text, mdEl);
                } else {
                    // 内容加载失败
                    mdEl.innerHTML = '<p style="color:#888;text-align:center;padding:40px 0;">内容加载失败，请稍后重试。</p>';
                }

                isRendering = false;
            })
            .catch(function (err) {
                console.error('加载 About 内容失败:', err);
                var mdEl = document.getElementById('markdown-content');
                if (mdEl) {
                    mdEl.innerHTML = '<p style="color:#c0392b;text-align:center;padding:40px 0;">内容加载失败，请稍后重试。</p>';
                }
                isRendering = false;
            });
    }

    // ==================== 统计信息更新 ====================

    /**
     * 刷新总字数显示
     */
    function refreshWordCountDisplay() {
        var wcEls = document.querySelectorAll('#word-count--about, #word-count');
        if (!wcEls.length) return;

        wcEls.forEach(function (el) { el.textContent = '...'; });

        getTotalWords()
            .then(function (total) {
                var display = formatProfileWordCount(total);
                wcEls.forEach(function (el) { el.textContent = display; });
            })
            .catch(function () {
                wcEls.forEach(function (el) { el.textContent = '0.0w'; });
            });
    }

    /**
     * 初始化个人资料统计信息
     */
    function initProfileCounts() {
        fetch('data/blogs.json')
            .then(function (r) { return r.json(); })
            .then(function (blogs) {
                try {
                    aboutBlogs = Array.isArray(blogs) ? blogs : [];
                    aboutTotalWordsPromise = null;

                    var articleCount = aboutBlogs.length;

                    // 统计标签（使用 Set 去重）
                    var tagSet = new Set();
                    aboutBlogs.forEach(function (b) {
                        if (Array.isArray(b.tags)) {
                            b.tags.forEach(function (t) { tagSet.add(t); });
                        }
                    });
                    var tagCount = tagSet.size;

                    // 更新文章数
                    document.querySelectorAll('#article-count--about, #article-count').forEach(function (el) {
                        el.textContent = String(articleCount);
                    });

                    // 更新标签数
                    document.querySelectorAll('#tag-count--about, #tag-count').forEach(function (el) {
                        el.textContent = String(tagCount);
                    });

                    refreshWordCountDisplay();
                } catch (_) {
                    /* 忽略统计更新中的异常 */
                }
            })
            .catch(function () {
                /* 忽略数据加载失败 */
            });
    }

    // ==================== 初始化 ====================

    /**
     * 页面 DOM 加载完成后的初始化
     */
    document.addEventListener('DOMContentLoaded', function () {
        var lang = getCurrentSiteLang();

        // 加载并渲染 About 内容
        loadAndRenderAbout(lang);

        // 初始化统计信息
        initProfileCounts();

        // 监听语言切换事件
        document.addEventListener('site:languageChanged', function () {
            var newLang = getCurrentSiteLang();
            loadAndRenderAbout(newLang);
            refreshWordCountDisplay();
        });
    });

    // ==================== 暴露公共 API ====================

    /**
     * 刷新 About 页面内容
     * 
     * 供外部模块调用，用于强制刷新 About 页面的内容和统计信息
     * 
     * @param {string} [lang] - 目标语言，不传则使用当前语言
     */
    window.refreshAboutContent = function (lang) {
        loadAndRenderAbout(lang || getCurrentSiteLang());
    };

})();