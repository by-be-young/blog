const DATA_URL = 'data/pdf-materials.json';

const listEl = document.getElementById('pdfList');
const frameEl = document.getElementById('pdfFrame');
const titleEl = document.getElementById('currentTitle');
const openLinkEl = document.getElementById('openLink');
const metaEl = document.getElementById('metaText');
const searchEl = document.getElementById('searchInput');
const emptyHintEl = document.getElementById('emptyHint');

let allItems = [];
let activeId = null;

function encodePath(p) {
    return encodeURI(String(p || ''));
}

function updateMeta(visibleCount, totalCount) {
    metaEl.textContent = `共 ${totalCount} 个 PDF，当前显示 ${visibleCount} 个`;
}

function setActiveItem(item) {
    activeId = item ? item.id : null;

    document.querySelectorAll('.pdf-item').forEach(btn => {
        const id = Number(btn.dataset.id);
        btn.classList.toggle('active', id === activeId);
    });

    if (!item) {
        frameEl.removeAttribute('src');
        titleEl.textContent = '未选择文件';
        openLinkEl.setAttribute('href', '#');
        openLinkEl.setAttribute('aria-disabled', 'true');
        emptyHintEl.hidden = false;
        return;
    }

    const src = encodePath(item.path);
    frameEl.src = src;
    titleEl.textContent = item.title || item.relativePath || item.path;
    openLinkEl.href = src;
    openLinkEl.setAttribute('aria-disabled', 'false');
    emptyHintEl.hidden = true;
}

function renderList(items) {
    listEl.innerHTML = '';

    if (!items.length) {
        const li = document.createElement('li');
        li.textContent = '没有匹配的 PDF。';
        li.className = 'pdf-meta';
        listEl.appendChild(li);
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const item of items) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pdf-item';
        btn.dataset.id = String(item.id);
        btn.innerHTML = `<span class="pdf-title">${escapeHtml(item.title || '未命名 PDF')}</span>`;

        btn.addEventListener('click', () => setActiveItem(item));

        li.appendChild(btn);
        fragment.appendChild(li);
    }

    listEl.appendChild(fragment);

    if (activeId !== null) {
        const selected = items.find(item => item.id === activeId);
        if (selected) {
            setActiveItem(selected);
        }
    }
}

function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function applyFilter() {
    const keyword = (searchEl.value || '').trim().toLowerCase();

    const filtered = keyword
        ? allItems.filter(item => {
            const title = (item.title || '').toLowerCase();
            const rel = (item.relativePath || '').toLowerCase();
            const full = (item.path || '').toLowerCase();
            return title.includes(keyword) || rel.includes(keyword) || full.includes(keyword);
        })
        : allItems;

    updateMeta(filtered.length, allItems.length);
    renderList(filtered);

    if (!filtered.some(item => item.id === activeId)) {
        setActiveItem(null);
    }
}

async function init() {
    try {
        const res = await fetch(DATA_URL, { cache: 'no-cache' });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        allItems = Array.isArray(data.items) ? data.items : [];

        allItems.sort((a, b) => {
            const aName = String(a.relativePath || a.path || '');
            const bName = String(b.relativePath || b.path || '');
            return aName.localeCompare(bName, 'zh-CN');
        });

        applyFilter();
        setActiveItem(null);
    } catch (error) {
        metaEl.textContent = '读取 PDF 目录失败，请先运行 npm run generate。';
        listEl.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'pdf-meta';
        li.textContent = `错误：${error instanceof Error ? error.message : String(error)}`;
        listEl.appendChild(li);
        setActiveItem(null);
    }
}

searchEl.addEventListener('input', applyFilter);

init();
