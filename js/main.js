// 博客数据
let blogs = [];
let footerTotalWordsPromise = null;

const HOME_CATEGORY_RULES = {
    learningFirstTags: new Set(['二上', '二下']),
    learningKey: 'home_category_learning',
    entertainmentKey: 'home_category_entertainment'
};

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function getHomeCategoryKey(blog) {
    if (blog && typeof blog.category === 'string' && blog.category.trim()) {
        const normalized = blog.category.trim();
        if (normalized === '学习') return HOME_CATEGORY_RULES.learningKey;
        if (normalized === '娱乐') return HOME_CATEGORY_RULES.entertainmentKey;
    }
    const tags = Array.isArray(blog && blog.tags) ? blog.tags : [];
    const firstTag = typeof tags[0] === 'string' ? tags[0].trim() : '';
    if (HOME_CATEGORY_RULES.learningFirstTags.has(firstTag)) {
        return HOME_CATEGORY_RULES.learningKey;
    }
    return HOME_CATEGORY_RULES.entertainmentKey;
}

function updateProfileStats() {
    const articleCountEl = document.getElementById('article-count');
    const wordCountEl = document.getElementById('word-count');
    const tagCountEl = document.getElementById('tag-count');
    const footerBlogCountEl = document.getElementById('footer-blog-count');
    const footerWordCountEl = document.getElementById('footer-word-count');
    if (!articleCountEl && !wordCountEl && !tagCountEl && !footerBlogCountEl && !footerWordCountEl) return;

    const articleCount = Array.isArray(blogs) ? blogs.length : 0;

    const tagSet = new Set();
    (Array.isArray(blogs) ? blogs : []).forEach(blog => {
        if (Array.isArray(blog.tags)) {
            blog.tags.forEach(tag => tagSet.add(tag));
        }
    });
    const tagCount = tagSet.size;

    if (articleCountEl) articleCountEl.textContent = articleCount;
    if (tagCountEl) tagCountEl.textContent = tagCount;
    if (footerBlogCountEl) footerBlogCountEl.textContent = formatFooterStatNumber(articleCount);
    if (wordCountEl) wordCountEl.textContent = '...';

    if (footerWordCountEl || wordCountEl) {
        if (footerWordCountEl) footerWordCountEl.textContent = '...';
        getFooterTotalWords().then(totalWords => {
            if (footerWordCountEl) footerWordCountEl.textContent = formatFooterStatNumber(totalWords);
            if (wordCountEl) wordCountEl.textContent = formatProfileWordCount(totalWords);
        }).catch(() => {
            if (footerWordCountEl) footerWordCountEl.textContent = '0';
            if (wordCountEl) wordCountEl.textContent = '0.0w';
        });
    }
}

function formatFooterStatNumber(value) {
    const num = Number.isFinite(Number(value)) ? Number(value) : 0;
    return num.toLocaleString('zh-CN');
}

function getCurrentSiteLang() {
    try {
        if (window.siteI18n && typeof window.siteI18n.getLang === 'function') {
            return window.siteI18n.getLang();
        }
    } catch (e) { }
    try {
        return localStorage.getItem('site_language') || 'ja';
    } catch (e) { }
    return 'ja';
}

function formatProfileWordCount(totalWords) {
    const words = Number.isFinite(Number(totalWords)) ? Number(totalWords) : 0;
    const lang = getCurrentSiteLang();
    if (lang === 'zh') {
        return (words / 10000).toFixed(1) + 'w';
    }
    return Math.round(words / 1000).toLocaleString('en-US') + 'k';
}

function countBlogCharacters(markdownText) {
    const raw = String(markdownText || '');
    const stripped = raw
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`\n]*`/g, ' ')
        .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^\)]*\)/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[#>*~\-]/g, ' ')
        .replace(/\s+/g, '');
    return stripped.length;
}

function getFooterTotalWords() {
    if (footerTotalWordsPromise) return footerTotalWordsPromise;

    const contentFiles = (Array.isArray(blogs) ? blogs : [])
        .map(blog => blog && blog.contentFile)
        .filter(Boolean);

    footerTotalWordsPromise = Promise.all(contentFiles.map(path => {
        const encodedPath = encodeURI(path);
        return fetch(encodedPath)
            .then(res => res.ok ? res.text() : '')
            .catch(() => '');
    })).then(contents => contents.reduce((sum, text) => sum + countBlogCharacters(text), 0));

    return footerTotalWordsPromise;
}

function loadBlogs(callback) {
    fetch('data/blogs.json')
        .then(res => res.json())
        .then(data => {
            blogs = data;
            updateProfileStats();
            if (typeof callback === 'function') callback();
        });
}

function enforceHomeLinksOpenInNewTab(scope) {
    try {
        if (!document.body || !document.body.classList.contains('home')) return;
        const root = scope && typeof scope.querySelectorAll === 'function' ? scope : document;
        root.querySelectorAll('a[href]').forEach(link => {
            const href = (link.getAttribute('href') || '').trim();
            if (!href || href === '#' || /^javascript:/i.test(href)) return;
            link.setAttribute('target', '_blank');

            const rel = (link.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
            if (!rel.includes('noopener')) rel.push('noopener');
            if (!rel.includes('noreferrer')) rel.push('noreferrer');
            link.setAttribute('rel', rel.join(' ').trim());
        });
    } catch (e) { }
}

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function () {
    // 在选定页面隐藏滚动条，同时保持内容可滚动
    try {
        var b = document.body;
        if (b && (b.classList.contains('home') || b.classList.contains('categories-page') || b.classList.contains('quick-links-page'))) {
            document.documentElement.classList.add('hide-scrollbar');
            document.body.classList.add('hide-scrollbar');
        }
    } catch (e) { }
    // 设置github链接
    var githubLink = document.getElementById('github-link');
    if (githubLink) {
        githubLink.href = 'https://github.com/by-be-young';
        githubLink.target = '_blank';
        githubLink.rel = 'noopener noreferrer';
    }

    // 加载数据后再更新统计 & 渲染列表，避免初始值总是 0
    loadBlogs(function () {
        if (document.getElementById('blogGrid')) {
            initBlogGrid();
        }
    });

    // 语言切换后刷新统计单位显示（总字数的 w/k 规则）
    document.addEventListener('site:languageChanged', function () {
        updateProfileStats();
    });

    // 首页公告栏（显示最新公告）
    try {
        if (document.body && document.body.classList.contains('home')) {
            enforceHomeLinksOpenInNewTab();
            initAnnouncementModal();
            initSettingsModal();
            renderAnnouncementBanner();
        }
    } catch (e) { }

    // 初始化导航栏
    initNavigation();

    // 初始化滚动监听
    initScroll();
    // 初始化个人联系方式交互
    try { initProfileContacts && initProfileContacts(); } catch (e) { }

    // 适配欢迎语换行（小屏时将空格替换为换行）
    try { adaptWelcomeText && adaptWelcomeText(); } catch (e) { }
    window.addEventListener('resize', throttle(function () { try { adaptWelcomeText && adaptWelcomeText(); } catch (e) { } }, 150));

    // 使整个个人资料卡片可点击（导航到关于页面），但忽略内部交互元素（链接、按钮）的点击
    try {
        const profileCard = document.getElementById('home-profile-card');
        if (profileCard) {
            profileCard.style.cursor = 'pointer';
            profileCard.addEventListener('click', function (e) {
                if (e.target.closest('a, button, input, .contact-btn')) return;
                const w = window.open('about.html', '_blank', 'noopener,noreferrer');
                try { if (w) w.opener = null; } catch (err) { }
            });
        }
    } catch (e) { }
});

