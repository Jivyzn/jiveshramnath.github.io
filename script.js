(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('[data-menu-toggle]');
  const panel = document.querySelector('[data-mobile-panel]');
  const progress = document.querySelector('[data-scroll-progress]');

  const closePanel = () => {
    panel?.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  };

  toggle?.addEventListener('click', () => {
    const open = panel?.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(Boolean(open)));
  });

  document.querySelectorAll('[data-close-panel]').forEach((link) => {
    link.addEventListener('click', closePanel);
  });

  document.addEventListener('click', (event) => {
    if (!panel?.classList.contains('open')) return;
    if (!panel.contains(event.target) && !toggle?.contains(event.target)) closePanel();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });

  const onScroll = () => {
    header?.classList.toggle('scrolled', window.scrollY > 20);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? window.scrollY / max : 0;
      progress.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === current || (current === '' && href === 'index.html')) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  const revealElements = [...document.querySelectorAll('.reveal')];
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, revealObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add('visible'));
  }

  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      document.querySelectorAll('[data-project-card]').forEach((card) => {
        const categories = card.dataset.category?.split(' ') || [];
        card.hidden = filter !== 'all' && !categories.includes(filter);
      });
    });
  });

  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${y * -5}deg) rotateY(${x * 6}deg) translateY(-4px)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
  }

  const canvas = document.querySelector('[data-ambient-canvas]');
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let dpr = 1;
    let points = [];
    let frame = 0;
    const pointer = { x: 0, y: 0, active: false };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(95, Math.floor((width * height) / 16000));
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.11,
        vy: (Math.random() - 0.5) * 0.11,
        r: Math.random() * 1.2 + 0.25,
        a: Math.random() * 0.45 + 0.08
      }));
    };

    window.addEventListener('pointermove', (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    }, { passive: true });
    window.addEventListener('pointerleave', () => { pointer.active = false; });
    window.addEventListener('resize', resize);
    resize();

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (const point of points) {
        point.x += point.vx;
        point.y += point.vy;
        if (point.x < -5) point.x = width + 5;
        if (point.x > width + 5) point.x = -5;
        if (point.y < -5) point.y = height + 5;
        if (point.y > height + 5) point.y = -5;

        let drawX = point.x;
        let drawY = point.y;
        if (pointer.active) {
          const dx = pointer.x - point.x;
          const dy = pointer.y - point.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance < 180) {
            const force = (180 - distance) / 180;
            drawX -= (dx / distance) * force * 9;
            drawY -= (dy / distance) * force * 9;
          }
        }
        ctx.beginPath();
        ctx.arc(drawX, drawY, point.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,240,233,${point.a})`;
        ctx.fill();
      }
      frame = requestAnimationFrame(render);
    };
    render();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else render();
    });
  }
})();
