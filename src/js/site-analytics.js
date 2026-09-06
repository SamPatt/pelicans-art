// Analytics belongs to public site visits, never local authoring or CLI captures.
(() => {
  const publicHosts = new Set(['pelicans.art', 'www.pelicans.art', 'pelicans-community.sam-cloudflare-d20.workers.dev']);
  if (!publicHosts.has(window.location.hostname) || window.self !== window.top || new URLSearchParams(window.location.search).get('embed') === '1') return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://ruddy-mule.pikapod.net/script.js';
  script.dataset.websiteId = '9bc694aa-3b94-457a-9e3a-adabd7a04b7f';
  document.head.appendChild(script);
})();