function renderAnnouncementBanner() {
    const host = document.getElementById('announcementModalContent');
    if (!host) return;

    function renderAnnouncementMessageHtml(msg) {
        const lines = String(msg || '').split(/\r?\n/);
        return lines.map((line, idx) => {
            const safe = escapeHtml(line);
            if (!line.trim()) {
                return '<div class="ann-line ann-line--blank" aria-hidden="true">&nbsp;</div>';
            }
            const classes = ['ann-line'];
            if (idx === 0) classes.push('ann-line--headline');
            if (line.includes('>>')) classes.push('ann-line--section');
            return `<div class="${classes.join(' ')}">${safe}</div>`;
        }).join('');
    }

    fetch('data/announcements.json')
        .then(r => r.json())
        .then(list => {
            const arr = Array.isArray(list) ? list.slice() : [];
            // 按日期选择最新的公告（防御性：JSON 顺序可能变化）
            arr.sort((a, b) => {
                const da = a && a.date ? new Date(a.date).getTime() : 0;
                const db = b && b.date ? new Date(b.date).getTime() : 0;
                if (db !== da) return db - da;
                const ia = Number(a && a.id ? a.id : 0);
                const ib = Number(b && b.id ? b.id : 0);
                return ib - ia;
            });
            const latest = arr[0];
            if (!latest || !latest.message) return;
            const messageHtml = renderAnnouncementMessageHtml(latest.message);

            const dateText = (typeof window.formatDate === 'function') ? window.formatDate(latest.date) : (latest.date || '');

            host.innerHTML = `
                <div class="announcement-banner announcement-banner--modal is-visible">
                <div class="announcement-left">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div class="announcement-icon" aria-hidden="true"><i class="fas fa-bullhorn"></i></div>
                        <div>
                            <div class="announcement-kicker" id="announcement-modal-title">
                                <span data-i18n="announcement_banner_title"></span>
                                <span class="announcement-date date" data-date="${latest.date || ''}">${dateText}</span>
                            </div>
                            <div class="announcement-message">${messageHtml}</div>
                        </div>
                    </div>
                </div>
                <a class="announcement-btn" href="announcements.html">
                    <span data-i18n="announcement_view_all"></span>
                    <i class="fas fa-arrow-right" aria-hidden="true"></i>
                </a>
                </div>
            `;
            enforceHomeLinksOpenInNewTab(host);
            try { if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') window.siteI18n.applyTo(host); } catch (e) { }
            // 不在渲染时立即启动滚动：仅在弹窗打开后按延时策略启动，避免双重启动导致跳回顶部
            try {
                const modal = document.getElementById('announcementModal');
                if (modal && modal.classList.contains('is-open') && typeof host.__scheduleAnnouncementAutoScroll === 'function') {
                    host.__scheduleAnnouncementAutoScroll();
                }
            } catch (e) { }
            try {
                const msgEl = host.querySelector('.announcement-message');
                if (msgEl && msgEl.__wheelHandler) {
                    try { msgEl.removeEventListener('wheel', msgEl.__wheelHandler); } catch (e) { }
                    msgEl.__wheelHandler = null;
                }
            } catch (e) { }
        })
        .catch(() => {
            // 出错时不显示横幅
        });

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
}

function initAnnouncementModal() {
    const trigger = document.getElementById('announcementFab');
    const modal = document.getElementById('announcementModal');
    const closeBtn = document.getElementById('announcementModalClose');
    const noticeShownKey = 'homeAnnouncementModalShown_v1';
    const reloadCarryKey = 'homeAnnouncementModalReloadCarry_v1';

    if (!trigger || !modal || !closeBtn) return;
    try { modal.inert = true; } catch (e) { }
    let scrollStartTimer = null;
    let modalOpenAt = 0;
    const scrollDelayMs = 3000;

    function isReloadNavigation() {
        try {
            const navEntry = performance.getEntriesByType && performance.getEntriesByType('navigation');
            if (navEntry && navEntry[0] && navEntry[0].type) return navEntry[0].type === 'reload';
        } catch (e) { }
        try {
            return performance && performance.navigation && performance.navigation.type === 1;
        } catch (e) { }
        return false;
    }

    function scheduleAutoScrollForCurrentOpen() {
        try {
            const host = document.getElementById('announcementModalContent');
            if (!host) return;
            if (scrollStartTimer) {
                clearTimeout(scrollStartTimer);
                scrollStartTimer = null;
            }
            const elapsed = modalOpenAt ? (Date.now() - modalOpenAt) : 0;
            const remaining = Math.max(0, scrollDelayMs - elapsed);
            scrollStartTimer = setTimeout(() => {
                if (!modal.classList.contains('is-open')) return;
                requestAnimationFrame(() => {
                    try { startAnnouncementAutoScroll(host); } catch (e) { }
                });
            }, remaining);
        } catch (e) { }
    }

    function openModal() {
        try { modal.inert = false; } catch (e) { }
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('announcement-modal-open');
        modalOpenAt = Date.now();
        scheduleAutoScrollForCurrentOpen();
    }

    function closeModal() {
        if (scrollStartTimer) {
            clearTimeout(scrollStartTimer);
            scrollStartTimer = null;
        }
        try {
            const host = document.getElementById('announcementModalContent');
            stopAnnouncementAutoScroll(host);
        } catch (e) { }
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        try { modal.inert = true; } catch (e) { }
        document.body.classList.remove('announcement-modal-open');
    }

    try {
        const host = document.getElementById('announcementModalContent');
        if (host) host.__scheduleAnnouncementAutoScroll = scheduleAutoScrollForCurrentOpen;
    } catch (e) { }

    trigger.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Escape' || e.key === 'Esc') && modal.classList.contains('is-open')) {
            closeModal();
        }
    });

    // 首次进入首页自动弹一次：刷新后不再弹；离开页面后清除记录。
    try {
        const carriedFromUnload = sessionStorage.getItem(reloadCarryKey) === '1';
        const isReload = isReloadNavigation();

        if (carriedFromUnload && isReload) {
            localStorage.setItem(noticeShownKey, '1');
        }

        const alreadyShown = localStorage.getItem(noticeShownKey) === '1';
        if (!alreadyShown) {
            localStorage.setItem(noticeShownKey, '1');
            setTimeout(openModal, 0);
        }

        if (carriedFromUnload) {
            sessionStorage.removeItem(reloadCarryKey);
        }
    } catch (e) { }

    window.addEventListener('beforeunload', () => {
        try { sessionStorage.setItem(reloadCarryKey, '1'); } catch (e) { }
        try { localStorage.removeItem(noticeShownKey); } catch (e) { }
    });
}

