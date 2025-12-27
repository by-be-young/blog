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

function mondayFirstIndex(jsDay /* 0=Sun */) {
  return (jsDay + 6) % 7;
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
    <div class="timeline-header-content">时间轴归档</div>
  `;
  timeline.appendChild(headerItem);

  // 接着渲染每一篇博客卡片
  blogs.forEach(blog => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    item.dataset.date = blog.date;
    item.innerHTML = `
    <a class="timeline-link" href="blog-detail.html?id=${blog.id}">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-date">${blog.date}</div>
        <div class="timeline-title">${blog.title}</div>
        <div class="timeline-excerpt">${blog.excerpt}</div>
      </div>
    </a>
    `;
    timeline.appendChild(item);
  });
}

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
    calLabel.textContent = `${y}年${m + 1}月`;

    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const offset = mondayFirstIndex(first.getDay());

    const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
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
      const tip = has ? ` data-tip="该日共 ${count} 篇"` : '';
      const target = has ? ` data-target-date="${key}"` : '';
      parts.push(`<div class="${cls}"${style}${tip}${target}><span>${dayNum}</span></div>`);
    }

    parts.push('</div>');
    calendarBody.innerHTML = parts.join('');
  }

  function renderYear() {
    const y = cursor.getFullYear();
    calLabel.textContent = `${y}年`;

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
      const tip = has ? ` data-tip="本月共 ${count} 篇"` : '';
      const target = has ? ` data-target-month="${key}"` : '';
      parts.push(`<div class="${cls}"${style}${tip}${target}><span>${month + 1}月</span></div>`);
    }
    parts.push('</div>');
    calendarBody.innerHTML = parts.join('');
  }

  function render() {
    if (view === 'year') renderYear();
    else renderMonth();
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
