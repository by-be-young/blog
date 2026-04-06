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

    function getLatestSeriesTimestamp(series) {
        if (!series || !Array.isArray(series.posts) || series.posts.length === 0) return 0;
        const latestDate = series.posts[0] && series.posts[0].date;
        const timestamp = new Date(latestDate).getTime();
        return Number.isFinite(timestamp) ? timestamp : 0;
    }

    function normalizeSeriesPayload(payload) {
        if (!Array.isArray(payload)) return [];

        return payload
            .map(item => {
                if (!item || typeof item !== 'object') return null;
                const title = normalizeSeriesName(item.title);
                if (!title) return null;

                const posts = Array.isArray(item.posts)
                    ? item.posts
                        .map(post => {
                            if (!post || typeof post !== 'object') return null;
                            const id = Number(post.id);
                            const postTitle = typeof post.title === 'string' && post.title.trim()
                                ? post.title.trim()
                                : t('series_untitled_post', '未命名文章');
                            if (!Number.isFinite(id)) return null;
                            return {
                                id,
                                title: postTitle,
                                date: typeof post.date === 'string' ? post.date : ''
                            };
                        })
                        .filter(Boolean)
                    : [];

                posts.sort((a, b) => new Date(b.date) - new Date(a.date));

                return {
                    title,
                    coverImage: (typeof item.coverImage === 'string' && item.coverImage.trim())
                        ? item.coverImage.trim()
                        : 'assets/images/background/bg2.png',
                    posts,
                    count: Number.isFinite(Number(item.count)) ? Number(item.count) : posts.length
                };
            })
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
                date: typeof blog.date === 'string' ? blog.date : ''
            });
        });

        return Array.from(map.entries())
            .map(([title, posts]) => {
                posts.sort((a, b) => new Date(b.date) - new Date(a.date));
                return {
                    title,
                    coverImage: 'assets/images/background/bg2.png',
                    posts,
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
        const revealTimers = new WeakMap();

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

        function closeCard(card) {
            clearRevealTimer(card);
            card.setAttribute('data-open', 'false');
            card.setAttribute('aria-expanded', 'false');
            card.setAttribute('data-phase', 'closed');
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
                    closeCard(card);
                }
            }

            card.addEventListener('click', function (event) {
                // Keep post links clickable without toggling the card.
                if (event.target && event.target.closest('.series-post-link')) return;
                toggleCard();
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
                        <ol class="series-post-list">
                            ${postsHtml}
                        </ol>
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
