// 分类页面多级分类渲染
let blogsData = [];
let selectedTags = [];

const MAX_LEVELS = 3;
const wheelTimers = new Map();
const programmaticUntil = new Map();

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function buildTagTree() {
    const tagTree = {};
    blogsData.forEach(blog => {
        const tags = Array.isArray(blog.tags) ? blog.tags.slice(0, MAX_LEVELS) : [];
        if (!tags.length) return;

        let node = tagTree;
        tags.forEach((tag, i) => {
            const isLeaf = i === tags.length - 1;
            if (!node[tag]) node[tag] = isLeaf ? [] : {};
            if (isLeaf) node[tag].push(blog);
            else node = node[tag];
        });
    });
    return tagTree;
}

function getTagsAtLevel(tagTree, level) {
    let node = tagTree;
    for (let i = 0; i < level; i++) {
        const key = selectedTags[i];
        if (!key) return [];
        node = node && typeof node === 'object' ? node[key] : null;
        if (!node || Array.isArray(node)) return [];
    }
    if (!node || Array.isArray(node)) return [];
    return Object.keys(node);
}

function getSelectedIndex(tags, level) {
    if (!tags.length) return -1;
    const sel = selectedTags[level];
    if (!sel) return 0;
    const idx = tags.indexOf(sel);
    return idx >= 0 ? idx : 0;
}

function adjustWheelPadding(wheelEl) {
    const first = wheelEl.querySelector('.wheel-item');
    if (!first) return;
    const itemH = first.getBoundingClientRect().height || 54;
    const wheelH = wheelEl.getBoundingClientRect().height;
    const pad = Math.max(0, Math.round(wheelH / 2 - itemH / 2));
    wheelEl.style.paddingTop = `${pad}px`;
    wheelEl.style.paddingBottom = `${pad}px`;
}

function getWheelCenterY(wheelEl) {
    return wheelEl.scrollTop + wheelEl.clientHeight / 2;
}

function findClosestWheelIndex(wheelEl) {
    const items = Array.from(wheelEl.querySelectorAll('.wheel-item'));
    if (!items.length) return -1;
    const centerY = getWheelCenterY(wheelEl);
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const itemCenter = it.offsetTop + it.offsetHeight / 2;
        const dist = Math.abs(itemCenter - centerY);
        if (dist < bestDist) {
            bestDist = dist;
            bestIdx = i;
        }
    }
    return bestIdx;
}

function applyWheelVisuals(wheelEl) {
    const items = Array.from(wheelEl.querySelectorAll('.wheel-item'));
    if (!items.length) return;
    const centerY = getWheelCenterY(wheelEl);
    const itemH = items[0].offsetHeight || 54;

    for (const it of items) {
        const itemCenter = it.offsetTop + it.offsetHeight / 2;
        const d = itemCenter - centerY;
        const steps = d / itemH;
        const abs = Math.abs(steps);

        const opacity = clamp(1 - abs * 0.28, 0, 1);
        const scale = clamp(1 - abs * 0.08, 0.78, 1);
        const rotateX = clamp(steps * 10, -50, 50);
        const blur = clamp(abs * 0.6, 0, 2.2);

        it.style.opacity = `${opacity}`;
        it.style.transform = `rotateX(${rotateX}deg) translateZ(${(1 - abs) * 10}px) scale(${scale})`;
        it.style.filter = `blur(${blur}px)`;
    }

    const idx = findClosestWheelIndex(wheelEl);
    items.forEach((it, i) => it.classList.toggle('is-center', i === idx));

    // 更新覆盖三列的选中框（如果在一个 .categories-wheel-row 下，复用同一个框）
    try {
        const wheelRow = wheelEl.closest('.categories-wheel-row');
        if (wheelRow) {
            let frame = wheelRow.querySelector('.wheel-selected-frame');
            if (!frame) {
                frame = document.createElement('div');
                frame.className = 'wheel-selected-frame';
                frame.setAttribute('aria-hidden', 'true');
                wheelRow.appendChild(frame);
            }

            // 若框为首次插入（render 时标记），在首次设置位置时禁用 transition
            const isInitial = frame.dataset.initial === 'true';
            if (isInitial) {
                frame.style.transition = 'none';
            }

            const wheelRect = wheelEl.getBoundingClientRect();
            const rowRect = wheelRow.getBoundingClientRect();
            const centerY_in_row = (wheelRect.top - rowRect.top) + (wheelEl.clientHeight / 2);
            // 使选中框略高一些以增强视觉（额外高度由 extraHeight 控制）
            const extraHeight = 8; // px，可按需调整
            const frameH = Math.round(itemH + extraHeight);
            const topPx = Math.round(centerY_in_row - frameH / 2);

            frame.style.height = `${frameH}px`;
            frame.style.top = `${topPx}px`;

            if (isInitial) {
                // 清除标记并在下一帧恢复 CSS 中定义的过渡
                delete frame.dataset.initial;
                window.requestAnimationFrame(() => {
                    frame.style.transition = '';
                });
            }
        }
    } catch (err) {
        // 安全降级：若位置计算失败，不阻塞主流程
        // console.warn('wheel frame update failed', err);
    }
}

