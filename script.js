const toggle = document.querySelector('[data-menu-toggle]');
const panel = document.querySelector('[data-mobile-panel]');
if (toggle && panel) {
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

document.querySelectorAll('[data-close-panel]').forEach(link => {
  link.addEventListener('click', () => {
    if (panel) {
      panel.classList.remove('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  });
});

const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && revealEls.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.14 });
  revealEls.forEach(el => observer.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('visible'));
}

const year = document.querySelector('[data-year]');
if (year) year.textContent = new Date().getFullYear();

const path = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a, .mobile-panel a').forEach(link => {
  const href = link.getAttribute('href');
  if (href && href === path) link.classList.add('active');
});
