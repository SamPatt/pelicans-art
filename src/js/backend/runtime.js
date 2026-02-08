(function initRuntime(global) {
  const originalFetch = global.fetch.bind(global);

  function isLocalAssetPath(pathname) {
    return pathname.startsWith('/api/') || pathname.startsWith('/sprites/') || pathname.startsWith('/backgrounds/') || pathname.startsWith('/props/') || pathname.startsWith('/published/');
  }

  function timeoutFetch(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return originalFetch(url, { signal: controller.signal })
      .finally(() => clearTimeout(timeout));
  }

  async function detectMode() {
    const params = new URLSearchParams(global.location.search);
    const forced = params.get('mode');
    if (forced === 'browser') return 'browser';
    if (forced === 'server') return 'server';
    try {
      const response = await timeoutFetch('/api/sprites', 2000);
      if (response.ok) return 'server';
    } catch (_) {}
    return 'browser';
  }

  function createResponseJson(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  function createResponseText(payload, status = 200, contentType = 'text/plain') {
    return new Response(payload, {
      status,
      headers: { 'Content-Type': contentType }
    });
  }

  async function readJsonBody(input, init) {
    if (init?.body) {
      if (typeof init.body === 'string') {
        return init.body ? JSON.parse(init.body) : {};
      }
      if (init.body instanceof FormData) {
        return init.body;
      }
    }

    if (input instanceof Request) {
      const contentType = input.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const text = await input.clone().text();
        return text ? JSON.parse(text) : {};
      }
      if (contentType.includes('multipart/form-data')) {
        return input.clone().formData();
      }
    }

    return {};
  }

  function resolveVariantFromFilename(name) {
    return decodeURIComponent(name.replace(/\.svg$/i, ''));
  }

  async function handleBrowserLocalFetch(backend, input, init, urlObj) {
    const pathname = urlObj.pathname;
    const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
    const parts = pathname.replace(/^\//, '').split('/');

    const respondError = (err, code = 400) => createResponseJson({ error: true, message: err?.message || String(err) }, code);

    try {
      // Static assets
      if (parts[0] === 'sprites' && parts.length >= 3 && parts[2].endsWith('.svg')) {
        const spriteName = decodeURIComponent(parts[1]);
        const variant = resolveVariantFromFilename(parts[2]);
        if (method === 'HEAD') {
          try {
            await backend.getSprite(spriteName, variant);
            return new Response(null, { status: 200 });
          } catch (_) {
            return new Response(null, { status: 404 });
          }
        }
        const svg = await backend.getSprite(spriteName, variant);
        return createResponseText(svg, 200, 'image/svg+xml');
      }

      if (parts[0] === 'sprites' && parts.length >= 3 && parts[2] === 'meta.json') {
        const spriteName = decodeURIComponent(parts[1]);
        const meta = await backend.getSpriteMeta(spriteName);
        return createResponseJson(meta);
      }

      if (parts[0] === 'backgrounds' && parts.length >= 3 && parts[2].endsWith('.svg')) {
        const bgName = decodeURIComponent(parts[1]);
        const orientation = resolveVariantFromFilename(parts[2]);
        if (method === 'HEAD') {
          try {
            await backend.getBackground(bgName, orientation);
            return new Response(null, { status: 200 });
          } catch (_) {
            return new Response(null, { status: 404 });
          }
        }
        const svg = await backend.getBackground(bgName, orientation);
        return createResponseText(svg, 200, 'image/svg+xml');
      }

      if (parts[0] === 'backgrounds' && parts.length === 2 && parts[1].endsWith('.svg')) {
        const bgName = resolveVariantFromFilename(parts[1]);
        const svg = await backend.getBackground(bgName, 'landscape');
        return createResponseText(svg, 200, 'image/svg+xml');
      }

      if (parts[0] === 'props' && parts.length >= 3 && parts[2] === 'prop.svg') {
        const propName = decodeURIComponent(parts[1]);
        if (method === 'HEAD') {
          try {
            await backend.getProp(propName);
            return new Response(null, { status: 200 });
          } catch (_) {
            return new Response(null, { status: 404 });
          }
        }
        const prop = await backend.getProp(propName);
        return createResponseText(prop.svg, 200, 'image/svg+xml');
      }

      if (parts[0] === 'published' && parts[1]?.endsWith('.json')) {
        const skitId = resolveVariantFromFilename(parts[1]);
        const published = await backend.getPublished(skitId);
        return createResponseJson(published);
      }

      // API routes
      if (parts[0] === 'api' && parts[1] === 'sprites') {
        if (parts.length === 2 && method === 'GET') return createResponseJson(await backend.listSprites());
        if (parts.length === 2 && method === 'POST') {
          const body = await readJsonBody(input, init);
          await backend.saveSprite(body.name, body.svg, body.meta || {});
          return createResponseJson({ name: body.name }, 201);
        }
        if (parts.length === 3 && method === 'GET') {
          const name = decodeURIComponent(parts[2]);
          const svg = await backend.getSprite(name, 'front');
          const meta = await backend.getSpriteMeta(name);
          return createResponseJson({ name, svg, meta });
        }
        if (parts.length === 3 && method === 'PUT') {
          const name = decodeURIComponent(parts[2]);
          const body = await readJsonBody(input, init);
          await backend.saveSprite(name, body.svg, body.meta || {});
          return createResponseJson({ name });
        }
        if (parts.length === 3 && method === 'DELETE') {
          const name = decodeURIComponent(parts[2]);
          await backend.deleteSprite(name);
          return new Response(null, { status: 204 });
        }
        if (parts.length === 5 && parts[3] === 'variant' && method === 'PUT') {
          const name = decodeURIComponent(parts[2]);
          const variant = decodeURIComponent(parts[4]);
          const body = await readJsonBody(input, init);
          await backend.saveSpriteVariant(name, variant, body.svg);
          return createResponseJson({ name, variant });
        }
      }

      if (parts[0] === 'api' && parts[1] === 'backgrounds') {
        if (parts.length === 2 && method === 'GET') return createResponseJson(await backend.listBackgrounds());
        if (parts.length === 2 && method === 'POST') {
          const body = await readJsonBody(input, init);
          await backend.saveBackground(body.name, body.orientation || 'landscape', body.svg);
          return createResponseJson({ name: body.name, orientation: body.orientation || 'landscape' }, 201);
        }
        if (parts.length === 3 && method === 'GET') {
          const name = decodeURIComponent(parts[2]);
          const orientation = urlObj.searchParams.get('orientation') || 'landscape';
          return createResponseText(await backend.getBackground(name, orientation), 200, 'image/svg+xml');
        }
        if (parts.length === 3 && method === 'DELETE') {
          const name = decodeURIComponent(parts[2]);
          await backend.deleteBackground(name);
          return new Response(null, { status: 204 });
        }
        if (parts.length === 4 && ['GET', 'HEAD', 'PUT'].includes(method)) {
          const name = decodeURIComponent(parts[2]);
          const orientation = decodeURIComponent(parts[3]);
          if (method === 'GET') return createResponseText(await backend.getBackground(name, orientation), 200, 'image/svg+xml');
          if (method === 'HEAD') {
            try {
              await backend.getBackground(name, orientation);
              return new Response(null, { status: 200 });
            } catch (_) {
              return new Response(null, { status: 404 });
            }
          }
          const body = await readJsonBody(input, init);
          await backend.saveBackground(name, orientation, body.svg);
          return createResponseJson({ name, orientation });
        }
      }

      if (parts[0] === 'api' && parts[1] === 'props') {
        if (parts.length === 2 && method === 'GET') return createResponseJson(await backend.listProps());
        if (parts.length === 2 && method === 'POST') {
          const body = await readJsonBody(input, init);
          await backend.saveProp(body.name, body.svg, body.meta || {});
          return createResponseJson({ name: body.name }, 201);
        }
        if (parts.length === 3 && method === 'GET') return createResponseJson(await backend.getProp(decodeURIComponent(parts[2])));
        if (parts.length === 3 && method === 'PUT') {
          const name = decodeURIComponent(parts[2]);
          const body = await readJsonBody(input, init);
          const existing = await backend.getProp(name).catch(() => ({ meta: {} }));
          await backend.saveProp(name, body.svg || existing.svg || '', body.meta || existing.meta || {});
          return createResponseJson({ name });
        }
        if (parts.length === 3 && method === 'DELETE') {
          await backend.deleteProp(decodeURIComponent(parts[2]));
          return new Response(null, { status: 204 });
        }
      }

      if (parts[0] === 'api' && parts[1] === 'skits') {
        if (parts.length === 2 && method === 'GET') return createResponseJson(await backend.listSkits());
        if (parts.length === 2 && method === 'POST') {
          const body = await readJsonBody(input, init);
          const id = await backend.saveSkit(null, body);
          return createResponseJson({ id, ...body }, 201);
        }
        if (parts.length === 3 && method === 'GET') return createResponseJson(await backend.getSkit(decodeURIComponent(parts[2])));
        if (parts.length === 3 && method === 'PUT') {
          const id = decodeURIComponent(parts[2]);
          const body = await readJsonBody(input, init);
          await backend.saveSkit(id, body);
          return createResponseJson({ id, ...body });
        }
        if (parts.length === 3 && method === 'DELETE') {
          await backend.deleteSkit(decodeURIComponent(parts[2]));
          return new Response(null, { status: 204 });
        }
      }

      if (parts[0] === 'api' && parts[1] === 'agent' && parts[2] === 'generate' && method === 'POST') {
        const body = await readJsonBody(input, init);
        const result = await backend.generateAsset(body);
        return createResponseJson(result);
      }

      if (parts[0] === 'api' && parts[1] === 'publish' && parts.length === 3) {
        const id = decodeURIComponent(parts[2]);
        if (method === 'POST') return createResponseJson(await backend.publishSkit(id));
        if (method === 'GET') return createResponseJson(await backend.getPublished(id));
      }

      if (parts[0] === 'api' && parts[1] === 'tts' && parts.length === 2 && method === 'POST') {
        const body = await readJsonBody(input, init);
        const blob = await backend.previewTts(body.text, body.voice);
        if (!blob) return new Response(null, { status: 204 });
        return new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/mpeg' } });
      }

      if (parts[0] === 'api' && parts[1] === 'voice') {
        if (parts.length === 3 && parts[2] === 'list' && method === 'GET') return createResponseJson(await backend.listVoices());
        if (parts.length === 3 && parts[2] === 'import' && method === 'POST') {
          const body = await readJsonBody(input, init);
          return createResponseJson(await backend.importVoice(body));
        }
        if (parts.length === 3 && parts[2] === 'analyze' && method === 'POST') {
          const formData = await readJsonBody(input, init);
          return createResponseJson(await backend.analyzeAudio(formData));
        }
        if (parts.length === 3 && parts[2] === 'process' && method === 'POST') {
          const body = await readJsonBody(input, init);
          return createResponseJson(await backend.processVoice(body));
        }
        if (parts.length === 3 && parts[2] === 'preview' && method === 'POST') {
          const body = await readJsonBody(input, init);
          const blob = await backend.previewCustomVoice(body.voice, body.text);
          if (!blob) return new Response(null, { status: 204 });
          return new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/wav' } });
        }
        if (parts.length === 3 && parts[2] === 'preview-wav' && method === 'POST') {
          const body = await readJsonBody(input, init);
          const blob = await backend.previewCustomVoiceWav(body.voice, body.text);
          if (!blob) return new Response(null, { status: 204 });
          return new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/wav' } });
        }
        if (parts.length === 4 && parts[3] === 'finalize' && method === 'POST') {
          const body = await readJsonBody(input, init);
          await backend.finalizeVoice(decodeURIComponent(parts[2]), body.winner);
          return createResponseJson({ ok: true });
        }
        if (parts.length === 4 && parts[3] === 'file' && method === 'GET') {
          const blob = await backend.getVoiceFile(decodeURIComponent(parts[2]));
          return new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } });
        }
        if (parts.length === 4 && parts[3] === 'wav' && method === 'GET') {
          const blob = await backend.getVoiceWav(decodeURIComponent(parts[2]));
          return new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/wav' } });
        }
      }

      return originalFetch(input, init);
    } catch (err) {
      return respondError(err, 500);
    }
  }

  async function initBackend() {
    const mode = await detectMode();
    let backend;

    if (mode === 'server') {
      backend = new global.AITServerBackend({ fetchImpl: originalFetch });
      backend.mode = 'server';
    } else {
      backend = new global.AITBrowserBackend({ fetchImpl: originalFetch });
      await backend.init();
      backend.mode = 'browser';
    }

    global.backend = backend;
    global.__aitMode = mode;
    global.dispatchEvent(new CustomEvent('ait:backend-ready', { detail: { mode, backend } }));
    return backend;
  }

  const backendPromise = initBackend();

  global.fetch = async function patchedFetch(input, init) {
    let urlObj;
    try {
      const url = typeof input === 'string' ? input : input.url;
      urlObj = new URL(url, global.location.href);
    } catch (_) {
      return originalFetch(input, init);
    }

    if (!isLocalAssetPath(urlObj.pathname)) {
      return originalFetch(input, init);
    }

    const backend = await backendPromise;
    if (backend.mode !== 'browser') {
      return originalFetch(input, init);
    }

    return handleBrowserLocalFetch(backend, input, init, urlObj);
  };

  global.AITRuntime = {
    backendPromise,
    originalFetch,
    detectMode,
    initBackend
  };
})(window);
