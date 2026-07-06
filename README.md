# BeYoung's Blog 博客网站

一个以 **马卡龙色系** 为视觉基调、功能丰富的个人博客系统，支持多语言（中文 / 英文 / 日语）、全文搜索、分类归档、系列整理、快速链接、公告通知以及背景音乐等特性。网站采用纯前端静态架构，所有内容以 Markdown 驱动，通过自动化脚本生成数据文件，便于维护和扩展。

---

## ✨ 主要功能

- 📝 **博客系统**  
  所有文章以 Markdown 格式存储在 `blogs/` 目录中，支持 Front Matter（标题、日期、标签、系列、顺序等），通过 `generate-blogs.js` 自动生成 `blogs.json` 和 `series.json` 数据文件。

- 🌐 **多语言支持**  
  内置 i18n 系统，可在界面右上角一键切换 `中文` / `English` / `日本語`，界面文本和日期格式均会相应变化，但博客正文内容保持原语言。

- 📂 **归档与日历**  
  - 时间轴归档页面，按年月分组展示所有文章。  
  - 侧边日历支持按日 / 按月查看，点击有文章的日期可快速跳转到对应位置。

- 🏷️ **多级分类筛选**  
  使用三级“老虎机”滚轮筛选器（领域 → 科目 → 主题），结合“学习 / 非学习”过滤器，精准定位博客。

- 📚 **系列功能**  
  将同系列的文章归并到一起，支持按章节划分，并可在文章详情页底部快速切换上/下一篇。

- 🔗 **快速链接**  
  自定义分类链接（友链、北航校内资源、个人项目、学习平台等），以卡片形式展示，并配有滚轮侧边栏。

- 🔍 **全站搜索**  
  - 全局搜索：支持标题、标签、摘要及正文内容（可开启“搜索正文”选项）。  
  - 文章内搜索：在详情页右侧面板中搜索当前文章内容，并高亮匹配项，支持自动展开折叠代码块和答案块。

- 📢 **公告系统**  
  首页左下角悬浮球显示最新公告，点击可查看全部公告时间轴（左右交错布局）。

- 🎵 **背景音乐**  
  内置原创曲目（《抹不去的记忆》《澎湃》《谎画》），支持播放/暂停、进度控制、音量调节，首次需点击页面启用。

- 🖼️ **图片与图表增强**  
  - 文章内图片支持点击放大查看，并可在多图间切换浏览。  
  - 支持 Mermaid 图表（流程图、时序图等）渲染，可全屏查看并切换源码/视图。

- 📄 **PDF 资料库**  
  独立页面用于展示和管理 PDF 文档（如英语学习资料），支持搜索和在线预览。

- 🎨 **马卡龙视觉主题**  
  柔和的粉、蓝、薄荷、薰衣草色调，卡片毛玻璃效果，平滑过渡动画，并配有动态背景轮播和萤火虫粒子效果。

---

## 🛠️ 技术栈

