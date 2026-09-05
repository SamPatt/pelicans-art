// Share pages reserve a separate, touch-friendly row below the complete scene.
if (new URLSearchParams(location.search).get('controls') === 'below') {
  document.body.classList.add('controls-below');
}
