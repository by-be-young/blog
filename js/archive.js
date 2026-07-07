/**
 * 归档页面模块
 * 功能：时间轴展示博客列表，支持按年/月分组、滚筒视觉效果、
 * 日历热力图导航、类型筛选（学习/非学习）、移动端弹窗适配。
 */
(function () {
  'use strict';

  // ==================== 配置常量 ====================
  const ARCHIVE_DESKTOP_ANIMATION_BREAKPOINT = 900;
  const ARCHIVE_ITEM_STAGGER_MS = 120;
  const MODAL_ANIMATION_MS = 320;
  const WHEEL_SCROLL_FACTOR = 0.55;
  const SNAP_DELAY_MS = 140;
  const PROGRAMMATIC_LOCK_MS = 220;

  // ==================== 工具函数 ====================

  /** 数字补零 */
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  /** 格式化为 YYYY-MM-DD */
  function toYMD(date) {
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    const d = pad2(date.getDate());
    return `${y}-${m}-${d}`;
  }

  /** 格式化为 YYYY-MM */
  function toYM(date) {
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    return `${y}-${m}`;
  }

  /** 计算日历偏移量（根据周起始日） */
  function computeOffset(jsDay, weekStart) {
    return ((jsDay - (weekStart || 0)) + 7) % 7;
  }

  /** 热力值计算 */
  function heatLevel(count) {
    if (count <= 0) return 0;
    if (count <= 2) return 1;
    if (count <= 4) return 2;
    return 3;
  }

  function monthHeatLevel(count) {
    if (count <= 0) return 0;
    if (count <= 10) return 1;
    if (count <= 20) return 2;
    return 3;
  }

  /** HTML 转义 */
  function escapeHtml(s) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    return String(s).replace(/[&<>"]/g, (c) => map[c] || c);
  }

  /** 节流函数 */
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

  /** 获取当前语言 */
  function getLang() {
    try {
      return window.siteI18n?.getLang?.() || 'zh';
    } catch (error) {
      console.error('[archive] 获取当前语言失败:', error);
      return 'zh';
    }
  }

  /** 获取国际化文本 */
  function getI18nText(key, fallback) {
    try {
      const lang = getLang();
      const map = window.siteI18n?.translations?.[lang] || {};
      return map[key] ?? fallback;
    } catch (error) {
      console.error('[archive] 获取国际化文本失败:', error);
      return fallback;
    }
  }

  // ==================== 分类规则（兼容 main.js） ====================

  function getArchiveHomeCategoryKey(blog) {
    if (typeof getHomeCategoryKey === 'function') {
      return getHomeCategoryKey(blog);
    }

    if (blog?.category?.trim()) {
      const normalized = blog.category.trim();
      if (normalized === '学习') return 'home_category_learning';
      if (normalized === '娱乐') return 'home_category_entertainment';
    }

    const tags = Array.isArray(blog?.tags) ? blog.tags : [];
    const firstTag = typeof tags[0] === 'string' ? tags[0].trim() : '';
    if (firstTag === '二上' || firstTag === '二下') return 'home_category_learning';
    return 'home_category_entertainment';
  }

  function isLearningBlog(blog) {
    return getArchiveHomeCategoryKey(blog) === 'home_category_learning';
  }

  function filterArchiveBlogs(blogs, mode) {
    if (!Array.isArray(blogs)) return [];
    if (mode === 'learning') return blogs.filter(isLearningBlog);
    if (mode === 'non-learning') return blogs.filter((blog) => !isLearningBlog(blog));
    return blogs.slice();
  }

  // ==================== 类型筛选 UI ====================

  function initArchiveFilterUI(onChange) {
    const filterRoot = document.getElementById('archiveFilterToggle');
    if (!filterRoot) return null;

    const buttons = Array.from(filterRoot.querySelectorAll('.archive-filter-btn'));
    if (buttons.length === 0) return null;

    function updateActiveBackground(activeBtn) {
      if (!activeBtn) return;
      const top = activeBtn.offsetTop;
      const height = activeBtn.offsetHeight;
      filterRoot.style.setProperty('--filter-bg-top', `${top}px`);
      filterRoot.style.setProperty('--filter-bg-height', `${height}px`);
    }

    function setActive(mode, shouldEmit) {
      let activeBtn = null;
      buttons.forEach((btn) => {
        const active = btn.dataset.filter === mode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-checked', active ? 'true' : 'false');
        if (active) activeBtn = btn;
      });
      updateActiveBackground(activeBtn || buttons[0]);
      if (shouldEmit && typeof onChange === 'function') onChange(mode);
    }

    function shiftActiveByWheel(step) {
      const currentIndex = Math.max(0, buttons.findIndex((btn) => btn.classList.contains('active')));
      const nextIndex = Math.min(buttons.length - 1, Math.max(0, currentIndex + step));
      if (nextIndex === currentIndex) return;
      const nextBtn = buttons[nextIndex];
      setActive(nextBtn.dataset.filter || 'all', true);
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        setActive(btn.dataset.filter || 'all', true);
      });
    });

    filterRoot.addEventListener(
      'wheel',
      (e) => {
        if (!e?.deltaY) return;
        e.preventDefault();
        shiftActiveByWheel(e.deltaY > 0 ? 1 : -1);
      },
      { passive: false }
    );

    window.addEventListener('resize', () => {
      const activeBtn = buttons.find((btn) => btn.classList.contains('active')) || buttons[0];
      updateActiveBackground(activeBtn);
    });

    setActive('all', false);

    return { setActive };
  }

  // ==================== 移动端弹窗 ====================

  function initCalendarFab(filterController) {
    const fab = document.getElementById('calendarFab');
    const modal = document.getElementById('calendarModal');
    const modalBody = modal?.querySelector('.calendar-modal-body');
    const closeBtn = modal?.querySelector('.calendar-modal-close');
    const sidebar = document.querySelector('.archive-sidebar');
    const calendarCard = document.getElementById('calendarCard');
    const filterPanel = document.getElementById('archiveFilterPanel');

    if (!fab || !modal || !modalBody || !calendarCard) return;

    let isOpen = false;
    let isAnimating = false;
    let closeTimer = null;

    function restoreCalendarToSidebar() {
      if (sidebar) {
        sidebar.appendChild(calendarCard);
        if (filterPanel) sidebar.appendChild(filterPanel);
      }
    }

    function finalizeClose() {
      restoreCalendarToSidebar();
      modal.classList.remove('closing');
      modal.setAttribute('aria-hidden', 'true');
      fab.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = '';
      isAnimating = false;
      closeTimer = null;
    }

    function openModal() {
      if (isOpen || isAnimating) return;
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }

      modalBody.appendChild(calendarCard);
      if (filterPanel) modalBody.appendChild(filterPanel);

      // 打开时重置为"全部"
      if (filterController?.setActive) {
        filterController.setActive('all', true);
      }

      modal.classList.remove('open', 'closing');
      modal.classList.add('open-prep');
      modal.setAttribute('aria-hidden', 'false');
      fab.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = 'hidden';

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          modal.classList.remove('open-prep');
          modal.classList.add('open');

          if (filterController?.setActive) {
            filterController.setActive('all', false);
          }
        });
      });

      isOpen = true;
    }

    function closeModal(immediate = false) {
      if (!isOpen && !isAnimating) return;

      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }

      isOpen = false;

      if (immediate) {
        modal.classList.remove('open', 'open-prep', 'closing');
        finalizeClose();
        return;
      }

      isAnimating = true;
      modal.classList.remove('open', 'open-prep');
      modal.classList.add('closing');

      closeTimer = setTimeout(() => {
        finalizeClose();
      }, MODAL_ANIMATION_MS);
    }

    fab.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
    closeBtn?.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
    modal.addEventListener('click', (e) => {
      if (e.target?.matches('[data-role="backdrop"]')) closeModal();
    });

    function updateMode() {
      const w = window.innerWidth;
      if (w > ARCHIVE_DESKTOP_ANIMATION_BREAKPOINT) {
        if (isOpen || isAnimating) closeModal(true);
        if (sidebar && calendarCard?.parentNode !== sidebar) sidebar.appendChild(calendarCard);
        if (sidebar && filterPanel?.parentNode !== sidebar) sidebar.appendChild(filterPanel);
        fab.style.display = 'none';
      } else {
        fab.style.display = 'inline-flex';
      }
    }

    updateMode();
    window.addEventListener('resize', throttle(updateMode, 150));
  }

  // ==================== 时间轴渲染 ====================

  function renderTimeline(blogs) {
    const timeline = document.getElementById('archiveTimeline');
    if (!timeline) return;
    timeline.innerHTML = '';

    function getSeparatorText(date, level) {
      const d = date instanceof Date ? date : new Date(date);
      if (Number.isNaN(d.getTime())) return '';

      const lang = getLang();
      if (level === 'year') {
        if (lang === 'en') return `${d.getFullYear()}`;
        if (lang === 'ja') return `${d.getFullYear()}年`;
        return `${d.getFullYear()}年`;
      }

      if (lang === 'en') {
        try {
          return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long' }).format(d);
        } catch (error) {
          console.error('[archive] 格式化日期失败:', error);
          return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
        }
      }

      return `${d.getFullYear()}年 ${pad2(d.getMonth() + 1)}月`;
    }

    function appendSeparator(date, level) {
      const text = getSeparatorText(date, level);
      if (!text) return;

      const item = document.createElement('div');
      item.className = `timeline-item timeline-separator timeline-separator-${level}`;
      item.innerHTML = `
                <div class="timeline-separator-content" aria-hidden="true">
                    <span class="timeline-separator-pattern">✦ ✦ ✦</span>
                    <span class="timeline-separator-label">${text}</span>
                    <span class="timeline-separator-pattern">✦ ✦ ✦</span>
                </div>
            `;
      timeline.appendChild(item);
    }

    // 标题头
    const headerItem = document.createElement('div');
    headerItem.className = 'timeline-item timeline-header';
    headerItem.innerHTML = `<div class="timeline-header-content" data-i18n="archive_timeline_title"></div>`;
    timeline.appendChild(headerItem);

    if (window.siteI18n?.applyTo) {
      try { window.siteI18n.applyTo(timeline); } catch (error) {
        console.error('[archive] 应用国际化失败:', error);
      }
    }

    let lastYearKey = '';
    let lastMonthKey = '';

    const shouldAnimateEntrance = (() => {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      return window.innerWidth > ARCHIVE_DESKTOP_ANIMATION_BREAKPOINT && !reducedMotion;
    })();

    blogs.forEach((blog, index) => {
      const blogDate = new Date(blog.date);
      const hasValidDate = !Number.isNaN(blogDate.getTime());
      const yearKey = hasValidDate ? String(blogDate.getFullYear()) : '';
      const monthKey = hasValidDate ? `${blogDate.getFullYear()}-${pad2(blogDate.getMonth() + 1)}` : '';

      if (hasValidDate && yearKey !== lastYearKey) {
        appendSeparator(blogDate, 'year');
        appendSeparator(blogDate, 'month');
        lastYearKey = yearKey;
        lastMonthKey = monthKey;
      } else if (hasValidDate && monthKey !== lastMonthKey) {
        appendSeparator(blogDate, 'month');
        lastMonthKey = monthKey;
      }

      const item = document.createElement('div');
      item.className = 'timeline-item';
      if (shouldAnimateEntrance) {
        item.classList.add('timeline-item-enter');
        item.style.setProperty('--timeline-enter-delay', `${index * ARCHIVE_ITEM_STAGGER_MS}ms`);
      }
      item.dataset.date = blog.date;

      const displayDate = typeof window.formatDate === 'function' ? window.formatDate(blog.date) : blog.date;

      item.innerHTML = `
                <a class="timeline-link" href="blog-detail.html?id=${blog.id}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-badge" aria-hidden="true"></div>
                        <div class="timeline-left">
                            <div class="timeline-title">
                                <span class="title-text">${escapeHtml(blog.title)}</span>
                                ${blog.type ? `<span class="blog-type">${escapeHtml(blog.type)}</span>` : ''}
                            </div>
                            <div class="timeline-excerpt">${blog.excerpt || ''}</div>
                        </div>
                        <div class="timeline-right">
                            <div class="timeline-date date" data-date="${blog.date}">${displayDate}</div>
                        </div>
                    </div>
                </a>
            `;
      timeline.appendChild(item);
    });

    // 格式化日期
    if (typeof updateArchiveDates === 'function') updateArchiveDates();
    initArchiveMobileTitleMarquee();
  }

  // ==================== 移动端标题滚动 ====================

  function initArchiveMobileTitleMarquee() {
    const timeline = document.getElementById('archiveTimeline');
    if (!timeline) return;

    const isMobile = window.matchMedia(`(max-width: ${ARCHIVE_DESKTOP_ANIMATION_BREAKPOINT}px)`).matches;
    const titleNodes = Array.from(timeline.querySelectorAll('.timeline-title .title-text'));

    titleNodes.forEach((titleEl) => {
      if (!titleEl) return;

      let inner = titleEl.querySelector(':scope > .title-scroll-inner');
      if (!inner) {
        const text = titleEl.textContent || '';
        titleEl.textContent = '';
        inner = document.createElement('span');
        inner.className = 'title-scroll-inner';
        inner.textContent = text;
        titleEl.appendChild(inner);
      }

      titleEl.classList.remove('title-text-scroll');
      titleEl.style.removeProperty('--title-scroll-distance');
      titleEl.style.removeProperty('--title-scroll-duration');

      if (!isMobile) return;

      const boxWidth = Math.ceil(titleEl.clientWidth || 0);
      const textWidth = Math.ceil(inner.scrollWidth || 0);
      const overflow = textWidth - boxWidth;
      if (overflow <= 6) return;

      const distance = -overflow;
      const travelMs = Math.round((overflow / 38) * 1000);
      const duration = Math.max(5600, Math.min(15000, travelMs + 3600));

      titleEl.style.setProperty('--title-scroll-distance', `${distance}px`);
      titleEl.style.setProperty('--title-scroll-duration', `${duration}ms`);
      titleEl.classList.add('title-text-scroll');
    });
  }

  // ==================== 日期更新 ====================

  function archiveFormatDate(dateString) {
    const date = new Date(dateString);
    try {
      const lang = getLang();
      if (lang === 'en') {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      if (lang === 'ja') {
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        let era = '';
        if (y >= 2019) {
          const reiwa = y - 2018;
          era = reiwa === 1 ? '（令和元年）' : `（令和${reiwa}年）`;
        }
        const main = `${y}年${m}月${d}日`;
        const eraHtml = era ? `<span class="timeline-era">${era}</span>` : '';
        return `${main} ${eraHtml}`;
      }
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (error) {
      console.error('[archive] 格式化日期失败:', error);
      return date.toLocaleDateString();
    }
  }

  function updateArchiveDates() {
    try {
      document.querySelectorAll('.timeline-date.date[data-date]').forEach((el) => {
        const d = el.getAttribute('data-date');
        if (d) {
          if (typeof window.formatDate === 'function') {
            el.textContent = window.formatDate(d);
          } else {
            el.innerHTML = archiveFormatDate(d);
          }
        }
      });
    } catch (error) {
      console.error('[archive] 更新时间戳失败:', error);
    }
  }

  // ==================== 滚筒效果 ====================

  function initTimelineDrum() {
    const timeline = document.getElementById('archiveTimeline');
    if (!timeline) return;

    if (!timeline.hasAttribute('tabindex')) timeline.setAttribute('tabindex', '0');

    const isNarrowScreen = () => window.matchMedia(`(max-width: ${ARCHIVE_DESKTOP_ANIMATION_BREAKPOINT}px)`).matches;

    function applyMode() {
      if (isNarrowScreen()) {
        timeline.classList.remove('drum');
        timeline.style.removeProperty('--drum-pad');
      } else {
        timeline.classList.add('drum');
      }
    }

    applyMode();

    function getItems() {
      return Array.from(timeline.querySelectorAll('.timeline-item'));
    }

    let ticking = false;

    function computeDrumPadding() {
      const rect = timeline.getBoundingClientRect();
      const h = rect.height;
      if (!h) return;

      const contents = Array.from(timeline.querySelectorAll('.timeline-item .timeline-content'));
      if (contents.length === 0) return;

      let maxItemH = 0;
      contents.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height > maxItemH) maxItemH = r.height;
      });

      const pad = Math.max(0, h / 2 - maxItemH / 2);
      timeline.style.setProperty('--drum-pad', `${Math.round(pad)}px`);
    }

    function update() {
      if (!timeline.classList.contains('drum')) return;
      computeDrumPadding();

      const rect = timeline.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const denom = Math.max(1, rect.height / 2);

      getItems().forEach((item) => {
        const content = item.querySelector('.timeline-content');
        if (!content) return;

        const r = content.getBoundingClientRect();
        const itemCenter = r.top + r.height / 2;
        let d = (itemCenter - centerY) / denom;
        d = Math.max(-1.25, Math.min(1.25, d));
        const ad = Math.abs(d);

        content.style.setProperty('--d', d.toFixed(3));
        content.style.setProperty('--ad', ad.toFixed(3));
      });
    }

    function onScroll() {
      if (!timeline.classList.contains('drum')) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    }

    timeline.addEventListener('scroll', onScroll, { passive: true });

    window.addEventListener('resize', () => {
      applyMode();
      update();
    });

    timeline.__drumUpdate = update;
    update();
  }

  // ==================== 日历热力图 ====================

  function initArchiveCalendar(blogs) {
    const calendarBody = document.getElementById('calendarBody');
    const calLabel = document.getElementById('calLabel');
    const btnPrev = document.getElementById('calPrev');
    const btnNext = document.getElementById('calNext');
    const btnToday = document.getElementById('calToday');
    const toggleButtons = Array.from(document.querySelectorAll('.calendar-toggle-btn'));

    if (!calendarBody || !calLabel || !btnPrev || !btnNext || !btnToday || toggleButtons.length === 0) return;

    let dateCount = new Map();
    let monthCount = new Map();
    let monthMaxDate = new Map();
    let maxDay = 0;
    let maxMonth = 0;

    function rebuildCalendarStats(sourceBlogs) {
      dateCount = new Map();
      monthCount = new Map();
      monthMaxDate = new Map();
      maxDay = 0;
      maxMonth = 0;

      (Array.isArray(sourceBlogs) ? sourceBlogs : []).forEach((blog) => {
        const d = new Date(blog.date);
        if (Number.isNaN(d.getTime())) return;
        const ymd = toYMD(d);
        const ym = toYM(d);

        const dayVal = (dateCount.get(ymd) ?? 0) + 1;
        dateCount.set(ymd, dayVal);
        if (dayVal > maxDay) maxDay = dayVal;

        const monthVal = (monthCount.get(ym) ?? 0) + 1;
        monthCount.set(ym, monthVal);
        if (monthVal > maxMonth) maxMonth = monthVal;

        const prevMax = monthMaxDate.get(ym);
        if (!prevMax || prevMax < ymd) monthMaxDate.set(ym, ymd);
      });
    }

    rebuildCalendarStats(blogs);

    let view = 'month';
    const baseDate = blogs.length ? new Date(blogs[0].date) : new Date();
    let cursor = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);

    function getCalTranslations() {
      const lang = getLang();
      const tr = window.siteI18n?.translations?.[lang] || {};
      return { lang, tr };
    }

    function updateCalendarI18n() {
      try {
        const { lang, tr } = getCalTranslations();

        const weekdaysRaw = tr.cal_weekdays ? String(tr.cal_weekdays).split(',') : null;
        const baseWeek = weekdaysRaw?.length === 7 ? weekdaysRaw :
          (lang === 'ja' ? ['月', '火', '水', '木', '金', '土', '日'] :
            lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] :
              ['一', '二', '三', '四', '五', '六', '日']);
        const weekStart = typeof tr.weekStart === 'number' ? tr.weekStart : (lang === 'zh' ? 1 : 0);
        const weekLabels = weekStart === 1 ? baseWeek : ([baseWeek[6]].concat(baseWeek.slice(0, 6)));

        const weekEls = calendarBody ? Array.from(calendarBody.querySelectorAll('.cal-weekday')) : [];
        weekEls.forEach((el, idx) => {
          if (weekLabels[idx]) el.textContent = weekLabels[idx];
        });

        const monthTipTemplate = tr.cal_month_tip || (lang === 'en' ? '{n} posts' : lang === 'ja' ? '{n} 件' : '本月共 {n} 篇');
        const monthEls = calendarBody ? Array.from(calendarBody.querySelectorAll('.cal-month')) : [];
        monthEls.forEach((el) => {
          const target = el.getAttribute('data-target-month');
          if (target && monthCount.has(target)) {
            const c = monthCount.get(target) || 0;
            el.setAttribute('data-tip', monthTipTemplate.replace('{n}', String(c)));
          }
        });

        const calLabelEl = document.getElementById('calLabel');
        if (calLabelEl) {
          if (view === 'month') {
            const y = cursor.getFullYear();
            const m = cursor.getMonth();
            try {
              calLabelEl.textContent = new Intl.DateTimeFormat(
                lang === 'ja' ? 'ja-JP' : lang === 'en' ? 'en-US' : 'zh-CN',
                { year: 'numeric', month: 'long' }
              ).format(new Date(y, m, 1));
            } catch (error) {
              console.error('[archive] 格式化日期失败:', error);
              calLabelEl.textContent = `${y}年${m + 1}月`;
            }
          } else {
            const y = cursor.getFullYear();
            if (lang === 'ja' && y >= 2019) {
              const reiwa = y - 2018;
              const era = reiwa === 1 ? '（令和元年）' : `（令和${reiwa}年）`;
              calLabelEl.textContent = `${y}年 ${era}`;
            } else {
              try {
                calLabelEl.textContent = new Intl.DateTimeFormat(
                  lang === 'ja' ? 'ja-JP' : lang === 'en' ? 'en-US' : 'zh-CN',
                  { year: 'numeric' }
                ).format(new Date(y, 0, 1));
              } catch (error) {
                console.error('[archive] 格式化日期失败:', error);
                calLabelEl.textContent = `${y}年`;
              }
            }
          }
        }
      } catch (error) {
        console.error('[archive] 更新日历国际化失败:', error);
      }
    }

    document.addEventListener('site:languageChanged', () => {
      try { render(); } catch (error) {
        console.error('[archive] 渲染失败:', error);
      }
      updateCalendarI18n();
      updateToggleBackground();
    });

    function includesDateInCurrentView(date) {
      if (view === 'year') return cursor.getFullYear() === date.getFullYear();
      return cursor.getFullYear() === date.getFullYear() && cursor.getMonth() === date.getMonth();
    }

    function locateToDate(date) {
      if (view === 'year') cursor = new Date(date.getFullYear(), 0, 1);
      else cursor = new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function updateToggleBackground() {
      const toggleContainer = document.querySelector('.calendar-view-toggle');
      const activeBtn = toggleButtons.find((btn) => btn.classList.contains('active'));
      if (activeBtn && toggleContainer) {
        const containerRect = toggleContainer.getBoundingClientRect();
        const btnRect = activeBtn.getBoundingClientRect();
        const left = btnRect.left - containerRect.left;
        const width = btnRect.width;
        toggleContainer.style.setProperty('--bg-left', left + 'px');
        toggleContainer.style.setProperty('--bg-width', width + 'px');
      }
    }

    function setView(nextView) {
      view = nextView;
      toggleButtons.forEach((btn) => {
        const active = btn.dataset.view === view;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      updateToggleBackground();

      const today = new Date();
      if (!includesDateInCurrentView(today)) {
        locateToDate(today);
      }

      render();
    }

    function renderMonth() {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const { lang, tr } = getCalTranslations();
      const locale = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en-US';

      try {
        calLabel.textContent = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(y, m, 1));
      } catch (error) {
        console.error('[archive] 格式化日期失败:', error);
        calLabel.textContent = `${y}年${m + 1}月`;
      }

      const first = new Date(y, m, 1);
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const weekStart = typeof tr.weekStart === 'number' ? tr.weekStart : (lang === 'zh' ? 1 : 0);
      const offset = computeOffset(first.getDay(), weekStart);

      const weekdaysBase = tr.cal_weekdays ? String(tr.cal_weekdays).split(',') :
        (lang === 'ja' ? ['月', '火', '水', '木', '金', '土', '日'] :
          lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] :
            ['一', '二', '三', '四', '五', '六', '日']);
      const weekdays = weekStart === 1 ? weekdaysBase : ([weekdaysBase[6]].concat(weekdaysBase.slice(0, 6)));

      const parts = [];
      parts.push('<div class="cal-grid">');
      weekdays.forEach((w) => parts.push(`<div class="cal-weekday">${w}</div>`));

      for (let i = 0; i < 42; i++) {
        const dayNum = i - offset + 1;
        if (dayNum < 1 || dayNum > daysInMonth) {
          parts.push('<div class="cal-cell muted"></div>');
          continue;
        }
        const d = new Date(y, m, dayNum);
        const key = toYMD(d);
        const count = dateCount.get(key) ?? 0;
        const has = count > 0;
        const level = heatLevel(count);
        const cls = has ? `cal-cell has-posts heat-${level}` : 'cal-cell';
        const postsTemplate = tr.cal_posts_tip || (lang === 'en' ? '{n} posts' : lang === 'ja' ? '{n} 件' : '该日共 {n} 篇');
        const tip = has ? ` data-tip="${postsTemplate.replace('{n}', String(count))}"` : '';
        const target = has ? ` data-target-date="${key}"` : '';
        parts.push(`<div class="${cls}"${tip}${target}><span>${dayNum}</span></div>`);
      }

      parts.push('</div>');
      calendarBody.innerHTML = parts.join('');

      if (window.siteI18n?.applyTo) try { window.siteI18n.applyTo(calendarBody); } catch (error) {
        console.error('[archive] 应用国际化失败:', error);
      }
      updateCalendarI18n();
    }

    function renderYear() {
      const y = cursor.getFullYear();
      const { lang, tr } = getCalTranslations();
      const locale = lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en-US';

      if (lang === 'ja' && y >= 2019) {
        const reiwa = y - 2018;
        const era = reiwa === 1 ? '（令和元年）' : `（令和${reiwa}年）`;
        calLabel.textContent = `${y}年 ${era}`;
      } else {
        try {
          calLabel.textContent = new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(new Date(y, 0, 1));
        } catch (error) {
          console.error('[archive] 格式化年份失败:', error);
          calLabel.textContent = `${y}年`;
        }
      }

      const parts = [];
      parts.push('<div class="cal-year-grid">');

      for (let month = 0; month < 12; month++) {
        const d = new Date(y, month, 1);
        const key = toYM(d);
        const count = monthCount.get(key) ?? 0;
        const has = count > 0;
        const level = monthHeatLevel(count);
        const cls = has ? `cal-month has-posts heat-${level}` : 'cal-month';
        const monthTipTemplate = tr.cal_month_tip || (lang === 'en' ? '{n} posts' : lang === 'ja' ? '{n} 件' : '本月共 {n} 篇');
        const tip = has ? ` data-tip="${monthTipTemplate.replace('{n}', String(count))}"` : '';
        const target = has ? ` data-target-month="${key}"` : '';

        let monthLabel = '';
        if (lang === 'en') {
          try { monthLabel = new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(y, month, 1)); } catch (error) {
            console.error('[archive] 格式化月份失败:', error);
            monthLabel = String(month + 1);
          }
        } else {
          monthLabel = `${month + 1}月`;
        }

        parts.push(`<div class="${cls}"${tip}${target}><span>${monthLabel}</span></div>`);
      }

      parts.push('</div>');
      calendarBody.innerHTML = parts.join('');

      if (window.siteI18n?.applyTo) try { window.siteI18n.applyTo(calendarBody); } catch (error) {
        console.error('[archive] 应用国际化失败:', error);
      }
      updateCalendarI18n();
    }

    function render() {
      if (view === 'year') renderYear();
      else renderMonth();
      if (window.siteI18n?.applyTo) try { window.siteI18n.applyTo(calendarBody); } catch (error) {
        console.error('[archive] 应用国际化失败:', error);
      }
      updateCalendarI18n();
    }

    // ---- 导航事件 ----
    btnPrev.addEventListener('click', () => {
      if (view === 'year') cursor = new Date(cursor.getFullYear() - 1, 0, 1);
      else cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
      render();
    });

    btnNext.addEventListener('click', () => {
      if (view === 'year') cursor = new Date(cursor.getFullYear() + 1, 0, 1);
      else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      render();
    });

    toggleButtons.forEach((btn) => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    btnToday.addEventListener('click', () => {
      const today = new Date();
      if (!includesDateInCurrentView(today)) {
        locateToDate(today);
        render();
      }
    });

    // ---- 日历点击跳转 ----
    function jumpTimelineToDate(targetYmd) {
      if (!targetYmd) return;
      const timeline = document.getElementById('archiveTimeline');
      if (!timeline) return;

      const el = timeline.querySelector(`.timeline-item[data-date="${targetYmd}"]`);
      if (!el) return;

      const block = timeline.classList.contains('drum') ? 'center' : 'start';
      el.scrollIntoView({ behavior: 'smooth', block });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 900);

      if (timeline.classList.contains('drum')) {
        const update = timeline.__drumUpdate;
        if (typeof update === 'function') {
          requestAnimationFrame(update);
          setTimeout(update, 220);
        }
      }
    }

    calendarBody.addEventListener('click', (e) => {
      const dayEl = e.target.closest?.('.cal-cell.has-posts');
      if (dayEl?.dataset?.targetDate) {
        jumpTimelineToDate(dayEl.dataset.targetDate);
        return;
      }

      const monthEl = e.target.closest?.('.cal-month.has-posts');
      if (monthEl?.dataset?.targetMonth) {
        const ym = monthEl.dataset.targetMonth;
        const maxDate = monthMaxDate.get(ym);
        if (maxDate) jumpTimelineToDate(maxDate);
      }
    });

    render();
    updateToggleBackground();

    // 默认定位到今天
    try {
      const today = new Date();
      const todayYmd = toYMD(today);
      if (!includesDateInCurrentView(today)) {
        locateToDate(today);
        render();
      }
      if (dateCount.has(todayYmd)) {
        setTimeout(() => jumpTimelineToDate(todayYmd), 80);
      }
    } catch (error) {
      console.error('[archive] 定位到今天失败:', error);
    }

    return {
      setBlogs(nextBlogs) {
        rebuildCalendarStats(nextBlogs);
        render();
      }
    };
  }

  // ==================== 语言切换监听 ====================

  document.addEventListener('site:languageChanged', () => {
    updateArchiveDates();
    initArchiveMobileTitleMarquee();
  });

  // 窗口缩放时更新标题滚动
  if (!window.__archiveTitleMarqueeResizeBound) {
    window.__archiveTitleMarqueeResizeBound = true;
    let archiveTitleResizeTimer = null;
    window.addEventListener('resize', () => {
      if (archiveTitleResizeTimer) clearTimeout(archiveTitleResizeTimer);
      archiveTitleResizeTimer = setTimeout(() => {
        initArchiveMobileTitleMarquee();
      }, 140);
    });
  }

  // ==================== 初始化 ====================

  fetch('data/blogs.json')
    .then((res) => res.json())
    .then((blogs) => {
      blogs.sort((a, b) => new Date(b.date) - new Date(a.date));
      let activeBlogs = blogs.slice();

      renderTimeline(activeBlogs);
      initTimelineDrum();
      const calendarController = initArchiveCalendar(activeBlogs);

      function applyArchiveFilter(mode) {
        activeBlogs = filterArchiveBlogs(blogs, mode);
        renderTimeline(activeBlogs);
        if (calendarController?.setBlogs) {
          calendarController.setBlogs(activeBlogs);
        }

        const timeline = document.getElementById('archiveTimeline');
        if (timeline?.__drumUpdate) {
          requestAnimationFrame(timeline.__drumUpdate);
        }
      }

      const filterController = initArchiveFilterUI(applyArchiveFilter);
      try { initCalendarFab(filterController); } catch (error) {
        console.error('[archive] 初始化日历Fab失败:', error);
      }

      // 默认滚动到最新文章
      setTimeout(() => {
        const timeline = document.getElementById('archiveTimeline');
        if (!timeline) return;

        const firstItem = timeline.querySelector('.timeline-item[data-date]');
        if (!firstItem) return;

        const block = timeline.classList.contains('drum') ? 'center' : 'start';
        firstItem.scrollIntoView({ behavior: 'auto', block });

        const update = timeline.__drumUpdate;
        if (typeof update === 'function') {
          requestAnimationFrame(update);
          setTimeout(update, 220);
        }
      }, 60);
    })
    .catch(() => {
      const timeline = document.getElementById('archiveTimeline');
      if (timeline) {
        timeline.innerHTML = '<div style="color:#aaa;text-align:center;padding:40px;">数据加载失败</div>';
      }
    });
})();