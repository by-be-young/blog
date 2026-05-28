(function () {
    const SERIES_DATA_URL = 'data/series.json';
    const BLOGS_DATA_URL = 'data/blogs.json';

    let currentSeries = [];

    function escapeHtml(value) {
        return String(value).replace(/[&<>\"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    }

    function getLang() {
        try {
            if (window.siteI18n && typeof window.siteI18n.getLang === 'function') {
                return window.siteI18n.getLang();
            }
        } catch (e) {
            // ignore
        }
        return 'zh';
    }

    function t(key, fallback) {
        try {
            const i18n = window.siteI18n;
            const lang = getLang();
            const map = (i18n && i18n.translations && i18n.translations[lang]) || {};
            if (Object.prototype.hasOwnProperty.call(map, key) && map[key] != null) {
                return map[key];
            }
        } catch (e) {
            // ignore
        }
        return fallback;
    }

    function formatSeriesCount(count) {
        return t('series_post_count', '{n}篇').replace('{n}', String(count));
    }

    function normalizeSeriesName(value) {
        if (typeof value === 'string' && value.trim()) return value.trim();
        return '';
    }

    function normalizeChapter(value) {
        if (typeof value === 'string' && value.trim()) return value.trim();
        return '';
    }

    function parseChapter(value) {
        const raw = normalizeChapter(value);
        if (!raw) {
            return {
                raw: '',
                order: Number.POSITIVE_INFINITY,
                title: '未分章',
                hasChapter: false
            };
        }

        const match = raw.match(/^(\d+)\s*-\s*(.+)$/);
        if (match) {
            return {
                raw,
                order: Number(match[1]),
                title: match[2].trim(),
                hasChapter: true
            };
        }

        return {
            raw,
            order: Number.POSITIVE_INFINITY,
            title: raw,
            hasChapter: true
        };
    }

    function normalizeOrder(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return Math.trunc(value);
        }

        if (typeof value === 'string' && value.trim()) {
            const parsed = Number(value.trim());
            if (Number.isFinite(parsed)) {
                return Math.trunc(parsed);
            }
        }

        return null;
    }

    function compareSeriesPosts(a, b) {
        const aChapter = parseChapter(a && a.chapter);
        const bChapter = parseChapter(b && b.chapter);

        if (aChapter.hasChapter || bChapter.hasChapter) {
            if (aChapter.hasChapter && !bChapter.hasChapter) return -1;
            if (!aChapter.hasChapter && bChapter.hasChapter) return 1;
            if (aChapter.order !== bChapter.order) return aChapter.order - bChapter.order;
            if (aChapter.title !== bChapter.title) return aChapter.title.localeCompare(bChapter.title, 'zh-CN');
        }

        const aHasOrder = Number.isFinite(a && a.order);
        const bHasOrder = Number.isFinite(b && b.order);

        if (aHasOrder && bHasOrder) {
            if (a.order !== b.order) return a.order - b.order;
            return new Date(b.date) - new Date(a.date);
        }

        if (aHasOrder && !bHasOrder) return -1;
        if (!aHasOrder && bHasOrder) return 1;

        return new Date(b.date) - new Date(a.date);
    }

    function groupPostsByChapter(posts) {
        if (!Array.isArray(posts)) return [];

        const hasAnyChapter = posts.some(post => parseChapter(post && post.chapter).hasChapter);
        if (!hasAnyChapter) return [];

        const chapterMap = new Map();

        posts.forEach(post => {
            if (!post || typeof post !== 'object') return;

            const chapterInfo = parseChapter(post.chapter);
            const key = chapterInfo.raw || '__uncategorized__';
            if (!chapterMap.has(key)) {
                chapterMap.set(key, {
                    raw: chapterInfo.raw,
                    title: chapterInfo.title,
                    order: chapterInfo.order,
                    hasChapter: chapterInfo.hasChapter,
                    posts: []
                });
            }

            chapterMap.get(key).posts.push(post);
        });

        return Array.from(chapterMap.values())
            .sort((a, b) => {
                if (a.hasChapter || b.hasChapter) {
                    if (a.hasChapter && !b.hasChapter) return -1;
                    if (!a.hasChapter && b.hasChapter) return 1;
                    if (a.order !== b.order) return a.order - b.order;
                    if (a.title !== b.title) return a.title.localeCompare(b.title, 'zh-CN');
                }
                return 0;
            })
            .map(chapter => ({
                chapter: chapter.raw,
                title: chapter.title,
                order: chapter.order,
                hasChapter: chapter.hasChapter,
                posts: chapter.posts.slice().sort(compareSeriesPosts)
            }));
    }

    function flattenChapters(chapters) {
        if (!Array.isArray(chapters)) return [];
        return chapters.reduce((acc, chapter) => {
            if (chapter && Array.isArray(chapter.posts)) acc.push(...chapter.posts);
            return acc;
        }, []);
    }

    function getLatestSeriesTimestamp(series) {
        if (!series) return 0;

        const posts = Array.isArray(series.posts) && series.posts.length > 0
            ? series.posts
            : flattenChapters(series.chapters);

        let latest = 0;
        posts.forEach(post => {
            const timestamp = new Date(post && post.date).getTime();
            if (Number.isFinite(timestamp) && timestamp > latest) {
                latest = timestamp;
            }
        });

        return latest;
    }

    function normalizeSeriesPosts(posts) {
        if (!Array.isArray(posts)) return [];

        return posts
            .map(post => {
                if (!post || typeof post !== 'object') return null;
                const id = Number(post.id);
                if (!Number.isFinite(id)) return null;
                return {
                    id,
                    title: (typeof post.title === 'string' && post.title.trim()) ? post.title.trim() : t('series_untitled_post', '未命名文章'),
                    date: typeof post.date === 'string' ? post.date : '',
                    order: normalizeOrder(post.order),
                    chapter: normalizeChapter(post.chapter),
                    contentFile: typeof post.contentFile === 'string' ? post.contentFile : ''
                };
            })
            .filter(Boolean);
    }

    function normalizeSeriesItem(item) {
        if (!item || typeof item !== 'object') return null;
        const title = normalizeSeriesName(item.title);
        if (!title) return null;

        const posts = normalizeSeriesPosts(item.posts);
        const chapters = groupPostsByChapter(posts);

        return {
            title,
            coverImage: (typeof item.coverImage === 'string' && item.coverImage.trim())
                ? item.coverImage.trim()
                : 'assets/images/series.png',
            posts: chapters.length > 0 ? flattenChapters(chapters) : posts.slice().sort(compareSeriesPosts),
            chapters,
            count: Number.isFinite(Number(item.count)) ? Number(item.count) : posts.length
        };
    }

    function normalizeSeriesPayload(payload) {
        if (!Array.isArray(payload)) return [];

        return payload
            .map(normalizeSeriesItem)
            .filter(Boolean)
            .filter(item => item.posts.length > 0)
            .sort((a, b) => {
                const diff = getLatestSeriesTimestamp(b) - getLatestSeriesTimestamp(a);
                if (diff !== 0) return diff;
                return a.title.localeCompare(b.title, 'zh-CN');
            });
    }

    function groupBlogsToSeries(blogs) {
        if (!Array.isArray(blogs)) return [];

        const map = new Map();
        blogs.forEach(blog => {
            if (!blog || typeof blog !== 'object') return;
            const name = normalizeSeriesName(blog.series);
            if (!name) return;

            const id = Number(blog.id);
            if (!Number.isFinite(id)) return;

            if (!map.has(name)) map.set(name, []);
            map.get(name).push({
                id,
                title: (typeof blog.title === 'string' && blog.title.trim()) ? blog.title.trim() : t('series_untitled_post', '未命名文章'),
                date: typeof blog.date === 'string' ? blog.date : '',
                order: normalizeOrder(blog.order),
                chapter: normalizeChapter(blog.chapter),
                contentFile: typeof blog.contentFile === 'string' ? blog.contentFile : ''
            });
        });

        return Array.from(map.entries())
            .map(([title, posts]) => {
                const chapters = groupPostsByChapter(posts);
                return {
                    title,
                    coverImage: 'assets/images/series.png',
                    posts: chapters.length > 0 ? flattenChapters(chapters) : posts.slice().sort(compareSeriesPosts),
                    chapters,
                    count: posts.length
                };
            })
            .sort((a, b) => {
                const diff = getLatestSeriesTimestamp(b) - getLatestSeriesTimestamp(a);
                if (diff !== 0) return diff;
                return a.title.localeCompare(b.title, 'zh-CN');
            });
    }

    function bindSeriesInteractions() {
        const cards = Array.from(document.querySelectorAll('.series-card'));
        const listEl = document.getElementById('seriesList');
        const EXPAND_REVEAL_DELAY = 380;
        const CLICK_RESTORE_DELAY = 260;
        const CHAPTER_OPEN_SCROLL_DELAY = 320;
        const CHAPTER_BODY_HEIGHT = 260;
        const revealTimers = new WeakMap();
        const clickRestoreTimers = new WeakMap();
        const touchHoverTimers = new WeakMap();

        function isDesktopView() {
            return window.matchMedia('(min-width: 901px)').matches;
        }

        function scrollCardIntoCenter(card, smooth = true) {
            if (!listEl || !card || !isDesktopView()) return;

            const maxScrollLeft = Math.max(0, listEl.scrollWidth - listEl.clientWidth);
            const target = card.offsetLeft - (listEl.clientWidth - card.offsetWidth) / 2;
            const clamped = Math.min(maxScrollLeft, Math.max(0, target));

            listEl.scrollTo({
                left: clamped,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }

        function scheduleCentering(card) {
            if (!isDesktopView()) return;

            // Initial centering + follow-up centering after width transition settles.
            scrollCardIntoCenter(card, true);
            requestAnimationFrame(() => scrollCardIntoCenter(card, true));
            setTimeout(() => scrollCardIntoCenter(card, true), 220);
            setTimeout(() => scrollCardIntoCenter(card, true), 420);
        }

        function clearRevealTimer(card) {
            const timer = revealTimers.get(card);
            if (timer) {
                clearTimeout(timer);
                revealTimers.delete(card);
            }
        }

        function clearClickRestoreTimer(card) {
            const timer = clickRestoreTimers.get(card);
            if (timer) {
                clearTimeout(timer);
                clickRestoreTimers.delete(card);
            }
        }

        function clearTouchHoverTimer(card) {
            const timer = touchHoverTimers.get(card);
            if (timer) {
                clearTimeout(timer);
                touchHoverTimers.delete(card);
            }
        }

        function setTouchHover(card) {
            if (!card || card.getAttribute('data-open') === 'true') return;
            clearTouchHoverTimer(card);
            card.classList.add('is-touch-hover');
        }

        function clearTouchHover(card, delay = 0) {
            if (!card) return;
            clearTouchHoverTimer(card);

            if (delay > 0) {
                const timer = setTimeout(() => {
                    card.classList.remove('is-touch-hover');
                    touchHoverTimers.delete(card);
                }, delay);
                touchHoverTimers.set(card, timer);
                return;
            }

            card.classList.remove('is-touch-hover');
        }

        function closeCard(card) {
            clearRevealTimer(card);
            clearClickRestoreTimer(card);
            clearTouchHover(card);
            Array.from(card.querySelectorAll('.series-chapter')).forEach(chapterEl => {
                const body = chapterEl.querySelector('.series-chapter-body');
                if (!body) return;
                chapterEl.setAttribute('data-open', 'false');
                body.style.maxHeight = '0px';
                body.style.opacity = '0';
            });
            card.setAttribute('data-open', 'false');
            card.setAttribute('aria-expanded', 'false');
            card.setAttribute('data-phase', 'closed');
            card.classList.remove('is-restoring');
        }

        if (listEl) {
            listEl.addEventListener('wheel', function (event) {
                if (!isDesktopView()) return;
                if (!event || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
                if (event.target && event.target.closest('.series-card-right')) return;

                event.preventDefault();
                listEl.scrollBy({ left: event.deltaY, behavior: 'auto' });
            }, { passive: false });
        }

        cards.forEach(card => {
            const chapterToggles = Array.from(card.querySelectorAll('.series-chapter-toggle'));
            const cardRight = card.querySelector('.series-card-right');

            function scrollChapterToTop(chapterEl) {
                if (!cardRight || !chapterEl || typeof cardRight.scrollTo !== 'function') return;

                const chapterRect = chapterEl.getBoundingClientRect();
                const rightRect = cardRight.getBoundingClientRect();
                const paddingTop = parseFloat(window.getComputedStyle(cardRight).paddingTop || '0') || 0;
                const targetTop = cardRight.scrollTop + (chapterRect.top - rightRect.top) - paddingTop;
                cardRight.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
            }

            function setChapterOpen(chapterEl, open) {
                if (!chapterEl) return;
                const body = chapterEl.querySelector('.series-chapter-body');
                if (!body) return;

                if (open) {
                    chapterToggles.forEach(toggle => {
                        const otherChapter = toggle.closest('.series-chapter');
                        if (otherChapter && otherChapter !== chapterEl) setChapterOpen(otherChapter, false);
                    });
                }

                chapterEl.setAttribute('data-open', open ? 'true' : 'false');
                if (open) {
                    body.style.overflowY = 'auto';
                    body.style.height = `${CHAPTER_BODY_HEIGHT}px`;
                    body.style.maxHeight = `${CHAPTER_BODY_HEIGHT}px`;
                    body.style.opacity = '1';
                    body.scrollTop = 0;
                    if (chapterEl.__seriesOpenTimer) {
                        clearTimeout(chapterEl.__seriesOpenTimer);
                    }
                    chapterEl.__seriesOpenTimer = setTimeout(() => {
                        body.scrollTop = 0;
                        scrollChapterToTop(chapterEl);
                    }, CHAPTER_OPEN_SCROLL_DELAY);
                } else {
                    if (chapterEl.__seriesOpenTimer) {
                        clearTimeout(chapterEl.__seriesOpenTimer);
                        chapterEl.__seriesOpenTimer = null;
                    }
                    body.style.overflowY = 'hidden';
                    body.style.height = '0px';
                    body.style.maxHeight = '0px';
                    body.style.opacity = '0';
                }
            }

            function closeAllChapters() {
                chapterToggles.forEach(toggle => {
                    const chapterEl = toggle.closest('.series-chapter');
                    if (chapterEl) setChapterOpen(chapterEl, false);
                });
            }

            chapterToggles.forEach(toggle => {
                toggle.addEventListener('click', function (event) {
                    event.preventDefault();
                    event.stopPropagation();

                    const chapterEl = toggle.closest('.series-chapter');
                    if (!chapterEl) return;
                    const isOpen = chapterEl.getAttribute('data-open') === 'true';
                    if (isOpen) closeAllChapters();
                    else setChapterOpen(chapterEl, true);
                });
            });

            function triggerToggleAfterRestore() {
                clearTouchHover(card);
                const isOpen = card.getAttribute('data-open') === 'true';
                if (isOpen) {
                    toggleCard();
                    return;
                }

                clearClickRestoreTimer(card);
                card.classList.add('is-restoring');
                const timer = setTimeout(() => {
                    card.classList.remove('is-restoring');
                    toggleCard();
                    clickRestoreTimers.delete(card);
                }, CLICK_RESTORE_DELAY);
                clickRestoreTimers.set(card, timer);
            }

            function toggleCard() {
                const isOpen = card.getAttribute('data-open') === 'true';
                const nextOpen = !isOpen;

                if (nextOpen) {
                    cards.forEach(otherCard => {
                        if (otherCard !== card) closeCard(otherCard);
                    });

                    clearRevealTimer(card);
                    card.setAttribute('data-open', 'true');
                    card.setAttribute('aria-expanded', 'true');
                    card.setAttribute('data-phase', 'opening');
                    const revealTimer = setTimeout(() => {
                        if (card.getAttribute('data-open') === 'true') {
                            card.setAttribute('data-phase', 'revealed');
                        }
                    }, EXPAND_REVEAL_DELAY);
                    revealTimers.set(card, revealTimer);
                    scheduleCentering(card);
                } else {
                    closeAllChapters();
                    closeCard(card);
                }
            }

            card.addEventListener('click', function (event) {
                // Keep post links clickable without toggling the card.
                if (event.target && (event.target.closest('.series-post-link') || event.target.closest('.series-chapter-toggle'))) return;
                triggerToggleAfterRestore();
            });

            card.addEventListener('pointerdown', function (event) {
                if (!event || event.pointerType !== 'touch') return;
                setTouchHover(card);
            });

            card.addEventListener('pointerup', function (event) {
                if (!event || event.pointerType !== 'touch') return;
                clearTouchHover(card, 120);
            });

            card.addEventListener('pointercancel', function (event) {
                if (!event || event.pointerType !== 'touch') return;
                clearTouchHover(card);
            });

            card.addEventListener('pointerleave', function (event) {
                if (!event || event.pointerType !== 'touch') return;
                clearTouchHover(card);
            });

            card.addEventListener('keydown', function (event) {
                if (!event) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleCard();
                }
            });
        });
    }

    function renderSeries(seriesList) {
        const listEl = document.getElementById('seriesList');
        const emptyEl = document.getElementById('seriesEmpty');
        if (!listEl || !emptyEl) return;

        listEl.innerHTML = '';

        if (!Array.isArray(seriesList) || seriesList.length === 0) {
            emptyEl.style.display = 'block';
            return;
        }

        emptyEl.style.display = 'none';

        seriesList.forEach((series, index) => {
            const card = document.createElement('article');
            card.className = 'series-card';
            card.style.setProperty('--series-delay', `${index * 70}ms`);
            card.setAttribute('data-open', 'false');
            card.setAttribute('data-phase', 'closed');
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-expanded', 'false');

            const postsHtml = series.posts
                .map((post, postIndex) => `
                    <li class="series-post-item" style="--series-item-delay:${postIndex * 70}ms">
                        <a class="series-post-link" href="blog-detail.html?id=${post.id}">${escapeHtml(post.title)}</a>
                    </li>
                `)
                .join('');

            const hasChapters = Array.isArray(series.chapters) && series.chapters.length > 0;

            const chaptersHtml = (hasChapters ? series.chapters : [])
                .map((chapter, chapterIndex) => {
                    const chapterTitle = (chapter && typeof chapter.title === 'string' && chapter.title.trim())
                        ? chapter.title.trim()
                        : (chapter && chapter.hasChapter && typeof chapter.raw === 'string' && chapter.raw.trim())
                            ? chapter.raw.trim()
                            : t('series_no_chapter', '未分章');
                    const chapterPostsHtml = (chapter && Array.isArray(chapter.posts) ? chapter.posts : [])
                        .map((post, postIndex) => `
                            <li class="series-post-item" style="--series-item-delay:${postIndex * 70}ms">
                                <a class="series-post-link" href="blog-detail.html?id=${post.id}">${escapeHtml(post.title)}</a>
                            </li>
                        `)
                        .join('');

                    return `
                        <section class="series-chapter" data-open="false" style="--chapter-delay:${chapterIndex * 50}ms">
                            <button type="button" class="series-chapter-toggle">
                                <span class="series-chapter-title">${escapeHtml(chapterTitle)}</span>
                                <span class="series-chapter-count">${escapeHtml(formatSeriesCount((chapter && chapter.posts && chapter.posts.length) || 0))}</span>
                                <i class="fas fa-chevron-down" aria-hidden="true"></i>
                            </button>
                            <div class="series-chapter-body">
                                <ol class="series-post-list">
                                    ${chapterPostsHtml}
                                </ol>
                            </div>
                        </section>
                    `;
                })
                .join('');

            card.innerHTML = `
                <div class="series-card-shell">
                    <div class="series-card-left">
                        <div class="series-cover-wrap">
                            <img class="series-cover" src="${escapeHtml(series.coverImage)}" alt="${escapeHtml(series.title)}">
                        </div>
                        <div class="series-meta">
                            <h2 class="series-name">${escapeHtml(series.title)}</h2>
                            <p class="series-count">${escapeHtml(formatSeriesCount(series.posts.length || series.count || 0))}</p>
                        </div>
                        <span class="series-expand-icon" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>
                    </div>
                    <div class="series-card-right">
                        ${hasChapters
                    ? `<div class="series-chapters">${chaptersHtml}</div>`
                    : `<ol class="series-post-list series-post-list--flat">${postsHtml}</ol>`}
                    </div>
                </div>
            `;

            listEl.appendChild(card);
        });

        bindSeriesInteractions();
    }

    async function loadSeriesData() {
        try {
            const seriesRes = await fetch(SERIES_DATA_URL, { cache: 'no-store' });
            if (seriesRes.ok) {
                const payload = await seriesRes.json();
                const normalized = normalizeSeriesPayload(payload);
                if (normalized.length > 0) return normalized;
            }
        } catch (e) {
            // fallback to blogs.json
        }

        try {
            const blogsRes = await fetch(BLOGS_DATA_URL, { cache: 'no-store' });
            if (blogsRes.ok) {
                const blogs = await blogsRes.json();
                return groupBlogsToSeries(blogs);
            }
        } catch (e) {
            // ignore
        }

        return [];
    }

    async function initSeriesPage() {
        currentSeries = await loadSeriesData();
        renderSeries(currentSeries);

        document.addEventListener('site:languageChanged', function () {
            renderSeries(currentSeries);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSeriesPage);
    } else {
        initSeriesPage();
    }
})();
