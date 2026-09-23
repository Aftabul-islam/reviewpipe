// reviewpipe docs — theme toggle, mobile drawer, and sidebar scrollspy.
(function () {
  const root = document.documentElement;

  // Theme: restore saved preference, else follow the OS.
  const saved = localStorage.getItem('rp-theme');
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

  const themeBtn = document.getElementById('theme-btn');
  function currentTheme() {
    return (
      root.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    );
  }
  function syncThemeIcon() {
    if (themeBtn) themeBtn.textContent = currentTheme() === 'dark' ? '☀' : '☾';
  }
  syncThemeIcon();
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('rp-theme', next);
      syncThemeIcon();
    });
  }

  // Mobile drawer.
  const menuBtn = document.getElementById('menu-btn');
  const scrim = document.querySelector('.scrim');
  function closeNav() {
    document.body.classList.remove('nav-open');
  }
  if (menuBtn) menuBtn.addEventListener('click', () => document.body.classList.toggle('nav-open'));
  if (scrim) scrim.addEventListener('click', closeNav);

  // Close the drawer after picking a section, and let anchors scroll normally.
  const links = Array.prototype.slice.call(document.querySelectorAll('.sidebar a'));
  links.forEach((link) => link.addEventListener('click', closeNav));

  // Scrollspy: highlight the sidebar link for the section in view.
  const byId = {};
  links.forEach((link) => {
    const id = link.getAttribute('href').slice(1);
    if (id) byId[id] = link;
  });
  const sections = Array.prototype.slice
    .call(document.querySelectorAll('.content > section[id]'))
    .filter((section) => byId[section.id]);

  let active = null;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (active) active.classList.remove('active');
        active = byId[entry.target.id];
        if (active) active.classList.add('active');
      });
    },
    { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
  );
  sections.forEach((section) => observer.observe(section));
})();
