// 分类页面多级分类渲染
let blogsData = [];
let selectedTags = [];

let isCollapsed = false;
let scrollTicking = false;

function getLowestSelectedTag() {
    return selectedTags.length ? selectedTags[selectedTags.length - 1] : null;
}

function updateCollapsedState() {
    const container = document.getElementById('categoriesContainer');
    if (!container) return;

    // 没有任何选择时不收起（避免只剩空面板）
    const hasSelection = selectedTags.length > 0;
    const shouldCollapse = hasSelection && window.scrollY > 140;
    isCollapsed = shouldCollapse;
    container.classList.toggle('is-collapsed', isCollapsed);

    const summaryTag = document.getElementById('categoriesCollapsedTag');
    if (summaryTag) {
        const lowest = getLowestSelectedTag();
        summaryTag.textContent = lowest ?? '';
    }
}

window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(() => {
        updateCollapsedState();
        scrollTicking = false;
    });
});

function renderCategories() {
    // 统计所有tag的多级结构
    const tagTree = {};
    blogsData.forEach(blog => {
        let node = tagTree;
        blog.tags.forEach((tag, i) => {
            if (!node[tag]) node[tag] = (i === blog.tags.length - 1) ? [] : {};
            if (i === blog.tags.length - 1) node[tag].push(blog);
            else node = node[tag];
        });
    });
    // 渲染多级tag选择
    const container = document.getElementById('categoriesContainer');
    container.innerHTML = '';

    const panelTitle = document.createElement('div');
    panelTitle.className = 'categories-panel-title';
    panelTitle.textContent = '筛选相关博客';
    container.appendChild(panelTitle);

    const collapsedSummary = document.createElement('div');
    collapsedSummary.className = 'categories-collapsed';
    collapsedSummary.innerHTML = `<span class="categories-collapsed-tag" id="categoriesCollapsedTag"></span>`;
    container.appendChild(collapsedSummary);

    // 先同步一次收起状态/文案（避免首次渲染为空）
    updateCollapsedState();

    let node = tagTree;
    for (let level = 0; level < 3; level++) {
        const tags = node && typeof node === 'object' && !Array.isArray(node) ? Object.keys(node) : [];
        if (!tags.length) break;
        const levelDiv = document.createElement('div');
        levelDiv.className = 'category-level';
        levelDiv.innerHTML = `<div class="category-title">${['选择领域', '选择科目', '选择主题'][level]}</div>`;
        const listDiv = document.createElement('div');
        listDiv.className = 'category-list';
        tags.forEach(tag => {
            const tagDiv = document.createElement('div');
            tagDiv.className = 'category-tag' + (selectedTags[level] === tag ? ' selected' : '');
            tagDiv.textContent = tag;
            tagDiv.onclick = () => {
                // 再次点击已选择的 tag：取消该层及其下级选择
                if (selectedTags[level] === tag) {
                    selectedTags = selectedTags.slice(0, level);
                } else {
                    selectedTags = selectedTags.slice(0, level);
                    selectedTags[level] = tag;
                }
                renderCategories();
                renderBlogList();
                updateCollapsedState();
            };
            listDiv.appendChild(tagDiv);
        });
        levelDiv.appendChild(listDiv);
        container.appendChild(levelDiv);
        node = node[selectedTags[level]];
        if (!node) break;
    }
}

function renderBlogList() {
    const listDiv = document.getElementById('blogList');
    listDiv.innerHTML = '';
    let filtered = blogsData;
    for (let i = 0; i < selectedTags.length; i++) {
        filtered = filtered.filter(blog => blog.tags[i] === selectedTags[i]);
    }
    filtered.forEach(blog => {
        const item = document.createElement('div');
        item.className = 'blog-item';
        item.innerHTML = `
      <div class="blog-title"><a href="blog-detail.html?id=${blog.id}">${blog.title}</a></div>
      <div class="blog-excerpt">${blog.excerpt}</div>
    `;
        listDiv.appendChild(item);
    });
    if (!filtered.length) {
        listDiv.innerHTML = '<div style="color:#aaa;text-align:center;">暂无该分类下的博客</div>';
    }
}

fetch('data/blogs.json')
    .then(res => res.json())
    .then(blogs => {
        blogsData = blogs;
        renderCategories();
        renderBlogList();
        updateCollapsedState();
    });
