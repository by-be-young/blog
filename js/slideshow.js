(function () {
    // 背景轮播：跨页面保持连续（使用 sessionStorage 记录起始时间）
    function initSlideshow() {
        const container = document.querySelector('.slideshow');
        if (!container) return;

        // 可替换或扩展的图片列表
        const IMAGES = [
            'assets/images/bg1.png',
            'assets/images/bg2.png',
            'assets/images/bg3.png'
        ];

        const INTERVAL = 5000; // ms
        const START_KEY = 'bg_slideshow_start_v1';

        // 初始化起始时间（首次访问时记录），所有页面基于该时间计算当前帧
        let start = Number(sessionStorage.getItem(START_KEY));
        if (!start || isNaN(start)) {
            start = Date.now();
            try { sessionStorage.setItem(START_KEY, String(start)); } catch (e) { /* ignore */ }
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

        // 根据全局 start 时间与间隔计算当前索引，保证不同页面同步
        function update() {
            const now = Date.now();
            const idx = Math.floor((now - start) / INTERVAL) % slides.length;
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