function initSettingsModal() {
    const trigger = document.getElementById('settingsFab');
    const modal = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('settingsModalClose');
    const tabs = document.querySelectorAll('.settings-tab');
    const sections = document.querySelectorAll('.settings-section');
    const settingsPanel = document.querySelector('.settings-panel');

    if (!trigger || !modal || !closeBtn) return;
    try { modal.inert = true; } catch (e) { }

    // 创建全局背景音乐对象
    window.backgroundAudio = new Audio('music/澎湃.mp3');
    window.backgroundAudio.volume = 0.2;
    window.backgroundAudio.loop = true;

    // 标记是否已启用音乐
    window.musicEnabled = false;
    // 标记是否已发生用户交互（用于防止页面加载时的自动触发）
    let userInteracted = false;

    // 点击页面任意位置启用音乐
    function enableMusic(event) {
        console.log('事件触发:', event.type, 'musicEnabled:', window.musicEnabled);

        if (!window.musicEnabled) {
            if (!hasSelectedTrack()) {
                stopAndClearSelectedTrack();
                updateProgressUI();
                updatePlayPauseButton();
                return;
            }
            console.log('尝试启用音乐...');
            userInteracted = true; // 标记已发生用户交互
            console.log('尝试启用音乐...');
            // 确保audio对象存在
            if (!window.backgroundAudio) {
                window.backgroundAudio = new Audio('music/澎湃.mp3');
                window.backgroundAudio.volume = 0.2;
                window.backgroundAudio.loop = true;
            }

            window.backgroundAudio.play().then(() => {
                console.log('音乐播放成功');
                window.musicEnabled = true;
                document.removeEventListener('click', enableMusic);
                document.removeEventListener('keydown', enableMusic);
                updatePlayPauseButton();
            }).catch(e => {
                console.log('播放失败，重试:', e);
                // 如果失败，尝试重新加载音频
                setTimeout(() => {
                    if (!window.musicEnabled) {
                        window.backgroundAudio.load();
                        window.backgroundAudio.play().catch(e2 => {
                            console.log('重试播放也失败:', e2);
                        });
                    }
                }, 100);
            });
        }
    }

    // 添加用户交互监听器来启用音乐
    document.addEventListener('click', enableMusic);
    document.addEventListener('keydown', enableMusic);

    // 音乐相关变量
    const playPauseBtn = document.getElementById('play-pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const musicSelect = document.getElementById('music-select');
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');
    const progressSlider = document.getElementById('progress-slider');
    const progressValue = document.getElementById('progress-value');
    const playPauseText = document.getElementById('play-pause-text');
    const musicFloatFab = document.getElementById('musicFloatFab');
    const musicFloatFabIcon = musicFloatFab ? musicFloatFab.querySelector('i') : null;
    const musicFloatResumeWindowMs = 3000;
    let musicFloatHideTimer = null;

    function hasSelectedTrack() {
        return !!(musicSelect && musicSelect.value);
    }

    function stopAndClearSelectedTrack() {
        try { window.backgroundAudio.pause(); } catch (e) { }
        try { window.backgroundAudio.currentTime = 0; } catch (e) { }
        try { window.backgroundAudio.removeAttribute('src'); } catch (e) { }
        try { window.backgroundAudio.src = ''; } catch (e) { }
        try { window.backgroundAudio.load(); } catch (e) { }
        hideMusicFloatFab();
    }

    function clearMusicFloatHideTimer() {
        if (musicFloatHideTimer) {
            clearTimeout(musicFloatHideTimer);
            musicFloatHideTimer = null;
        }
    }

    function hideMusicFloatFab() {
        if (!musicFloatFab) return;
        clearMusicFloatHideTimer();
        musicFloatFab.classList.remove('is-visible', 'is-paused');
        musicFloatFab.setAttribute('aria-hidden', 'true');
        musicFloatFab.hidden = true;
    }

    function showMusicFloatFab(isPaused) {
        if (!musicFloatFab) return;
        clearMusicFloatHideTimer();
        musicFloatFab.hidden = false;
        musicFloatFab.classList.add('is-visible');
        musicFloatFab.classList.toggle('is-paused', !!isPaused);
        musicFloatFab.setAttribute('aria-hidden', 'false');
        musicFloatFab.setAttribute('aria-label', isPaused ? '继续播放音乐' : '关闭音乐');
        if (musicFloatFabIcon) {
            musicFloatFabIcon.className = isPaused ? 'fas fa-play' : 'fas fa-pause';
        }
        if (isPaused) {
            musicFloatHideTimer = setTimeout(() => {
                hideMusicFloatFab();
            }, musicFloatResumeWindowMs);
        }
    }

    function getI18nText(key, fallback) {
        try {
            const i18n = window.siteI18n;
            if (!i18n || typeof i18n.getLang !== 'function' || !i18n.translations) return fallback;
            const lang = i18n.getLang();
            const map = i18n.translations[lang] || i18n.translations.ja || {};
            return (map && map[key]) || fallback;
        } catch (e) {
            return fallback;
        }
    }

    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
        const total = Math.floor(seconds);
        const minute = Math.floor(total / 60);
        const second = total % 60;
        return String(minute).padStart(2, '0') + ':' + String(second).padStart(2, '0');
    }

    let isSeeking = false;

    function updateProgressUI() {
        const duration = Number.isFinite(window.backgroundAudio.duration) ? window.backgroundAudio.duration : 0;
        const currentTime = Number.isFinite(window.backgroundAudio.currentTime) ? window.backgroundAudio.currentTime : 0;
        if (progressSlider && !isSeeking) {
            progressSlider.value = duration > 0 ? ((currentTime / duration) * 100).toFixed(2) : '0';
        }
        if (progressValue) {
            progressValue.textContent = formatTime(currentTime) + ' / ' + formatTime(duration);
        }
    }

    // 监听背景音乐播放状态变化
    window.backgroundAudio.addEventListener('play', updatePlayPauseButton);
    window.backgroundAudio.addEventListener('pause', updatePlayPauseButton);
    window.backgroundAudio.addEventListener('timeupdate', updateProgressUI);
    window.backgroundAudio.addEventListener('loadedmetadata', updateProgressUI);
    window.backgroundAudio.addEventListener('durationchange', updateProgressUI);
    window.backgroundAudio.addEventListener('ended', updateProgressUI);
    window.backgroundAudio.addEventListener('play', () => {
        showMusicFloatFab(false);
    });
    window.backgroundAudio.addEventListener('pause', () => {
        if (!window.musicEnabled) {
            hideMusicFloatFab();
            return;
        }
        showMusicFloatFab(true);
    });

    if (musicFloatFab) {
        musicFloatFab.addEventListener('click', () => {
            if (!hasSelectedTrack()) {
                stopAndClearSelectedTrack();
                updateProgressUI();
                updatePlayPauseButton();
                return;
            }
            if (!window.musicEnabled) {
                enableMusic();
                return;
            }
            if (window.backgroundAudio.paused) {
                window.backgroundAudio.play().catch(e => {
                    console.log('播放失败:', e);
                });
                return;
            }
            window.backgroundAudio.pause();
        });
    }

    // 同步当前音乐选择和音量到设置弹窗
    musicSelect.value = '澎湃.mp3'; // 默认选择
    volumeSlider.value = window.backgroundAudio.volume.toString();
    volumeValue.textContent = Math.round(window.backgroundAudio.volume * 100) + '%';
    updateProgressUI();

    // 更新播放/暂停按钮状态
    function updatePlayPauseButton() {
        let iconClass = 'fas fa-play';
        let text = getI18nText('settings_play', '播放');
        if (!window.musicEnabled) {
            iconClass = 'fas fa-play';
            text = getI18nText('settings_enable_music', '启用音乐');
        } else if (window.backgroundAudio.paused) {
            iconClass = 'fas fa-play';
            text = getI18nText('settings_play', '播放');
        } else {
            iconClass = 'fas fa-pause';
            text = getI18nText('settings_pause', '暂停');
        }
        const icon = playPauseBtn ? playPauseBtn.querySelector('i') : null;
        if (icon) icon.className = iconClass;
        if (playPauseText) playPauseText.textContent = text;
    }

    // 初始状态更新
    updatePlayPauseButton();
    hideMusicFloatFab();

    function setLanguageInputsEnabled(enabled) {
        languageInputs.forEach(input => {
            input.disabled = !enabled;
        });
    }

    function openModal() {
        try { modal.inert = false; } catch (e) { }
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('settings-modal-open');
        setLanguageInputsEnabled(true);
    }

    function closeModal() {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        try { modal.inert = true; } catch (e) { }
        document.body.classList.remove('settings-modal-open');
        setLanguageInputsEnabled(false);
        try { trigger.focus(); } catch (e) { }
    }

    function updateSettingsPanelHeight(targetSection, immediate) {
        if (!settingsPanel || !targetSection) return;
        const nextHeight = Math.max(1, targetSection.scrollHeight || targetSection.offsetHeight || 0);
        if (!nextHeight) return;

        if (immediate) {
            settingsPanel.style.height = nextHeight + 'px';
            return;
        }

        const currentHeight = Math.max(1, Math.round(settingsPanel.getBoundingClientRect().height)) || nextHeight;
        settingsPanel.style.height = currentHeight + 'px';
        void settingsPanel.offsetHeight;
        settingsPanel.style.height = nextHeight + 'px';
    }

    function activateSettingsSection(tabName, options) {
        if (!tabName) return;
        const opts = options || {};
        let targetSection = null;

        tabs.forEach(t => {
            const isActive = t.dataset.tab === tabName;
            t.classList.toggle('active', isActive);
            t.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        sections.forEach(section => {
            const isActive = section.id === (tabName + '-section');
            section.classList.toggle('active', isActive);
            section.setAttribute('aria-hidden', isActive ? 'false' : 'true');
            if (isActive) targetSection = section;
        });

        if (targetSection) {
            updateSettingsPanelHeight(targetSection, !!opts.immediate);
        }
    }

    // 标签切换
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            activateSettingsSection(tabName);
        });
    });

    const initialActiveTab = Array.from(tabs).find(t => t.classList.contains('active'));
    if (initialActiveTab && initialActiveTab.dataset && initialActiveTab.dataset.tab) {
        activateSettingsSection(initialActiveTab.dataset.tab, { immediate: true });
    }

    // 语言设置
    const languageInputs = document.querySelectorAll('input[name="language"]');

    function syncLanguageSelection() {
        const currentLang = (window.siteI18n && typeof window.siteI18n.getLang === 'function')
            ? window.siteI18n.getLang()
            : 'ja';
        languageInputs.forEach(input => {
            input.checked = input.value === currentLang;
        });
    }

    syncLanguageSelection();
    setLanguageInputsEnabled(false);

    languageInputs.forEach(input => {
        input.addEventListener('change', () => {
            if (!modal.classList.contains('is-open')) {
                syncLanguageSelection();
                return;
            }
            if (input.checked) {
                // 这里可以添加语言切换逻辑
                console.log('Language changed to:', input.value);
                // 可以使用i18n.js中的函数来切换语言
                if (window.siteI18n && window.siteI18n.setLang) {
                    window.siteI18n.setLang(input.value);
                }
            }
        });
    });

    // 音乐控制
    musicSelect.addEventListener('change', () => {
        if (musicSelect.value) {
            // 切换音乐
            window.backgroundAudio.src = 'music/' + musicSelect.value;
            window.backgroundAudio.play().catch(e => {
                console.log('播放失败:', e);
            });
        } else {
            // 选择"无"时停止播放
            stopAndClearSelectedTrack();
        }
        updateProgressUI();
        updatePlayPauseButton();
    });

    playPauseBtn.addEventListener('click', () => {
        if (!hasSelectedTrack()) {
            stopAndClearSelectedTrack();
            updateProgressUI();
            updatePlayPauseButton();
            return;
        }
        if (!window.musicEnabled) {
            // 启用音乐
            enableMusic();
        } else if (window.backgroundAudio.paused) {
            window.backgroundAudio.play().catch(e => {
                console.log('播放失败:', e);
            });
        } else {
            window.backgroundAudio.pause();
        }
        updatePlayPauseButton();
    });

    stopBtn.addEventListener('click', () => {
        window.backgroundAudio.pause();
        window.backgroundAudio.currentTime = 0;
        updateProgressUI();
        updatePlayPauseButton();
    });

    volumeSlider.addEventListener('input', () => {
        const volume = parseFloat(volumeSlider.value);
        volumeValue.textContent = Math.round(volume * 100) + '%';
        window.backgroundAudio.volume = volume;
    });

    if (progressSlider) {
        progressSlider.addEventListener('input', () => {
            isSeeking = true;
            const duration = Number.isFinite(window.backgroundAudio.duration) ? window.backgroundAudio.duration : 0;
            const ratio = parseFloat(progressSlider.value) / 100;
            const previewTime = duration > 0 ? ratio * duration : 0;
            if (progressValue) {
                progressValue.textContent = formatTime(previewTime) + ' / ' + formatTime(duration);
            }
        });

        progressSlider.addEventListener('change', () => {
            const duration = Number.isFinite(window.backgroundAudio.duration) ? window.backgroundAudio.duration : 0;
            const ratio = parseFloat(progressSlider.value) / 100;
            if (duration > 0) {
                window.backgroundAudio.currentTime = Math.min(duration, Math.max(0, ratio * duration));
            }
            isSeeking = false;
            updateProgressUI();
        });
    }

    document.addEventListener('site:languageChanged', () => {
        updatePlayPauseButton();
        syncLanguageSelection();
    });

    // 事件监听
    trigger.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Escape' || e.key === 'Esc') && modal.classList.contains('is-open')) {
            closeModal();
        }
    });
}



