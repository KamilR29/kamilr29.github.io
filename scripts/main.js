// ===== Kamil Rączkowski — Portfolio interactions =====

const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const menu = document.getElementById('menu');

// Shrink / solidify navbar on scroll
const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Mobile menu toggle
const closeMenu = () => {
    menu.classList.remove('open');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
};

hamburger.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
});

menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
});

// Active section highlighting
const sections = document.querySelectorAll('main section[id]');
const navLinks = document.querySelectorAll('.menu a');

const spy = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach(a =>
                a.classList.toggle('active', a.getAttribute('href') === `#${id}`)
            );
        }
    });
}, { rootMargin: '-45% 0px -50% 0px' });

sections.forEach(s => spy.observe(s));

// Scroll-reveal animations
const revealer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealer.unobserve(entry.target);
        }
    });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealer.observe(el));

// Current year in footer
document.getElementById('year').textContent = new Date().getFullYear();
