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
            locate_today: '定位到今天',
            view_month: '按月',
            view_year: '按年',
            view_more: '查看更多',
            posts: '文章',
            cal_weekdays: '一,二,三,四,五,六,日',
            cal_posts_tip: '该日共 {n} 篇',
            cal_month_tip: '本月共 {n} 篇',
            tags: '标签'
            , profile_name: '白恙',
            profile_bio: '24级 21系 本科'
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
            locate_today: 'Locate Today',
            view_month: 'By Month',
            view_year: 'By Year',
            view_more: 'View more',
            posts: 'Posts',
            cal_weekdays: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
            cal_posts_tip: '{n} posts',
            cal_month_tip: '{n} posts',
            tags: 'Tags',
            profile_name: 'Be Young',
            profile_bio: 'Undergraduate, Class of 24, Dept. 21'
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
            locate_today: '今日を表示',
            view_month: '月ごと',
            view_year: '年ごと',
            view_more: 'さらに表示',
            posts: '記事',
            cal_weekdays: '月,火,水,木,金,土,日',
            cal_posts_tip: '{n} 件',
            cal_month_tip: '{n} 件',
            tags: 'タグ'
            , profile_name: '白恙',
            profile_bio: '学部生、24級、21系'
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
        const btn = document.querySelector('.nav-lang-button');
        if (btn) {
            const labelMap = { zh: '语', ja: '語', en: '🌐' };
            btn.textContent = labelMap[lang] || labelMap[DEFAULT_LANG];
        }
        // dispatch a document-level event so other modules (e.g. date formatting) can react
        try {
            document.dispatchEvent(new CustomEvent('site:languageChanged', { detail: { lang } }));
        } catch (e) {
            // ignore if CustomEvent is unavailable
            console.warn('languageChanged event dispatch failed', e);
        }
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else init();
})();
