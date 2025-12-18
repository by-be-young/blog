(function () {
    function initSlideshow() {
        const slides = document.querySelectorAll('.slide');
        if (!slides || slides.length === 0) return;

        let currentSlide = 0;

        function showSlide(index) {
            slides.forEach(slide => slide.classList.remove('active'));
            if (slides[index]) slides[index].classList.add('active');
        }

        function nextSlide() {
            currentSlide = (currentSlide + 1) % slides.length;
            showSlide(currentSlide);
        }

        showSlide(0);
        setInterval(nextSlide, 5000);
    }

    document.addEventListener('DOMContentLoaded', initSlideshow);
})();