function scrollItemIntoCenter(wheelEl, index, behavior = 'smooth') {
    const items = Array.from(wheelEl.querySelectorAll('.wheel-item'));
    if (!items.length) return;
    const idx = clamp(index, 0, items.length - 1);
    const it = items[idx];
    const target = it.offsetTop + it.offsetHeight / 2 - wheelEl.clientHeight / 2;
    programmaticUntil.set(wheelEl, Date.now() + 220);
    wheelEl.scrollTo({ top: target, behavior });
}

function setSelectedTag(level, tag) {
    const current = selectedTags[level];
    if (current === tag) return false;

    selectedTags = selectedTags.slice(0, level);
    if (tag != null) selectedTags[level] = tag;
    return true;
}

function scheduleSnap(wheelEl, onSnap) {
    const prev = wheelTimers.get(wheelEl);
    if (prev) window.clearTimeout(prev);
    wheelTimers.set(wheelEl, window.setTimeout(() => {
        const idx = findClosestWheelIndex(wheelEl);
        scrollItemIntoCenter(wheelEl, idx, 'smooth');
        if (typeof onSnap === 'function') onSnap(idx);
    }, 140));
}

function bindWheelInteractions(wheelEl, level, tags) {
    const now = Date.now();

    applyWheelVisuals(wheelEl);

    wheelEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY;
        wheelEl.scrollTop += delta * 0.55;
    }, { passive: false });

    wheelEl.addEventListener('scroll', () => {
        const until = programmaticUntil.get(wheelEl) || 0;
        applyWheelVisuals(wheelEl);
        if (Date.now() < until) return;
        scheduleSnap(wheelEl, (idx) => {
            const tag = tags[idx];
            const changed = setSelectedTag(level, tag);
            if (changed) {
                renderCategories();
                renderBlogList();
            }
        });
    });

    wheelEl.addEventListener('click', (e) => {
        const target = e.target.closest('.wheel-item');
        if (!target) return;
        const idx = Number(target.dataset.index);
        if (Number.isNaN(idx)) return;
        scrollItemIntoCenter(wheelEl, idx, 'smooth');
        const changed = setSelectedTag(level, tags[idx]);
        if (changed) {
            renderCategories();
            renderBlogList();
        }
        try {
            wheelEl.focus({ preventScroll: true });
        } catch (e) {
            // 某些旧浏览器可能不支持 preventScroll 选项，退回到默认行为
            wheelEl.focus();
        }
    });

    wheelEl.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const idx = findClosestWheelIndex(wheelEl);
        const next = idx + (e.key === 'ArrowDown' ? 1 : -1);
        scrollItemIntoCenter(wheelEl, next, 'smooth');
        const newIdx = clamp(next, 0, tags.length - 1);
        const changed = setSelectedTag(level, tags[newIdx]);
        if (changed) {
            renderCategories();
            renderBlogList();
        }
    });

    // 初次渲染后对齐到当前选项
    if (now) {
        const selectedIndex = getSelectedIndex(tags, level);
        window.requestAnimationFrame(() => {
            adjustWheelPadding(wheelEl);
            scrollItemIntoCenter(wheelEl, selectedIndex, 'auto');
            applyWheelVisuals(wheelEl);
        });
    }
}

