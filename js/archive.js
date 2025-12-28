function pad2(n) {
  return String(n).padStart(2, '0');
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

function toYM(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  return `${y}-${m}`;
}

// compute offset into calendar grid given JS day index (0=Sun) and desired weekStart (0=Sun,1=Mon)
function computeOffset(jsDay /* 0=Sun */, weekStart) {
  return ((jsDay - (weekStart || 0)) + 7) % 7;
}

function heat(count, max) {
  if (!count || !max) return 0;
  const ratio = Math.min(1, Math.max(0, count / max));
  return 0.18 + ratio * 0.72;
}

function renderTimeline(blogs) {
  const timeline = document.getElementById('archiveTimeline');
  if (!timeline) return;
  timeline.innerHTML = '';

  // 在时间轴顶部插入一个标题性文字节点，位于第一张卡片上方，居中对齐且无背景
  const headerItem = document.createElement('div');
  headerItem.className = 'timeline-item timeline-header';
  headerItem.innerHTML = `
      <div class="timeline-header-content" data-i18n="archive_timeline_title"></div>
    `;
  timeline.appendChild(headerItem);

  // Ensure newly created nodes get i18n applied immediately
  if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
    try { window.siteI18n.applyTo(timeline); } catch (e) { /* ignore */ }
  }

  // 接着渲染每一篇博客卡片
  blogs.forEach(blog => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    item.dataset.date = blog.date;
    const displayDate = (typeof window !== 'undefined' && typeof window.formatDate === 'function') ? window.formatDate(blog.date) : blog.date;
    item.innerHTML = `
    <a class="timeline-link" href="blog-detail.html?id=${blog.id}">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-date date" data-date="${blog.date}">${displayDate}</div>
        <div class="timeline-title">${blog.title}</div>
        <div class="timeline-excerpt">${blog.excerpt}</div>
      </div>
    </a>
    `;
    timeline.appendChild(item);
  });
  // After rendering all items, format dates once using current language
  if (typeof updateArchiveDates === 'function') updateArchiveDates();
}

// Archive-specific date formatter (language-aware) and updater
function archiveFormatDate(dateString) {
  const date = new Date(dateString);
  try {
    const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'zh';
    if (lang === 'en') {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } else if (lang === 'ja') {
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const d = date.getDate();
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

function updateArchiveDates() {
  try {
    document.querySelectorAll('.timeline-date.date[data-date]').forEach(el => {
      const d = el.getAttribute('data-date');
      if (d) {
        // prefer global formatter if available
        if (typeof window !== 'undefined' && typeof window.formatDate === 'function') {
          el.textContent = window.formatDate(d);
        } else {
          el.textContent = archiveFormatDate(d);
        }
      }
    });
  } catch (e) {
    console.warn('updateArchiveDates error', e);
  }
}

// listen for language changes
document.addEventListener('site:languageChanged', function (e) {
  updateArchiveDates();
});

function initTimelineDrum() {
  const timeline = document.getElementById('archiveTimeline');
  if (!timeline) return;

  timeline.classList.add('drum');
  if (!timeline.hasAttribute('tabindex')) timeline.setAttribute('tabindex', '0');

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
    contents.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height > maxItemH) maxItemH = r.height;
    });

    const pad = Math.max(0, h / 2 - maxItemH / 2);
    timeline.style.setProperty('--drum-pad', `${Math.round(pad)}px`);
  }

  function update() {
    computeDrumPadding();
    const rect = timeline.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    const denom = Math.max(1, rect.height / 2);

    getItems().forEach(item => {
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
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      update();
      ticking = false;
    });
  }

  timeline.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update);

  // 供其它逻辑（比如日历跳转）触发一次滚筒刷新
  timeline.__drumUpdate = update;

  update();
}

