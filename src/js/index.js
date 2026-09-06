    // Skit selector - switch iframe src when user clicks a tab
    const skitFrame = document.getElementById('skitFrame');
    const selector = document.getElementById('skitSelector');

    selector.addEventListener('click', (e) => {
      const btn = e.target.closest('.script-tab');
      if (!btn) return;

      const skitName = btn.dataset.skit;
      const skitUrl = btn.dataset.skitUrl;
      if (!skitName && !skitUrl) return;

      // Update active state
      selector.querySelectorAll('.script-tab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');

      // Reload iframe with new skit
      const params = new URLSearchParams({ embed: '1', captions: '1' });
      params.set(skitUrl ? 'url' : 'skit', skitUrl || skitName);
      skitFrame.src = `skit-player.html?${params}`;
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

        track.replaceChildren();
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
          const category = document.createElement('span');
          category.className = `tag tag-${item._category === 'characters' ? 'character' : item._category === 'backgrounds' ? 'background' : 'prop'}`;
          category.style.cssText = 'padding:2px 6px;font-size:11px';
          category.textContent = CATEGORY_LABELS[item._category];
          meta.appendChild(category);
          if (item.username) {
            const byline = document.createElement('span');
            byline.textContent = `by ${item.username}`;
            meta.append(' ', byline);
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

        const scrollBehavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
        leftBtn.addEventListener('click', () => { track.scrollBy({ left: -scrollAmt, behavior: scrollBehavior() }); });
        rightBtn.addEventListener('click', () => { track.scrollBy({ left: scrollAmt, behavior: scrollBehavior() }); });


      } catch (err) {
        console.warn('Failed to load community carousel:', err);
        track.textContent = 'The prop cupboard is taking a break. Use Browse all assets to try again.';
      }
    })();
