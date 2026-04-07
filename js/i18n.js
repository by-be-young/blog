// 简单 i18n 实现
(function () {
    const DEFAULT_LANG = 'zh'; // 默认语言，易于修改
    const LANG_KEY = 'site_language';

    const translations = {
        zh: {
            brand: '白恙的逃避行',
            search: '搜索',
            language: '语种',
            archive: '归档',
            categories: '分类',
            series: '系列',
            quicklinks: '快捷链接',
            home: '首页',
            welcome_prefix: '欢迎，',
            welcome_text: '向北航行 一路华章',
            beihang: '中国 北航',
            toc: '目录',
            archive_timeline_title: '时间轴归档',
            archive_filter_learning: '只显示学习类博客',
            archive_filter_all: '显示全部博客',
            archive_filter_non_learning: '只显示非学习类博客',
            categories_filter_title: '筛选相关博客',
            series_page_title: '系列一览',
            series_catalog: '目录',
            series_empty: '暂无系列内容',
            series_post_count: '{n}篇文章',
            series_untitled_post: '未命名文章',
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
            search_idle_hint: '输入关键词以搜索标题、系列、摘要和标签',
            search_include_body: '搜索正文',
            search_body_loading: '正在准备正文检索...',
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
            settings_tab_language: '语言',
            settings_tab_music: '音乐',
            settings_language_title: '语言设置',
            settings_language_note: '语言设置不影响博客内容的语种。',
            settings_language_zh: '中文',
            settings_language_en: 'English',
            settings_language_ja: '日本語',
            settings_music_title: '音乐设置',
            settings_music_hint: '点击页面或按任意键启用背景音乐',
            settings_music_original: '所有音乐均为原创',
            settings_track_label: '选择曲目：',
            settings_track_none: '无',
            settings_track_memory: '抹不去的记忆',
            settings_track_passion: '澎湃',
            settings_track_liepaint: '谎画',
            settings_play: '播放',
            settings_pause: '暂停',
            settings_stop: '停止',
            settings_enable_music: '启用音乐',
            settings_progress_label: '进度：',
            settings_volume_label: '音量：',
            wide_read: '宽屏阅读',
            immersive_read: '沉浸阅读',
            immersive_exit_hint: '按ESC以退出沉浸阅读',
            immersive_pdf_hint: '使用快捷键Ctrl+P可以导出PDF',
            export_action: '导出',
            export_markdown: '导出Markdown',
            copy_markdown: '复制Markdown',
            export_modal_title: '导出选项',
            export_method_label: '导出方式',
            export_method_download: '下载文件',
            export_method_copy: '复制到剪贴板',
            export_exercise_label: '例题导出方式',
            export_exercise_exclude: '不导出例题',
            export_exercise_normal: '普通导出',
            export_exercise_source: '保持源码导出',
            export_confirm: '执行导出',
            export_done_download: '已下载',
            export_done_copy: '已复制',
            export_copy_failed: '复制失败',
            export_no_content: '当前选项下无可导出内容',
            display_manage: '显示管理',
            display_modal_title: '显示管理',
            display_exercise_label: '例题显示',
            display_exercise_hide: '不显示',
            display_exercise_collapse: '全部收起答案',
            display_exercise_expand: '全部展开答案',
            display_code_label: '代码块显示',
            display_code_collapse: '全部收起',
            display_code_expand: '全部展开',
            display_apply: '应用设置',
            display_applied: '已应用'
            , prev_post: '上一篇'
            , next_post: '下一篇'
            , similar_post: '相似博客'
            , code_copy: '复制'
            , code_copied: '已复制'
            , code_collapse: '收起'
            , code_expand: '展开'
            , code_toggle: '收起/展开'
            , announcement_banner_title: '公告'
            , announcement_view_all: '查看公告'
            , announcements_title: '公告'
            , announcements_empty: '暂无公告'
            , home_recent_updates: '最近更新'
            , home_recommended_blogs: '推荐博客'
            , home_category_learning: '学习'
            , home_category_entertainment: '娱乐'
            , total_words: '总字数'
            , footer_blog_count: '博客总数'
            , footer_total_words: '总字数'
            , footer_site_visitors: '访客数'
            , footer_site_views: '总访问'
            , image_download: '下载'
            , image_copy: '复制'
            , image_copied: '已复制'
            , image_copy_failed: '复制失败'
        },
        en: {
            brand: "Young's Escape Journey",
            search: 'Search',
            language: 'Language',
            archive: 'Archive',
            categories: 'Categories',
            series: 'Series',
            quicklinks: 'Quick Links',
            home: 'Home',
            welcome_prefix: 'Welcome,',
            welcome_text: 'Braving Unfolding\nAdvancing Achieving',
            beihang: 'Beihang China',
            toc: 'Table of Contents',
            archive_timeline_title: 'Timeline Archive',
            archive_filter_learning: 'Show Learning Posts Only',
            archive_filter_all: 'Show All Posts',
            archive_filter_non_learning: 'Show Non-Learning Posts Only',
            categories_filter_title: 'Filter Blogs',
            series_page_title: 'Series Collections',
            series_catalog: 'Contents',
            series_empty: 'No series available yet',
            series_post_count: '{n} posts',
            series_untitled_post: 'Untitled Post',
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
            search_idle_hint: 'Type keywords to search titles, series, excerpts, and tags',
            search_include_body: 'Search in full content',
            search_body_loading: 'Preparing full-content search...',
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
            settings_tab_language: 'Language',
            settings_tab_music: 'Music',
            settings_language_title: 'Language Settings',
            settings_language_note: 'Language settings do not change the language of blog content.',
            settings_language_zh: '中文',
            settings_language_en: 'English',
            settings_language_ja: '日本語',
            settings_music_title: 'Music Settings',
            settings_music_hint: 'Click anywhere or press any key to enable background music',
            settings_music_original: 'All music tracks are original compositions',
            settings_track_label: 'Track:',
            settings_track_none: 'None',
            settings_track_memory: 'Unfading Memory',
            settings_track_passion: 'Surge',
            settings_track_liepaint: 'Lie Painting',
            settings_play: 'Play',
            settings_pause: 'Pause',
            settings_stop: 'Stop',
            settings_enable_music: 'Enable Music',
            settings_progress_label: 'Progress:',
            settings_volume_label: 'Volume:',
            wide_read: 'Wide reading',
            immersive_read: 'Immersive reading',
            immersive_exit_hint: 'Press ESC to exit immersive reading',
            immersive_pdf_hint: 'Use Ctrl+P to export PDF',
            export_action: 'Export',
            export_markdown: 'Export Markdown',
            copy_markdown: 'Copy Markdown',
            export_modal_title: 'Export Options',
            export_method_label: 'Export Method',
            export_method_download: 'Download file',
            export_method_copy: 'Copy to clipboard',
            export_exercise_label: 'Exercise Export Mode',
            export_exercise_exclude: 'Exclude exercises',
            export_exercise_normal: 'Normal export',
            export_exercise_source: 'Keep source markdown',
            export_confirm: 'Export',
            export_done_download: 'Downloaded',
            export_done_copy: 'Copied',
            export_copy_failed: 'Copy failed',
            export_no_content: 'No exportable content under current options',
            display_manage: 'Display',
            display_modal_title: 'Display Management',
            display_exercise_label: 'Exercise Visibility',
            display_exercise_hide: 'Hide all',
            display_exercise_collapse: 'Collapse all answers',
            display_exercise_expand: 'Expand all answers',
            display_code_label: 'Code Block Visibility',
            display_code_collapse: 'Collapse all',
            display_code_expand: 'Expand all',
            display_apply: 'Apply',
            display_applied: 'Applied'
            , prev_post: 'Previous'
            , next_post: 'Next'
            , similar_post: 'Similar Post'
            , code_copy: 'Copy'
            , code_copied: 'Copied'
            , code_collapse: 'Collapse'
            , code_expand: 'Expand'
            , code_toggle: 'Collapse/Expand'
            , announcement_banner_title: 'Announcement'
            , announcement_view_all: 'View announcements'
            , announcements_title: 'Announcements'
            , announcements_empty: 'No announcements yet'
            , home_recent_updates: 'Latest'
            , home_recommended_blogs: 'Recommended Blogs'
            , home_category_learning: 'Study'
            , home_category_entertainment: 'Fun'
            , total_words: 'Total Characters'
            , footer_blog_count: 'Posts'
            , footer_total_words: 'Total Characters'
            , footer_site_visitors: 'Visitors'
            , footer_site_views: 'Total Views'
            , image_download: 'Download'
            , image_copy: 'Copy'
            , image_copied: 'Copied'
            , image_copy_failed: 'Copy failed'
        },
        ja: {
            brand: '白恙の逃避行',
            search: '検索',
            language: '言語',
            archive: 'アーカイブ',
            categories: 'カテゴリ',
            series: 'シリーズ',
            quicklinks: 'クイックリンク',
            home: 'ホーム',
            welcome_prefix: 'ようこそ、',
            welcome_text: '北へ、向かえ 航路、拓け\n未来へ、進め 栄光、掴め',
            beihang: '中国 北航',
            toc: '目次',
            archive_timeline_title: 'タイムラインアーカイブ',
            archive_filter_learning: '学習系ブログのみ表示',
            archive_filter_all: 'すべてのブログを表示',
            archive_filter_non_learning: '学習系以外のブログのみ表示',
            categories_filter_title: 'ブログを絞り込む',
            series_page_title: 'シリーズ一覧',
            series_catalog: '目次',
            series_empty: 'シリーズはまだありません',
            series_post_count: '{n}件の記事',
            series_untitled_post: '無題の記事',
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
            search_idle_hint: 'キーワードを入力してタイトル・シリーズ・概要・タグを検索',
            search_include_body: '本文も検索する',
            search_body_loading: '本文検索を準備中...',
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
            settings_tab_language: '言語',
            settings_tab_music: '音楽',
            settings_language_title: '言語設定',
            settings_language_note: '言語設定はブログ本文の言語には影響しません。',
            settings_language_zh: '中文',
            settings_language_en: 'English',
            settings_language_ja: '日本語',
            settings_music_title: '音楽設定',
            settings_music_hint: 'ページをクリックするか任意のキーでBGMを有効化',
            settings_music_original: 'すべての楽曲はオリジナルです',
            settings_track_label: '曲目：',
            settings_track_none: 'なし',
            settings_track_memory: '消えない記憶',
            settings_track_passion: '澎湃',
            settings_track_liepaint: '謊画',
            settings_play: '再生',
            settings_pause: '一時停止',
            settings_stop: '停止',
            settings_enable_music: '音楽を有効化',
            settings_progress_label: '再生位置：',
            settings_volume_label: '音量：',
            wide_read: '広い表示',
            immersive_read: '没入読書',
            immersive_exit_hint: 'ESCキーで没入読書を終了',
            immersive_pdf_hint: 'Ctrl+P のショートカットで PDF を書き出せます',
            export_action: 'エクスポート',
            export_markdown: 'Markdownを出力',
            copy_markdown: 'Markdownをコピー',
            export_modal_title: 'エクスポート設定',
            export_method_label: 'エクスポート方法',
            export_method_download: 'ファイルとして保存',
            export_method_copy: 'クリップボードにコピー',
            export_exercise_label: '例題の出力方式',
            export_exercise_exclude: '例題を出力しない',
            export_exercise_normal: '通常出力',
            export_exercise_source: 'ソースMarkdownを保持',
            export_confirm: 'エクスポート実行',
            export_done_download: 'ダウンロード済み',
            export_done_copy: 'コピー済み',
            export_copy_failed: 'コピー失敗',
            export_no_content: '現在の設定では出力できる内容がありません',
            display_manage: '表示管理',
            display_modal_title: '表示管理',
            display_exercise_label: '例題表示',
            display_exercise_hide: '非表示',
            display_exercise_collapse: '解答をすべて折りたたむ',
            display_exercise_expand: '解答をすべて展開',
            display_code_label: 'コードブロック表示',
            display_code_collapse: 'すべて折りたたむ',
            display_code_expand: 'すべて展開',
            display_apply: '設定を適用',
            display_applied: '適用済み'
            , prev_post: '前の記事'
            , next_post: '次の記事'
            , similar_post: '類似の投稿'
            , code_copy: 'コピー'
            , code_copied: 'コピー済み'
            , code_collapse: '折りたたむ'
            , code_expand: '展開'
            , code_toggle: '折りたたむ/展開'
            , announcement_banner_title: 'お知らせ'
            , announcement_view_all: 'お知らせ一覧'
            , announcements_title: 'お知らせ'
            , announcements_empty: 'お知らせはありません'
            , home_recent_updates: '最近の更新'
            , home_recommended_blogs: 'おすすめブログ'
            , home_category_learning: '学習'
            , home_category_entertainment: '娯楽'
            , total_words: '総文字数'
            , footer_blog_count: '記事数'
            , footer_total_words: '総文字数'
            , footer_site_visitors: '訪問者数'
            , footer_site_views: '総閲覧数'
            , image_download: 'ダウンロード'
            , image_copy: 'コピー'
            , image_copied: 'コピー済み'
            , image_copy_failed: 'コピー失敗'
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
        // bring element to front helper（供搜索面板等动态层复用）
        if (!window.__bringToFront) {
            window.__bringToFront = function (el) {
                try {
                    if (!el || !(el.style)) return;
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
                } catch (e) { }
            };
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
