(function () {
    'use strict';

    /**
     * Небольшой помощник: безопасно получить элемент и ничего не сломать,
     * если его вдруг нет на странице.
     */
    function $(id) { return document.getElementById(id); }

    var nav = $('nav');
    var menuToggle = $('menuToggle');
    var mobileMenu = $('mobileMenu');
    var menuClose = $('menuClose');
    var scrollTopBtn = $('scrollTop');
    var mapFrame = $('mapFrame');
    var mapFacadeBtn = $('mapFacadeBtn');
    var inertTargets = document.querySelectorAll('#nav, main, footer, #scrollTop, .mobile-dock');

    var lastFocusedEl = null;

    var reduceMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
    var ticking = false;
    function onScrollFrame() {
        if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
        if (scrollTopBtn) scrollTopBtn.classList.toggle('visible', window.scrollY > 500);
        ticking = false;
    }
    window.addEventListener('scroll', function () {
        if (!ticking) { ticking = true; window.requestAnimationFrame(onScrollFrame); }
    }, { passive: true });

    /* ---------- Мобильное меню ---------- */
    function setPageInert(value) {
        Array.prototype.forEach.call(inertTargets, function (el) {
            el.inert = value;
        });
    }

    function openMenu() {
        if (!mobileMenu || !menuToggle) return;
        lastFocusedEl = document.activeElement;
        mobileMenu.classList.add('active');
        mobileMenu.setAttribute('aria-hidden', 'false');
        menuToggle.classList.add('active');
        menuToggle.setAttribute('aria-expanded', 'true');
        setPageInert(true);
        document.body.style.overflow = 'hidden';
        if (menuClose) menuClose.focus();
    }

    function closeMenu() {
        if (!mobileMenu || !menuToggle) return;
        mobileMenu.classList.remove('active');
        menuToggle.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
        setPageInert(false);
        document.body.style.overflow = '';
        if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
            lastFocusedEl.focus();
        }
        mobileMenu.setAttribute('aria-hidden', 'true');
    }

    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', function () {
            mobileMenu.classList.contains('active') ? closeMenu() : openMenu();
        });

        if (menuClose) menuClose.addEventListener('click', closeMenu);

        mobileMenu.addEventListener('click', function (e) {
            if (e.target === mobileMenu) closeMenu();
        });

        // Закрытие по Esc — доступность важна не меньше красоты
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
                closeMenu();
            }

            if (e.key === 'Tab' && mobileMenu.classList.contains('active')) {
                var focusable = mobileMenu.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
                if (!focusable.length) return;
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });

        document.querySelectorAll('.mobile-menu-links a').forEach(function (link) {
            link.addEventListener('click', closeMenu);
        });

        var desktopMenuMQ = window.matchMedia('(min-width: 961px)');
        var closeMenuAtDesktop = function (event) {
            if (event.matches && mobileMenu.classList.contains('active')) closeMenu();
        };
        if (desktopMenuMQ.addEventListener) desktopMenuMQ.addEventListener('change', closeMenuAtDesktop);
        else if (desktopMenuMQ.addListener) desktopMenuMQ.addListener(closeMenuAtDesktop);
    }

    /* ---------- Кнопка «наверх» ---------- */
    if (scrollTopBtn) {
        scrollTopBtn.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: reduceMotionMQ.matches ? 'auto' : 'smooth' });
        });
    }

    /* ---------- Плавный скролл к якорям ---------- */
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var href = this.getAttribute('href');
            if (!href || href === '#') return;

            var target = document.querySelector(href);
            if (!target) return;

            e.preventDefault();
            var isSkipLink = this.classList.contains('skip-link');
            var isMobileNavLink = !!this.closest('.mobile-menu-links');
            var focusTarget = isSkipLink ? target : (isMobileNavLink ? target.querySelector('h2') : null);

            // Читаем geometry в следующем кадре: если клик по ссылке в мобильном
            // меню только что закрыл меню (запись стилей), чтение
            // getBoundingClientRect() сразу после этого вызвало бы
            // принудительную синхронную компоновку (forced reflow).
            window.requestAnimationFrame(function () {
                var headerOffset = nav ? Math.ceil(nav.getBoundingClientRect().height) + 12 : 90;
                var position = target.getBoundingClientRect().top + window.scrollY - headerOffset;
                window.scrollTo({ top: position, behavior: reduceMotionMQ.matches ? 'auto' : 'smooth' });
                if (focusTarget) {
                    if (!focusTarget.hasAttribute('tabindex')) focusTarget.setAttribute('tabindex', '-1');
                    try { focusTarget.focus({ preventScroll: true }); }
                    catch (err) { focusTarget.focus(); }
                }
            });

            // Обновляем URL без резкого скачка страницы
            if (history.pushState) history.pushState(null, '', href);
        });
    });

    /* ---------- Карта проезда: подгружаем iframe только по клику ----------
       Экономит время загрузки и трафик, пока человек не захотел
       посмотреть карту — вставляем тяжёлый виджет Яндекс.Карт лениво. */
    if (mapFacadeBtn && mapFrame) {
        mapFacadeBtn.hidden = false;
        var mapFallback = $('mapFallback');
        if (mapFallback) mapFallback.hidden = true;
        mapFacadeBtn.addEventListener('click', function () {
            var iframe = document.createElement('iframe');
            iframe.src = 'https://yandex.ru/map-widget/v1/?z=16&ol=biz&oid=147961964582';
            iframe.width = '100%';
            iframe.height = '520';
            iframe.frameBorder = '0';
            iframe.loading = 'lazy';
            iframe.tabIndex = 0;
            iframe.title = 'Магазин Твой на карте — село Поповка, ул. Победы, 24';

            mapFrame.replaceChildren(iframe);
            iframe.focus();
        }, { once: true });
    }

    /* ---------- Первичный расчёт состояний при загрузке ---------- */
    onScrollFrame();

})();

(function () {
    'use strict';

    var root = document.documentElement;

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
            var now = new Date(Date.now() + 3 * 60 * 60 * 1000);
            return now.getUTCHours() * 60 + now.getUTCMinutes();
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
        var sectionObserver = new IntersectionObserver(function () {
            var current = observedSections.find(function (section) {
                var bounds = section.getBoundingClientRect();
                return bounds.top < window.innerHeight * 0.44 && bounds.bottom > window.innerHeight * 0.32;
            });
            markActiveSection(current ? current.id : '');
        }, {
            rootMargin: '-32% 0px -56% 0px',
            threshold: 0
        });

        observedSections.forEach(function (section) {
            sectionObserver.observe(section);
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

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) updateOpenStatus();
    });
})();
