/**
 * 日期格式化模块
 * 功能：提供语言感知的日期格式化函数，并在语言切换时自动更新页面上的日期显示。
 * 支持中文、英文、日文（含令和纪年）。
 */
(function () {
    'use strict';

    // 如果页面已提供 formatDate（如 main.js），则不覆盖
    if (typeof window.formatDate === 'function') return;

    // ==================== 核心格式化函数 ====================

    /**
     * 格式化日期（语言感知）
     * @param {string} dateString - 日期字符串（可被 Date 解析）
     * @returns {string} 格式化后的日期字符串
     */
    function formatDateImpl(dateString) {
        if (!dateString) return '';

        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return String(dateString);

        try {
            const lang = window.siteI18n?.getLang?.() || 'zh';

            if (lang === 'en') {
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
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
                return `${y}年${m}月${d}日 ${era}`;
            }

            // 默认中文
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            console.error('[date] 格式化日期失败:', error);
            // 回退到浏览器默认格式
            return date.toLocaleDateString();
        }
    }

    // ==================== 更新页面日期 ====================

    /**
     * 更新页面上所有带有 data-date 属性的日期元素
     */
    function updateDates() {
        try {
            const selectors = '.date[data-date], .result-date[data-date]';
            document.querySelectorAll(selectors).forEach((el) => {
                const d = el.getAttribute('data-date');
                if (d) {
                    el.textContent = formatDateImpl(d);
                }
            });
        } catch (error) {
            console.error('[date] 更新日期元素失败:', error);
        }
    }

    // ==================== 暴露 API ====================

    window.formatDate = formatDateImpl;

    // ==================== 事件绑定 ====================

    // 语言切换时更新
    document.addEventListener('site:languageChanged', () => {
        try { updateDates(); } catch (error) {
            console.error('[date] 语言切换时更新日期失败:', error);
        }
    });

    // DOM 加载完成后更新
    document.addEventListener('DOMContentLoaded', () => {
        try { updateDates(); } catch (error) {
            console.error('[date] DOM 加载完成后更新日期失败:', error);
        }
    });
})();