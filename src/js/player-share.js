(() => {
  const params = new URLSearchParams(location.search);
  if (params.has('embed')) return;
  const catalog = window.PELICAN_SHARE_CATALOG || {};
  const skit = params.get('skit');
  let url = catalog.bundled?.[skit];
  try {
    const source = new URL(params.get('url'));
    const match = source.pathname.match(/^\/api\/community\/published\/([a-z0-9-]+)\/data.json$/);
    if (source.origin === 'https://pelicans-community.sam-cloudflare-d20.workers.dev' && match) {
      url = catalog.pouch?.[match[1]] || `${source.origin}/watch/${match[1]}`;
    }
  } catch {}
  if (!url) return;
  const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = url; document.head.append(canonical);
  const button = document.createElement('button'); button.id = 'share-button'; button.textContent = 'Share skit';
  button.addEventListener('click', () => {
    if (typeof currentSkit !== 'undefined' && currentSkit?.meta?.title) document.title = `${currentSkit.meta.title} — pelicans.art`;
  });
  const status = document.createElement('p'); status.id = 'share-status'; status.setAttribute('role','status');
  document.querySelector('.player-body').append(button, status);
})();
