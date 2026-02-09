  const API_URL = 'https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community';

  let currentCategory = 'all';
  let currentCursor = null;
  let currentItems = [];
  let selectedSlug = null;

  const CATEGORY_ICONS = {
    characters: '\u{1F9D1}',
    props: '\u{1F381}',
    backgrounds: '\u{1F3DE}',
    skits: '\u{1F4DD}',
    published: '\u{1F3AC}',
    voices: '\u{1F3A4}',
  };

  const VISUAL_CATEGORIES = ['characters', 'props', 'backgrounds'];

  function previewFile(category, slug) {
    switch (category) {
      case 'characters': return `${API_URL}/characters/${slug}/front.svg`;
      case 'props': return `${API_URL}/props/${slug}/prop.svg`;
      case 'backgrounds': return `${API_URL}/backgrounds/${slug}/landscape.svg`;
      default: return null;
    }
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const id = params.get('id');

    if (type && ['all', 'characters', 'props', 'backgrounds', 'skits', 'published', 'voices'].includes(type)) {
      currentCategory = type;
      document.querySelectorAll('.category-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.type === type);
      });
    }

    await loadCategory();

    if (id) {
      openDetail(id);
    }
  }

  function switchCategory(category) {
    currentCategory = category;
    currentCursor = null;
    currentItems = [];
    selectedSlug = null;
    closeDetail();

    document.querySelectorAll('.category-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.type === category);
    });

    const url = new URL(window.location);
    url.searchParams.set('type', category);
    url.searchParams.delete('id');
    history.replaceState(null, '', url);

    loadCategory();
  }

  async function loadAllCategories() {
    const grid = document.getElementById('asset-grid');
    const loading = document.getElementById('loading-indicator');
    const empty = document.getElementById('empty-state');
    const loadMoreBtn = document.getElementById('load-more-btn');

    grid.innerHTML = '';
    loading.style.display = '';
    empty.style.display = 'none';
    loadMoreBtn.style.display = 'none';
    currentItems = [];
    currentCursor = null;

    const categories = ['characters', 'props', 'backgrounds', 'skits', 'published', 'voices'];

    try {
      const results = await Promise.all(
        categories.map(cat =>
          fetch(`${API_URL}/${cat}?limit=8`)
            .then(r => r.json())
            .then(data => data.items.map(item => ({ ...item, _category: cat })))
            .catch(() => [])
        )
      );

      loading.style.display = 'none';

      const combined = results.flat();
      for (let i = combined.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]];
      }

      currentItems = combined;

      if (combined.length === 0) {
        empty.style.display = '';
        return;
      }

      renderCards(combined);
    } catch (e) {
      loading.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Failed to load assets: ' + e.message;
    }
  }

  async function loadCategory() {
    if (currentCategory === 'all') return loadAllCategories();
    const grid = document.getElementById('asset-grid');
    const loading = document.getElementById('loading-indicator');
    const empty = document.getElementById('empty-state');
    const loadMoreBtn = document.getElementById('load-more-btn');

    grid.innerHTML = '';
    loading.style.display = '';
    empty.style.display = 'none';
    loadMoreBtn.style.display = 'none';
    currentItems = [];
    currentCursor = null;

    try {
      const resp = await fetch(`${API_URL}/${currentCategory}?limit=50`);
      const data = await resp.json();

      loading.style.display = 'none';
      currentItems = data.items;
      currentCursor = data.cursor;

      if (data.items.length === 0) {
        empty.style.display = '';
        return;
      }

      renderCards(data.items);

      if (data.hasMore && data.cursor) {
        loadMoreBtn.style.display = '';
      }
    } catch (e) {
      loading.style.display = 'none';
      empty.style.display = '';
      empty.textContent = 'Failed to load assets: ' + e.message;
    }
  }

  async function loadMore() {
    if (!currentCursor) return;
    const loadMoreBtn = document.getElementById('load-more-btn');
    loadMoreBtn.textContent = 'Loading...';
    loadMoreBtn.disabled = true;

    try {
      const resp = await fetch(`${API_URL}/${currentCategory}?limit=50&cursor=${encodeURIComponent(currentCursor)}`);
      const data = await resp.json();
      currentItems = currentItems.concat(data.items);
      currentCursor = data.cursor;
      renderCards(data.items, true);

      if (data.hasMore && data.cursor) {
        loadMoreBtn.style.display = '';
      } else {
        loadMoreBtn.style.display = 'none';
      }
    } catch (e) {
      console.error('Load more failed:', e);
    } finally {
      loadMoreBtn.textContent = 'Load More';
      loadMoreBtn.disabled = false;
    }
  }

  function renderCards(items, append = false) {
    const grid = document.getElementById('asset-grid');
    if (!append) grid.innerHTML = '';

    for (const item of items) {
      const card = document.createElement('div');
      card.className = 'asset-card';
      if (item.slug === selectedSlug) card.classList.add('selected');
      card.onclick = () => openDetail(item.slug);

      const preview = document.createElement('div');
      preview.className = 'asset-card-preview';

      const itemCat = item._category || currentCategory;
      const url = previewFile(itemCat, item.slug);
      if (url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = item.name;
        img.loading = 'lazy';
        preview.appendChild(img);
      } else {
        const icon = document.createElement('div');
        icon.className = 'asset-card-icon';
        icon.textContent = CATEGORY_ICONS[itemCat] || '\u{1F4E6}';
        preview.appendChild(icon);
      }

      const name = document.createElement('div');
      name.className = 'asset-card-name';
      name.textContent = item.name;

      const meta = document.createElement('div');
      meta.className = 'asset-card-meta';
      meta.textContent = item.username;

      card.appendChild(preview);
      card.appendChild(name);
      card.appendChild(meta);

      if (itemCat === 'published') {
        const playOverlay = document.createElement('div');
        playOverlay.className = 'card-play-overlay';
        playOverlay.title = 'Play skit';
        playOverlay.addEventListener('click', (e) => {
          e.stopPropagation();
          const dataUrl = `${API_URL}/published/${item.slug}/data.json`;
          window.open(`skit-player.html?url=${encodeURIComponent(dataUrl)}`, '_blank');
        });
        card.appendChild(playOverlay);
      }

      if (currentCategory === 'all' && item._category) {
        const CATEGORY_LABELS = { skits: 'Scripts', published: 'Skits' };
        const badge = document.createElement('div');
        badge.className = 'asset-card-category';
        badge.dataset.cat = item._category;
        badge.textContent = CATEGORY_LABELS[item._category] || item._category;
        card.appendChild(badge);
      }

      grid.appendChild(card);
    }
  }

  async function openDetail(slug) {
    selectedSlug = slug;
    const panel = document.getElementById('detail-panel');
    const title = document.getElementById('detail-title');
    const content = document.getElementById('detail-content');

    const matchedItem = currentItems.find(it => it.slug === slug);
    const detailCategory = matchedItem?._category || currentCategory;

    const url = new URL(window.location);
    url.searchParams.set('type', detailCategory);
    url.searchParams.set('id', slug);
    history.replaceState(null, '', url);

    document.querySelectorAll('.asset-card').forEach((c, i) => {
      c.classList.toggle('selected', currentItems[i]?.slug === slug);
    });

    panel.classList.add('visible');
    title.textContent = 'Loading...';
    content.innerHTML = '<div class="loading">Loading</div>';

    const header = document.querySelector('.detail-header');
    const oldPlayBtn = header.querySelector('.detail-header-play');
    if (oldPlayBtn) oldPlayBtn.remove();

    try {
      const metaResp = await fetch(`${API_URL}/${detailCategory}/${slug}`);
      if (!metaResp.ok) throw new Error('Asset not found');
      const meta = await metaResp.json();

      title.textContent = meta.name || slug;

      if (detailCategory === 'published') {
        const playBtn = document.createElement('button');
        playBtn.className = 'detail-header-play';
        playBtn.innerHTML = '&#9654; Play';
        const dataUrl = `${API_URL}/published/${slug}/data.json`;
        const playerUrl = `skit-player.html?url=${encodeURIComponent(dataUrl)}`;
        playBtn.addEventListener('click', () => window.open(playerUrl, '_blank'));
        header.insertBefore(playBtn, header.querySelector('.detail-close'));
      }

      switch (detailCategory) {
        case 'characters': await renderCharacterDetail(content, slug, meta); break;
        case 'props': await renderPropDetail(content, slug, meta); break;
        case 'backgrounds': await renderBackgroundDetail(content, slug, meta); break;
        case 'skits': await renderSkitDetail(content, slug, meta); break;
        case 'published': await renderPublishedDetail(content, slug, meta); break;
        case 'voices': await renderVoiceDetail(content, slug, meta); break;
      }
    } catch (e) {
      content.innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    }
  }

  function closeDetail() {
    document.getElementById('detail-panel').classList.remove('visible');
    selectedSlug = null;
    document.querySelectorAll('.asset-card').forEach(c => c.classList.remove('selected'));

    const url = new URL(window.location);
    url.searchParams.delete('id');
    history.replaceState(null, '', url);
  }

  async function renderCharacterDetail(container, slug, meta) {
    const variants = [];
    const variantNames = Array.isArray(meta?.variants)
      ? [...new Set(meta.variants.filter((v) => typeof v === 'string' && v.trim()))]
      : [];

    if (variantNames.length > 0) {
      for (const variantName of variantNames) {
        const resp = await fetch(`${API_URL}/characters/${slug}/${variantName}.svg`);
        if (!resp.ok) continue;
        variants.push({
          name: variantName,
          label: variantName.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
          svg: await resp.text()
        });
      }
    }

    // Backwards compatibility for older community entries without meta.variants.
    if (variants.length === 0) {
      const frontResp = await fetch(`${API_URL}/characters/${slug}/front.svg`);
      if (frontResp.ok) variants.push({ name: 'front', label: 'Front', svg: await frontResp.text() });
      const backResp = await fetch(`${API_URL}/characters/${slug}/back.svg`);
      if (backResp.ok) variants.push({ name: 'back', label: 'Back', svg: await backResp.text() });
    }

    let tabsHtml = '';
    if (variants.length > 1) {
      tabsHtml = '<div class="variant-tabs" id="char-variant-tabs">';
      variants.forEach((v, i) => {
        tabsHtml += `<button class="variant-tab${i === 0 ? ' active' : ''}" data-char-variant="${v.name}">${v.label}</button>`;
      });
      tabsHtml += '</div>';
    }

    let html = tabsHtml;
    html += '<div class="detail-preview" id="char-preview"></div>';
    html += renderMetaTable(meta);
    html += '<div class="detail-actions">';
    variants.forEach(v => {
      html += `<button class="detail-btn btn-download" data-download-cat="characters" data-download-slug="${slug}" data-download-file="${v.name}.svg">Download ${v.label}</button>`;
    });
    html += `<button class="detail-btn btn-download" data-download-cat="characters" data-download-slug="${slug}" data-download-file="meta.json">Download Meta</button>`;
    html += `<button class="detail-btn btn-copy-link" data-action="copy-link">Copy Link</button>`;
    html += '</div>';
    container.innerHTML = html;

    window._charVariants = {};
    variants.forEach(v => { window._charVariants[v.name] = v.svg; });
    if (variants.length > 0) {
      document.getElementById('char-preview').innerHTML = variants[0].svg;
    }
  }

  function switchCharVariant(name) {
    const svg = window._charVariants?.[name];
    if (svg) document.getElementById('char-preview').innerHTML = svg;
    document.querySelectorAll('#char-variant-tabs .variant-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.charVariant === name);
    });
  }

  async function renderPropDetail(container, slug, meta) {
    let html = '<div class="detail-preview" id="prop-preview"></div>';
    html += renderMetaTable(meta);
    html += `<div class="detail-actions">
      <button class="detail-btn btn-download" data-download-cat="props" data-download-slug="${slug}" data-download-file="prop.svg">Download SVG</button>
      <button class="detail-btn btn-download" data-download-cat="props" data-download-slug="${slug}" data-download-file="meta.json">Download Meta</button>
      <button class="detail-btn btn-copy-link" data-action="copy-link">Copy Link</button>
    </div>`;
    container.innerHTML = html;

    try {
      const resp = await fetch(`${API_URL}/props/${slug}/prop.svg`);
      if (resp.ok) {
        document.getElementById('prop-preview').innerHTML = await resp.text();
      }
    } catch (e) {}
  }

  async function renderBackgroundDetail(container, slug, meta) {
    const orientations = [];
    const landResp = await fetch(`${API_URL}/backgrounds/${slug}/landscape.svg`);
    if (landResp.ok) orientations.push({ name: 'landscape', label: 'Landscape', svg: await landResp.text() });
    const portResp = await fetch(`${API_URL}/backgrounds/${slug}/portrait.svg`);
    if (portResp.ok) orientations.push({ name: 'portrait', label: 'Portrait', svg: await portResp.text() });

    let tabsHtml = '';
    if (orientations.length > 1) {
      tabsHtml = '<div class="variant-tabs" id="bg-variant-tabs">';
      orientations.forEach((o, i) => {
        tabsHtml += `<button class="variant-tab${i === 0 ? ' active' : ''}" data-bg-variant="${o.name}">${o.label}</button>`;
      });
      tabsHtml += '</div>';
    }

    let html = tabsHtml;
    html += '<div class="detail-preview" id="bg-preview"></div>';
    html += renderMetaTable(meta);
    html += '<div class="detail-actions">';
    orientations.forEach(o => {
      html += `<button class="detail-btn btn-download" data-download-cat="backgrounds" data-download-slug="${slug}" data-download-file="${o.name}.svg">Download ${o.label}</button>`;
    });
    html += `<button class="detail-btn btn-copy-link" data-action="copy-link">Copy Link</button>`;
    html += '</div>';
    container.innerHTML = html;

    window._bgVariants = {};
    orientations.forEach(o => { window._bgVariants[o.name] = o.svg; });
    if (orientations.length > 0) {
      document.getElementById('bg-preview').innerHTML = orientations[0].svg;
    }
  }

  function switchBgVariant(name) {
    const svg = window._bgVariants?.[name];
    if (svg) document.getElementById('bg-preview').innerHTML = svg;
    document.querySelectorAll('#bg-variant-tabs .variant-tab').forEach(t => {
      t.classList.toggle('active', t.textContent.toLowerCase() === name);
    });
  }

  async function renderSkitDetail(container, slug, meta) {
    let html = '';
    try {
      const resp = await fetch(`${API_URL}/skits/${slug}/data.json`);
      if (resp.ok) {
        const skit = await resp.json();
        const castNames = skit.cast ? Object.keys(skit.cast).join(', ') : 'none';
        const scriptLen = skit.script ? skit.script.length : 0;
        const dialogueCount = skit.script ? skit.script.filter(a => a.do === 'say').length : 0;

        html += `<div class="skit-summary">
          <strong>Title:</strong> ${skit.meta?.title || 'Untitled'}<br>
          ${skit.meta?.description ? `<strong>Description:</strong> ${skit.meta.description}<br>` : ''}
          <strong>Background:</strong> ${skit.stage?.background || 'none'}<br>
          <strong>Cast:</strong> ${castNames}<br>
          <strong>Script:</strong> ${scriptLen} actions (${dialogueCount} lines of dialogue)
        </div>`;
        html += renderScriptActions(skit.script);
      }
    } catch (e) {}

    html += renderMetaTable(meta);
    html += `<div class="detail-actions">
      <button class="detail-btn btn-download" data-download-cat="skits" data-download-slug="${slug}" data-download-file="${slug}.json">Download JSON</button>
      <button class="detail-btn btn-copy-link" data-action="copy-link">Copy Link</button>
    </div>`;
    container.innerHTML = html;
  }

  async function renderPublishedDetail(container, slug, meta) {
    let html = '';
    try {
      const resp = await fetch(`${API_URL}/published/${slug}/data.json`);
      if (resp.ok) {
        const pub = await resp.json();
        const castNames = pub.cast ? Object.keys(pub.cast).join(', ') : 'none';
        const scriptLen = pub.script ? pub.script.length : 0;
        const dialogueCount = pub.script ? pub.script.filter(a => a.do === 'say').length : 0;
        const audioCount = pub.assets?.audio ? Object.keys(pub.assets.audio).length : 0;
        const spriteCount = pub.assets?.sprites ? Object.keys(pub.assets.sprites).length : 0;

        html += `<div class="skit-summary">
          <strong>Title:</strong> ${pub.meta?.title || 'Untitled'}<br>
          ${pub.meta?.description ? `<strong>Description:</strong> ${pub.meta.description}<br>` : ''}
          <strong>Background:</strong> ${pub.stage?.background || 'none'}<br>
          <strong>Cast:</strong> ${castNames}<br>
          <strong>Script:</strong> ${scriptLen} actions (${dialogueCount} lines)<br>
          <strong>Assets:</strong> ${spriteCount} sprites, ${audioCount} audio clips
        </div>`;

        const bgName = pub.stage?.background;
        if (bgName && pub.assets?.backgrounds?.[bgName]) {
          html += `<div class="detail-preview"><img src="${pub.assets.backgrounds[bgName]}" alt="Background"></div>`;
        }

        html += renderScriptActions(pub.script);
      }
    } catch (e) {}

    html += renderMetaTable(meta);
    html += `<div class="detail-actions">
      <button class="detail-btn btn-download" data-download-cat="published" data-download-slug="${slug}" data-download-file="${slug}.json">Download Bundle</button>
      <button class="detail-btn btn-copy-link" data-action="copy-link">Copy Link</button>
    </div>`;
    container.innerHTML = html;
  }

  async function renderVoiceDetail(container, slug, meta) {
    let html = '';

    const isSafetensors = meta.contentType === 'application/octet-stream' ||
                          (meta.key && meta.key.endsWith('.safetensors'));
    const fileExt = isSafetensors ? 'safetensors' : 'wav';
    const fileUrl = `${API_URL}/voices/${slug}/${slug}.${fileExt}`;

    if (isSafetensors) {
      html += `<div class="voice-player" style="padding:20px;text-align:center;color:var(--wing-gray);">
        <p>This is a processed voice model (safetensors format).</p>
        <p>Import it into the sprite editor to use it.</p>
      </div>`;
    } else {
      html += `<div class="voice-player">
        <audio controls src="${fileUrl}" preload="none" style="width:100%;"></audio>
      </div>`;
    }
    html += renderMetaTable(meta);
    html += `<div class="detail-actions">
      <button class="detail-btn btn-download" data-download-cat="voices" data-download-slug="${slug}" data-download-file="${slug}.${fileExt}">Download ${fileExt.toUpperCase()}</button>
      <button class="detail-btn btn-copy-link" data-action="copy-link">Copy Link</button>
    </div>`;
    container.innerHTML = html;
  }

  function renderMetaTable(meta) {
    const date = meta.uploadedAt ? new Date(meta.uploadedAt).toLocaleDateString() : 'unknown';
    const sizeKB = meta.size ? (meta.size / 1024).toFixed(1) + ' KB' : 'unknown';
    return `<div class="detail-info">
      <span class="detail-label">Uploaded by</span><span class="detail-value">${meta.username || 'unknown'}</span>
      <span class="detail-label">Date</span><span class="detail-value">${date}</span>
      <span class="detail-label">Size</span><span class="detail-value">${sizeKB}</span>
      <span class="detail-label">Category</span><span class="detail-value">${meta.category || currentCategory}</span>
    </div>`;
  }

  function renderScriptActions(script) {
    if (!script || !script.length) return '';
    let html = '<div class="script-list"><h4>Script</h4>';
    script.forEach(action => {
      let content = '';
      let cssClass = '';
      switch (action.do) {
        case 'say':
          content = `<strong>${action.who}:</strong> "${action.line}"`;
          cssClass = 'say';
          break;
        case 'emote':
          content = `${action.who} \u2192 ${action.emotion}`;
          cssClass = 'emote';
          break;
        case 'shot':
          content = `\u{1F4F7} ${action.type}${action.who ? ` (${action.who})` : ''}`;
          cssClass = 'shot';
          break;
        case 'enter':
          content = `\u2197 ${action.who} enters from ${action.from}`;
          cssClass = 'stage';
          break;
        case 'exit':
          content = `\u2198 ${action.who} exits to ${action.to}`;
          cssClass = 'stage';
          break;
        case 'move':
          content = `\u2192 ${action.who} moves to ${action.to}`;
          cssClass = 'stage';
          break;
        case 'pause':
          content = `\u23F8 pause ${action.duration}s`;
          cssClass = 'stage';
          break;
        case 'look':
          content = `\u{1F441} ${action.who} looks ${action.at}`;
          cssClass = 'stage';
          break;
        case 'spawn':
          content = `\u{1F381} spawn ${action.what}${action.who ? ` held by ${action.who}` : (action.at ? ` at (${action.at[0]}, ${action.at[1]})` : '')}`;
          cssClass = 'prop';
          break;
        case 'despawn':
          content = `\u{1F381} despawn ${action.what}`;
          cssClass = 'prop';
          break;
        case 'prop-move':
          content = `\u{1F381} ${action.what} moves to (${action.to?.[0] || '?'}, ${action.to?.[1] || '?'})`;
          cssClass = 'prop';
          break;
        case 'prop-hold':
          content = `\u{1F381} ${action.who} holds ${action.what}`;
          cssClass = 'prop';
          break;
        case 'prop-drop':
          content = `\u{1F381} ${action.who || 'drop'} ${action.what}${action.at ? ` at (${action.at[0]}, ${action.at[1]})` : ''}`;
          cssClass = 'prop';
          break;
        case 'prop-rotate':
          content = `\u{1F381} rotate ${action.what} to ${action.angle}\u00B0`;
          cssClass = 'prop';
          break;
        case 'prop-scale':
          content = `\u{1F381} scale ${action.what} to ${action.scale}x`;
          cssClass = 'prop';
          break;
        case 'prop-animate':
          content = `\u{1F381} animate ${action.what}: ${action.animation}`;
          cssClass = 'prop';
          break;
        default:
          content = JSON.stringify(action);
      }
      if (action.offset < 0) {
        content += ` <span class="offset-badge">[${action.offset}s]</span>`;
      }
      html += `<div class="script-line ${cssClass}">${content}</div>`;
    });
    html += '</div>';
    return html;
  }

  function copyAssetLink() {
    const link = window.location.href;
    navigator.clipboard.writeText(link).then(() => {
      const btns = document.querySelectorAll('.btn-copy-link');
      btns.forEach(b => { b.textContent = 'Copied!'; });
      setTimeout(() => { btns.forEach(b => { b.textContent = 'Copy Link'; }); }, 2000);
    }).catch(() => {
      const tmp = document.createElement('input');
      tmp.value = link;
      document.body.appendChild(tmp);
      tmp.select();
      document.execCommand('copy');
      document.body.removeChild(tmp);
    });
  }

  async function downloadFile(category, slug, filename) {
    const url = `${API_URL}/${category}/${slug}/${filename}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        alert('File not found');
        return;
      }
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert('Download failed: ' + e.message);
    }
  }

  function handleDetailButtonClick(event) {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.dataset.charVariant) {
      switchCharVariant(button.dataset.charVariant);
      return;
    }
    if (button.dataset.bgVariant) {
      switchBgVariant(button.dataset.bgVariant);
      return;
    }
    if (button.dataset.downloadCat && button.dataset.downloadSlug && button.dataset.downloadFile) {
      downloadFile(button.dataset.downloadCat, button.dataset.downloadSlug, button.dataset.downloadFile);
      return;
    }
    if (button.dataset.action === 'copy-link') {
      copyAssetLink();
    }
  }

  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('detail-close-btn').addEventListener('click', closeDetail);
  document.getElementById('load-more-btn').addEventListener('click', loadMore);
  document.getElementById('category-tabs').addEventListener('click', (event) => {
    const btn = event.target.closest('.category-tab');
    if (!btn) return;
    switchCategory(btn.dataset.type);
  });
  document.getElementById('detail-content').addEventListener('click', handleDetailButtonClick);

  init();

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
