(function () {
    const TARGET_PAGES = ['archive-page', 'categories-page', 'quick-links-page', 'series-page'];

    function isTargetPage() {
        const body = document.body;
        if (!body) return false;
        return TARGET_PAGES.some(cls => body.classList.contains(cls));
    }

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    function randInt(min, max) {
        return Math.floor(rand(min, max + 1));
    }

    function createFirefly() {
        const dot = document.createElement('span');
        dot.className = 'firefly';

        dot.style.setProperty('--x0', `${rand(-8, 108).toFixed(2)}vw`);
        dot.style.setProperty('--y0', `${rand(-4, 104).toFixed(2)}vh`);
        dot.style.setProperty('--x1', `${rand(-8, 108).toFixed(2)}vw`);
        dot.style.setProperty('--y1', `${rand(-4, 104).toFixed(2)}vh`);
        dot.style.setProperty('--x2', `${rand(-8, 108).toFixed(2)}vw`);
        dot.style.setProperty('--y2', `${rand(-4, 104).toFixed(2)}vh`);

        dot.style.setProperty('--size', `${rand(4.8, 9.6).toFixed(2)}px`);
        dot.style.setProperty('--alpha', `${rand(0.58, 0.96).toFixed(2)}`);
        // 拉长周期，让飞行和明暗变化更慢、更舒缓。
        dot.style.setProperty('--float-duration', `${randInt(18000, 32000)}ms`);
        dot.style.setProperty('--glow-duration', `${randInt(2600, 5600)}ms`);
        dot.style.setProperty('--float-delay', `${randInt(-32000, 0)}ms`);
        dot.style.setProperty('--glow-delay', `${randInt(-5600, 0)}ms`);
        dot.style.setProperty('--hue', `${randInt(44, 72)}`);

        return dot;
    }

    function initFireflies() {
        if (!isTargetPage()) return;

        const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const slideshow = document.querySelector('.slideshow');
        if (!slideshow) return;

        if (slideshow.querySelector('.fireflies-overlay')) return;

        const overlay = document.createElement('div');
        overlay.className = 'fireflies-overlay';
        overlay.setAttribute('aria-hidden', 'true');

        const count = reducedMotion
            ? (window.innerWidth <= 760 ? 10 : 16)
            : (window.innerWidth <= 760 ? 18 : 34);
        for (let i = 0; i < count; i += 1) {
            overlay.appendChild(createFirefly());
        }

        slideshow.appendChild(overlay);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFireflies);
    } else {
        initFireflies();
    }
})();
