/**
 * 萤火虫背景特效模块
 * 功能：在指定页面（归档、分类、快捷链接、系列）的背景轮播上生成
 * 缓慢飘浮、明暗变化的萤火虫粒子效果。
 * 支持减少动效偏好（prefers-reduced-motion）。
 */
(function () {
    'use strict';

    // ==================== 配置常量 ====================
    /** 启用萤火虫的页面类名 */
    const TARGET_PAGES = ['archive-page', 'categories-page', 'quick-links-page', 'series-page'];

    /** 萤火虫数量（常规 / 减少动效模式） */
    const COUNT = {
        normal: { desktop: 34, mobile: 18 },
        reduced: { desktop: 16, mobile: 10 }
    };

    /** 移动端断点（px） */
    const MOBILE_BREAKPOINT = 760;

    // ==================== 工具函数 ====================

    /** 随机浮点数 [min, max) */
    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    /** 随机整数 [min, max] */
    function randInt(min, max) {
        return Math.floor(rand(min, max + 1));
    }

    // ==================== 核心逻辑 ====================

    /**
     * 判断当前页面是否为目标页面
     */
    function isTargetPage() {
        const body = document.body;
        if (!body) return false;
        return TARGET_PAGES.some((cls) => body.classList.contains(cls));
    }

    /**
     * 创建单个萤火虫 DOM 元素
     * @returns {HTMLElement} span 元素，带有 CSS 自定义属性
     */
    function createFirefly() {
        const dot = document.createElement('span');
        dot.className = 'firefly';

        // ---- 随机路径点（视口百分比） ----
        dot.style.setProperty('--x0', `${rand(-8, 108).toFixed(2)}vw`);
        dot.style.setProperty('--y0', `${rand(-4, 104).toFixed(2)}vh`);
        dot.style.setProperty('--x1', `${rand(-8, 108).toFixed(2)}vw`);
        dot.style.setProperty('--y1', `${rand(-4, 104).toFixed(2)}vh`);
        dot.style.setProperty('--x2', `${rand(-8, 108).toFixed(2)}vw`);
        dot.style.setProperty('--y2', `${rand(-4, 104).toFixed(2)}vh`);

        // ---- 尺寸与透明度 ----
        dot.style.setProperty('--size', `${rand(4.8, 9.6).toFixed(2)}px`);
        dot.style.setProperty('--alpha', `${rand(0.58, 0.96).toFixed(2)}`);

        // ---- 动画时长与延迟（缓慢舒缓） ----
        dot.style.setProperty('--float-duration', `${randInt(18000, 32000)}ms`);
        dot.style.setProperty('--glow-duration', `${randInt(2600, 5600)}ms`);
        dot.style.setProperty('--float-delay', `${randInt(-32000, 0)}ms`);
        dot.style.setProperty('--glow-delay', `${randInt(-5600, 0)}ms`);

        // ---- 色相（暖黄-黄绿） ----
        dot.style.setProperty('--hue', `${randInt(44, 72)}`);

        return dot;
    }

    /**
     * 初始化萤火虫
     */
    function initFireflies() {
        if (!isTargetPage()) return;

        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const slideshow = document.querySelector('.slideshow');
        if (!slideshow) return;

        // 避免重复初始化
        if (slideshow.querySelector('.fireflies-overlay')) return;

        // 创建覆盖层
        const overlay = document.createElement('div');
        overlay.className = 'fireflies-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        // 确定萤火虫数量
        const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
        const countConfig = reducedMotion ? COUNT.reduced : COUNT.normal;
        const count = isMobile ? countConfig.mobile : countConfig.desktop;

        // 生成萤火虫
        for (let i = 0; i < count; i += 1) {
            overlay.appendChild(createFirefly());
        }

        slideshow.appendChild(overlay);
    }

    // ==================== 启动 ====================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFireflies);
    } else {
        initFireflies();
    }
})();