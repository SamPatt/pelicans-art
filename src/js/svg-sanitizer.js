(function () {
  'use strict';

  const FORBIDDEN_TAGS = ['script', 'foreignObject', 'iframe', 'object', 'embed'];
  const URL_ATTRIBUTES = ['href', 'xlink:href', 'src'];
  const SAFE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp);base64,/i;

  function isSafeReference(value) {
    const trimmed = String(value || '').trim();
    return trimmed.startsWith('#') || SAFE_DATA_IMAGE.test(trimmed);
  }

  function sanitizeCss(value) {
    return String(value || '')
      .replace(/@import[\s\S]*?(?:;|$)/gi, '')
      .replace(/url\(\s*(['"]?)(?!#|data:image\/(?:png|jpe?g|gif|webp);base64,)[^)]+\1\s*\)/gi, 'none');
  }

  function sanitize(svgText, { isolated = false } = {}) {
    if (!window.DOMPurify) {
      throw new Error('SVG sanitizer is unavailable');
    }

    const clean = window.DOMPurify.sanitize(String(svgText || ''), {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: FORBIDDEN_TAGS,
      // Only isolated Shadow DOM / serialized exports may preserve reserved animation IDs.
      SANITIZE_DOM: !isolated,
      RETURN_DOM_FRAGMENT: true
    });

    const svg = clean.querySelector('svg');
    if (!svg) throw new Error('Asset does not contain an SVG root');

    svg.querySelectorAll('*').forEach((element) => {
      URL_ATTRIBUTES.forEach((attribute) => {
        if (element.hasAttribute(attribute) && !isSafeReference(element.getAttribute(attribute))) {
          element.removeAttribute(attribute);
        }
      });

      if (element.hasAttribute('style')) {
        element.setAttribute('style', sanitizeCss(element.getAttribute('style')));
      }
    });

    svg.querySelectorAll('style').forEach((style) => {
      style.textContent = sanitizeCss(style.textContent);
    });

    return svg.outerHTML;
  }

  function setSvg(element, svgText) {
    if (!element) throw new Error('SVG destination element is missing');
    const clean = sanitize(svgText);
    element.replaceChildren();
    element.insertAdjacentHTML('afterbegin', clean);
    return element.querySelector('svg');
  }

  window.AITSvgSanitizer = Object.freeze({ sanitize, setSvg });
})();