function renderCategories() {
    const tagTree = buildTagTree();

    const container = document.getElementById('categoriesContainer');
    // 防止清空重建时容器高度塌陷引起页面微移：先固定当前高度
    const prevH = container.getBoundingClientRect().height || container.offsetHeight || 0;
    if (prevH > 0) container.style.minHeight = `${prevH}px`;
    container.innerHTML = '';

    const panelTitle = document.createElement('div');
    panelTitle.className = 'categories-panel-title';
    panelTitle.setAttribute('data-i18n', 'categories_filter_title');
    container.appendChild(panelTitle);

    const wheelRow = document.createElement('div');
    wheelRow.className = 'categories-wheel-row';
    container.appendChild(wheelRow);
    // 预创建覆盖三列的选中框，避免首次动态创建时引起布局跳动
    const preFrame = document.createElement('div');
    preFrame.className = 'wheel-selected-frame';
    preFrame.setAttribute('aria-hidden', 'true');
    // 标记首次插入，首次位置设置时禁用过渡以避免跳动
    preFrame.dataset.initial = 'true';
    wheelRow.appendChild(preFrame);

    // labels localized via i18n
    const lang = (window.siteI18n && window.siteI18n.getLang) ? window.siteI18n.getLang() : 'zh';
    const t = (window.siteI18n && window.siteI18n.translations) ? window.siteI18n.translations[lang] || window.siteI18n.translations['zh'] : null;
    const labels = t ? [t.label_domain, t.label_subject, t.label_topic] : ['领域', '科目', '主题'];

    // 先按层级顺序计算每层可用标签并确保 selectedTags 默认指向每层第一个可用项
    const tagsPerLevel = [];
    let node = tagTree;
    for (let level = 0; level < MAX_LEVELS; level++) {
        if (!node || Array.isArray(node)) {
            const labels = (window.siteI18n && window.siteI18n.translations) ? [
                (window.siteI18n.translations[window.siteI18n.getLang()] || {}).label_domain || '领域',
                (window.siteI18n.translations[window.siteI18n.getLang()] || {}).label_subject || '科目',
                (window.siteI18n.translations[window.siteI18n.getLang()] || {}).label_topic || '主题'
            ] : ['领域', '科目', '主题'];
        } else {
            tagsPerLevel[level] = Object.keys(node);
        }

        if (tagsPerLevel[level].length > 0) {
            // 若未设置或当前值不在可选列表中，默认选中第一个
            if (!selectedTags[level] || tagsPerLevel[level].indexOf(selectedTags[level]) === -1) {
                selectedTags[level] = tagsPerLevel[level][0];
            }
            node = node[selectedTags[level]];
        } else {
            // 无下级可选项，清空后续
            selectedTags[level] = undefined;
            node = null;
        }
    }

    // 逐列渲染（保证三列均显示，缺项时显示占位）
    for (let level = 0; level < MAX_LEVELS; level++) {
        const tags = tagsPerLevel[level] || [];

        const wrap = document.createElement('div');
        wrap.className = 'categories-wheel-wrap';

        const label = document.createElement('div');
        label.className = 'categories-wheel-label';
        const keyNames = ['label_domain', 'label_subject', 'label_topic'];
        const keyName = keyNames[level] || 'label_domain';
        label.setAttribute('data-i18n', keyName);
        // provide immediate fallback text while i18n.applyTo runs
        label.textContent = labels[level] || (window.siteI18n && window.siteI18n.translations ? (window.siteI18n.translations[window.siteI18n.getLang()] || {})[keyName] : keyName);
        wrap.appendChild(label);

        const wheel = document.createElement('div');
        wheel.className = 'categories-wheel';
        wheel.setAttribute('role', 'listbox');
        wheel.setAttribute('tabindex', '0');
        wheel.setAttribute('aria-label', `${labels[level]}筛选`);

        if (tags.length === 0) {
            const item = document.createElement('div');
            item.className = 'wheel-item empty';
            item.textContent = '— 无选项 —';
            item.dataset.index = '0';
            wheel.appendChild(item);
        } else {
            tags.forEach((tag, idx) => {
                const item = document.createElement('div');
                item.className = 'wheel-item' + (selectedTags[level] === tag ? ' is-selected' : '');
                item.textContent = tag;
                item.dataset.index = String(idx);
                wheel.appendChild(item);
            });
        }

        wrap.appendChild(wheel);
        wheelRow.appendChild(wrap);

        // 仅当存在真实标签时绑定交互
        if (tags.length > 0) bindWheelInteractions(wheel, level, tags);
    }

    // 重建完成后恢复高度约束
    container.style.minHeight = '';
    // apply i18n to newly created elements
    if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
        try { window.siteI18n.applyTo(container); } catch (e) { /* ignore */ }
    }
}

function renderBlogList() {
    const listDiv = document.getElementById('blogList');
    listDiv.innerHTML = '';
    let filtered = blogsData;
    for (let i = 0; i < selectedTags.length; i++) {
        if (!selectedTags[i]) continue;
        filtered = filtered.filter(blog => blog.tags[i] === selectedTags[i]);
    }
    filtered.forEach(blog => {
        const item = document.createElement('div');
        item.className = 'blog-item';
        item.innerHTML = `
            <a class="blog-link" href="blog-detail.html?id=${blog.id}">
                <div class="blog-title">${blog.title}</div>
                <div class="blog-excerpt">${blog.excerpt}</div>
            </a>
        `;
        listDiv.appendChild(item);
    });
    if (!filtered.length) {
        try {
            const lang = (window.siteI18n && typeof window.siteI18n.getLang === 'function') ? window.siteI18n.getLang() : 'zh';
            const tr = (window.siteI18n && window.siteI18n.translations) ? (window.siteI18n.translations[lang] || {}) : {};
            listDiv.innerHTML = '<div style="color:#aaa;text-align:center;">' + (tr.categories_no_blogs || '暂无该分类下的博客') + '</div>';
        } catch (e) {
            listDiv.innerHTML = '<div style="color:#aaa;text-align:center;">暂无该分类下的博客</div>';
        }
    }
}

fetch('data/blogs.json')
    .then(res => res.json())
    .then(blogs => {
        blogsData = blogs;
        renderCategories();
        renderBlogList();
    });

// ensure dynamically created category labels are updated when language changes
document.addEventListener('site:languageChanged', function () {
    try {
        const container = document.getElementById('categoriesContainer');
        if (container && window.siteI18n && typeof window.siteI18n.applyTo === 'function') {
            window.siteI18n.applyTo(container);
        }
    } catch (e) {
        console.warn('categories language update failed', e);
    }
});
