cconst toggle = document.querySelector('[data-menu-toggle]');
const panel = document.querySelector('[data-mobile-panel]');

function closePanel() {
  if (panel) {
    panel.classList.remove('open');
  }
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
  }
}

if (toggle && panel) {
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

document.querySelectorAll('[data-close-panel]').forEach(link => {
  link.addEventListener('click', closePanel);
});

document.addEventListener('click', (event) => {
  if (!panel || !toggle) return;
  if (!panel.classList.contains('open')) return;

  const clickedInsidePanel = panel.contains(event.target);
  const clickedToggle = toggle.contains(event.target);

  if (!clickedInsidePanel && !clickedToggle) {
    closePanel();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closePanel();
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 760) {
    closePanel();
  }
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
if (year) {
  year.textContent = new Date().getFullYear();
}

const path = location.pathname.split('/').pop() || 'index.html';

document.querySelectorAll('.nav-links a, .mobile-panel a').forEach(link => {
  const href = link.getAttribute('href');
  if (href && href === path) {
    link.classList.add('active');
  }
});
