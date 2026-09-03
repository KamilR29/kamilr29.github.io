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

// ===== Graph mesh around the hero photo (reacts to the pointer) =====
const graphCanvas = document.querySelector('.photo-graph');

if (graphCanvas && graphCanvas.getContext) {
    const ctx = graphCanvas.getContext('2d');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const NODE_COUNT = 54;
    const R_MIN = 0.70;                       // inner radius, fraction of the canvas half-size
    const R_MAX = 0.98;
    const LINK_DIST = 0.30;                   // neighbours closer than this get an edge
    const MAX_DEGREE = 4;
    const POINTER_RADIUS = 140;               // px of influence around the cursor
    const SPRING = 0.02;
    const DAMPING = 0.88;

    const cssColor = (name, fallback) => {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
        if (!hex) return fallback;
        let v = hex[1];
        if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
        return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
    };
    const ACCENT = cssColor('--accent', [94, 211, 244]);
    const ACCENT_2 = cssColor('--accent-2', [167, 139, 250]);
    const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

    // Fixed seed: the layout is random-looking but the same on every visit.
    let seed = 0x6d2b79f5;
    const rand = () => {
        seed |= 0; seed = seed + 0x6d2b79f5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    // Scatter the nodes over the ring area: one per angular sector, but each sector
    // is a different width and each node sits at its own distance from the centre.
    const nodes = [];
    let angle = rand() * Math.PI * 2;
    const weights = [];
    for (let i = 0; i < NODE_COUNT; i++) weights.push(0.35 + rand() * 1.65);
    const weightSum = weights.reduce((a, b) => a + b, 0);

    for (let i = 0; i < NODE_COUNT; i++) {
        const radius = R_MIN + (R_MAX - R_MIN) * rand() ** 1.4;
        nodes.push({
            angle,
            radius,
            ux: Math.cos(angle) * radius,       // unit-space home, used to wire up edges
            uy: Math.sin(angle) * radius,
            alpha: 1 - (radius - R_MIN) / (R_MAX - R_MIN) * 0.55 - rand() * 0.15,
            size: 1.2 + rand() * 1.5,
            wobble: rand() * Math.PI * 2,
            wobbleAmp: 0.006 + rand() * 0.022,
            wobbleSpeed: 0.45 + rand() * 0.9,
            x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0, glow: 0
        });
        angle += (weights[i] / weightSum) * Math.PI * 2;
    }

    // Wire up neighbours: shortest links first, each node capped at MAX_DEGREE.
    const pairs = [];
    for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
            pairs.push([a, b, Math.hypot(nodes[a].ux - nodes[b].ux, nodes[a].uy - nodes[b].uy)]);
        }
    }
    pairs.sort((p, q) => p[2] - q[2]);

    const edges = [];
    const degree = new Array(nodes.length).fill(0);
    for (const [a, b, d] of pairs) {
        if (d > LINK_DIST) break;
        if (degree[a] >= MAX_DEGREE || degree[b] >= MAX_DEGREE) continue;
        edges.push([a, b]);
        degree[a]++; degree[b]++;
    }
    // Nobody floats alone — hook up any leftovers to their nearest neighbour.
    for (const [a, b] of pairs) {
        if (!degree[a] || !degree[b]) {
            edges.push([a, b]);
            degree[a]++; degree[b]++;
        }
    }

    let w = 0, h = 0, cx = 0, cy = 0, half = 0, placed = false, running = false;
    const pointer = { x: 0, y: 0, active: false };

    const updateHomes = (t) => {
        const spin = t * 0.00006;   // one slow revolution every ~29 s
        for (const n of nodes) {
            const rr = (n.radius + Math.sin(t * 0.0007 * n.wobbleSpeed + n.wobble) * n.wobbleAmp) * half;
            const a = n.angle + spin;
            n.hx = cx + Math.cos(a) * rr;
            n.hy = cy + Math.sin(a) * rr;
        }
    };

    const resize = () => {
        const rect = graphCanvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = rect.width;
        h = rect.height;
        graphCanvas.width = Math.round(w * dpr);
        graphCanvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cx = w / 2;
        cy = h / 2;
        half = Math.min(w, h) / 2;
        updateHomes(0);
        if (!placed) {
            nodes.forEach(n => { n.x = n.hx; n.y = n.hy; n.vx = n.vy = 0; });
            placed = true;
        }
    };

    const step = (t) => {
        updateHomes(t);
        for (const n of nodes) {
            n.vx += (n.hx - n.x) * SPRING;
            n.vy += (n.hy - n.y) * SPRING;

            let target = 0;
            if (pointer.active) {
                const dx = n.x - pointer.x;
                const dy = n.y - pointer.y;
                const d = Math.hypot(dx, dy) || 0.001;
                if (d < POINTER_RADIUS) {
                    const push = (1 - d / POINTER_RADIUS) ** 2;
                    n.vx += (dx / d) * push * 2.6;
                    n.vy += (dy / d) * push * 2.6;
                    target = 1 - d / POINTER_RADIUS;
                }
            }
            n.glow += (target - n.glow) * 0.14;

            n.vx *= DAMPING;
            n.vy *= DAMPING;
            n.x += n.vx;
            n.y += n.vy;
        }
    };

    const draw = () => {
        ctx.clearRect(0, 0, w, h);

        ctx.lineWidth = 1;
        for (const [a, b] of edges) {
            const na = nodes[a], nb = nodes[b];
            const glow = Math.max(na.glow, nb.glow);
            const fade = Math.min(na.alpha, nb.alpha);
            ctx.strokeStyle = rgba(glow > 0.05 ? ACCENT : ACCENT_2, (0.11 + glow * 0.5) * fade);
            ctx.beginPath();
            ctx.moveTo(na.x, na.y);
            ctx.lineTo(nb.x, nb.y);
            ctx.stroke();
        }

        if (pointer.active) {
            for (const n of nodes) {
                if (n.glow < 0.08) continue;
                ctx.strokeStyle = rgba(ACCENT, n.glow * 0.4);
                ctx.beginPath();
                ctx.moveTo(pointer.x, pointer.y);
                ctx.lineTo(n.x, n.y);
                ctx.stroke();
            }
        }

        for (const n of nodes) {
            const fade = n.alpha;
            const r = n.size + n.glow * 2.4;
            if (n.glow > 0.1) {
                ctx.fillStyle = rgba(ACCENT, n.glow * 0.16);
                ctx.beginPath();
                ctx.arc(n.x, n.y, r * 3.4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = rgba(n.glow > 0.05 ? ACCENT : ACCENT_2, (0.45 + n.glow * 0.55) * fade);
            ctx.beginPath();
            ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    const frame = (t) => {
        if (!running) return;
        step(t);
        draw();
        requestAnimationFrame(frame);
    };

    const start = () => {
        if (running || reducedMotion) return;
        running = true;
        requestAnimationFrame(frame);
    };
    const stop = () => { running = false; };

    if (window.ResizeObserver) {
        new ResizeObserver(() => { resize(); if (!running) draw(); }).observe(graphCanvas);
    } else {
        window.addEventListener('resize', resize);
    }
    resize();
    draw();

    if (!reducedMotion) {
        window.addEventListener('pointermove', e => {
            const rect = graphCanvas.getBoundingClientRect();
            pointer.x = e.clientX - rect.left;
            pointer.y = e.clientY - rect.top;
            pointer.active =
                pointer.x > -POINTER_RADIUS && pointer.x < rect.width + POINTER_RADIUS &&
                pointer.y > -POINTER_RADIUS && pointer.y < rect.height + POINTER_RADIUS;
        }, { passive: true });
        document.addEventListener('pointerleave', () => { pointer.active = false; });

        // Only animate while the mesh is on screen
        new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) start(); else stop();
        }, { threshold: 0 }).observe(graphCanvas);
    }
}