- **前端**：HTML5, CSS3, JavaScript (ES6+)  
- **Markdown 渲染**：[marked.js](https://marked.js.org/)  
- **代码高亮**：[highlight.js](https://highlightjs.org/)  
- **数学公式**：[KaTeX](https://katex.org/)  
- **图表渲染**：[Mermaid](https://mermaid.js.org/)  
- **图标库**：[Font Awesome](https://fontawesome.com/)  
- **构建工具**：Node.js（用于生成数据 JSON）  
- **其他**：原生滚动驱动、IntersectionObserver、ResizeObserver、CSS 动画等。

---

## 📁 文件结构

```
├── assets/                     # 静态资源
│   ├── images/                 # 背景图、头像、卡片图等
│   └── fonts/                  # 自定义字体（仓耳今楷01）
├── blogs/                      # Markdown 博客源文件
│   
├── css/                        # 样式表
│   ├── style.css               # 全局基础样式与导航
│   ├── announcements.css       # 公告时间轴样式
│   ├── archive.css             # 归档页样式（含日历、滚筒模式）
│   ├── blog-detail.css         # 文章详情页目录、内容、浮动控件
│   ├── butterfly.css           # 额外美化（按钮、标签云等）
│   ├── categories.css          # 分类页滚轮与卡片
│   ├── pdf-materials-test.css  # PDF 资料页样式
│   ├── quick-links.css         # 快速链接页布局
│   ├── responsive.css          # 响应式断点与移动端适配
│   ├── search.css              # 搜索面板与高亮
│   └── series.css              # 系列页卡片与章节展开
├── data/                       # 由构建脚本生成的 JSON 数据
│   ├── blogs.json              # 所有博客索引（含元数据）
│   ├── series.json             # 系列聚合数据
│   ├── announcements.json      # 公告列表
│   ├── background-images.json  # 背景图片清单
│   ├── pdf-materials.json      # PDF 资料清单
│   └── quick-links.json        # 快速链接分类与条目（手动维护）
├── js/                         # JavaScript 模块
│   ├── main.js                 # 全局初始化、导航、首页逻辑
│   ├── i18n.js                 # 多语言核心（翻译、切换、应用）
│   ├── formatDate.js           # 统一日期格式化（依赖 i18n）
│   ├── slideshow.js            # 背景轮播（基于 sessionStorage 同步）
│   ├── fireflies.js            # 萤火虫粒子效果（归档/分类/系列/链接页）
│   ├── search.js               # 搜索面板与高亮逻辑
│   ├── archive.js              # 归档页时间轴 + 日历 + 滚筒效果
│   ├── categories.js           # 分类页滚轮筛选与博客列表
│   ├── series.js               # 系列页渲染与交互
│   ├── quick-links.js          # 快速链接页侧栏滚轮与卡片
│   ├── announcements.js        # 公告时间轴渲染
│   ├── blog-detail.js          # 详情页 TOC 折叠/展开及移动端适配
│   ├── markdown.js             # Markdown 解析、数学、代码块增强、例题交互
│   ├── about.js                # 关于页加载 Markdown 内容
│   └── pdf-materials-test.js   # PDF 资料页加载与搜索
├── html/                       # 页面模板（根目录下）
│   ├── index.html              # 首页（欢迎语+博客卡片）
│   ├── archive.html            # 归档页
│   ├── categories.html         # 分类页
│   ├── series.html             # 系列页
│   ├── quick-links.html        # 快速链接页
│   ├── blog-detail.html        # 文章详情页
│   └── about.html              # 关于页（需手动创建，由 about.js 加载 Markdown）
└── scripts/                    # 构建脚本
    └── generate-blogs.js       # 扫描 blogs/ 目录，生成 blogs.json 和 series.json
```

---

## 🔧 安装与构建

### 1. 克隆项目
```bash
git clone https://github.com/yourname/your-blog.git
cd your-blog
```

### 2. 安装依赖（Node.js 环境）
```bash
npm install
```
需要安装的包：`gray-matter`（用于解析 Front Matter）。

### 3. 生成数据文件
```bash
node scripts/generate-blogs.js
```
该命令会：
- 扫描 `blogs/` 下所有 `.md` 文件，提取 Front Matter 和正文摘要，生成 `data/blogs.json`。
- 根据博客的 `series` 字段聚合系列，生成 `data/series.json`。
- 扫描 `assets/images/background/` 生成 `background-images.json`。
- 扫描 `English_materials/`（若存在）生成 `pdf-materials.json`。
- 若在命令行添加参数，如 `node generate-blogs.js "新公告内容"`，还会向 `announcements.json` 追加一条新公告。

> **提示**：每次新增/修改 Markdown 博客后，需重新运行脚本以更新数据。

### 4. 预览
使用任意静态服务器（如 VS Code Live Server、Python http.server 等）打开根目录下的 `index.html` 即可。

---

## ✍️ 如何添加内容

### 添加一篇新博客
1. 在 `blogs/` 下按已有分类（如 `二下/操作系统/`）创建 `.md` 文件。
2. 在文件头部编写 Front Matter（YAML 格式）：
   ```yaml
   ---
   title: 文章标题
   date: 2026-06-29
   tags:
     - 标签1
     - 标签2
     - 标签3
   category: 学习          # 或 娱乐
   type: 系统笔记           # 可选（如“轻松笔记”等）
   series: 操作系统         # 所属系列名
   order: 8                # 系列内排序（可选）
   chapter: 4-实验报告     # 章节名（可选，格式为“数字-章节名”）
   recommended: false      # 是否推荐至首页
   ---
   ```
3. 正文使用 Markdown 书写。
4. 运行 `node scripts/generate-blogs.js` 更新数据。
5. 刷新页面即可看到新文章。

### 添加公告
- 直接在 `data/announcements.json` 中手动添加（建议按日期排序），格式为：
  ```json
  {
    "id": 时间戳,
    "date": "2026-06-18",
    "message": "公告内容（支持多行）"
  }
  ```
- 或在构建时通过命令行参数添加：
  ```bash
  node scripts/generate-blogs.js "这是新公告内容"
  ```

### 管理快速链接
- 手动编辑 `data/quick-links.json`，按分类组织链接，每个链接包含 `title`, `url`, `image`（封面图路径）。

### 管理 PDF 资料
- 将 PDF 文件放入 `English_materials/`（或其它指定目录），运行 `generate-blogs.js` 会自动扫描并生成 `pdf-materials.json`。

---

## 🌐 多语言配置

语言文本存储在 `js/i18n.js` 的 `translations` 对象中，包含 `zh`, `en`, `ja` 三个语种。新增或修改翻译时，只需在该对象中添加对应键值对，并在 HTML 中使用 `data-i18n="key"` 标记文本元素。日期格式会自动跟随当前语言。

---

## 🧩 自定义与扩展

- **主题色**：修改 CSS 中的 `--macaron-*` 变量可调整马卡龙配色体系。
- **背景轮播图**：将图片放入 `assets/images/background/`，运行构建脚本会自动生成清单。
- **增加新页面**：可参考现有页面（如 `series.html`）创建新的 HTML，并在 `nav-menu` 中添加链接，同时编写对应的 JS 逻辑。

---

*Enjoy your journey with Be Young!* 🚀