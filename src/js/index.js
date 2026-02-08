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

    // --- Community carousel ---
    (async function initCarousel() {
      const API = 'https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community';
      const track = document.getElementById('carouselTrack');
      if (!track) return;

      const CATEGORY_LABELS = { characters: 'Character', props: 'Prop', backgrounds: 'Background' };

      function previewUrl(cat, slug) {
        if (cat === 'characters') return `${API}/characters/${slug}/front.svg`;
        if (cat === 'props') return `${API}/props/${slug}/prop.svg`;
        if (cat === 'backgrounds') return `${API}/backgrounds/${slug}/landscape.svg`;
        return null;
      }

      try {
        const results = await Promise.all(
          ['characters', 'props', 'backgrounds'].map(cat =>
            fetch(`${API}/${cat}?limit=50`)
              .then(r => r.json())
              .then(data => (data.items || []).map(item => ({ ...item, _category: cat })))
              .catch(() => [])
          )
        );

        const items = results.flat();
        // Shuffle
        for (let i = items.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [items[i], items[j]] = [items[j], items[i]];
        }

        if (!items.length) {
          track.innerHTML = '<p style="padding:20px;color:var(--wing-gray)">No community assets yet.</p>';
          return;
        }

        items.forEach(item => {
          const url = previewUrl(item._category, item.slug);
          if (!url) return;

          const card = document.createElement('a');
          card.className = 'carousel-card';
          card.href = `community.html?type=${item._category}&id=${item.slug}`;

          const img = document.createElement('img');
          img.className = 'carousel-card-img';
          img.src = url;
          img.alt = item.name || item.slug;
          img.loading = 'lazy';

          const info = document.createElement('div');
          info.className = 'carousel-card-info';

          const name = document.createElement('div');
          name.className = 'carousel-card-name';
          name.textContent = item.name || item.slug;

          const meta = document.createElement('div');
          meta.className = 'carousel-card-meta';
          meta.innerHTML = `<span class="tag tag-${item._category === 'characters' ? 'character' : item._category === 'backgrounds' ? 'background' : 'prop'}" style="padding:2px 6px;font-size:11px">${CATEGORY_LABELS[item._category]}</span>`;
          if (item.username) {
            meta.innerHTML += ` <span>by ${item.username}</span>`;
          }

          info.appendChild(name);
          info.appendChild(meta);
          card.appendChild(img);
          card.appendChild(info);
          track.appendChild(card);
        });

        // Arrow buttons
        const leftBtn = document.getElementById('carouselLeft');
        const rightBtn = document.getElementById('carouselRight');
        const scrollAmt = 440;

        leftBtn.addEventListener('click', () => { track.scrollBy({ left: -scrollAmt, behavior: 'smooth' }); });
        rightBtn.addEventListener('click', () => { track.scrollBy({ left: scrollAmt, behavior: 'smooth' }); });

        // Auto-rotate
        let autoScroll = setInterval(() => {
          if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 10) {
            track.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            track.scrollBy({ left: 220, behavior: 'smooth' });
          }
        }, 3000);

        // Pause on hover
        track.addEventListener('mouseenter', () => clearInterval(autoScroll));
        track.addEventListener('mouseleave', () => {
          autoScroll = setInterval(() => {
            if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 10) {
              track.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
              track.scrollBy({ left: 220, behavior: 'smooth' });
            }
          }, 3000);
        });

      } catch (err) {
        console.warn('Failed to load community carousel:', err);
      }
    })();