function initArchiveCalendar(blogs) {
  const calendarBody = document.getElementById('calendarBody');
  const calLabel = document.getElementById('calLabel');
  const btnPrev = document.getElementById('calPrev');
  const btnNext = document.getElementById('calNext');
  const btnToday = document.getElementById('calToday');
  const toggleButtons = Array.from(document.querySelectorAll('.calendar-toggle-btn'));

  if (!calendarBody || !calLabel || !btnPrev || !btnNext || !btnToday || toggleButtons.length === 0) return;

  const dateCount = new Map();
  const monthCount = new Map();
  const monthMaxDate = new Map();
  let maxDay = 0;
  let maxMonth = 0;

  blogs.forEach(blog => {
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

  let view = 'month';
  const baseDate = blogs.length ? new Date(blogs[0].date) : new Date();
  let cursor = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);

  // helper to get current translations for calendar
  function getCalTranslations() {
    const lang = (window.siteI18n && window.siteI18n.getLang) ? window.siteI18n.getLang() : 'zh';
    const tr = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[lang] || {}) : {};
    return { lang, tr };
  }

  // update calendar i18n texts (weekday labels, tips, year label adjustments)
  function updateCalendarI18n() {
    try {
      const { lang, tr } = getCalTranslations();
      // weekday labels (support rotating start-of-week per locale)
      const weekdaysRaw = (tr && tr.cal_weekdays) ? String(tr.cal_weekdays).split(',') : null;
      const baseWeek = weekdaysRaw && weekdaysRaw.length === 7 ? weekdaysRaw : (lang === 'ja' ? ['月', '火', '水', '木', '金', '土', '日'] : (lang === 'en' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['一', '二', '三', '四', '五', '六', '日']));
      const weekStart = (tr && typeof tr.weekStart === 'number') ? tr.weekStart : (lang === 'zh' ? 1 : 0);
      const weekLabels = (weekStart === 1) ? baseWeek : ([baseWeek[6]].concat(baseWeek.slice(0, 6)));
      const weekEls = calendarBody ? Array.from(calendarBody.querySelectorAll('.cal-weekday')) : [];
      weekEls.forEach((el, idx) => { if (weekLabels[idx]) el.textContent = weekLabels[idx]; });

      // tips and month labels in year view will be updated when calendar is re-rendered,
      // but for safety update existing month tip texts here
      const monthTipTemplate = (tr && tr.cal_month_tip) || (lang === 'en' ? '{n} posts' : (lang === 'ja' ? '{n} 件' : '本月共 {n} 篇'));
      const monthEls = calendarBody ? Array.from(calendarBody.querySelectorAll('.cal-month')) : [];
      monthEls.forEach((el) => {
        const span = el.querySelector('span');
        const target = el.getAttribute('data-target-month');
        if (target && monthCount.has(target)) {
          const c = monthCount.get(target) || 0;
          el.setAttribute('data-tip', monthTipTemplate.replace('{n}', String(c)));
        }
      });

      // also update calLabel for current view
      const calLabelEl = document.getElementById('calLabel');
      if (calLabelEl) {
        if (view === 'month') {
          const y = cursor.getFullYear();
          const m = cursor.getMonth();
          try { calLabelEl.textContent = new Intl.DateTimeFormat((lang === 'ja') ? 'ja-JP' : (lang === 'en' ? 'en-US' : 'zh-CN'), { year: 'numeric', month: 'long' }).format(new Date(y, m, 1)); }
          catch (e) { calLabelEl.textContent = `${y}年${m + 1}月`; }
        } else {
          const y = cursor.getFullYear();
          if (lang === 'ja' && y >= 2019) {
            const reiwa = y - 2018; const era = reiwa === 1 ? '（令和元年）' : `（令和${reiwa}年）`;
            calLabelEl.textContent = `${y}年 ${era}`;
          } else {
            try { calLabelEl.textContent = new Intl.DateTimeFormat((lang === 'ja') ? 'ja-JP' : (lang === 'en' ? 'en-US' : 'zh-CN'), { year: 'numeric' }).format(new Date(y, 0, 1)); }
            catch (e) { calLabelEl.textContent = `${y}年`; }
          }
        }
      }
    } catch (e) {
      console.warn('updateCalendarI18n failed', e);
    }
  }

  // listen for language changes to update calendar labels/tips AND re-render grid
  document.addEventListener('site:languageChanged', function () { try { render(); } catch (e) { updateCalendarI18n(); } });

  function includesDateInCurrentView(date) {
    if (view === 'year') return cursor.getFullYear() === date.getFullYear();
    return cursor.getFullYear() === date.getFullYear() && cursor.getMonth() === date.getMonth();
  }

  function locateToDate(date) {
    if (view === 'year') cursor = new Date(date.getFullYear(), 0, 1);
    else cursor = new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function setView(nextView) {
    view = nextView;
    toggleButtons.forEach(btn => {
      const active = btn.dataset.view === view;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    // 切换视图时自动执行一次“定位到今天”
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
    const locale = (lang === 'zh') ? 'zh-CN' : (lang === 'ja' ? 'ja-JP' : 'en-US');
    try { calLabel.textContent = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' }).format(new Date(y, m, 1)); }
    catch (e) { calLabel.textContent = `${y}年${m + 1}月`; }

    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const weekStart = (tr && typeof tr.weekStart === 'number') ? tr.weekStart : (lang === 'zh' ? 1 : 0);
    const offset = computeOffset(first.getDay(), weekStart);

    // weekdays: try translations first, then rotate to match weekStart
    const weekdaysBase = (tr && tr.cal_weekdays) ? String(tr.cal_weekdays).split(',') : ['一', '二', '三', '四', '五', '六', '日'];
    const weekdays = (weekStart === 1) ? weekdaysBase : ([weekdaysBase[6]].concat(weekdaysBase.slice(0, 6)));
    const parts = [];
    parts.push('<div class="cal-grid">');
    weekdays.forEach(w => parts.push(`<div class="cal-weekday">${w}</div>`));

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
      const h = heat(count, maxDay);
      const style = has ? ` style="--heat:${h.toFixed(3)}"` : '';
      const cls = has ? 'cal-cell has-posts' : 'cal-cell';
      const postsTemplate = (tr && tr.cal_posts_tip) ? tr.cal_posts_tip : ((lang === 'en') ? '{n} posts' : (lang === 'ja' ? '{n} 件' : '该日共 {n} 篇'));
      const tip = has ? ` data-tip="${postsTemplate.replace('{n}', String(count))}"` : '';
      const target = has ? ` data-target-date="${key}"` : '';
      parts.push(`<div class="${cls}"${style}${tip}${target}><span>${dayNum}</span></div>`);
    }

    parts.push('</div>');
    calendarBody.innerHTML = parts.join('');
    // apply translations and update i18n texts/tips
    if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') try { window.siteI18n.applyTo(calendarBody); } catch (e) { }
    updateCalendarI18n();
  }

  function renderYear() {
    const y = cursor.getFullYear();
    const { lang, tr } = getCalTranslations();
    const locale = (lang === 'zh') ? 'zh-CN' : (lang === 'ja' ? 'ja-JP' : 'en-US');
    if (lang === 'ja' && y >= 2019) {
      const reiwa = y - 2018;
      const era = reiwa === 1 ? '（令和元年）' : `（令和${reiwa}年）`;
      calLabel.textContent = `${y}年 ${era}`;
    } else {
      try { calLabel.textContent = new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(new Date(y, 0, 1)); }
      catch (e) { calLabel.textContent = `${y}年`; }
    }


    const parts = [];
    parts.push('<div class="cal-year-grid">');
    for (let month = 0; month < 12; month++) {
      const d = new Date(y, month, 1);
      const key = toYM(d);
      const count = monthCount.get(key) ?? 0;
      const has = count > 0;
      const h = heat(count, maxMonth);
      const style = has ? ` style="--heat:${h.toFixed(3)}"` : '';
      const cls = has ? 'cal-month has-posts' : 'cal-month';
      const monthTipTemplate = (tr && tr.cal_month_tip) ? tr.cal_month_tip : (lang === 'en' ? '{n} posts' : (lang === 'ja' ? '{n} 件' : '本月共 {n} 篇'));
      const tip = has ? ` data-tip="${monthTipTemplate.replace('{n}', String(count))}"` : '';
      const target = has ? ` data-target-month="${key}"` : '';
      // month label in year view
      let monthLabel = '';
      if (lang === 'en') {
        try { monthLabel = new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(y, month, 1)); }
        catch (e) { monthLabel = String(month + 1); }
      } else {
        monthLabel = `${month + 1}月`;
      }
      parts.push(`<div class="${cls}"${style}${tip}${target}><span>${monthLabel}</span></div>`);
    }
    parts.push('</div>');
    calendarBody.innerHTML = parts.join('');
    if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') try { window.siteI18n.applyTo(calendarBody); } catch (e) { }
    updateCalendarI18n();
  }

  function render() {
    if (view === 'year') renderYear();
    else renderMonth();
    // ensure calendar i18n applied after any render
    if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') try { window.siteI18n.applyTo(calendarBody); } catch (e) { }
    updateCalendarI18n();
  }

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

  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  btnToday.addEventListener('click', () => {
    const today = new Date();
    if (includesDateInCurrentView(today)) return;
    locateToDate(today);
    render();
  });

  function jumpTimelineToDate(targetYmd) {
    if (!targetYmd) return;
    const timeline = document.getElementById('archiveTimeline');
    if (!timeline) return;
    const el = timeline.querySelector(`.timeline-item[data-date="${targetYmd}"]`);
    if (!el) return;
    const block = timeline.classList.contains('drum') ? 'center' : 'start';
    el.scrollIntoView({ behavior: 'smooth', block });
    el.classList.add('flash');
    window.setTimeout(() => el.classList.remove('flash'), 900);

    if (timeline.classList.contains('drum')) {
      const update = timeline.__drumUpdate;
      if (typeof update === 'function') {
        window.requestAnimationFrame(update);
        window.setTimeout(update, 220);
      }
    }
  }

  calendarBody.addEventListener('click', (e) => {
    const dayEl = e.target.closest?.('.cal-cell.has-posts');
    if (dayEl && dayEl.dataset?.targetDate) {
      jumpTimelineToDate(dayEl.dataset.targetDate);
      return;
    }

    const monthEl = e.target.closest?.('.cal-month.has-posts');
    if (monthEl && monthEl.dataset?.targetMonth) {
      const ym = monthEl.dataset.targetMonth;
      const maxDate = monthMaxDate.get(ym);
      if (maxDate) jumpTimelineToDate(maxDate);
    }
  });

  render();
}

// 归档页面：时间轴 + 侧边日历
fetch('data/blogs.json')
  .then(res => res.json())
  .then(blogs => {
    blogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderTimeline(blogs);
    initTimelineDrum();
    initArchiveCalendar(blogs);
    // 页面进入后默认将最近一篇博文滚动到时间轴中心
    setTimeout(() => {
      const timeline = document.getElementById('archiveTimeline');
      if (!timeline) return;
      const firstItem = timeline.querySelector('.timeline-item[data-date]');
      if (!firstItem) return;
      firstItem.scrollIntoView({ behavior: 'auto', block: 'center' });
      // 如果启用了 drum 效果，触发一次更新以计算居中样式
      const update = timeline.__drumUpdate;
      if (typeof update === 'function') {
        window.requestAnimationFrame(update);
        window.setTimeout(update, 220);
      }
    }, 60);
  });
