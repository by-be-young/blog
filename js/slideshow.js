(function () {
    // 背景轮播：跨页面保持连续（使用 sessionStorage 记录起始时间）
    async function initSlideshow() {
        const container = document.querySelector('.slideshow');
        if (!container) return;

        // 默认图片列表：当清单读取失败时使用
        const FALLBACK_IMAGES = [
            'assets/images/background/bg1.png',
            'assets/images/background/bg2.png',
            'assets/images/background/bg3.png'
        ];
        const MANIFEST_URL = 'data/background-images.json';

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

        const INTERVAL = 5000; // ms
        const START_KEY = 'bg_slideshow_start_v1';

        // 初始化起始时间（首次访问时记录），所有页面基于该时间计算当前帧
        let start = Number(sessionStorage.getItem(START_KEY));
        if (!start || isNaN(start)) {
            start = Date.now();
            try { sessionStorage.setItem(START_KEY, String(start)); } catch (e) { /* ignore */ }
        }

        // 基于 seed 的伪随机打乱，确保同一时间段内各页面展示一致
        function createSeededRandom(seed) {
            let s = seed >>> 0;
            return function next() {
                s = (1664525 * s + 1013904223) >>> 0;
                return s / 4294967296;
            };
        }

        function createShuffledOrder(length, seed) {
            const order = Array.from({ length }, (_, i) => i);
            const rand = createSeededRandom(seed);
            for (let i = order.length - 1; i > 0; i--) {
                const j = Math.floor(rand() * (i + 1));
                [order[i], order[j]] = [order[j], order[i]];
            }
            return order;
        }

        // 清空已有结构，统一由脚本渲染 slides
        container.innerHTML = '';
        IMAGES.forEach(src => {
            const d = document.createElement('div');
            d.className = 'slide';
            d.style.backgroundImage = `url('${src}')`;
            container.appendChild(d);
        });

        const slides = container.querySelectorAll('.slide');
        if (!slides || slides.length === 0) return;

        const cycleDuration = INTERVAL * slides.length;
        let cachedCycle = -1;
        let cachedOrder = [];

        // 根据全局 start 时间与间隔计算当前索引，按“每轮随机顺序”播放
        function update() {
            const now = Date.now();
            const elapsed = now - start;
            const cycle = Math.floor(elapsed / cycleDuration);
            const posInCycle = Math.floor(elapsed / INTERVAL) % slides.length;

            if (cycle !== cachedCycle) {
                cachedCycle = cycle;
                cachedOrder = createShuffledOrder(slides.length, start + cycle);
            }

            const idx = cachedOrder[posInCycle];
            slides.forEach(s => s.classList.remove('active'));
            if (slides[idx]) slides[idx].classList.add('active');
        }

        // 首次渲染并定时刷新（每秒检查一次以保证跨页同步）
        update();
        setInterval(update, 1000);

        // 预加载图片以减少切换时白屏
        IMAGES.forEach(src => { const img = new Image(); img.src = src; });
    }

    document.addEventListener('DOMContentLoaded', initSlideshow);
})();
