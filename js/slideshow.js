/**
 * 背景轮播模块
 * 功能：跨页面保持背景图片轮播同步，使用 sessionStorage 记录起始时间，
 * 所有页面基于同一时间线计算当前显示图片，实现连续切换效果。
 * 每轮播放顺序基于时间种子随机打乱，确保各页面展示一致。
 */
(function () {
    'use strict';

    /**
     * 初始化轮播
     * 从 manifest 文件加载图片列表，若加载失败则使用备用图片。
     * 使用 sessionStorage 存储起始时间，所有页面基于该时间计算当前帧。
     */
    async function initSlideshow() {
        const container = document.querySelector('.slideshow');
        if (!container) return;

        // ==================== 配置常量 ====================
        const INTERVAL = 5000; // 每张图片展示间隔（毫秒）
        const START_KEY = 'bg_slideshow_start_v1'; // sessionStorage 键名
        const MANIFEST_URL = 'data/background-images.json'; // 图片清单地址

        // 备用图片列表（当清单读取失败时使用）
        const FALLBACK_IMAGES = [
            'assets/images/background/bg1.png',
            'assets/images/background/bg2.png',
            'assets/images/background/bg3.png'
        ];

        // ==================== 加载图片清单 ====================
        /**
         * 从 manifest 文件加载图片列表
         * @returns {Promise<string[]>} 图片 URL 数组
         */
        async function loadImagesFromManifest() {
            try {
                const resp = await fetch(MANIFEST_URL, { cache: 'no-store' });
                if (!resp.ok) return FALLBACK_IMAGES;

                const data = await resp.json();
                const images = Array.isArray(data)
                    ? data
                    : (data && Array.isArray(data.images) ? data.images : []);

                const cleaned = images
                    .map(src => String(src || '').trim())
                    .filter(Boolean);

                return cleaned.length > 0 ? cleaned : FALLBACK_IMAGES;
            } catch (e) {
                return FALLBACK_IMAGES;
            }
        }

        const IMAGES = await loadImagesFromManifest();

        // ==================== 构建 DOM ====================
        // 保留动态背景层（如萤火虫），仅重建 slide 节点
        const preservedOverlay = container.querySelector('.fireflies-overlay');
        if (preservedOverlay) preservedOverlay.remove();

        // 清空容器并创建幻灯片节点
        container.innerHTML = '';
        IMAGES.forEach(src => {
            const slide = document.createElement('div');
            slide.className = 'slide';
            slide.style.backgroundImage = `url('${src}')`;
            container.appendChild(slide);
        });

        // 恢复背景层
        if (preservedOverlay) container.appendChild(preservedOverlay);

        const slides = container.querySelectorAll('.slide');
        if (!slides || slides.length === 0) return;

        // ==================== 起始时间管理 ====================
        // 首次访问时记录起始时间，后续页面基于该时间继续播放
        let start = Number(sessionStorage.getItem(START_KEY));
        if (!start || isNaN(start)) {
            start = Date.now();
            try {
                sessionStorage.setItem(START_KEY, String(start));
            } catch (e) {
                /* ignore */
            }
        }

        // ==================== 辅助函数 ====================
        /**
         * 基于种子的伪随机数生成器
         * @param {number} seed - 种子值
         * @returns {Function} 返回 [0, 1) 范围内的随机数生成函数
         */
        function createSeededRandom(seed) {
            let s = seed >>> 0;
            return function next() {
                s = (1664525 * s + 1013904223) >>> 0;
                return s / 4294967296;
            };
        }

        /**
         * 创建打乱后的索引顺序
         * @param {number} length - 数组长度
         * @param {number} seed - 随机种子
         * @returns {number[]} 打乱后的索引数组
         */
        function createShuffledOrder(length, seed) {
            const order = Array.from({ length }, (_, i) => i);
            const rand = createSeededRandom(seed);
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(rand() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
            return order;
        }

        // ==================== 轮播状态 ====================
        const cycleDuration = INTERVAL * slides.length;
        let cachedCycle = -1;
        let cachedOrder = [];
        let activeIndex = -1;

        // ==================== 更新当前图片 ====================
        /**
         * 根据全局起始时间计算当前应该显示的图片索引
         * 每轮播放顺序基于时间种子随机打乱，确保各页面同步
         */
        function update() {
            const now = Date.now();
            const elapsed = now - start;
            const cycle = Math.floor(elapsed / cycleDuration);
            const posInCycle = Math.floor(elapsed / INTERVAL) % slides.length;

            // 进入新轮次时重新计算打乱顺序
            if (cycle !== cachedCycle) {
                cachedCycle = cycle;
                cachedOrder = createShuffledOrder(slides.length, start + cycle);
            }

            const idx = cachedOrder[posInCycle];
            if (typeof idx !== 'number' || idx < 0 || idx >= slides.length) return;
            if (idx === activeIndex) return;

            // 切换激活状态
            if (activeIndex >= 0 && slides[activeIndex]) {
                slides[activeIndex].classList.remove('active');
            }
            slides[idx].classList.add('active');
            activeIndex = idx;
        }

        // ==================== 启动轮播 ====================
        // 首次渲染
        update();

        // 每秒检查一次，确保跨页面同步
        setInterval(update, 1000);

        // 预加载图片，减少切换时白屏
        IMAGES.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    }

    // ==================== 启动 ====================
    document.addEventListener('DOMContentLoaded', initSlideshow);
})();