// 首页公告：自动滚动实现（使用 CSS 动画，平滑且性能好）
function startAnnouncementAutoScroll(bannerEl, opts) {
    if (!bannerEl) return;
    const msg = bannerEl.querySelector('.announcement-message');
    if (!msg) return;

    stopAnnouncementAutoScroll(bannerEl);

    if (msg.scrollHeight <= msg.clientHeight) return;

    const speed = (opts && opts.speed) ? opts.speed : 20;
    const pauseMs = (opts && opts.pauseMs) ? opts.pauseMs : 1000;

    const originalHtml = msg.innerHTML;
    const lines = Array.from(msg.querySelectorAll('.ann-line'));
    if (lines.length <= 1) return;

    const fixedLineHtml = lines[0].outerHTML;
    const scrollingHtml = lines.slice(1).map(line => line.outerHTML).join('');
    if (!scrollingHtml.trim()) return;

    msg.innerHTML = '';
    msg.classList.add('announcement-message--split');

    const fixedLine = document.createElement('div');
    fixedLine.className = 'announcement-fixed-line';
    fixedLine.innerHTML = fixedLineHtml;

    const viewport = document.createElement('div');
    viewport.className = 'announcement-scroll-viewport';

    const inner = document.createElement('div');
    inner.className = 'announcement-scroll-inner';
    const spacer = '<div class="announcement-scroll-sep" aria-hidden="true"></div>';
    inner.innerHTML = scrollingHtml + spacer + scrollingHtml;

    viewport.appendChild(inner);
    msg.appendChild(fixedLine);
    msg.appendChild(viewport);

    const singleHeight = inner.scrollHeight / 2;
    const viewportHeight = viewport.clientHeight;
    if (singleHeight <= viewportHeight + 1) {
        msg.__autoScroll = {
            styleEl: null,
            animName: null,
            originalHtml: originalHtml
        };
        return;
    }

    const tScroll = Math.max(0.8, singleHeight / speed);
    const totalDuration = tScroll + (pauseMs / 1000);
    const p = (tScroll / totalDuration) * 100;

    // 创建唯一的关键帧名称
    const animName = 'annScroll_' + Date.now();
    const keyframes = `@keyframes ${animName} { 0% { transform: translateY(0); } ${p}% { transform: translateY(-50%); } 100% { transform: translateY(-50%); } }`;

    const styleEl = document.createElement('style');
    styleEl.type = 'text/css';
    styleEl.textContent = keyframes;
    document.head.appendChild(styleEl);

    inner.style.willChange = 'transform';
    inner.style.animation = `${animName} ${totalDuration}s linear infinite`;

    // 存储引用以便需要时清理
    msg.__autoScroll = { styleEl: styleEl, animName: animName, originalHtml: originalHtml };
}

