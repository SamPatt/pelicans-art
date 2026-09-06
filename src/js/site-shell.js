// Shared navigation and theme state for every public page and standalone player.
(() => {
  const root = document.documentElement;
  const preference = matchMedia('(prefers-color-scheme: dark)');
  let saved;
  try { saved = localStorage.getItem('pelicans-theme'); } catch {}
  function apply(theme) {
    if (theme === 'ocean') root.dataset.theme = 'ocean';
    else delete root.dataset.theme;
    const button = document.getElementById('themeToggle');
    if (button) {
      document.getElementById('themeIcon').textContent = theme === 'ocean' ? '☀' : '☾';
      document.getElementById('themeLabel').textContent = theme === 'ocean' ? 'Beach' : 'Ocean';
      button.setAttribute('aria-label', `Switch to ${theme === 'ocean' ? 'beach' : 'ocean'} theme`);
    }
  }
  apply(saved || (preference.matches ? 'ocean' : 'beach'));
  const nav = document.querySelector('.pelicans-nav');
  if (nav) {
    // The script origin also keeps navigation correct on Worker-hosted share pages.
    const base = new URL('../', document.currentScript.src);
    const links = [['Watch', '#now-playing'], ['The Pouch', 'community.html'], ['Create', 'agent.html']];
    nav.classList.remove('dark');
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = `<a class="pelicans-nav-logo" href="${base}">pelicans<span>.art</span></a><ul class="pelicans-nav-links">${links.map(([label, path]) => `<li><a href="${new URL(path, base)}">${label}</a></li>`).join('')}<li><button type="button" class="theme-toggle" id="themeToggle"><span id="themeIcon" aria-hidden="true"></span><span id="themeLabel"></span></button></li></ul>`;
    const current = location.pathname;
    const index = current.includes('community') ? 1 : /agent|how-it-works|sprite-editor|editor/.test(current) ? 2 : 0;
    nav.querySelectorAll('.pelicans-nav-links a')[index].setAttribute('aria-current', 'page');
    document.getElementById('themeToggle').addEventListener('click', () => {
      saved = root.dataset.theme === 'ocean' ? 'beach' : 'ocean';
      try { localStorage.setItem('pelicans-theme', saved); } catch {}
      apply(saved);
    });
  }
  apply(saved || (preference.matches ? 'ocean' : 'beach'));
  addEventListener('storage', event => {
    if (event.key === 'pelicans-theme') { saved = event.newValue; apply(saved || (preference.matches ? 'ocean' : 'beach')); }
  });
  preference.addEventListener('change', event => { if (!saved) apply(event.matches ? 'ocean' : 'beach'); });
})();
