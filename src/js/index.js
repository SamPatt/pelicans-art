    // Skit selector - switch iframe src when user clicks a tab
    const skitFrame = document.getElementById('skitFrame');
    const selector = document.getElementById('skitSelector');

    selector.addEventListener('click', (e) => {
      const btn = e.target.closest('.script-tab');
      if (!btn) return;

      const skitName = btn.dataset.skit;
      if (!skitName) return;

      // Update active state
      selector.querySelectorAll('.script-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Reload iframe with new skit
      skitFrame.src = `skit-player.html?embed=1&skit=${skitName}`;
    });

    // Listen for orientation changes from embedded skit player
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'skit-orientation') {
        if (e.data.orientation === 'portrait') {
          skitFrame.classList.add('portrait');
        } else {
          skitFrame.classList.remove('portrait');
        }
      }
    });

    // --- Theme toggle ---
    function applyTheme(theme) {
      if (theme === 'ocean') {
        document.documentElement.dataset.theme = 'ocean';
        document.getElementById('themeIcon').innerHTML = '&#9728;';
        document.getElementById('themeLabel').textContent = 'Beach';
      } else {
        delete document.documentElement.dataset.theme;
        document.getElementById('themeIcon').innerHTML = '&#127754;';
        document.getElementById('themeLabel').textContent = 'Ocean';
      }
    }
    function toggleTheme() {
      const current = document.documentElement.dataset.theme === 'ocean' ? 'ocean' : 'beach';
      const next = current === 'ocean' ? 'beach' : 'ocean';
      localStorage.setItem('pelicans-theme', next);
      applyTheme(next);
    }
    (function initTheme() {
      const saved = localStorage.getItem('pelicans-theme');
      if (saved) { applyTheme(saved); return; }
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) { applyTheme('ocean'); }
    })();
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