function stopAnnouncementAutoScroll(bannerEl) {
    if (!bannerEl) return;
    const msg = bannerEl.querySelector('.announcement-message');
    if (!msg || !msg.__autoScroll) return;

    try {
        const state = msg.__autoScroll;
        if (state.styleEl && state.styleEl.parentNode) state.styleEl.parentNode.removeChild(state.styleEl);
        if (typeof state.originalHtml === 'string') msg.innerHTML = state.originalHtml;
        msg.classList.remove('announcement-message--split');
        msg.__autoScroll = null;
    } catch (e) { }
}

// 初始化个人联系方式交互（显示/隐藏微信与QQ）
function initProfileContacts() {
    const wechatBtn = document.getElementById('wechat-btn');
    const qqBtn = document.getElementById('qq-btn');
    const popup = document.getElementById('contact-popup');
    const wechatSpan = document.getElementById('contact-wechat');
    const qqSpan = document.getElementById('contact-qq');
    const githubLink = document.getElementById('github-link');

    if (githubLink) {
        githubLink.href = 'https://github.com/by-be-young';
        githubLink.target = '_blank';
        githubLink.rel = 'noopener noreferrer';
    }

    if (!popup) return;

    // 如果 popup 被放在了侧栏内，移动到 body 以避免父级 transform/overflow 影响 fixed 定位
    if (popup.parentElement !== document.body) document.body.appendChild(popup);

    let lastTrigger = null;

    function repositionPopupFor(triggerBtn) {
        if (!triggerBtn) return;
        if (!popup.classList.contains('show')) return;
        const rect = triggerBtn.getBoundingClientRect();
        popup.style.left = '-9999px';
        popup.style.top = '-9999px';
        void popup.offsetWidth;
        const popupRect = popup.getBoundingClientRect();
        const gap = 8;
        let left = Math.round(rect.left + rect.width / 2 - popupRect.width / 2);
        left = Math.max(8, Math.min(left, window.innerWidth - popupRect.width - 8));
        let top = Math.round(rect.bottom + gap);
        if (top + popupRect.height > window.innerHeight - 8) {
            top = Math.round(rect.top - popupRect.height - gap);
            if (top < 8) top = Math.max(8, window.innerHeight - popupRect.height - 8);
        }
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
    }

    const repositionIfVisible = throttle(() => { if (lastTrigger) repositionPopupFor(lastTrigger); }, 50);
    window.addEventListener('resize', repositionIfVisible);
    // 使用捕获来捕获任何祖先的滚动
    window.addEventListener('scroll', repositionIfVisible, true);

    function hidePopup() {
        popup.classList.remove('show');
        lastTrigger = null;
    }

    function showPopupFor(triggerBtn, text) {
        if (!triggerBtn) return;
        if (popup.classList.contains('show') && lastTrigger === triggerBtn) {
            hidePopup();
            return;
        }

        popup.innerHTML = `<div class="contact-item"><div class="number-line">${text || ''}</div></div>`;

        popup.style.left = '-9999px';
        popup.style.top = '-9999px';
        popup.classList.add('show');
        void popup.offsetWidth;
        repositionPopupFor(triggerBtn);
        lastTrigger = triggerBtn;
    }

    // 点击外部关闭 — 将弹出框和触发按钮视为内部
    document.addEventListener('click', (e) => {
        if (!popup) return;
        if (e.target.closest('#contact-popup') || e.target.closest('#wechat-btn') || e.target.closest('#qq-btn')) return;
        hidePopup();
    });

    // ESC 键关闭
    document.addEventListener('keydown', (e) => {
        if (!popup) return;
        if (e.key === 'Escape' || e.key === 'Esc') {
            if (popup.classList.contains('show')) hidePopup();
        }
    });

    if (wechatBtn) {
        wechatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showPopupFor(wechatBtn, (wechatSpan ? wechatSpan.textContent : '') || '');
        });
    }

    if (qqBtn) {
        qqBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showPopupFor(qqBtn, (qqSpan ? qqSpan.textContent : '') || '');
        });
    }
}

