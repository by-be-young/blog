// 简单 i18n 实现
(function () {
    const DEFAULT_LANG = 'ja'; // 默认语言，易于修改
    const LANG_KEY = 'site_language';

    const translations = {
        zh: {
            brand: '白恙的博客',
            search: '搜索',
            language: '语种',
            archive: '归档',
            categories: '分类',
            quicklinks: '快捷链接',
            home: '首页',
            welcome_prefix: '欢迎，',
            welcome_text: '向北航行 一路华章',
            beihang: '中国 北航',
            toc: '目录',
            archive_timeline_title: '时间轴归档',
            categories_filter_title: '筛选相关博客',
            label_domain: '领域',
            label_subject: '科目',
            label_topic: '主题',
            filter_all: '全部',
            quick_friends: '友链',
            quick_beihang: '北航',
            quick_personal: '个人',
            quick_study: '学习',
            quick_fun: '娱乐',
            quick_ai: 'AI',
            search_placeholder: '输入关键词：',
            search_close: '关闭',
            search_no_results: '未找到匹配结果',
            search_no_results_detail: '未在本文中找到匹配',
            quick_no_links: '该分类下暂无链接。',
            link_unnamed: '未命名链接',
            quick_links_load_failed: '加载失败：请检查 data/quick-links.json',
            categories_no_blogs: '暂无该分类下的博客',
            match_label: '匹配 {n}',
            locate_today: '定位到今天',
            view_month: '按月',
            view_year: '按年',
            view_more: '查看更多',
            posts: '文章',
            cal_weekdays: '一,二,三,四,五,六,日',
            weekStart: 1,
            cal_posts_tip: '该日共 {n} 篇',
            cal_month_tip: '本月共 {n} 篇',
            tags: '标签',
            profile_name: '白恙',
            profile_bio: '24级 21系 本科',
            label_school: '学校',
            label_degree: '学历',
            label_grade: '年级',
            label_department: '院系',
            label_interests: '兴趣',
            contact: '联系方式',
            contact_github: 'GitHub',
            contact_wechat: '微信',
            contact_qq: 'QQ',
            school_name: '北京航空航天大学',
            degree_name: '本科',
            grade_value: '24级',
            department_value: '21系（软件学院）',
            interest_game: '明日方舟',
            interest_literature: '文学',
            interest_jpop: 'J-POP',
            interest_language: '语言',
            back_to_top: '回到顶部',
            settings: '设置',
            wide_read: '宽屏阅读',
            export_markdown: '导出Markdown'
            , prev_post: '上一篇'
            , next_post: '下一篇'
            , similar_post: '相似博客'
            , code_copy: '复制'
            , code_copied: '已复制'
            , code_collapse: '收起'
            , code_expand: '展开'
            , code_toggle: '收起/展开'
        },
        en: {
            brand: "Be Young's Blog",
            search: 'Search',
            language: 'Language',
            archive: 'Archive',
            categories: 'Categories',
            quicklinks: 'Quick Links',
            home: 'Home',
            welcome_prefix: 'Welcome,',
            welcome_text: 'Braving Unfolding\nAdvancing Achieving',
            beihang: 'Beihang China',
            toc: 'Table of Contents',
            archive_timeline_title: 'Timeline Archive',
            categories_filter_title: 'Filter Blogs',
            label_domain: 'Domain',
            label_subject: 'Subject',
            label_topic: 'Topic',
            filter_all: 'All',
            quick_friends: 'Friends',
            quick_beihang: 'Beihang',
            quick_personal: 'Personal',
            quick_study: 'Study',
            quick_fun: 'Entertainment',
            quick_ai: 'AI',
            search_placeholder: 'Type keywords:',
            search_close: 'Close',
            search_no_results: 'No matches found',
            search_no_results_detail: 'No matches found in this article',
            quick_no_links: 'No links in this category.',
            link_unnamed: 'Unnamed link',
            quick_links_load_failed: 'Load failed: check data/quick-links.json',
            categories_no_blogs: 'No posts in this category',
            match_label: 'Match {n}',
            locate_today: 'Locate Today',
            view_month: 'By Month',
            view_year: 'By Year',
            view_more: 'View more',
            posts: 'Posts',
            cal_weekdays: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
            weekStart: 0,
            cal_posts_tip: '{n} posts',
            cal_month_tip: '{n} posts',
            tags: 'Tags',
            profile_name: 'Be Young',
            profile_bio: 'Undergraduate, Class of 24, Dept. 21',
            label_school: 'School',
            label_degree: 'Degree',
            label_grade: 'Grade',
            label_department: 'Department',
            label_interests: 'Interests',
            contact: 'Contact',
            contact_github: 'GitHub',
            contact_wechat: 'WeChat',
            contact_qq: 'QQ',
            school_name: 'Beihang University',
            degree_name: 'Bachelor',
            grade_value: 'Class of 24',
            department_value: 'Dept.21 (Software)',
            interest_game: 'Arknights',
            interest_literature: 'Literature',
            interest_jpop: 'J-POP',
            interest_language: 'Languages',
            back_to_top: 'Back to top',
            settings: 'Settings',
            wide_read: 'Wide reading',
            export_markdown: 'Export Markdown'
            , prev_post: 'Previous'
            , next_post: 'Next'
            , similar_post: 'Similar Post'
            , code_copy: 'Copy'
            , code_copied: 'Copied'
            , code_collapse: 'Collapse'
            , code_expand: 'Expand'
            , code_toggle: 'Collapse/Expand'
        },
        ja: {
            brand: '白恙のブログ',
            search: '検索',
            language: '言語',
            archive: 'アーカイブ',
            categories: 'カテゴリ',
            quicklinks: 'クイックリンク',
            home: 'ホーム',
            welcome_prefix: 'ようこそ、',
            welcome_text: '北へ、向かえ 航路、拓け\n未来へ、進め 栄光、掴め',
            beihang: '中国 北航',
            toc: '目次',
            archive_timeline_title: 'タイムラインアーカイブ',
            categories_filter_title: 'ブログを絞り込む',
            label_domain: '分野',
            label_subject: '科目',
            label_topic: 'テーマ',
            filter_all: 'すべて',
            quick_friends: '友達',
            quick_beihang: '北航',
            quick_personal: '個人',
            quick_study: '学習',
            quick_fun: '娯楽',
            quick_ai: 'AI',
            search_placeholder: 'キーワードを入力：',
            search_close: '閉じる',
            search_no_results: '一致する結果は見つかりませんでした',
            search_no_results_detail: '本文内で一致が見つかりませんでした',
            quick_no_links: 'このカテゴリにリンクはありません。',
            link_unnamed: '名前のないリンク',
            quick_links_load_failed: '読み込みに失敗しました：data/quick-links.json を確認してください',
            categories_no_blogs: 'このカテゴリに記事はありません',
            match_label: '一致 {n}',
            locate_today: '今日を表示',
            view_month: '月ごと',
            view_year: '年ごと',
            view_more: 'さらに表示',
            posts: '記事',
            cal_weekdays: '月,火,水,木,金,土,日',
            weekStart: 0,
            cal_posts_tip: '{n} 件',
            cal_month_tip: '{n} 件',
            tags: 'タグ',
            profile_name: '白恙',
            profile_bio: '学部生、24級、21系',
            label_school: '学校',
            label_degree: '学位',
            label_grade: '学年',
            label_department: '学部',
            label_interests: '興味',
            contact: '連絡先',
            contact_github: 'GitHub',
            contact_wechat: 'WeChat',
            contact_qq: 'QQ',
            school_name: '北京航空航天大学',
            degree_name: '学士',
            grade_value: '24級',
            department_value: '21系（ソフトウェア）',
            interest_game: 'アークナイツ',
            interest_literature: '文学',
            interest_jpop: 'J-POP',
            interest_language: '語学',
            back_to_top: 'トップへ戻る',
            settings: '設定',
            wide_read: '広い表示',
            export_markdown: 'Markdownを出力'
            , prev_post: '前の記事'
            , next_post: '次の記事'
            , similar_post: '類似の投稿'
            , code_copy: 'コピー'
            , code_copied: 'コピー済み'
            , code_collapse: '折りたたむ'
            , code_expand: '展開'
            , code_toggle: '折りたたむ/展開'
        }
    };

    function getLang() {
        return localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
    }

    function setLang(lang) {
        localStorage.setItem(LANG_KEY, lang);
        applyLang(lang);
    }

    function applyLang(lang) {
        const map = translations[lang] || translations[DEFAULT_LANG];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            const text = map[key];
            if (text !== undefined) {
                if (el.placeholder !== undefined && el.tagName.toLowerCase() === 'input') {
                    el.placeholder = text;
                } else {
                    if (typeof text === 'string' && text.indexOf('\n') !== -1) {
                        el.innerHTML = text.replace(/\n/g, '<br>');
                    } else {
                        el.textContent = text;
                    }
                }
            }
        });
        // apply titles/tooltips from data-i18n-title and set data-tooltip for custom styling
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (!key) return;
            const text = map[key];
            if (text !== undefined) {
                try { el.title = text; } catch (e) { }
                try { el.setAttribute('data-tooltip', text); } catch (e) { }
                try { if (el.getAttribute('aria-label') === null) el.setAttribute('aria-label', text); } catch (e) { }
            }
        });
        const btn = document.querySelector('.nav-lang-button');
        if (btn) {
            const labelMap = { zh: '语', ja: '語', en: '🌐' };
            btn.textContent = labelMap[lang] || labelMap[DEFAULT_LANG];
        }
        // dispatch a document-level event so other modules (e.g. date formatting) can react
        (function emitLanguageChange() {
            try {
                document.dispatchEvent(new CustomEvent('site:languageChanged', { detail: { lang } }));
            } catch (e) {
                try {
                    var evt = document.createEvent('Event');
                    evt.initEvent('site:languageChanged', true, true);
                    // best-effort attach detail for listeners expecting it
                    evt.detail = { lang: lang };
                    document.dispatchEvent(evt);
                } catch (e2) {
                    console.warn('languageChanged event dispatch failed', e, e2);
                }
            }
        })();
    }

    function init() {
        const nav = document.querySelector('.nav-container');
        if (nav && !document.querySelector('.nav-lang-wrap')) {
            const wrap = document.createElement('div');
            wrap.className = 'nav-lang-wrap';
            // 自定义下拉：按钮显示短符号，展开列表显示完整名称
            wrap.innerHTML = `
                <div class="nav-lang">
                    <button class="nav-lang-button" aria-haspopup="listbox" aria-expanded="false">語</button>
                    <ul class="nav-lang-list" role="listbox" aria-hidden="true">
                        <li class="nav-lang-item" data-lang="ja">日本語</li>
                        <li class="nav-lang-item" data-lang="zh">简体中文</li>
                        <li class="nav-lang-item" data-lang="en">English</li>
                    </ul>
                </div>
            `;
            const searchBtn = nav.querySelector('.nav-search-btn');
            if (searchBtn) nav.insertBefore(wrap, searchBtn);
            else nav.appendChild(wrap);

            const btn = wrap.querySelector('.nav-lang-button');
            const list = wrap.querySelector('.nav-lang-list');

            // bring element to front helper
            if (!window.__bringToFront) {
                window.__bringToFront = function (el) {
                    try {
                        if (!el || !(el.style)) return;
                        // compute current maximum z-index in the document
                        let max = 0;
                        try {
                            const all = document.querySelectorAll('body *');
                            for (let i = 0; i < all.length; i++) {
                                const z = window.getComputedStyle(all[i]).zIndex;
                                if (z && z !== 'auto') {
                                    const n = parseInt(z, 10);
                                    if (!Number.isNaN(n) && n > max) max = n;
                                }
                            }
                        } catch (e) { max = (window.__uiZIndexCounter || 1200); }
                        const next = Math.max(max + 1, (window.__uiZIndexCounter || 1201));
                        window.__uiZIndexCounter = next;
                        el.style.zIndex = String(next);
                    } catch (e) { /* ignore */ }
                };
            }

            function closeList() {
                btn.setAttribute('aria-expanded', 'false');
                list.setAttribute('aria-hidden', 'true');
                list.style.display = 'none';
            }

            function openList() {
                btn.setAttribute('aria-expanded', 'true');
                list.setAttribute('aria-hidden', 'false');
                list.style.display = 'block';
            }

            btn.addEventListener('click', e => {
                const expanded = btn.getAttribute('aria-expanded') === 'true';
                if (expanded) closeList(); else openList();
                // ensure language menu appears above other UI
                try { if (typeof window.__bringToFront === 'function') window.__bringToFront(wrap); } catch (e) { }
            });

            wrap.querySelectorAll('.nav-lang-item').forEach(item => {
                item.addEventListener('click', e => {
                    const lang = item.getAttribute('data-lang');
                    setLang(lang);
                    closeList();
                });
            });

            // close on outside click
            document.addEventListener('click', e => {
                if (!wrap.contains(e.target)) closeList();
            });
        }

        applyLang(getLang());
    }

    // apply translations within a given container (or document if omitted)
    function applyTo(root) {
        const container = root && (root.nodeType === 1) ? root : document;
        const lang = getLang();
        const map = translations[lang] || translations[DEFAULT_LANG];
        container.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!key) return;
            const text = map[key];
            if (text !== undefined) {
                if (el.placeholder !== undefined && el.tagName.toLowerCase() === 'input') {
                    el.placeholder = text;
                } else {
                    if (typeof text === 'string' && text.indexOf('\n') !== -1) {
                        el.innerHTML = text.replace(/\n/g, '<br>');
                    } else {
                        el.textContent = text;
                    }
                }
            }
        });
    }

    // Expose some API
    window.siteI18n = { getLang, setLang, translations, applyTo };

    // Ensure dynamic elements get translations applied when language changes.
    // Some UI (search panel, dynamic results, etc.) may be created after initial render;
    // re-run applyTo() on language change to pick them up.
    try {
        document.addEventListener('site:languageChanged', function () {
            try {
                if (window.siteI18n && typeof window.siteI18n.applyTo === 'function') window.siteI18n.applyTo();
            } catch (e) { }
        });
    } catch (e) { }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else init();
})();
