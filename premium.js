(function () {
    'use strict';

    var root = document.documentElement;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    var cardDepthInstalled = false;

    /* Живой статус магазина в московском часовом поясе. */
    function getMoscowMinutes() {
        try {
            var parts = new Intl.DateTimeFormat('ru-RU', {
                timeZone: 'Europe/Moscow',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).formatToParts(new Date());
            var hour = 0;
            var minute = 0;

            parts.forEach(function (part) {
                if (part.type === 'hour') hour = Number(part.value) % 24;
                if (part.type === 'minute') minute = Number(part.value);
            });

            return hour * 60 + minute;
        } catch (error) {
            var now = new Date();
            return now.getHours() * 60 + now.getMinutes();
        }
    }

    function updateOpenStatus() {
        var minutes = getMoscowMinutes();
        var isOpen = minutes >= 8 * 60 && minutes < 22 * 60;
        var label = isOpen
            ? 'Открыто сейчас'
            : minutes < 8 * 60
                ? 'Откроемся в 8:00'
                : 'Откроемся завтра в 8:00';

        root.classList.toggle('store-closed', !isOpen);
        document.querySelectorAll('[data-open-status]').forEach(function (element) {
            element.textContent = label;
        });
    }

    updateOpenStatus();
    window.setInterval(updateOpenStatus, 60000);

    /* Подсвечиваем пункт навигации, соответствующий видимой секции. */
    var navigationLinks = Array.prototype.slice.call(
        document.querySelectorAll('.nav-links a[href^="#"], .mobile-menu-links a[href^="#"]')
    );
    var observedSections = Array.prototype.slice.call(
        document.querySelectorAll('#features, #about, #reviews, #faq, #map')
    );

    function markActiveSection(id) {
        navigationLinks.forEach(function (link) {
            var active = link.getAttribute('href') === '#' + id;
            link.classList.toggle('active', active);
            if (active) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        });
    }

    if ('IntersectionObserver' in window && observedSections.length) {
        var sectionObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) markActiveSection(entry.target.id);
            });
        }, {
            rootMargin: '-32% 0px -56% 0px',
            threshold: 0
        });

        observedSections.forEach(function (section) {
            sectionObserver.observe(section);
        });
    }

    /* Мягкий локальный tilt — максимум 2.8°, только для точного указателя. */
    function installCardDepth() {
        if (cardDepthInstalled || !finePointer.matches || reduceMotion.matches) return;
        cardDepthInstalled = true;

        document.querySelectorAll('.feature-card, .review-card').forEach(function (card) {
            var bounds = null;
            var frame = 0;
            var pointerX = 0;
            var pointerY = 0;

            card.classList.add('tilt-card');

            card.addEventListener('pointerenter', function () {
                if (!finePointer.matches || reduceMotion.matches) return;
                bounds = card.getBoundingClientRect();
                card.style.willChange = 'transform';
            }, { passive: true });

            card.addEventListener('pointermove', function (event) {
                if (!finePointer.matches || reduceMotion.matches) return;
                if (!bounds) bounds = card.getBoundingClientRect();
                pointerX = event.clientX;
                pointerY = event.clientY;

                if (frame) return;
                frame = window.requestAnimationFrame(function () {
                    var x = Math.max(0, Math.min(1, (pointerX - bounds.left) / Math.max(bounds.width, 1)));
                    var y = Math.max(0, Math.min(1, (pointerY - bounds.top) / Math.max(bounds.height, 1)));
                    card.style.setProperty('--card-x', (x * 100).toFixed(1) + '%');
                    card.style.setProperty('--card-y', (y * 100).toFixed(1) + '%');
                    card.style.setProperty('--tilt-x', ((0.5 - y) * 5.6).toFixed(2) + 'deg');
                    card.style.setProperty('--tilt-y', ((x - 0.5) * 5.6).toFixed(2) + 'deg');
                    frame = 0;
                });
            }, { passive: true });

            card.addEventListener('pointerleave', function () {
                if (frame) window.cancelAnimationFrame(frame);
                frame = 0;
                bounds = null;
                card.style.removeProperty('--tilt-x');
                card.style.removeProperty('--tilt-y');
                card.style.removeProperty('will-change');
            }, { passive: true });
        });
    }

    installCardDepth();

    function resetCardDepthStyles() {
        document.querySelectorAll('.tilt-card').forEach(function (card) {
            card.style.removeProperty('--tilt-x');
            card.style.removeProperty('--tilt-y');
            card.style.removeProperty('will-change');
        });
    }

    function onReducedMotionChange(event) {
        if (event.matches) resetCardDepthStyles();
        else installCardDepth();
    }

    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onReducedMotionChange);
    else if (reduceMotion.addListener) reduceMotion.addListener(onReducedMotionChange);

    if (finePointer.addEventListener) {
        finePointer.addEventListener('change', function (event) {
            if (event.matches) installCardDepth();
            else resetCardDepthStyles();
        });
    }

    /* Wi‑Fi: раскрываем данные по запросу и даём быстро скопировать пароль. */
    var wifiToggle = document.getElementById('wifiToggle');
    var wifiDetails = document.getElementById('wifiDetails');
    var wifiStatus = document.getElementById('wifiStatus');

    if (wifiToggle && wifiDetails) {
        wifiToggle.addEventListener('click', function () {
            var isOpening = wifiDetails.hidden;
            wifiDetails.hidden = !isOpening;
            wifiToggle.setAttribute('aria-expanded', String(isOpening));
        });
    }

    function fallbackCopy(value) {
        var field = document.createElement('textarea');
        field.value = value;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        var copied = false;
        try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
        field.remove();
        return copied;
    }

    document.querySelectorAll('[data-copy-wifi]').forEach(function (button) {
        button.addEventListener('click', function () {
            var value = button.getAttribute('data-copy-wifi') || '';
            var copyPromise = window.isSecureContext && navigator.clipboard
                ? navigator.clipboard.writeText(value)
                : Promise.resolve(fallbackCopy(value));

            copyPromise.then(function (result) {
                var copied = result === undefined || result === true;
                if (wifiStatus) wifiStatus.textContent = copied ? 'Пароль скопирован' : 'Выделите пароль вручную: tvoyfree';
                if (copied) {
                    button.classList.add('is-copied');
                    window.setTimeout(function () { button.classList.remove('is-copied'); }, 1600);
                }
            }).catch(function () {
                var copied = fallbackCopy(value);
                if (wifiStatus) wifiStatus.textContent = copied ? 'Пароль скопирован' : 'Пароль: tvoyfree';
            });
        });
    });

    /* Останавливаем бесконечные декоративные анимации за пределами экрана. */
    if ('IntersectionObserver' in window) {
        var motionObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                entry.target.classList.toggle('motion-paused', !entry.isIntersecting);
            });
        }, { rootMargin: '180px 0px', threshold: 0 });

        document.querySelectorAll('.hero, .about, .reviews').forEach(function (scene) {
            motionObserver.observe(scene);
        });
    }

    document.addEventListener('visibilitychange', function () {
        root.classList.toggle('page-hidden', document.hidden);
        if (!document.hidden) updateOpenStatus();
    });
})();
