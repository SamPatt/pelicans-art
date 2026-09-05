(() => {
  const button = document.getElementById('share-button');
  if (!button) return;
  button.addEventListener('click', async () => {
    const url = document.querySelector('link[rel="canonical"]')?.href || location.href;
    const title = document.title.replace(/ — pelicans.art$/, '');
    const status = document.getElementById('share-status');
    try {
      if (navigator.share) await navigator.share({ title, url });
      else { await navigator.clipboard.writeText(url); status.textContent = 'Link copied!'; }
    } catch (error) {
      if (error.name !== 'AbortError') {
        status.textContent = 'Copy this link: ';
        const link = document.createElement('a'); link.href = url; link.textContent = url; status.append(link);
      }
    }
  });
})();