// 博客网格初始化
function initBlogGrid() {
    const blogGrid = document.getElementById('blogGrid');
    if (!blogGrid) return;
    blogGrid.innerHTML = '';

    // 所有博客数据
    const all = Array.isArray(blogs) ? blogs : [];

    // 先插入“最近更新”卡片（占满整行，位于公告横幅下方、其他博客卡片上方）
    try {
        const recentCard = createRecentUpdatesCard(all);
        if (recentCard) blogGrid.appendChild(recentCard);
    } catch (e) { /* 防御性：若生成失败则继续渲染其余卡片 */ }

    // 在“最近更新”下方插入“推荐博客”标题卡片（占满整行）
    try {
        const recommendedHeaderCard = createRecommendedBlogsHeaderCard();
        if (recommendedHeaderCard) blogGrid.appendChild(recommendedHeaderCard);
    } catch (e) { /* 防御性：若生成失败则继续渲染其余卡片 */ }

    // 仅渲染被标记为推荐的博客卡片（保持原有行为）
    const recommendedBlogs = all.filter(b => b.recommended === true);
    recommendedBlogs.forEach(blog => {
        const blogCard = createBlogCard(blog);
        blogGrid.appendChild(blogCard);
    });

    // 初始化“查看更多”交互（如果存在未显示的文章）
    initViewMore(all.length, recommendedBlogs.length);

    // 动态内容插入后应用一次 i18n，确保标题文案与当前语言一致
    try { if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') window.siteI18n.applyTo(blogGrid); } catch (e) { }
}

function createRecommendedBlogsHeaderCard() {
    const card = document.createElement('div');
    card.className = 'recommended-blogs-card';
    card.style.gridColumn = '1 / -1';

    card.innerHTML = `
        <span class="recommended-title" data-i18n="home_recommended_blogs">推荐博客</span>
    `;

    return card;
}

function initViewMore(totalCount, shownCount) {
    const wrap = document.getElementById('viewMoreWrap');
    const btn = document.getElementById('viewMoreBtn');
    if (!wrap || !btn) return;

    // 只有当存在未显示的文章时才启用按钮
    const hasMore = totalCount > shownCount;
    if (!hasMore) {
        wrap.style.display = 'none';
        return;
    }
    // 显示在卡片下方：将按钮宽度与“最近更新”卡片对齐，并在窗口缩放时调整
    wrap.style.display = 'flex';
    const blogGrid = document.getElementById('blogGrid');

    function alignWidthToRecentCard() {
        const recentCard = blogGrid && blogGrid.querySelector('.recent-updates-card');
        const fallbackCard = blogGrid && blogGrid.querySelector('.blog-card');
        const target = recentCard || fallbackCard;
        if (target) {
            const w = target.getBoundingClientRect().width;
            btn.style.width = Math.floor(w) + 'px';
        } else {
            btn.style.width = '';
        }
    }

    window.addEventListener('load', alignWidthToRecentCard);
    setTimeout(alignWidthToRecentCard, 120);
    window.addEventListener('resize', throttle(alignWidthToRecentCard, 150));

    btn.addEventListener('click', () => {
        const w = window.open('archive.html', '_blank', 'noopener,noreferrer');
        try { if (w) w.opener = null; } catch (e) { }
    });
}

// 简单节流函数
function throttle(fn, wait) {
    let last = 0;
    return function (...args) {
        const now = Date.now();
        if (now - last >= wait) {
            last = now;
            fn.apply(this, args);
        }
    };
}

// 在小屏时将欢迎语中的空格替换为换行；恢复时还原原始内容
function adaptWelcomeText() {
    try {
        const el = document.querySelector('.welcome-text');
        if (!el) return;
        if (!el.dataset.originalHtml) el.dataset.originalHtml = el.innerHTML;
        if (!el.dataset.originalText) {
            const html = el.dataset.originalHtml || '';
            const withNewlines = html.replace(/<br\s*\/?\>/gi, '\n');
            const tmp = document.createElement('div');
            tmp.innerHTML = withNewlines;
            el.dataset.originalText = (tmp.textContent || tmp.innerText || '').replace(/\r/g, '');
        }

        const originalHtml = el.dataset.originalHtml;
        const originalText = el.dataset.originalText;
        const small = window.innerWidth <= 720;
        if (small) {
            const lines = (originalText || '').split('\n');
            const processed = lines.map(line => {
                const collapsed = line.replace(/\s+/g, ' ').trim();
                return collapsed.replace(/ /g, '<br>');
            }).join('<br>');
            el.innerHTML = (processed && processed.replace(/^(?:<br>)+|(?:<br>)+$/g, '').length) ? processed : originalHtml;
        } else {
            el.innerHTML = originalHtml;
        }
    } catch (e) { /* ignore errors */ }
}


// 创建博客卡片
// 创建“最近更新”卡片，放在博客网格顶部（占满整行）
function createRecentUpdatesCard(allBlogs) {
    if (!Array.isArray(allBlogs) || allBlogs.length === 0) return null;

    // 按更新时间降序（防御性：若无 date 字段则视为最旧）
    const sorted = allBlogs.slice().sort((a, b) => {
        const da = a && a.date ? new Date(a.date).getTime() : 0;
        const db = b && b.date ? new Date(b.date).getTime() : 0;
        return db - da;
    });

    const latestStudy = sorted.find(blog => getHomeCategoryKey(blog) === HOME_CATEGORY_RULES.learningKey) || null;
    const latestEntertainment = sorted.find(blog => getHomeCategoryKey(blog) === HOME_CATEGORY_RULES.entertainmentKey) || null;

    const recentBlogs = [latestStudy, latestEntertainment].filter(Boolean);
    if (recentBlogs.length === 0) return null;

    const card = document.createElement('div');
    card.className = 'recent-updates-card';
    // 让该卡片占据网格整行（与公告横幅宽度一致）
    card.style.gridColumn = '1 / -1';

    const itemsHtml = recentBlogs.map(blog => {
        const categoryKey = getHomeCategoryKey(blog);
        const fallbackCategoryText = categoryKey === HOME_CATEGORY_RULES.learningKey ? '学习' : '娱乐';
        const tags = Array.isArray(blog.tags) ? blog.tags.map((t, index) => `<span class="tag" data-level="${index}" data-path="${encodeURIComponent(JSON.stringify(blog.tags))}">${escapeHtml(t)}</span>`).join('') : '';
        const img = 'assets/images/lantern_festival.png';
        const typeHtml = blog.type ? `<div class="blog-type-overlay"><span class="blog-type">${escapeHtml(blog.type)}</span></div>` : '';

        return `
            <div class="recent-item" data-id="${blog.id}">
                <div class="recent-item-category-rail"><span class="recent-item-category" data-i18n="${categoryKey}">${fallbackCategoryText}</span></div>
                <div class="recent-item-main">
                    <h3 class="blog-title recent-item-title">${escapeHtml(blog.title)}</h3>
                    <p class="blog-excerpt recent-item-excerpt">${escapeHtml(blog.excerpt || '')}</p>
                    <div class="blog-meta recent-item-meta"><span class="date" data-date="${blog.date}">${formatDate(blog.date)}</span></div>
                </div>
                <div class="recent-item-side">
                    <div class="blog-image recent-thumb">
                        <img src="${img}" alt="${escapeHtml(blog.title)}">
                        ${typeHtml}
                        <div class="tags">${tags}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    card.innerHTML = `
        <div class="recent-updates-header"><span class="recommended-title" data-i18n="home_recent_updates">最近更新</span></div>
        <div class="recent-content">${itemsHtml}</div>
    `;

    // 点击行为与普通卡片一致：打开对应文章（针对最近列表的每一项）
    card.addEventListener('click', (e) => {
        const categoryRailEl = e.target.closest('.recent-item-category-rail');
        if (categoryRailEl) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const tagEl = e.target.closest('.tag');
        if (tagEl) {
            e.preventDefault();
            e.stopPropagation();
            const level = Number(tagEl.dataset.level || 0);
            const path = tagEl.dataset.path ? JSON.parse(decodeURIComponent(tagEl.dataset.path)) : null;
            if (path) {
                const selectedTags = [];
                for (let i = 0; i <= level; i++) selectedTags[i] = path[i] || null;
                for (let i = level + 1; i < 3; i++) selectedTags[i] = null;
                const tagsParam = JSON.stringify(selectedTags);
                const w = window.open(`categories.html?tags=${encodeURIComponent(tagsParam)}`, '_blank', 'noopener,noreferrer');
                try { if (w) w.opener = null; } catch (err) { }
            }
            return;
        }

        const el = e.target.closest('.recent-item');
        if (!el) return;
        const id = el.getAttribute('data-id');
        if (id) {
            const url = `blog-detail.html?id=${id}`;
            const w = window.open(url, '_blank', 'noopener,noreferrer');
            try { if (w) w.opener = null; } catch (err) { }
        }
    });

    return card;
}

function createBlogCard(blog) {
    const card = document.createElement('div');
    card.className = 'blog-card';
    const tags = Array.isArray(blog.tags) ? blog.tags : [];
    card.innerHTML = `
        <div class="blog-image">
            <img src="assets/images/lantern_festival.png" alt="${blog.title}">
            ${blog.type ? `<div class="blog-type-overlay"><span class="blog-type">${escapeHtml(blog.type)}</span></div>` : ''}
            <div class="tags">
                ${tags.map((tag, index) => `<span class="tag" data-level="${index}" data-path="${encodeURIComponent(JSON.stringify(blog.tags))}">${tag}</span>`).join('')}</div>
        </div>
        <div class="blog-content">
            <h3 class="blog-title">${escapeHtml(blog.title)}</h3>
            <p class="blog-excerpt">${blog.excerpt}</p>
            <div class="blog-meta">
                <span class="date" data-date="${blog.date}">${formatDate(blog.date)}</span>
            </div>
        </div>
    `;

    // 为标签添加点击事件，完全复用分类页面的逻辑
    const tagElements = card.querySelectorAll('.tag');
    tagElements.forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const level = Number(el.dataset.level || 0);
            const path = el.dataset.path ? JSON.parse(decodeURIComponent(el.dataset.path)) : null;
            if (!path) return;

            const selectedTags = [];
            for (let i = 0; i <= level; i++) selectedTags[i] = path[i] || null;
            for (let i = level + 1; i < 3; i++) selectedTags[i] = null;

            const tagsParam = JSON.stringify(selectedTags);
            const w = window.open(`categories.html?tags=${encodeURIComponent(tagsParam)}`, '_blank', 'noopener,noreferrer');
            try { if (w) w.opener = null; } catch (err) { }
        });
    });

    card.addEventListener('click', () => {
        const url = `blog-detail.html?id=${blog.id}`;
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        try { if (w) w.opener = null; } catch (e) { /* ignore */ }
    });

    return card;
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    // 语言感知格式化
    try {
        const lang = window.siteI18n && typeof window.siteI18n.getLang === 'function' ? window.siteI18n.getLang() : 'zh';
        if (lang === 'en') {
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } else if (lang === 'ja') {
            const y = date.getFullYear();
            const m = date.getMonth() + 1;
            const d = date.getDate();
            // 令和年计算（令和元年 = 2019）
            let era = '';
            if (y >= 2019) {
                const reiwa = y - 2018;
                era = reiwa === 1 ? '（令和元年）' : `（令和${reiwa}年）`;
            }
            return `${y}年${m}月${d}日 ${era}`;
        } else {
            return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
        }
    } catch (e) {
        return date.toLocaleDateString();
    }
}

// 更新页面上所有可感知的日期显示（在语言切换后调用）
function updateDates() {
    try {
        document.querySelectorAll('.date[data-date]').forEach(el => {
            const d = el.getAttribute('data-date');
            if (d) {
                el.textContent = formatDate(d);
            }
        });
    } catch (e) {
        console.warn('updateDates error', e);
    }
}

// 监听语言切换事件，自动刷新页面上的日期显示
document.addEventListener('site:languageChanged', function (e) {
    updateDates();
});

// 当语言切换时，更新 welcome-text 的原始缓存并重新应用适配逻辑
document.addEventListener('site:languageChanged', function (e) {
    try {
        const el = document.querySelector('.welcome-text');
        if (!el) return;
        el.dataset.originalHtml = el.innerHTML;
        // 将 HTML 中的 <br> 转为 \n，再取纯文本以保留换行
        const withNewlines = (el.dataset.originalHtml || '').replace(/<br\s*\/?\>/gi, '\n');
        const tmp = document.createElement('div');
        tmp.innerHTML = withNewlines;
        el.dataset.originalText = (tmp.textContent || tmp.innerText || '').replace(/\r/g, '');
        // 立即重新应用适配（以维持当前窗口宽度下的换行规则）
        try { adaptWelcomeText && adaptWelcomeText(); } catch (err) { }
    } catch (e) { /* ignore */ }
});

// 导航栏初始化
function initNavigation() {
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.querySelector('.nav-menu');

    if (toggle) {
        toggle.addEventListener('click', () => {
            if (!menu) return;
            const isActive = menu.classList.toggle('active');
            if (isActive) {
                document.body.classList.add('offcanvas-open');
            } else {
                document.body.classList.remove('offcanvas-open');
            }
        });

        // 创建背景元素（单实例）并连接点击以关闭菜单
        (function ensureBackdrop() {
            if (document.querySelector('.offcanvas-backdrop')) return;
            const b = document.createElement('div');
            b.className = 'offcanvas-backdrop';
            // 仅在点击背景本身时关闭
            b.addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (menu) menu.classList.remove('active');
                document.body.classList.remove('offcanvas-open');
            });
            try {
                const nav = document.querySelector('.navbar');
                if (nav && nav.parentNode) {
                    nav.parentNode.insertBefore(b, nav);
                } else {
                    document.body.appendChild(b);
                }
            } catch (e) {
                document.body.appendChild(b);
            }
        })();
    }

    // 根据窗口宽度切换 offcanvas 模式（用于中间区间将导航收进侧边栏）
    function updateMenuMode() {
        try {
            const w = window.innerWidth;
            if (!menu) return;
            // 当视口较窄或处于中间区间时启用 offcanvas（与 CSS 区间保持一致）
            if (w <= 1100) {
                menu.classList.add('offcanvas');
            } else {
                menu.classList.remove('offcanvas');
                menu.classList.remove('active');
                document.body.classList.remove('offcanvas-open');
            }
        } catch (e) { }
    }
    updateMenuMode();
    window.addEventListener('resize', throttle(updateMenuMode, 150));

    // 点击链接关闭菜单（移动端）
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            if (menu) menu.classList.remove('active');
            document.body.classList.remove('offcanvas-open');
        });
    });
}

// 滚动监听
function initScroll() {
    const scrollDown = document.querySelector('.scroll-down');

    if (scrollDown) {
        scrollDown.addEventListener('click', () => {
            window.scrollTo({
                top: window.innerHeight,
                behavior: 'smooth'
            });
        });
    }
}

// 在 window.load 后延迟设置使用 data-bg 的背景图片，确保背景资源在页面关键资源加载后再请求
window.addEventListener('load', function () {
    try {
        const els = document.querySelectorAll('[data-bg]');
        els.forEach(el => {
            const src = el.getAttribute('data-bg');
            if (!src) return;
            const img = new Image();
            img.onload = function () {
                el.style.backgroundImage = `url('${src}')`;
                el.classList.add('bg-loaded');
            };
            img.src = src;
        });
    } catch (e) {
        // 安静失败，不影响页面其它逻辑
        console.warn('defer-bg error', e);
    }
});

// Busuanzi 控制台打印（每次页面加载时在控制台输出站点总访问量、访客数、以及当前页面的阅读数）
(function () {
    try {
        var ids = ['busuanzi_today_pv', 'busuanzi_today_uv', 'busuanzi_site_pv', 'busuanzi_site_uv', 'busuanzi_page_pv', 'busuanzi_page_uv'];
        // 确保页面存在这些元素（隐藏），以便 Busuanzi 填充
        ids.forEach(function (id) {
            if (!document.getElementById(id)) {
                var sp = document.createElement('span');
                sp.id = id;
                sp.style.display = 'none';
                sp.textContent = '加载中...';
                document.body.appendChild(sp);
            }
        });

        // 加载 Busuanzi 脚本：优先官方 HTTPS，失败时自动切换备用源
        var busuanziSources = [
            'https://cdn.busuanzi.cc/busuanzi/3.6.9/busuanzi.min.js',
            'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'
        ];
        loadBusuanziWithFallback(0);

        function loadBusuanziWithFallback(index) {
            if (index >= busuanziSources.length) {
                console.warn('Busuanzi 脚本加载失败：所有源均不可用');
                pollAndLog();
                return;
            }

            var s = document.createElement('script');
            s.src = busuanziSources[index];
            s.defer = true;
            s.onload = pollAndLog;
            s.onerror = function () {
                loadBusuanziWithFallback(index + 1);
            };
            document.head.appendChild(s);
        }

        function pollAndLog() {
            var attempts = 0, maxAttempts = 50;
            var tid = setInterval(function () {
                attempts++;
                var vals = ids.map(function (id) {
                    var el = document.getElementById(id);
                    return el ? el.textContent.trim() : '';
                });
                var ready = vals.some(function (v) { return v && v !== '加载中...' && v !== 'n/a'; });
                if (ready || attempts >= maxAttempts) {
                    clearInterval(tid);
                    var map = {};
                    ids.forEach(function (id, i) { map[id] = vals[i] || 'n/a'; });
                    console.log('站点统计 — 今日访问(today_pv):', map['busuanzi_today_pv'], ', 今日访客(today_uv):', map['busuanzi_today_uv'], ', 总访问(site_pv):', map['busuanzi_site_pv'], ', 总访客(site_uv):', map['busuanzi_site_uv'], ', 本页阅读(page_pv):', map['busuanzi_page_pv'], ', 本页访客(page_uv):', map['busuanzi_page_uv']);
                }
            }, 100);
        }
    } catch (e) {
        console.warn('Busuanzi 控制台打印错误', e);
    }
})();