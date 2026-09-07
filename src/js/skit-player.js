    console.log('[Player] Script started');

    // === IndexedDB storage (for browser mode asset loading) ===
    let _idbStorage = null;
    async function getIDBStorage() {
      if (_idbStorage) return _idbStorage;
      if (!window.AITStorageIDB) return null;
      try {
        const s = new window.AITStorageIDB();
        await s.init();
        _idbStorage = s;
        return s;
      } catch (e) { return null; }
    }

    // === STATE ===
    const characters = {};
    const props = {}; // propId -> { el, x, y, scale, rotation, visible, layer, heldBy, sprite }
    const propSvgCache = new Map(); // propName -> svgText
    const camera = { x: 50, y: 50, zoom: 1, follow: null };
    let currentSkit = null;
    let currentSkitName = null;

    // Valid TTS voice IDs - AI-generated skits must use one of these
    const VALID_VOICES = ['alba', 'marius', 'javert', 'jean', 'fantine', 'cosette', 'eponine', 'azelma'];
    const DEFAULT_VOICE = 'alba';
    let isPlaying = false;
    let startTime = 0;
    let animationId = null;
    let triggeredBeats = new Set();
    let audioContext, analyser, dataArray;
    const audioCache = new Map();
    
    // Web Audio API buffers for mobile compatibility
    let currentSourceNode = null;
    let currentGainNode = null;
    
    // === SHOT PRESETS ===
    const shotPresets = {
      'wide': { zoom: 1, y: 50, frameBoth: true },
      'two-shot': { zoom: 1.4, y: 60, frameBoth: true },
      'closeup': { zoom: 2.2 },
      'extreme-closeup': { zoom: 3 },
      'medium': { zoom: 1.6 }
    };
    
    // === CAMERA SYSTEM ===
    let cameraAnimation = null;
    
    function clampCamera() {
      const marginX = 50 / camera.zoom;
      const marginY = 50 / camera.zoom;
      camera.x = Math.max(marginX, Math.min(100 - marginX, camera.x));
      camera.y = Math.max(marginY, Math.min(100 - marginY, camera.y));
    }
    
    function updateCamera() {
      const stage = document.getElementById('stage');
      clampCamera();
      const tx = 50 - camera.x;
      const ty = 50 - camera.y;
      stage.style.transformOrigin = `${camera.x}% ${camera.y}%`;
      stage.style.transform = `translate(${tx}%, ${ty}%) scale(${camera.zoom})`;
    }
    
    function animateCameraTo(targetX, targetY, duration = 1000) {
      if (cameraAnimation) cancelAnimationFrame(cameraAnimation);
      const startX = camera.x, startY = camera.y;
      const startTime = performance.now();
      
      function tick(now) {
        const t = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        camera.x = startX + (targetX - startX) * ease;
        camera.y = startY + (targetY - startY) * ease;
        updateCamera();
        if (t < 1) cameraAnimation = requestAnimationFrame(tick);
      }
      cameraAnimation = requestAnimationFrame(tick);
    }
    
    // Measure SVG geometry in stage coordinates. Screen-space measurements include
    // nested SVG transforms, facing direction and character scale; removing the
    // stage rectangle also removes the current camera transform.
    function stageBounds(node) {
      const stageRect = document.getElementById('stage').getBoundingClientRect();
      if (!stageRect.width || !stageRect.height || !node) return null;
      let rect;
      try {
        const box = node.getBBox();
        const matrix = node.getScreenCTM();
        if (!matrix || (!box.width && !box.height)) return null;
        const points = [[box.x, box.y], [box.x + box.width, box.y],
          [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]
          .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
        rect = { left: Math.min(...points.map(p => p.x)), right: Math.max(...points.map(p => p.x)),
          top: Math.min(...points.map(p => p.y)), bottom: Math.max(...points.map(p => p.y)) };
      } catch (_) { rect = node.getBoundingClientRect(); }
      return {
        left: (rect.left - stageRect.left) / stageRect.width * 100,
        right: (rect.right - stageRect.left) / stageRect.width * 100,
        top: (rect.top - stageRect.top) / stageRect.height * 100,
        bottom: (rect.bottom - stageRect.top) / stageRect.height * 100
      };
    }

    function unionBounds(bounds) {
      const valid = bounds.filter(Boolean);
      if (!valid.length) return null;
      return { left: Math.min(...valid.map(b => b.left)), right: Math.max(...valid.map(b => b.right)),
        top: Math.min(...valid.map(b => b.top)), bottom: Math.max(...valid.map(b => b.bottom)) };
    }

    function getCharacterFace(char) {
      const features = char.el.querySelectorAll('#eye-left-white, #eye-right-white, #mouth-closed');
      let bounds = unionBounds([...features].map(stageBounds));
      if (!bounds) bounds = unionBounds([...char.el.querySelectorAll('#head, #head-top, #head-bottom')].map(stageBounds));
      if (bounds) return { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
      // Older sprites without face IDs retain a scaled upper-body fallback.
      bounds = stageBounds(char.el.querySelector('svg')) || stageBounds(char.el);
      return bounds ? { x: (bounds.left + bounds.right) / 2, y: bounds.top + (bounds.bottom - bounds.top) * 0.35 }
        : { x: char.x, y: 50 };
    }

    function frameCharacters(chars, maximumZoom) {
      const bounds = unionBounds(chars.map(c => stageBounds(c.el.querySelector('svg')) || stageBounds(c.el)));
      if (!bounds) { camera.x = 50; camera.y = 50; return; }
      // Reserve room around the entire cast, including tall hats and short actors.
      // The extra bottom margin keeps feet clear of the caption area.
      camera.zoom = Math.max(1, Math.min(maximumZoom, 88 / Math.max(1, bounds.right - bounds.left),
        76 / Math.max(1, bounds.bottom - bounds.top)));
      camera.x = (bounds.left + bounds.right) / 2;
      camera.y = (bounds.top + bounds.bottom) / 2 + 5 / camera.zoom;
    }

    function shot(type, who = null, hardCut = true) {
      const preset = shotPresets[type];
      if (!preset) return;

      const stage = document.getElementById('stage');
      if (cameraAnimation) { cancelAnimationFrame(cameraAnimation); cameraAnimation = null; }

      if (hardCut) stage.style.transition = 'none';

      camera.zoom = preset.zoom;

      const visibleChars = Object.entries(characters).filter(([, c]) => !c.el.classList.contains('offscreen'));
      if (type === 'wide') {
        camera.x = 50; camera.y = 50; camera.follow = null;
      } else if (preset.frameBoth) {
        frameCharacters(visibleChars.map(([, c]) => c), preset.zoom);
        camera.follow = null;
      } else if (who && characters[who]) {
        const face = getCharacterFace(characters[who]);
        camera.x = face.x; camera.y = face.y; camera.follow = who;
      } else if (visibleChars.length === 1) {
        const [name, char] = visibleChars[0];
        const face = getCharacterFace(char);
        camera.x = face.x; camera.y = face.y; camera.follow = name;
      } else {
        frameCharacters(visibleChars.map(([, c]) => c), preset.zoom);
        camera.follow = null;
      }

      updateCamera();

      if (hardCut) {
        stage.offsetHeight; // force reflow
        stage.style.transition = 'transform 0.6s ease-out';
      }
    }
    
    function followCharacter(name) {
      if (!characters[name]) return;
      camera.follow = name;
      const face = getCharacterFace(characters[name]);
      animateCameraTo(face.x, face.y, 600);
    }
    
    // === CHARACTER SYSTEM ===
    const CACHE_BUSTER = Date.now();

    // Set background with fallback for legacy flat file structure
    async function setBackground(bgName, orientation = 'landscape') {
      const bgEl = document.getElementById('background');
      const viewport = document.getElementById('viewport');
      const newPath = `backgrounds/${bgName}/${orientation}.svg?v=${CACHE_BUSTER}`;
      const legacyPath = `backgrounds/${bgName}.svg?v=${CACHE_BUSTER}`;

      // Update viewport orientation
      if (orientation === 'landscape') {
        viewport.classList.add('landscape');
      } else {
        viewport.classList.remove('landscape');
      }

      // Notify parent frame of orientation (for embed mode)
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'skit-orientation', orientation }, '*');
      }

      // Published skits may carry every background used by their shot list.
      // Prefer those self-contained assets before consulting browser storage or disk.
      const publishedBackground = window.publishedAssets?.backgrounds?.[bgName];
      if (publishedBackground) {
        bgEl.onerror = null;
        bgEl.src = publishedBackground;
        return;
      }

      // Try IndexedDB first (browser mode)
      const idb = await getIDBStorage();
      if (idb) {
        try {
          const rec = await idb.getBackgroundRecord(bgName);
          const svg = rec?.orientations?.[orientation] || rec?.orientations?.landscape || Object.values(rec?.orientations || {})[0];
          if (svg) {
            const blob = new Blob([svg], { type: 'image/svg+xml' });
            bgEl.src = URL.createObjectURL(blob);
            return;
          }
        } catch (e) { /* fall through to filesystem */ }
      }

      // Try new path first, fall back to legacy on error
      bgEl.onerror = function() {
        if (!this.src.includes(legacyPath)) {
          console.log(`Background not found at ${newPath}, trying legacy path`);
          this.src = legacyPath;
        }
      };
      bgEl.src = newPath;
    }

    async function loadSprite(spriteName, view = 'front') {
      const bundledSvg = getPublishedSpriteSvg(spriteName, view);
      if (bundledSvg) return bundledSvg;

      // Try IndexedDB (browser mode)
      const idb = await getIDBStorage();
      if (idb) {
        try {
          const rec = await idb.getSpriteRecord(spriteName);
          const svg = rec?.variants?.[view] || rec?.variants?.front || Object.values(rec?.variants || {})[0];
          if (svg) return svg;
        } catch (e) { /* fall through to filesystem */ }
      }

      const spritePath = `sprites/${spriteName}/${view}.svg?v=${CACHE_BUSTER}`;
      const response = await fetch(spritePath);
      const svgText = await response.text();
      return svgText;
    }

    function decodeDataUrlToText(dataUrl) {
      const base64 = dataUrl.split(',')[1];
      return decodeURIComponent(escape(atob(base64)));
    }

    function getPublishedSpriteSvg(spriteName, view = 'front') {
      const key = `${spriteName}-${view}`;
      const dataUrl = window.publishedAssets?.sprites?.[key];
      if (!dataUrl) return null;
      return decodeDataUrlToText(dataUrl);
    }
    
    async function createCharacter(name, config) {
      const stage = document.getElementById('stage');
      const el = document.createElement('div');
      el.className = 'character' + (config.startOffscreen ? ' offscreen' : '');
      el.id = `char-${name}`;
      el.dataset.sprite = config.sprite;
      el.dataset.voice = config.voice;

      // Use startX/startY for initial position if specified (for offscreen starts)
      // Otherwise use x/y as the position
      const initialX = config.startX !== undefined ? config.startX : config.x;
      el.style.left = `${initialX}%`;
      const initialY = config.startY !== undefined ? config.startY : (config.y ?? 88);
      el.style.bottom = `${100 - initialY}%`;

      // Add position class for head rotation direction (based on target x, not start)
      el.classList.add(config.x < 50 ? 'pos-left' : 'pos-right');

      // Apply scale if specified
      if (config.scale) {
        el.style.height = `${40 * config.scale}%`;
      }

      // Load sprite as inline SVG
      const svgText = await loadSprite(config.sprite, 'front');
      window.AITSvgSanitizer.setSvg(el, svgText);

      // Voice metadata now comes from bundled spriteMeta/meta.json (not data-meta in SVG).
      let metaVoice = window.publishedAssets?.spriteMeta?.[config.sprite]?.voice || null;

      // Try IndexedDB for sprite meta (browser mode)
      if (!metaVoice) {
        const idb = await getIDBStorage();
        if (idb) {
          try {
            const rec = await idb.getSpriteRecord(config.sprite);
            if (rec?.meta?.voice) metaVoice = rec.meta.voice;
          } catch (e) { /* fall through */ }
        }
      }

      // Fall back to local meta.json when bundled spriteMeta is not available.
      if (!metaVoice) {
        try {
          const metaResp = await fetch(`sprites/${config.sprite}/meta.json?v=${CACHE_BUSTER}`);
          if (metaResp.ok) {
            const meta = await metaResp.json();
            metaVoice = meta.voice || null;
          }
        } catch (e) {
          // Meta not available - that's fine, use defaults
        }
      }

      stage.appendChild(el);

      // Create mouth group for unified mouth positioning
      const svg = el.querySelector('svg');
      if (svg) {
        svg.style.animationDelay = `${-(Math.random() * 7).toFixed(1)}s`;
        createMouthGroup(svg);
      }

      // Resolve this sprite's casting for the active browser voice provider.
      // Legacy unscoped IDs are used only if that provider understands them.
      const ttsSettings = getTtsSettings() || {};
      const castMetaVoice = { assignments: config.voiceAssignments || {} };
      const castAssignedVoice = window.AITTtsProvider?.getAssignedVoiceConfig?.(castMetaVoice, ttsSettings) || null;
      const spriteAssignedVoice = window.AITTtsProvider?.getAssignedVoiceConfig?.(metaVoice, ttsSettings) || null;
      const assignedVoice = castAssignedVoice || spriteAssignedVoice;
      const resolvedVoice = castAssignedVoice || window.AITTtsProvider?.resolveVoiceConfig?.(metaVoice, ttsSettings, config.voice) || metaVoice || {};
      const castVoiceIsCompatible = window.AITTtsProvider?.isVoiceCompatible?.(config.voice, ttsSettings) || false;
      const voiceId = resolvedVoice.id || config.voice || DEFAULT_VOICE;
      const voiceVolume = resolvedVoice.volume !== undefined ? resolvedVoice.volume : 1.0;
      const voiceSpeed = resolvedVoice.speed !== undefined ? resolvedVoice.speed : 1.0;
      const voicePitch = resolvedVoice.pitch !== undefined ? resolvedVoice.pitch : 0;

      // Capture original face values for transform-based emotion system
      const originalFaceValues = captureOriginalFaceValues(el);

      characters[name] = {
        x: initialX, // Current position (may be offscreen initially)
        targetX: config.x, // Where the character "belongs" (for enter actions)
        baseY: config.startY ?? config.y ?? 88, // character feet position from top
        sprite: config.sprite,
        voice: voiceId,
        voiceAssigned: Boolean(assignedVoice || castVoiceIsCompatible),
        volume: voiceVolume,
        speed: voiceSpeed,
        pitch: voicePitch,
        scale: config.scale || 1,
        el: el,
        originalFaceValues: originalFaceValues,
        currentEmotion: 'neutral'
      };

      // Auto-face character toward center (left characters face right, right face left)
      if (config.x < 50) {
        el.classList.add('facing-right');
      } else {
        el.classList.add('facing-left');
      }
    }
    
    async function setCharacterView(name, view) {
      const char = characters[name];
      if (!char) return;
      const svgText = await loadSprite(char.sprite, view);
      window.AITSvgSanitizer.setSvg(char.el, svgText);
    }
    
    function setEyeDirection(charName, direction) {
      const char = characters[charName];
      if (!char || !char.el) return;

      char.el.classList.remove('look-left', 'look-right', 'look-up', 'look-down');

      // Handle compound direction object {h: 'left'|'right', v: 'up'|'down'}
      if (typeof direction === 'object' && direction !== null) {
        const isFlipped = char.el.classList.contains('facing-left');
        if (direction.h) {
          let hDir = direction.h;
          if (isFlipped) hDir = hDir === 'left' ? 'right' : 'left';
          char.el.classList.add(`look-${hDir}`);
        }
        if (direction.v) {
          char.el.classList.add(`look-${direction.v}`);
        }
        return;
      }

      // Handle simple direction string
      if (['left', 'right', 'up', 'down'].includes(direction)) {
        // Invert left/right for flipped (facing-left) characters
        let actualDir = direction;
        if (char.el.classList.contains('facing-left') && (direction === 'left' || direction === 'right')) {
          actualDir = direction === 'left' ? 'right' : 'left';
        }
        char.el.classList.add(`look-${actualDir}`);
      }
    }
    
    function setFacing(charName, direction) {
      const char = characters[charName];
      if (!char || !char.el) return;
      
      char.el.classList.remove('facing-left', 'facing-right');
      if (direction === 'left') char.el.classList.add('facing-left');
      if (direction === 'right') char.el.classList.add('facing-right');
    }
    
    // Blinking system
    const blinkOriginalValues = new Map();
    let globalBlinkTimer = null;

    // Helper: <circle> elements use 'r', <ellipse> elements use 'ry'
    // Some sprites have spurious 'ry' attributes on circles, so check tagName
    function isCircleElement(el) {
      return el && el.tagName.toLowerCase() === 'circle';
    }

    function getPupilRy(el) {
      if (!el) return '5';
      if (isCircleElement(el)) {
        return el.getAttribute('r') || '5';
      }
      return el.getAttribute('ry') || el.getAttribute('r') || '5';
    }

    function getPupilUsesR(el, fallback) {
      if (!el) return !!fallback;
      if (typeof fallback === 'boolean') return fallback;
      return isCircleElement(el);
    }

    function setPupilBlinkTransition(el, usesR, duration, easing) {
      if (!el) return;
      const attr = usesR ? 'r' : 'ry';
      el.style.transition = `${attr} ${duration}ms ${easing}`;
    }

    function setPupilBlinkValue(el, usesR, value) {
      if (!el) return;
      el.setAttribute(usesR ? 'r' : 'ry', value);
    }

    function blink(charName) {
      const char = characters[charName];
      if (!char || !char.el) return;

      const el = char.el;
      const eyeLeftWhite = el.querySelector('#eye-left-white');
      const eyeRightWhite = el.querySelector('#eye-right-white');
      const eyeLeftPupil = el.querySelector('#eye-left-pupil');
      const eyeRightPupil = el.querySelector('#eye-right-pupil');

      // Store original values if not stored
      if (!blinkOriginalValues.has(charName)) {
        const leftUsesR = getPupilUsesR(eyeLeftPupil);
        const rightUsesR = getPupilUsesR(eyeRightPupil);
        blinkOriginalValues.set(charName, {
          leftWhiteRy: eyeLeftWhite?.getAttribute('ry') || '7',
          rightWhiteRy: eyeRightWhite?.getAttribute('ry') || '7',
          leftPupilRy: getPupilRy(eyeLeftPupil),
          rightPupilRy: getPupilRy(eyeRightPupil),
          pupilLUsesR: leftUsesR,
          pupilRUsesR: rightUsesR
        });
      }

      const closeDuration = 60;
      const openDuration = 180;
      const orig = blinkOriginalValues.get(charName) || {};
      const leftUsesR = getPupilUsesR(eyeLeftPupil, orig.pupilLUsesR);
      const rightUsesR = getPupilUsesR(eyeRightPupil, orig.pupilRUsesR);

      // Phase 1: close fast
      [eyeLeftWhite, eyeRightWhite].forEach((el) => {
        if (el) el.style.transition = `ry ${closeDuration}ms ease-in`;
      });
      setPupilBlinkTransition(eyeLeftPupil, leftUsesR, closeDuration, 'ease-in');
      setPupilBlinkTransition(eyeRightPupil, rightUsesR, closeDuration, 'ease-in');

      if (eyeLeftWhite) eyeLeftWhite.setAttribute('ry', '0.3');
      if (eyeRightWhite) eyeRightWhite.setAttribute('ry', '0.3');
      setPupilBlinkValue(eyeLeftPupil, leftUsesR, '0.1');
      setPupilBlinkValue(eyeRightPupil, rightUsesR, '0.1');

      // Phase 2: open slower and restore current emotion-adjusted values
      setTimeout(() => {
        const latest = blinkOriginalValues.get(charName);
        if (!latest) return;
        const latestLeftUsesR = getPupilUsesR(eyeLeftPupil, latest.pupilLUsesR);
        const latestRightUsesR = getPupilUsesR(eyeRightPupil, latest.pupilRUsesR);

        [eyeLeftWhite, eyeRightWhite].forEach((el) => {
          if (el) el.style.transition = `ry ${openDuration}ms ease-out`;
        });
        setPupilBlinkTransition(eyeLeftPupil, latestLeftUsesR, openDuration, 'ease-out');
        setPupilBlinkTransition(eyeRightPupil, latestRightUsesR, openDuration, 'ease-out');

        if (eyeLeftWhite) eyeLeftWhite.setAttribute('ry', latest.leftWhiteRy);
        if (eyeRightWhite) eyeRightWhite.setAttribute('ry', latest.rightWhiteRy);
        setPupilBlinkValue(eyeLeftPupil, latestLeftUsesR, latest.leftPupilRy);
        setPupilBlinkValue(eyeRightPupil, latestRightUsesR, latest.rightPupilRy);

        setTimeout(() => {
          [eyeLeftWhite, eyeRightWhite, eyeLeftPupil, eyeRightPupil].forEach((el) => {
            if (el) el.style.transition = '';
          });
        }, openDuration + 10);
      }, closeDuration);
    }

    function startGlobalBlinking() {
      stopGlobalBlinking();

      function scheduleNext() {
        const delay = 3000 + Math.random() * 4000; // 3-7 seconds
        globalBlinkTimer = setTimeout(() => {
          const charNames = Object.keys(characters);
          if (!charNames.length) {
            scheduleNext();
            return;
          }

          if (Math.random() < 0.4) {
            charNames.forEach(name => blink(name));
          } else {
            blink(charNames[Math.floor(Math.random() * charNames.length)]);
          }
          scheduleNext();
        }, delay);
      }

      scheduleNext();
    }

    function stopGlobalBlinking() {
      if (globalBlinkTimer) {
        clearTimeout(globalBlinkTimer);
        globalBlinkTimer = null;
      }
    }

    function resetHeadTransforms(charEl) {
      if (!charEl) return;
      const svg = charEl.querySelector('svg');
      if (!svg || svg.dataset.photoSprite === 'true') return;
      const headTop = svg.querySelector('#head-top');
      const headBottom = svg.querySelector('#head-bottom');
      if (headTop) headTop.style.transform = '';
      if (headBottom) headBottom.style.transform = '';
    }

    function applyHeadBobAndRotation(charEl, svg, normalizedAmp) {
      if (!charEl || !svg || svg.dataset.photoSprite === 'true') return;
      const t = performance.now();
      const bob = Math.sin(t * 0.008) * normalizedAmp * 1.2;
      const rotDeg = charEl.classList.contains('pos-left') ? -8 : 8;
      const headTop = svg.querySelector('#head-top');
      const headBottom = svg.querySelector('#head-bottom');
      if (headTop) headTop.style.transform = `translateY(${bob}px) rotate(${rotDeg}deg)`;
      if (headBottom) headBottom.style.transform = `translateY(${bob}px) rotate(${rotDeg}deg)`;
    }

    // === PROP SYSTEM ===
    const propMetaCache = new Map();

    async function loadPropMeta(propName) {
      if (propMetaCache.has(propName)) {
        return propMetaCache.get(propName);
      }
      // Check published assets first
      if (window.publishedAssets?.propMeta?.[propName]) {
        const meta = window.publishedAssets.propMeta[propName];
        propMetaCache.set(propName, meta);
        return meta;
      }

      // Try IndexedDB (browser mode)
      const idb = await getIDBStorage();
      if (idb) {
        try {
          const rec = await idb.getPropRecord(propName);
          if (rec?.meta) {
            propMetaCache.set(propName, rec.meta);
            return rec.meta;
          }
        } catch (e) { /* fall through */ }
      }

      // Fall back to meta.json
      const metaPath = `props/${propName}/meta.json?v=${CACHE_BUSTER}`;
      try {
        const response = await fetch(metaPath);
        if (!response.ok) throw new Error('Meta not found');
        const meta = await response.json();
        propMetaCache.set(propName, meta);
        return meta;
      } catch (e) {
        console.warn(`Failed to load prop meta: ${propName}`, e);
        const defaultMeta = { holdOffset: [0, 0], defaultScale: 1 };
        propMetaCache.set(propName, defaultMeta);
        return defaultMeta;
      }
    }

    async function loadPropSvg(propName) {
      if (propSvgCache.has(propName)) {
        return propSvgCache.get(propName);
      }
      // Check published assets first
      if (window.publishedAssets?.props?.[propName]) {
        const dataUrl = window.publishedAssets.props[propName];
        const base64 = dataUrl.split(',')[1];
        const svgText = decodeURIComponent(escape(atob(base64)));
        propSvgCache.set(propName, svgText);
        return svgText;
      }

      // Try IndexedDB (browser mode)
      const idb = await getIDBStorage();
      if (idb) {
        try {
          const rec = await idb.getPropRecord(propName);
          if (rec?.svg) {
            propSvgCache.set(propName, rec.svg);
            return rec.svg;
          }
        } catch (e) { /* fall through */ }
      }

      const propPath = `props/${propName}/prop.svg?v=${CACHE_BUSTER}`;
      try {
        const response = await fetch(propPath);
        if (!response.ok) throw new Error('Prop not found');
        const svgText = await response.text();
        propSvgCache.set(propName, svgText);
        return svgText;
      } catch (e) {
        console.warn(`Failed to load prop SVG: ${propName}`, e);
        // Return a placeholder
        return `<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="5" width="40" height="40" fill="#888" rx="4"/>
        </svg>`;
      }
    }

    async function createProp(id, config) {
      const stage = document.getElementById('stage');
      const el = document.createElement('div');
      el.className = 'prop' + (config.visible ? '' : ' hidden');
      el.id = `prop-${id}`;
      el.dataset.prop = config.prop;

      // Set layer
      if (config.layer === 'foreground') {
        el.classList.add('foreground');
      }

      // Load prop SVG and meta
      const [svgText, meta] = await Promise.all([
        loadPropSvg(config.prop),
        loadPropMeta(config.prop)
      ]);
      window.AITSvgSanitizer.setSvg(el, svgText);

      // Set initial position
      const x = config.x ?? 50;
      const y = config.y ?? 80;
      el.style.left = `${x}%`;
      el.style.bottom = `${100 - y}%`;

      // Get scale from config or meta default
      const scale = config.scale ?? meta.defaultScale ?? 1;
      if (scale !== 1) {
        el.style.transform = `translateX(-50%) scale(${scale})`;
      }

      stage.appendChild(el);

      props[id] = {
        el: el,
        x: x,
        y: y,
        scale: scale,
        rotation: 0,
        visible: config.visible || false,
        layer: config.layer || 'background',
        heldBy: null,
        sprite: config.prop,
        flipped: false,
        holdOffset: config.holdOffset || meta.holdOffset || [0, 0]
      };

      return props[id];
    }

    function updatePropPosition(id) {
      const prop = props[id];
      if (!prop) return;

      if (prop.heldBy && characters[prop.heldBy]) {
        // Follow character - position near their hand
        const char = characters[prop.heldBy];
        const charEl = char.el;
        const isFlipped = charEl.classList.contains('facing-left');
        const charScale = char.scale || 1;

        // Use prop's holdOffset from meta.json
        // holdOffset[0] = X offset (positive = right of character center)
        // holdOffset[1] = Y offset (negative = higher up)
        const holdOffsetX = prop.holdOffset[0] || 0;
        const holdOffsetY = prop.holdOffset[1] || 0;

        // Apply X offset, flip direction if character is facing left
        const handOffsetX = isFlipped ? -holdOffsetX : holdOffsetX;
        const heldX = char.x + handOffsetX * charScale * 0.1; // Scale factor to convert to %

        // Base hand height calculation
        // Characters are at bottom:12% with height:40%, hands roughly at waist
        const baseBottom = 22 + (charScale - 1) * 8;
        // Apply Y offset (negative holdOffsetY means higher up)
        const adjustedBottom = baseBottom - holdOffsetY * charScale * 0.1;
        const heldY = 100 - adjustedBottom;

        // Update stored coordinates so drop without 'at' works correctly
        prop.x = heldX;
        prop.y = heldY;
        prop.el.style.left = `${heldX}%`;
        prop.el.style.bottom = `${adjustedBottom}%`;
      } else {
        prop.el.style.left = `${prop.x}%`;
        prop.el.style.bottom = `${100 - prop.y}%`;
      }

      // Apply scale, rotation, and flip
      let transform = 'translateX(-50%)';
      if (prop.flipped) transform += ' scaleX(-1)';
      if (prop.scale !== 1) transform += ` scale(${prop.scale})`;
      if (prop.rotation !== 0) transform += ` rotate(${prop.rotation}deg)`;
      prop.el.style.transform = transform;
    }

    function spawnProp(id, at, who) {
      const prop = props[id];
      if (!prop) return;

      unmountProp(prop);

      if (at) {
        prop.x = at[0];
        prop.y = at[1];
      }
      prop.visible = true;
      prop.el.classList.remove('hidden');

      // If spawning held by someone, immediately attach
      if (who && characters[who]) {
        prop.heldBy = who;
        prop.el.classList.add('held');
      }

      updatePropPosition(id);
    }

    function despawnProp(id) {
      const prop = props[id];
      if (!prop) return;

      prop.visible = false;
      prop.el.classList.add('hidden');
      if (prop.mountEl) prop.mountEl.style.display = 'none';
    }

    function moveProp(id, to, duration = 1) {
      const prop = props[id];
      if (!prop) return;

      unmountProp(prop);

      prop.el.style.transition = `left ${duration}s ease-in-out, bottom ${duration}s ease-in-out`;
      prop.x = to[0];
      prop.y = to[1];
      updatePropPosition(id);

      // Reset transition after animation
      setTimeout(() => {
        prop.el.style.transition = '';
      }, duration * 1000);
    }

    function unmountProp(prop) {
      prop.mountEl?.remove();
      prop.mountEl = null;
      prop.el.style.removeProperty('display');
    }

    // SVG-space mounting lets a prop inherit the actor's sway and body animation.
    function mountProp(id, who, mount) {
      const prop = props[id];
      const body = characters[who]?.el.querySelector('svg #body');
      if (!prop || !body || !Array.isArray(mount) || mount.length !== 3 ||
          !mount.every(Number.isFinite) || mount[2] <= 0) return;
      unmountProp(prop);
      const source = prop.el.querySelector('svg');
      if (!source) return;
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.dataset.mountedProp = id;
      group.setAttribute('transform', `translate(${mount[0]} ${mount[1]}) scale(${mount[2]})`);
      const art = source.cloneNode(true);
      const box = source.viewBox.baseVal;
      art.setAttribute('width', box.width || 100);
      art.setAttribute('height', box.height || 100);
      // Nested SVG must not acquire the actor's full-size/sway CSS a second time.
      art.style.width = `${box.width || 100}px`;
      art.style.height = `${box.height || 100}px`;
      art.style.animation = 'none';
      group.appendChild(art);
      body.appendChild(group);
      prop.heldBy = null;
      prop.mountEl = group;
      prop.el.style.display = 'none';
      if (!prop.visible) group.style.display = 'none';
      if (prop.animation) group.classList.add(`animate-${prop.animation}`);
    }

    function holdProp(id, who, holdOffset) {
      const prop = props[id];
      if (!prop || !characters[who]) return;

      unmountProp(prop);

      prop.heldBy = who;
      // Allow beat to override holdOffset
      if (holdOffset) {
        prop.holdOffset = holdOffset;
      }
      prop.el.classList.add('held');
      updatePropPosition(id);
    }

    function dropProp(id, at) {
      const prop = props[id];
      if (!prop) return;

      unmountProp(prop);

      prop.heldBy = null;
      prop.el.classList.remove('held');

      if (at) {
        prop.x = at[0];
        prop.y = at[1];
      }
      updatePropPosition(id);
    }

    function rotateProp(id, angle, duration = 0.5) {
      const prop = props[id];
      if (!prop) return;

      prop.el.style.transition = `transform ${duration}s ease-out`;
      prop.rotation = angle;
      updatePropPosition(id);

      setTimeout(() => {
        prop.el.style.transition = '';
      }, duration * 1000);
    }

    function scaleProp(id, scale, duration = 0.5) {
      const prop = props[id];
      if (!prop) return;

      prop.el.style.transition = `transform ${duration}s ease-out`;
      prop.scale = scale;
      updatePropPosition(id);

      setTimeout(() => {
        prop.el.style.transition = '';
      }, duration * 1000);
    }

    function animateProp(id, animation, duration = 2) {
      const prop = props[id];
      if (!prop) return;

      clearTimeout(prop.animationTimeout);
      const targets = [prop.el, prop.mountEl].filter(Boolean);
      targets.forEach(el => el.classList.remove('animate-bounce', 'animate-spin', 'animate-shake', 'animate-pulse', 'animate-float', 'animate-radio'));
      prop.animation = animation || null;

      // Add new animation
      if (animation) {
        targets.forEach(el => el.classList.add(`animate-${animation}`));

        // Remove after duration
        prop.animationTimeout = setTimeout(() => animateProp(id, null), duration * 1000);
      }
    }

    function flipProp(id, flipped) {
      const prop = props[id];
      if (!prop) return;

      // If explicit value provided, use it; otherwise toggle
      if (flipped !== undefined) {
        prop.flipped = flipped;
      } else {
        prop.flipped = !prop.flipped;
      }
      updatePropPosition(id);
    }

    function clearAllProps() {
      Object.keys(props).forEach(id => {
        clearTimeout(props[id].animationTimeout);
        props[id].mountEl?.remove();
        if (props[id].el) {
          props[id].el.remove();
        }
        delete props[id];
      });
    }

    // Update held props each frame to follow characters
    function updateHeldProps() {
      Object.keys(props).forEach(id => {
        if (props[id].heldBy) {
          updatePropPosition(id);
        }
      });
    }

    function getAmplitude() {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      return sum / dataArray.length;
    }
    
    function moveCharacter(name, toX, duration = 1) {
      const char = characters[name];
      if (!char) return;

      char.el.style.transition = `left ${duration}s ease-in-out, opacity 0.3s`;
      const previousX = char.x;
      const previousFace = camera.follow === name ? getCharacterFace(char) : null;
      char.x = toX;
      char.el.style.left = `${toX}%`;

      // Update position class for head rotation direction
      char.el.classList.remove('pos-left', 'pos-right');
      char.el.classList.add(toX < 50 ? 'pos-left' : 'pos-right');

      if (camera.follow === name) {
        animateCameraTo(previousFace.x + toX - previousX, previousFace.y, duration * 1000);
      }

      // Update any held props to follow with same transition
      updateHeldPropsForCharacter(name, duration);
    }

    function enterCharacter(name, from, toX) {
      const char = characters[name];
      if (!char) return;

      // Use provided toX, or fall back to character's target position
      const targetX = toX !== undefined ? toX : (char.targetX !== undefined ? char.targetX : char.x);

      const startX = from === 'left' ? -20 : 120;

      // Start offscreen
      char.el.style.transition = 'none';
      char.el.style.left = `${startX}%`;
      char.el.style.opacity = '0';
      char.el.classList.remove('offscreen');

      // Position any held props at start position (no transition)
      char.x = startX;
      updateHeldPropsForCharacter(name, 0);

      char.el.offsetHeight; // reflow

      // Animate in
      char.el.style.transition = 'left 1.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out';
      char.el.style.opacity = '1';
      char.x = targetX;
      char.el.style.left = `${targetX}%`;

      // Animate held props along with character
      updateHeldPropsForCharacter(name, 1);
    }

    function exitCharacter(name, to) {
      const char = characters[name];
      if (!char) return;
      char.x = to === 'left' ? -20 : 120;
      char.el.style.left = `${char.x}%`;

      // Update any held props to follow
      updateHeldPropsForCharacter(name, 1);
    }

    function updateHeldPropsForCharacter(charName, duration) {
      Object.keys(props).forEach(id => {
        if (props[id].heldBy === charName) {
          if (duration > 0) {
            props[id].el.style.transition = `left ${duration}s ease-out, bottom ${duration}s ease-out`;
          } else {
            props[id].el.style.transition = 'none';
          }
          updatePropPosition(id);
          // Reset transition after animation
          if (duration > 0) {
            setTimeout(() => {
              props[id].el.style.transition = '';
            }, duration * 1000);
          }
        }
      });
    }
    
    // === TRANSFORM-BASED EMOTION SYSTEM ===
    // Unified emotion config using relative values only - works for any sprite
    const TRANSFORM_EMOTIONS = {
      neutral: {
        eyeRyRatio: 1.0, eyeCyDelta: 0, pupilRyRatio: 1.0, pupilCyDelta: 0,
        browY: 0, browRotateL: 0, browRotateR: 0,
        mouthY: 0, mouthScaleY: 0.3, mouthScaleX: 1.0,
        pupilScale: 1.0
      },
      happy: {
        eyeRyRatio: 0.7, eyeCyDelta: -1, pupilRyRatio: 0.8, pupilCyDelta: -1,
        browY: -2, browRotateL: -8, browRotateR: 8,
        mouthY: 1, mouthScaleY: 1.3, mouthScaleX: 1.1,
        pupilScale: 1.1
      },
      sad: {
        eyeRyRatio: 0.85, eyeCyDelta: 2, pupilRyRatio: 0.9, pupilCyDelta: 2,
        browY: 3, browRotateL: -12, browRotateR: 12,
        mouthY: 2, mouthScaleY: -0.9, mouthScaleX: 0.9,
        pupilScale: 1.0
      },
      angry: {
        eyeRyRatio: 0.85, eyeCyDelta: 2, pupilRyRatio: 0.9, pupilCyDelta: 2,
        browY: 3, browRotateL: 8, browRotateR: -8,
        mouthY: 2, mouthScaleY: -0.6, mouthScaleX: 0.9,
        pupilScale: 0.75
      },
      surprised: {
        eyeRyRatio: 1.4, eyeCyDelta: 0, pupilRyRatio: 1.3, pupilCyDelta: 0,
        browY: -5, browRotateL: -5, browRotateR: 5,
        mouthY: 3, mouthScaleY: 1.2, mouthScaleX: 0.8,
        useMouthOpen: true, highlight: 1,
        pupilScale: 1.35
      },
      excited: {
        eyeRyRatio: 1.3, eyeCyDelta: -1, pupilRyRatio: 1.2, pupilCyDelta: -1,
        browY: -4, browRotateL: -6, browRotateR: 6,
        mouthY: 2, mouthScaleY: 1.2, mouthScaleX: 1.1,
        highlight: 1,
        pupilScale: 1.3
      },
      worried: {
        eyeRyRatio: 0.9, eyeCyDelta: 1, pupilRyRatio: 0.9, pupilCyDelta: 1,
        browY: -1, browRotateL: -8, browRotateR: 8,
        mouthY: 1, mouthScaleY: -0.4, mouthScaleX: 0.85,
        pupilScale: 1.1
      },
      smug: {
        eyeRyRatio: 0.75, eyeCyDelta: 0, pupilRyRatio: 0.8, pupilCyDelta: 0,
        browY: 0, browRotateL: 6, browRotateR: -6,
        mouthX: 4, mouthY: 0, mouthScaleY: 0.8, mouthScaleX: 1.1, mouthRotate: -15,
        pupilScale: 0.9
      },
      tired: {
        eyeRyRatio: 0.35, eyeCyDelta: 2, pupilRyRatio: 0.5, pupilCyDelta: 2,
        browY: 4, browRotateL: 3, browRotateR: -3,
        mouthY: 1, mouthScaleY: 0.2, mouthScaleX: 1.0,
        pupilScale: 0.85
      },
      skeptical: {
        eyeRyRatio: 0.35, eyeCyDelta: 2, pupilRyRatio: 0.5, pupilCyDelta: 2,
        browY: 1, browRotateL: -25, browRotateR: 8,
        mouthY: 0, mouthScaleY: 0.2, mouthScaleX: 1.0,
        pupilScale: 0.8
      },
      dead: {
        eyeRyRatio: 0.7, eyeCyDelta: 0, pupilRyRatio: 0.8, pupilCyDelta: 0,
        browY: 0, browRotateL: 0, browRotateR: 0,
        mouthY: 2, mouthScaleY: 1.2, mouthScaleX: 0.7,
        xEyes: true, useMouthOpen: true,
        pupilScale: 0.7
      }
    };

    // === MOUTH GROUP SYSTEM ===
    // All mouth shapes at origin (0,0), positioned by group transform
    const MOUTH_SHAPES = {
      neutral:  { type: 'path', d: 'M-5 0 Q0 1 5 0', strokeWidth: 1.5 },
      smile:    { type: 'path', d: 'M-6 -1 Q0 5 6 -1', strokeWidth: 1.5 },
      bigsmile: { type: 'path', d: 'M-7 -2 Q0 6 7 -2', strokeWidth: 1.5 },
      frown:    { type: 'path', d: 'M-5 2 Q0 -2 5 2', strokeWidth: 1.5 },
      grimace:  { type: 'path', d: 'M-5 0 L5 0', strokeWidth: 2.5 },
      worried:  { type: 'path', d: 'M-5 1 Q-2 -1 0 1 Q2 3 5 1', strokeWidth: 1.5 },
      flat:     { type: 'path', d: 'M-4 0 L4 0', strokeWidth: 1.5 },
      tired:    { type: 'path', d: 'M-4 1 Q0 -1 4 1', strokeWidth: 1.5 },
      smirk:    { type: 'path', d: 'M-2 0 Q2 3 6 -1', strokeWidth: 1.5 },
      open:     { type: 'ellipse', rx: 4, ry: 1 }
    };

    const EMOTION_MOUTH_MAP = {
      neutral: 'neutral',
      happy: 'smile',
      sad: 'frown',
      angry: 'grimace',
      worried: 'worried',
      skeptical: 'flat',
      tired: 'tired',
      smug: 'smirk',
      dead: 'open',
      surprised: 'open',
      excited: 'bigsmile'
    };

    // Create mouth group for a sprite, positioning all shapes at a single point
    function createMouthGroup(svg) {
      if (!svg) return null;
      if (svg.querySelector('#mouth-group')) return svg.querySelector('#mouth-group');

      const mouthOpen = svg.querySelector('#mouth-open');
      const mouthClosed = svg.querySelector('#mouth-closed');

      // Get position from mouth-open (preferred) or mouth-closed
      let cx = 50, cy = 70;
      if (mouthOpen?.hasAttribute('cx') && mouthOpen?.hasAttribute('cy')) {
        cx = parseFloat(mouthOpen.getAttribute('cx'));
        cy = parseFloat(mouthOpen.getAttribute('cy'));
      } else if (mouthOpen?.getAttribute('d')) {
        // Path-based mouths do not have cx/cy. Derive their real position
        // instead of dropping the generated mouth at the legacy (50, 70).
        const center = getPathCenter(mouthOpen.getAttribute('d'));
        cx = center.cx;
        cy = center.cy;
      } else if (mouthClosed) {
        const d = mouthClosed.getAttribute('d');
        if (d) {
          const center = getPathCenter(d);
          cx = center.cx;
          cy = center.cy;
        }
      }

      // Get stroke color from mouth-open (or fallback to mouth-closed for legacy sprites)
      const strokeColor = mouthOpen?.getAttribute('stroke') || mouthClosed?.getAttribute('stroke') || '#8d6e63';

      // Create mouth group
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.id = 'mouth-group';
      group.setAttribute('transform', `translate(${cx}, ${cy})`);

      // Add all mouth shapes at origin
      for (const [name, shape] of Object.entries(MOUTH_SHAPES)) {
        let el;
        if (shape.type === 'path') {
          el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          el.setAttribute('d', shape.d);
          el.setAttribute('stroke', strokeColor);
          el.setAttribute('stroke-width', shape.strokeWidth);
          el.setAttribute('fill', 'none');
          el.setAttribute('stroke-linecap', 'round');
        } else if (shape.type === 'ellipse') {
          el = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
          el.setAttribute('cx', '0');
          el.setAttribute('cy', '0');
          el.setAttribute('rx', shape.rx);
          el.setAttribute('ry', shape.ry);
          el.setAttribute('fill', '#4a1a1a');
        }
        el.id = `mouth-${name}`;
        el.setAttribute('opacity', name === 'neutral' ? '1' : '0');
        group.appendChild(el);
      }

      // Insert into SVG (in head-bottom if present)
      const headBottom = svg.querySelector('#head-bottom');
      if (headBottom) {
        headBottom.appendChild(group);
      } else {
        svg.appendChild(group);
      }

      // Hide original mouth elements
      if (mouthClosed) mouthClosed.setAttribute('opacity', '0');
      if (mouthOpen) mouthOpen.setAttribute('opacity', '0');

      return group;
    }

    // Apply mouth shape for an emotion using the mouth group
    function applyMouthEmotion(svg, emotion) {
      const group = svg.querySelector('#mouth-group');
      if (!group) return;

      const shapeName = EMOTION_MOUTH_MAP[emotion] || 'neutral';

      // Hide all mouth shapes in group
      group.querySelectorAll('[id^="mouth-"]').forEach(el => {
        el.setAttribute('opacity', '0');
      });

      // Show the correct shape
      const shape = group.querySelector(`#mouth-${shapeName}`);
      if (shape) {
        shape.setAttribute('opacity', '1');

        // For open mouth emotions, adjust the size
        if (shapeName === 'open') {
          if (emotion === 'dead') {
            shape.setAttribute('ry', '3');
            shape.setAttribute('rx', '4');
          } else if (emotion === 'surprised') {
            shape.setAttribute('ry', '4');
            shape.setAttribute('rx', '5');
          }
        }
      }
    }

    // Animate mouth for speaking using the mouth group
    function animateMouthForSpeaking(svg, amplitude) {
      const group = svg.querySelector('#mouth-group');
      if (!group) return;

      const mouthOpen = group.querySelector('#mouth-open');
      if (!mouthOpen) return;

      // Hide all other mouth shapes, show mouth-open
      group.querySelectorAll('[id^="mouth-"]').forEach(el => {
        if (el !== mouthOpen) el.setAttribute('opacity', '0');
      });

      // Scale ry based on amplitude (1 = nearly closed, 4 = wide open)
      const ry = Math.max(1, Math.min(4, amplitude));
      const rx = 3 + (amplitude - 1) * 0.5;
      mouthOpen.setAttribute('ry', ry.toFixed(1));
      mouthOpen.setAttribute('rx', rx.toFixed(1));
      mouthOpen.setAttribute('opacity', '1');
    }

    // Reset mouth after speaking to show the emotion's mouth shape
    function resetMouthAfterSpeaking(svg, emotion = 'neutral') {
      applyMouthEmotion(svg, emotion);
    }

    // Get center point of a path for rotation pivot
    // Handles negative numbers and filters out arc flags
    function getPathCenter(d) {
      if (!d) return { cx: 50, cy: 50 };

      const coords = [];
      const commandRegex = /([MLHVCSQTAZ])\s*([-\d.,\s]+)/gi;
      let match;

      while ((match = commandRegex.exec(d)) !== null) {
        const cmd = match[1].toUpperCase();
        const numStr = match[2];
        const nums = numStr.match(/-?[\d.]+/g);
        if (!nums) continue;

        // Skip arc commands (A) as their parameters include flags
        if (cmd === 'A') continue;

        if (cmd === 'H') {
          nums.forEach(n => coords.push({ x: parseFloat(n), y: null }));
        } else if (cmd === 'V') {
          nums.forEach(n => coords.push({ x: null, y: parseFloat(n) }));
        } else {
          for (let i = 0; i < nums.length - 1; i += 2) {
            coords.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
          }
        }
      }

      if (coords.length === 0) return { cx: 50, cy: 50 };

      let sumX = 0, sumY = 0, countX = 0, countY = 0;
      for (const c of coords) {
        if (c.x !== null) { sumX += c.x; countX++; }
        if (c.y !== null) { sumY += c.y; countY++; }
      }

      return {
        cx: countX > 0 ? sumX / countX : 50,
        cy: countY > 0 ? sumY / countY : 50
      };
    }

    // Capture original face values from a character's SVG (no type parameter needed)
    function captureOriginalFaceValues(container) {
      const svg = container.querySelector ? container.querySelector('svg') : container;
      if (!svg) return null;

      const eyeL = svg.querySelector('#eye-left-white');
      const eyeR = svg.querySelector('#eye-right-white');
      const pupilL = svg.querySelector('#eye-left-pupil');
      const browL = svg.querySelector('#brow-left');
      const browR = svg.querySelector('#brow-right');
      const mouth = svg.querySelector('#mouth-closed');
      const mouthOpen = svg.querySelector('#mouth-open');

      if (!eyeL) return null;

      // Get eye values
      const eyeRy = parseFloat(eyeL.getAttribute('ry') || 7);
      const eyeCy = parseFloat(eyeL.getAttribute('cy') || 50);
      const eyeRx = parseFloat(eyeL.getAttribute('rx') || eyeRy);
      const eyeCx = parseFloat(eyeL.getAttribute('cx') || 40);
      const eyeRCx = parseFloat(eyeR?.getAttribute('cx') || 60);

      // Get pupil values - check tagName to distinguish circle (uses r) vs ellipse (uses ry)
      const pupilR = svg.querySelector('#eye-right-pupil');
      const pupilLUsesR = pupilL && isCircleElement(pupilL);
      const pupilRUsesR = pupilR && isCircleElement(pupilR);
      const pupilLRy = parseFloat(pupilLUsesR ? (pupilL?.getAttribute('r') || 5) : (pupilL?.getAttribute('ry') || pupilL?.getAttribute('r') || 5));
      const pupilRRy = parseFloat(pupilRUsesR ? (pupilR?.getAttribute('r') || 5) : (pupilR?.getAttribute('ry') || pupilR?.getAttribute('r') || 5));
      const pupilLRx = parseFloat(pupilLUsesR ? (pupilL?.getAttribute('r') || 5) : (pupilL?.getAttribute('rx') || pupilLRy));
      const pupilRRx = parseFloat(pupilRUsesR ? (pupilR?.getAttribute('r') || 5) : (pupilR?.getAttribute('rx') || pupilRRy));
      const pupilCy = parseFloat(pupilL?.getAttribute('cy') || eyeCy);

      // Get brow path data and centers
      const browLeftD = browL?.getAttribute('d') || '';
      const browRightD = browR?.getAttribute('d') || '';
      const browLeftCenter = getPathCenter(browLeftD);
      const browRightCenter = getPathCenter(browRightD);

      // Get mouth path data, center, and original stroke
      const mouthD = mouth?.getAttribute('d') || '';
      const mouthCenter = getPathCenter(mouthD);
      const mouthStroke = mouth?.getAttribute('stroke') || '#8d6e63';

      // Get mouth-open values
      const mouthOpenRy = parseFloat(mouthOpen?.getAttribute('ry') || 3);
      const mouthOpenRx = parseFloat(mouthOpen?.getAttribute('rx') || 5);

      return {
        eyeRy, eyeCy, eyeRx, eyeCx, eyeRCx,
        pupilLRy, pupilRRy, pupilLRx, pupilRRx, pupilCy, pupilLUsesR, pupilRUsesR,
        browLeftD, browRightD, browLeftCenter, browRightCenter,
        mouthD, mouthCenter, mouthStroke, mouthOpenRy, mouthOpenRx
      };
    }

    function setEmotion(charName, emotion) {
      const char = characters[charName];
      if (!char || !char.el) return;

      const cfg = TRANSFORM_EMOTIONS[emotion];
      if (!cfg) return;

      const el = char.el;
      const svg = el.querySelector('svg');
      const isPhotoSprite = svg && svg.dataset.photoSprite === 'true';

      // Handle photo sprite emotions (warp-style transforms + jaw puppet)
      if (isPhotoSprite) {
        const headTop = el.querySelector('#head-top');
        const headBottom = el.querySelector('#head-bottom');
        const mouthOpen = el.querySelector('#mouth-open');
        const faceUpper = el.querySelector('#face-upper');

        // Reset transforms
        if (headTop) headTop.style.transform = '';
        if (headBottom) headBottom.style.transform = '';
        if (faceUpper) faceUpper.style.transform = '';
        if (mouthOpen) {
          mouthOpen.setAttribute('ry', '1');
          mouthOpen.setAttribute('opacity', '0');
        }

        // Apply emotion-specific transforms
        switch (emotion) {
          case 'happy':
            if (faceUpper) faceUpper.style.transform = 'scaleY(0.97)';
            break;
          case 'sad':
            if (headTop) headTop.style.transform = 'perspective(100px) rotateX(3deg)';
            break;
          case 'angry':
            if (faceUpper) faceUpper.style.transform = 'scaleY(0.95) translateY(2px)';
            if (headBottom) headBottom.style.transform = 'rotate(2deg)';
            if (mouthOpen) {
              mouthOpen.setAttribute('ry', '1.5');
              mouthOpen.setAttribute('opacity', '0.7');
            }
            break;
          case 'surprised':
            if (faceUpper) faceUpper.style.transform = 'scaleY(1.03) translateY(-2px)';
            if (headBottom) headBottom.style.transform = 'rotate(12deg)';
            if (mouthOpen) {
              mouthOpen.setAttribute('ry', '5');
              mouthOpen.setAttribute('rx', '10');
              mouthOpen.setAttribute('opacity', '1');
            }
            break;
          case 'smug':
            if (faceUpper) faceUpper.style.transform = 'scaleY(0.96)';
            if (headTop) headTop.style.transform = 'rotate(3deg)';
            break;
          case 'tired':
            if (faceUpper) faceUpper.style.transform = 'scaleY(0.93) translateY(3px)';
            break;
        }

        console.log(`${charName} emotion: ${emotion} (photo-sprite)`);
        return;
      }

      // Get original face values
      const orig = char.originalFaceValues;
      if (!orig) {
        console.warn(`${charName}: no original face values captured`);
        return;
      }

      // Get SVG elements
      const eyeLeftWhite = el.querySelector('#eye-left-white');
      const eyeRightWhite = el.querySelector('#eye-right-white');
      const eyeLeftPupil = el.querySelector('#eye-left-pupil');
      const eyeRightPupil = el.querySelector('#eye-right-pupil');
      const browLeft = el.querySelector('#brow-left');
      const browRight = el.querySelector('#brow-right');
      const highlightLeft = el.querySelector('#eye-left-highlight');
      const highlightRight = el.querySelector('#eye-right-highlight');

      // Apply eye whites - use ratio for ry, delta for cy
      const newEyeRy = orig.eyeRy * cfg.eyeRyRatio;
      const newEyeCy = orig.eyeCy + cfg.eyeCyDelta;

      if (eyeLeftWhite) {
        eyeLeftWhite.setAttribute('ry', newEyeRy);
        eyeLeftWhite.setAttribute('cy', newEyeCy);
      }
      if (eyeRightWhite) {
        eyeRightWhite.setAttribute('ry', newEyeRy);
        eyeRightWhite.setAttribute('cy', newEyeCy);
      }

      // Apply pupils - scale both axes for true dilation on ellipse pupils
      const dilationScale = cfg.pupilScale || 1.0;
      const newPupilLRy = orig.pupilLRy * cfg.pupilRyRatio * dilationScale;
      const newPupilRRy = orig.pupilRRy * cfg.pupilRyRatio * dilationScale;
      const newPupilLRx = orig.pupilLRx * dilationScale;
      const newPupilRRx = orig.pupilRRx * dilationScale;
      const newPupilCy = orig.pupilCy + cfg.pupilCyDelta;

      if (eyeLeftPupil) {
        if (orig.pupilLUsesR) {
          eyeLeftPupil.setAttribute('r', newPupilLRy);
        } else {
          eyeLeftPupil.setAttribute('ry', newPupilLRy);
          eyeLeftPupil.setAttribute('rx', newPupilLRx);
        }
        eyeLeftPupil.setAttribute('cy', newPupilCy);
      }
      if (eyeRightPupil) {
        if (orig.pupilRUsesR) {
          eyeRightPupil.setAttribute('r', newPupilRRy);
        } else {
          eyeRightPupil.setAttribute('ry', newPupilRRy);
          eyeRightPupil.setAttribute('rx', newPupilRRx);
        }
        eyeRightPupil.setAttribute('cy', newPupilCy);
      }

      // Apply brows - keep original path, use transforms
      if (browLeft && orig.browLeftD) {
        browLeft.setAttribute('d', orig.browLeftD);
        const { cx, cy } = orig.browLeftCenter;
        browLeft.setAttribute('transform',
          `translate(0, ${cfg.browY}) rotate(${cfg.browRotateL}, ${cx}, ${cy})`);
      }
      if (browRight && orig.browRightD) {
        browRight.setAttribute('d', orig.browRightD);
        const { cx, cy } = orig.browRightCenter;
        browRight.setAttribute('transform',
          `translate(0, ${cfg.browY}) rotate(${cfg.browRotateR}, ${cx}, ${cy})`);
      }

      // Apply mouth using mouth group system
      applyMouthEmotion(svg, emotion);

      // Store current emotion on character for speaking animation reset
      char.currentEmotion = emotion;

      // Handle X eyes for dead emotion
      if (cfg.xEyes) {
        // Hide normal eyes
        if (eyeLeftWhite) eyeLeftWhite.setAttribute('opacity', '0');
        if (eyeRightWhite) eyeRightWhite.setAttribute('opacity', '0');
        if (eyeLeftPupil) eyeLeftPupil.setAttribute('opacity', '0');
        if (eyeRightPupil) eyeRightPupil.setAttribute('opacity', '0');

        // Create or show X eyes positioned based on actual eye locations
        let xEyesGroup = svg.querySelector('#x-eyes-group');
        if (!xEyesGroup) {
          xEyesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          xEyesGroup.id = 'x-eyes-group';
          const leftCx = orig.eyeCx;
          const rightCx = orig.eyeRCx;
          const cy = orig.eyeCy;
          const size = Math.max(3, orig.eyeRy * 0.8);
          xEyesGroup.innerHTML = `
            <line x1="${leftCx - size}" y1="${cy - size}" x2="${leftCx + size}" y2="${cy + size}" stroke="#000" stroke-width="2"/>
            <line x1="${leftCx + size}" y1="${cy - size}" x2="${leftCx - size}" y2="${cy + size}" stroke="#000" stroke-width="2"/>
            <line x1="${rightCx - size}" y1="${cy - size}" x2="${rightCx + size}" y2="${cy + size}" stroke="#000" stroke-width="2"/>
            <line x1="${rightCx + size}" y1="${cy - size}" x2="${rightCx - size}" y2="${cy + size}" stroke="#000" stroke-width="2"/>
          `;
          svg.appendChild(xEyesGroup);
        }
        xEyesGroup.setAttribute('opacity', '1');
      } else {
        // Show normal eyes, hide X eyes
        if (eyeLeftWhite) eyeLeftWhite.setAttribute('opacity', '1');
        if (eyeRightWhite) eyeRightWhite.setAttribute('opacity', '1');
        if (eyeLeftPupil) eyeLeftPupil.setAttribute('opacity', '1');
        if (eyeRightPupil) eyeRightPupil.setAttribute('opacity', '1');
        const xEyesGroup = svg.querySelector('#x-eyes-group');
        if (xEyesGroup) xEyesGroup.setAttribute('opacity', '0');
      }

      // Apply highlights (default to 0 if not specified to reset after emotions like excited)
      const highlightOpacity = cfg.highlight ?? 0;
      if (highlightLeft) highlightLeft.setAttribute('opacity', highlightOpacity);
      if (highlightRight) highlightRight.setAttribute('opacity', highlightOpacity);

      // Update blink original values to match new emotion state
      blinkOriginalValues.set(charName, {
        leftWhiteRy: newEyeRy,
        rightWhiteRy: newEyeRy,
        leftPupilRy: newPupilLRy,
        rightPupilRy: newPupilRRy,
        pupilLUsesR: orig.pupilLUsesR,
        pupilRUsesR: orig.pupilRUsesR
      });

      console.log(`${charName} emotion: ${emotion}`);
    }
    
    // === AUDIO SYSTEM ===
    const AUDIO_CACHE_NAME = 'skit-audio-cache-v2';
    
    async function openAudioCache() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(AUDIO_CACHE_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
          e.target.result.createObjectStore('audio', { keyPath: 'key' });
        };
      });
    }
    
    async function getCachedAudio(key) {
      try {
        const db = await openAudioCache();
        return new Promise((resolve) => {
          const tx = db.transaction('audio', 'readonly');
          const request = tx.objectStore('audio').get(key);
          request.onsuccess = () => resolve(request.result?.blob);
          request.onerror = () => resolve(null);
        });
      } catch { return null; }
    }
    
    async function setCachedAudio(key, blob) {
      try {
        const db = await openAudioCache();
        const tx = db.transaction('audio', 'readwrite');
        tx.objectStore('audio').put({ key, blob, ts: Date.now() });
      } catch (e) { console.warn('Cache write failed:', e); }
    }
    
    function getTtsSettings() {
      return typeof AITSettings !== 'undefined' ? AITSettings.get() : null;
    }

    function getTtsMode() {
      if (new URLSearchParams(location.search).get('recordedOnly') === '1') return 'none';
      const settings = getTtsSettings();
      return settings?.ttsMode || 'none';
    }

    async function generateAudio(text, voice) {
      // Check browser TTS settings
      const settings = getTtsSettings();
      const mode = settings?.ttsMode || 'none';

      if (mode === 'none') return null;

      // cloud or custom mode - use AITTtsProvider
      if ((mode === 'cloud' || mode === 'custom') && typeof AITTtsProvider !== 'undefined') {
        const voiceConfig = {
          id: voice || settings.ttsVoice || 'alloy',
          speed: settings.ttsRate || 1,
          pitch: settings.ttsPitch || 1,
          volume: settings.ttsVolume || 1
        };
        const blob = await AITTtsProvider.generateSpeech(text, voiceConfig, settings, {});
        if (blob) return blob;
        return null;
      }

      // Fallback: server endpoints (when no browser settings available)
      const cacheKey = `${voice}:${text}`;
      const cached = await getCachedAudio(cacheKey);
      if (cached) return cached;

      let res;
      // Handle custom voices (prefixed with 'custom:')
      if (voice && voice.startsWith('custom:')) {
        const customVoiceName = voice.replace('custom:', '');
        res = await fetch('/api/voice/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: customVoiceName })
        });
      } else {
        const formData = new FormData();
        formData.append('text', text);
        formData.append('voice_url', voice);
        res = await fetch('/tts/tts', { method: 'POST', body: formData });
      }
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      await setCachedAudio(cacheKey, blob);
      return blob;
    }
    
    // === SKITS ===
    const skits = {
      luckyCharms: {
        meta: { title: "Lucky Charms", duration: 120 },
        stage: { background: "restaurant" },
        cast: {
          waiter: { x: 30, sprite: "waiter", voice: "jean" },
          woman: { x: 70, sprite: "girl", voice: "cosette" },
          leprechaun: { x: -20, sprite: "leprechaun", voice: "marius", startOffscreen: true, scale: 0.6 }
        },
        script: [
          // Opening - wide shot
          { do: "shot", type: "wide" },
          { do: "emote", who: "waiter", emotion: "happy" },
          { do: "emote", who: "woman", emotion: "neutral" },
          { do: "pause", duration: 1 },
          
          // Waiter approaches
          { do: "shot", type: "closeup", who: "waiter" },
          { do: "say", who: "waiter", line: "Good evening, madam. May I tell you about our special tonight?" },
          
          // Woman responds
          { do: "shot", type: "closeup", who: "woman" },
          { do: "emote", who: "woman", emotion: "happy" },
          { do: "say", who: "woman", line: "Oh yes, please!" },
          
          // Waiter excited
          { do: "shot", type: "closeup", who: "waiter" },
          { do: "emote", who: "waiter", emotion: "excited" },
          { do: "say", who: "waiter", line: "Tonight we have something truly magical." },
          
          // Woman intrigued
          { do: "shot", type: "closeup", who: "woman" },
          { do: "emote", who: "woman", emotion: "surprised" },
          { do: "say", who: "woman", line: "Magical? In a restaurant?" },
          
          // Waiter reveals
          { do: "shot", type: "extreme-closeup", who: "waiter" },
          { do: "emote", who: "waiter", emotion: "happy" },
          { do: "say", who: "waiter", line: "Lucky Charms. Magically delicious." },
          
          // Woman confused
          { do: "shot", type: "extreme-closeup", who: "woman" },
          { do: "emote", who: "woman", emotion: "worried" },
          { do: "say", who: "woman", line: "The... the cereal?" },
          
          // Waiter doubles down
          { do: "shot", type: "closeup", who: "waiter" },
          { do: "emote", who: "waiter", emotion: "smug" },
          { do: "say", who: "waiter", line: "Imported directly from General Mills." },
          
          // Woman skeptical
          { do: "shot", type: "closeup", who: "woman" },
          { do: "emote", who: "woman", emotion: "angry" },
          { do: "say", who: "woman", line: "Sir, this is a five star restaurant." },
          
          // Waiter defensive
          { do: "shot", type: "closeup", who: "waiter" },
          { do: "emote", who: "waiter", emotion: "worried" },
          { do: "say", who: "waiter", line: "Yes, and it has five different marshmallow shapes." },
          
          // Woman done
          { do: "shot", type: "closeup", who: "woman" },
          { do: "emote", who: "woman", emotion: "tired" },
          { do: "say", who: "woman", line: "I'd like to speak to the manager." },
          
          // Wide shot - waiter frowns
          { do: "shot", type: "wide" },
          { do: "emote", who: "waiter", emotion: "sad" },
          { do: "pause", duration: 0.5 },
          
          // Waiter looks left and exits
          { do: "look", who: "waiter", at: "left" },
          { do: "exit", who: "waiter", to: "left" },
          { do: "pause", duration: 1 },
          
          // Leprechaun enters from left - woman surprised
          { do: "enter", who: "leprechaun", from: "left", to: 30 },
          { do: "emote", who: "leprechaun", emotion: "happy" },
          { do: "look", who: "leprechaun", at: "right" },
          { do: "emote", who: "woman", emotion: "surprised" },
          { do: "pause", duration: 0.5 },
          
          // Leprechaun introduces himself
          { do: "shot", type: "closeup", who: "leprechaun" },
          { do: "look", who: "leprechaun", at: "right" },
          { do: "say", who: "leprechaun", line: "Can I help you?" },
          
          // Back to wide - woman annoyed
          { do: "shot", type: "wide" },
          { do: "look", who: "leprechaun", at: "right" },
          { do: "emote", who: "woman", emotion: "angry" },
          { do: "pause", duration: 0.5 },
          
          // Leprechaun says What?
          { do: "look", who: "leprechaun", at: "right" },
          { do: "say", who: "leprechaun", line: "What?" },
          { do: "pause", duration: 1 }
        ]
      },
      // Sequential skits only
      trumpAlien: {
        meta: { duration: 300 }, // Long duration, will stop when script ends
        stage: { background: "space" },
        cast: {
          trump: { x: 70, sprite: "trump-v3", voice: "https://openclaw-vps.tail4abd9a.ts.net/skit/audio/trump_voice_reference.wav" },
          alien: { x: -20, sprite: "alien-green", voice: "cosette", startOffscreen: true }
        },
        script: [
          // No 't' values - plays sequentially, waits for audio to complete
          { do: "shot", type: "closeup", who: "trump" },
          { do: "emote", who: "trump", emotion: "smug" },
          { do: "pause", duration: 1 },
          { do: "say", who: "trump", line: "Space. The final frontier." },
          
          { do: "shot", type: "wide" },
          { do: "enter", who: "alien", from: "left", to: 30 },
          { do: "pause", duration: 1 },
          
          { do: "shot", type: "closeup", who: "trump" },
          { do: "emote", who: "trump", emotion: "surprised" },
          { do: "say", who: "trump", line: "Whoa! An alien!" },
          
          { do: "shot", type: "closeup", who: "alien" },
          { do: "emote", who: "alien", emotion: "neutral" },
          { do: "say", who: "alien", line: "Greetings, Earth creature." },
          
          { do: "shot", type: "closeup", who: "trump" },
          { do: "emote", who: "trump", emotion: "smug" },
          { do: "say", who: "trump", line: "Are you here legally?" },
          
          { do: "shot", type: "closeup", who: "alien" },
          { do: "emote", who: "alien", emotion: "worried" },
          { do: "say", who: "alien", line: "We do not understand this question." },
          
          { do: "shot", type: "wide" }
        ]
      },
      
      // The Interview - cat boss, nobody acknowledges it
      theInterview: {
        meta: { title: "The Interview", duration: 120 },
        stage: { background: "office" },
        cast: {
          candidate: { x: 30, sprite: "man-suit", voice: "marius", volume: 1.3 },
          cat: { x: 70, sprite: "cat", voice: "cosette" }
        },
        script: [
          // Opening - wide shot
          { do: "shot", type: "wide" },
          { do: "emote", who: "candidate", emotion: "neutral" },
          { do: "emote", who: "cat", emotion: "neutral" },
          { do: "pause", duration: 1 },
          
          // Candidate opens
          { do: "shot", type: "closeup", who: "candidate" },
          { do: "emote", who: "candidate", emotion: "happy" },
          { do: "say", who: "candidate", line: "Thank you for meeting with me today." },
          
          // Cat responds
          { do: "shot", type: "closeup", who: "cat" },
          { do: "emote", who: "cat", emotion: "neutral" },
          { do: "say", who: "cat", line: "Meow." },
          
          // Candidate answers "question"
          { do: "shot", type: "closeup", who: "candidate" },
          { do: "emote", who: "candidate", emotion: "happy" },
          { do: "say", who: "candidate", line: "Great question! My biggest strength is attention to detail." },
          
          // Cat gets aggressive
          { do: "shot", type: "closeup", who: "cat" },
          { do: "emote", who: "cat", emotion: "angry" },
          { do: "say", who: "cat", line: "HISSSSS!" },
          
          // Candidate backtracks
          { do: "shot", type: "closeup", who: "candidate" },
          { do: "emote", who: "candidate", emotion: "worried" },
          { do: "say", who: "candidate", line: "Fair point. I'm also very adaptable." },
          
          // Cat excited
          { do: "shot", type: "closeup", who: "cat" },
          { do: "emote", who: "cat", emotion: "excited" },
          { do: "say", who: "cat", line: "Meow meow! Purrrrr." },
          
          // Candidate confused but playing along
          { do: "shot", type: "closeup", who: "candidate" },
          { do: "emote", who: "candidate", emotion: "worried" },
          { do: "say", who: "candidate", line: "A ball of yarn? Is this... a negotiation tactic?" },
          
          // Wide shot - candidate considers
          { do: "shot", type: "wide" },
          { do: "pause", duration: 0.5 },
          
          // Candidate commits
          { do: "shot", type: "closeup", who: "candidate" },
          { do: "emote", who: "candidate", emotion: "smug" },
          { do: "say", who: "candidate", line: "Alright. I'll play ball." },
          
          // Cat very happy
          { do: "shot", type: "closeup", who: "cat" },
          { do: "emote", who: "cat", emotion: "happy" },
          { do: "say", who: "cat", line: "MEOW!" },
          
          // Candidate seals the deal
          { do: "shot", type: "closeup", who: "candidate" },
          { do: "emote", who: "candidate", emotion: "happy" },
          { do: "say", who: "candidate", line: "I accept your offer." },
          
          // Final wide
          { do: "shot", type: "wide" },
          { do: "pause", duration: 1 }
        ]
      }
    };
    
    // === PLAYBACK ===
    async function loadSkit(name) {
      const skit = skits[name];
      if (!skit) return;
      window.publishedAssets = null;
      stopGlobalBlinking();
      blinkOriginalValues.clear();
      
      currentSkit = skit;
      currentSkitName = name;
      triggeredBeats = new Set();
      audioCache.clear();
      
      // Clear stage
      const stage = document.getElementById('stage');
      stage.querySelectorAll('.character').forEach(el => el.remove());
      stage.querySelectorAll('.prop').forEach(el => el.remove());
      Object.keys(characters).forEach(k => delete characters[k]);
      clearAllProps();

      // Set background (with orientation support and legacy fallback)
      setBackground(skit.stage.background, skit.stage.orientation || 'landscape');

      // Create characters
      for (const [name, config] of Object.entries(skit.cast)) {
        await createCharacter(name, config);
      }

      // Create props
      for (const [id, config] of Object.entries(skit.props || {})) {
        await createProp(id, config);
      }
      
      // Reset camera
      camera.x = 50; camera.y = 50; camera.zoom = 1; camera.follow = null;
      updateCamera();
      
      // Set initial eye directions - characters look at each other
      const charNames = Object.keys(characters);
      if (charNames.length >= 2) {
        const [char1, char2] = charNames;
        const char1LooksRight = characters[char2].x > characters[char1].x;
        setEyeDirection(char1, char1LooksRight ? 'right' : 'left');
        setEyeDirection(char2, char1LooksRight ? 'left' : 'right');
      }
      
      // Generate audio
      document.getElementById('status').textContent = 'Generating audio...';
      document.getElementById('playBtn').disabled = true;
      
      const sayActions = skit.script.filter(b => b.do === 'say');
      // Build index map for sequential cache keys
      let seqIndex = 0;
      const beatIndexMap = new Map();
      skit.script.forEach((b, idx) => {
        if (b.do === 'say') {
          beatIndexMap.set(b, idx);
        }
      });

      const ttsModeSkit = getTtsMode();

      if (ttsModeSkit !== 'none') {
        // For ElevenLabs, assign different voices to each character
        const cloudVoiceMapSkit = {};
        const ttsSettingsSkit = getTtsSettings();
        if (ttsModeSkit === 'cloud' && ttsSettingsSkit?.ttsProvider === 'elevenlabs' && typeof AITTtsProvider !== 'undefined') {
          const voices = await AITTtsProvider.fetchElevenLabsVoices(ttsSettingsSkit.ttsKey);
          if (voices.length) {
            const castNames = Object.keys(skit.cast || {});
            castNames.forEach((name, idx) => {
              cloudVoiceMapSkit[name] = voices[idx % voices.length].id;
              console.log(`[Player] Assigned ElevenLabs voice "${voices[idx % voices.length].name}" to ${name}`);
            });
          }
        }

        for (let i = 0; i < sayActions.length; i++) {
          const beat = sayActions[i];
          const char = characters[beat.who];
          document.getElementById('status').textContent = `Loading audio ${i+1}/${sayActions.length}...`;

          if (!char) {
            console.warn(`Character "${beat.who}" not found in cast. Available: ${Object.keys(characters).join(', ')}`);
            continue;
          }

          try {
            const voice = char.voiceAssigned ? char.voice : (cloudVoiceMapSkit[beat.who] || char.voice);
            const blob = await generateAudio(beat.line, voice);
            if (!blob) continue;
            const audio = new Audio(URL.createObjectURL(blob));
            const source = audioContext.createMediaElementSource(audio);

            // Use gain node for volume (allows > 1.0 boost)
            const gainNode = audioContext.createGain();
            gainNode.gain.value = char.volume !== undefined ? char.volume : 1.0;
            source.connect(gainNode);
            gainNode.connect(analyser);

            // Use t-based key if available, otherwise use sequential index
            const cacheKey = beat.t !== undefined
              ? `${beat.t}-${beat.who}`
              : `seq-${beatIndexMap.get(beat)}-${beat.who}`;
            audioCache.set(cacheKey, {
              audio,
              beat,
              charName: beat.who,
              gainNode,
              volume: char.volume !== undefined ? char.volume : 1.0,
              speed: char.speed !== undefined ? char.speed : 1.0,
              pitch: char.pitch !== undefined ? char.pitch : 0
            });
          } catch (e) {
            console.error('TTS error:', e);
          }
        }
      }

      if (sayActions.length && audioCache.size === 0) setCaptionsEnabled(true);
      
      document.getElementById('status').textContent = 'Ready!';
      document.getElementById('playBtn').disabled = false;
    }
    
    async function discoverSpriteVariantsForPublish(spriteName) {
      // 0) IndexedDB (browser mode - authoritative when available)
      const idb = await getIDBStorage();
      if (idb) {
        try {
          const rec = await idb.getSpriteRecord(spriteName);
          const keys = Object.keys(rec?.variants || {});
          if (keys.length) return keys;
        } catch (e) {}
      }

      // 1) API endpoint (authoritative in server mode; supports freeform names).
      try {
        const apiResp = await fetch(`/api/sprites/${encodeURIComponent(spriteName)}/variants`);
        if (apiResp.ok) {
          const apiVariants = await apiResp.json();
          if (Array.isArray(apiVariants) && apiVariants.length > 0) {
            return [...new Set(apiVariants)];
          }
        }
      } catch (e) {}

      // 2) meta.json variants list (works for static assets that include it).
      try {
        const metaResp = await fetch(`sprites/${spriteName}/meta.json?v=${CACHE_BUSTER}`);
        if (metaResp.ok) {
          const meta = await metaResp.json();
          if (Array.isArray(meta?.variants) && meta.variants.length > 0) {
            return [...new Set(meta.variants)];
          }
        }
      } catch (e) {}

      // 3) Legacy fallback for older asset folders.
      const legacy = [];
      for (const variantName of ['front', 'back']) {
        try {
          const resp = await fetch(`sprites/${spriteName}/${variantName}.svg?v=${CACHE_BUSTER}`);
          if (resp.ok) legacy.push(variantName);
        } catch (e) {}
      }
      return legacy.length ? legacy : ['front'];
    }

    // === PUBLISH (export self-contained JSON) ===
    async function publishSkit(name) {
      const skit = skits[name];
      if (!skit) return;
      
      document.getElementById('status').textContent = 'Publishing...';
      
      // Collect unique sprites and backgrounds needed
      const spriteNames = new Set();
      const backgroundRequests = new Map();
      if (skit.stage.background) {
        backgroundRequests.set(skit.stage.background, skit.stage.orientation || 'landscape');
      }
      for (const beat of skit.script || []) {
        if (beat.do === 'background' && beat.name) {
          backgroundRequests.set(beat.name, beat.orientation || 'landscape');
        }
      }
      
      for (const [charName, config] of Object.entries(skit.cast)) {
        spriteNames.add(config.sprite);
      }
      
      // Load and encode sprites
      const sprites = {};
      for (const spriteName of spriteNames) {
        try {
          const variantNames = await discoverSpriteVariantsForPublish(spriteName);
          for (const variantName of variantNames) {
            const resp = await fetch(`sprites/${spriteName}/${variantName}.svg?v=${CACHE_BUSTER}`);
            if (!resp.ok) continue;
            const svgText = await resp.text();
            sprites[`${spriteName}-${variantName}`] = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));
          }
        } catch (e) {
          console.warn(`Failed to load sprite ${spriteName}:`, e);
        }
      }
      
      // Load and encode background (with orientation support and legacy fallback)
      const backgrounds = {};
      for (const [backgroundName, bgOrientation] of backgroundRequests) {
        try {
          let bgResp = await fetch(`backgrounds/${backgroundName}/${bgOrientation}.svg?v=${CACHE_BUSTER}`);
          if (!bgResp.ok) {
            // Try legacy flat file structure
            bgResp = await fetch(`backgrounds/${backgroundName}.svg?v=${CACHE_BUSTER}`);
          }
          if (bgResp.ok) {
            const bgSvg = await bgResp.text();
            backgrounds[backgroundName] = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(bgSvg)));
          }
        } catch (e) {
          console.warn(`Failed to load background ${backgroundName}:`, e);
        }
      }
      
      // Generate and encode audio for each line
      const audio = {};
      const sayActions = skit.script.filter(b => b.do === 'say');
      for (let i = 0; i < sayActions.length; i++) {
        const beat = sayActions[i];
        const char = skit.cast[beat.who];
        document.getElementById('status').textContent = `Publishing audio ${i+1}/${sayActions.length}...`;
        
        try {
          const blob = await generateAudio(beat.line, char.voice);
          const reader = new FileReader();
          const base64 = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          audio[`line-${i}`] = base64;
        } catch (e) {
          console.warn(`Failed to generate audio for line ${i}:`, e);
        }
      }
      
      // Build published skit
      const published = {
        meta: skit.meta,
        stage: skit.stage,
        cast: skit.cast,
        script: skit.script,
        assets: { sprites, backgrounds, audio }
      };
      
      // Download as JSON
      const json = JSON.stringify(published, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}-published.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      document.getElementById('status').textContent = `Published! (${(json.length / 1024).toFixed(1)} KB)`;
      console.log('Published skit size:', (json.length / 1024).toFixed(1), 'KB');
      
      return published;
    }
    
    // === LOAD FROM URL (self-contained JSON) ===
    async function loadFromUrl(url) {
      document.getElementById('status').textContent = 'Loading from URL...';
      document.getElementById('playBtn').disabled = true;
      stopGlobalBlinking();
      blinkOriginalValues.clear();
      
      try {
        const resp = await fetch(url);
        const skit = await resp.json();
        
        // Store assets for the custom loader
        window.publishedAssets = skit.assets;
        
        // Clear stage
        const stage = document.getElementById('stage');
        stage.querySelectorAll('.character').forEach(el => el.remove());
        stage.querySelectorAll('.prop').forEach(el => el.remove());
        Object.keys(characters).forEach(k => delete characters[k]);
        clearAllProps();

        // Set background from embedded asset (with orientation support)
        const bgName = skit.stage.background;
        const bgOrientation = skit.stage.orientation || 'landscape';
        if (skit.assets?.backgrounds?.[bgName]) {
          document.getElementById('background').src = skit.assets.backgrounds[bgName];
          // Set viewport orientation (setBackground normally handles this)
          const viewport = document.getElementById('viewport');
          if (bgOrientation === 'landscape') {
            viewport.classList.add('landscape');
          } else {
            viewport.classList.remove('landscape');
          }
          // Notify parent frame of orientation (for embed mode)
          if (window.parent !== window) {
            window.parent.postMessage({ type: 'skit-orientation', orientation: bgOrientation }, '*');
          }
        } else {
          setBackground(bgName, bgOrientation);
        }
        
        // Create characters with embedded sprites
        for (const [name, config] of Object.entries(skit.cast)) {
          await createCharacterFromPublished(name, config, skit.assets);
        }

        // Create props
        for (const [id, config] of Object.entries(skit.props || {})) {
          await createProp(id, config);
        }

        // Reset camera
        camera.x = 50; camera.y = 50; camera.zoom = 1; camera.follow = null;
        updateCamera();
        
        // Set initial eye directions
        const charNames = Object.keys(characters);
        if (charNames.length >= 2) {
          const [char1, char2] = charNames;
          const char1LooksRight = characters[char2].x > characters[char1].x;
          setEyeDirection(char1, char1LooksRight ? 'right' : 'left');
          setEyeDirection(char2, char1LooksRight ? 'left' : 'right');
        }
        
        // Decode audio into AudioBuffers (mobile-friendly)
        audioCache.clear();
        const sayActions = skit.script.filter(b => b.do === 'say');
        let hasEmbeddedAudio = false;

        for (let i = 0; i < sayActions.length; i++) {
          const beat = sayActions[i];
          const char = skit.cast[beat.who];
          const audioData = skit.assets?.audio?.[`line-${i}`];

          if (audioData) {
            hasEmbeddedAudio = true;
            document.getElementById('status').textContent = `Decoding audio ${i+1}/${sayActions.length}...`;
            try {
              // Convert data URL to ArrayBuffer and decode
              const base64 = audioData.split(',')[1];
              const binaryString = atob(base64);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              const audioBuffer = await audioContext.decodeAudioData(bytes.buffer.slice(0));

              // Use say-action index (matches playback lookup which uses sayActions.indexOf)
              const cacheKey = beat.t !== undefined
                ? `${beat.t}-${beat.who}`
                : `seq-${i}-${beat.who}`;
              audioCache.set(cacheKey, {
                buffer: audioBuffer,
                beat,
                charName: beat.who,
                volume: char.volume !== undefined ? char.volume : 1.0,
                speed: char.speed !== undefined ? char.speed : 1.0,
                pitch: char.pitch !== undefined ? char.pitch : 0
              });
            } catch (e) {
              console.warn(`Failed to decode audio ${i}:`, e);
            }
          }
        }

        // If no embedded audio, fall back to browser TTS settings
        if (!hasEmbeddedAudio) {
          const ttsUrlMode = getTtsMode();
          if (ttsUrlMode === 'cloud' || ttsUrlMode === 'custom') {
            for (let i = 0; i < sayActions.length; i++) {
              const beat = sayActions[i];
              document.getElementById('status').textContent = `Generating audio ${i + 1}/${sayActions.length}...`;
              try {
                const blob = await generateAudio(beat.line, '');
                if (!blob) continue;
                const audio = new Audio(URL.createObjectURL(blob));
                const source = audioContext.createMediaElementSource(audio);
                const gainNode = audioContext.createGain();
                gainNode.gain.value = 1.0;
                source.connect(gainNode);
                gainNode.connect(analyser);

                const cacheKey = beat.t !== undefined
                  ? `${beat.t}-${beat.who}`
                  : `seq-${i}-${beat.who}`;
                audioCache.set(cacheKey, {
                  audio,
                  beat,
                  charName: beat.who,
                  gainNode,
                  volume: 1.0,
                  speed: 1.0,
                  pitch: 0
                });
              } catch (e) {
                console.error('TTS error for', beat.who, ':', e);
              }
            }
          }
        }

        if (sayActions.length && audioCache.size === 0) setCaptionsEnabled(true);
        
        currentSkit = skit;
        triggeredBeats = new Set();
        
        document.getElementById('status').textContent = 'Ready!';
        document.getElementById('playBtn').disabled = false;
        
      } catch (e) {
        console.error('Failed to load from URL:', e);
        document.getElementById('status').textContent = 'Failed to load: ' + e.message;
        throw e;
      }
    }
    
    async function createCharacterFromPublished(name, config, assets) {
      const spriteName = `${config.sprite}-front`;
      let svgText;
      
      if (assets?.sprites?.[spriteName]) {
        // Decode from base64 data URL
        const dataUrl = assets.sprites[spriteName];
        const base64 = dataUrl.split(',')[1];
        svgText = decodeURIComponent(escape(atob(base64)));
      } else {
        svgText = await loadSprite(config.sprite, 'front');
      }
      
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      const svg = svgDoc.documentElement;
      
      const div = document.createElement('div');
      div.className = 'character';
      div.id = `char-${name}`;
      div.appendChild(svg);
      document.getElementById('stage').appendChild(div);

      // Create mouth group for unified mouth positioning
      createMouthGroup(svg);
      svg.style.animationDelay = `${-(Math.random() * 7).toFixed(1)}s`;

      // Get the provider-scoped voice from sprite meta (preferred) or cast config.
      const spriteMeta = assets?.spriteMeta?.[config.sprite];
      const ttsSettings = getTtsSettings() || {};
      const castMetaVoice = { assignments: config.voiceAssignments || {} };
      const castAssignedVoice = window.AITTtsProvider?.getAssignedVoiceConfig?.(castMetaVoice, ttsSettings) || null;
      const spriteAssignedVoice = window.AITTtsProvider?.getAssignedVoiceConfig?.(spriteMeta?.voice, ttsSettings) || null;
      const assignedVoice = castAssignedVoice || spriteAssignedVoice;
      const resolvedVoice = castAssignedVoice || window.AITTtsProvider?.resolveVoiceConfig?.(spriteMeta?.voice, ttsSettings, config.voice) || spriteMeta?.voice || {};
      const castVoiceIsCompatible = window.AITTtsProvider?.isVoiceCompatible?.(config.voice, ttsSettings) || false;
      const voice = resolvedVoice.id || config.voice;

      // Capture original face values for transform-based emotion system
      const originalFaceValues = captureOriginalFaceValues(div);

      const scale = config.scale || 1;
      const baseY = config.startY ?? config.y ?? 88;

      // Use startX for initial position if specified (for offscreen starts)
      const initialX = config.startX !== undefined ? config.startX : config.x;

      characters[name] = {
        el: div,
        x: initialX,
        targetX: config.x,
        baseY: baseY,
        scale: scale,
        currentEmotion: 'neutral',
        sprite: config.sprite,
        voice: voice,
        voiceAssigned: Boolean(assignedVoice || castVoiceIsCompatible),
        volume: resolvedVoice.volume ?? config.volume,
        speed: resolvedVoice.speed ?? config.speed,
        pitch: resolvedVoice.pitch ?? config.pitch,
        originalFaceValues: originalFaceValues
      };

      div.style.left = initialX + '%';
      div.style.bottom = `${100 - baseY}%`;
      div.style.setProperty('--char-scale', scale);
      if (config.scale) {
        div.style.height = `${40 * config.scale}%`;
      }

      // Add position class for head rotation direction (based on target x)
      div.classList.add(config.x < 50 ? 'pos-left' : 'pos-right');

      // Only mark offscreen if explicitly flagged or startX is outside visible area
      if (config.startOffscreen || (config.startX !== undefined && (config.startX < 0 || config.startX > 100))) {
        div.classList.add('offscreen');
      }

      // Auto-face toward center
      if (config.x > 50) {
        div.classList.add('facing-left');
        characters[name].flipped = true;
      } else {
        div.classList.add('facing-right');
      }
    }
    
    function togglePlay() {
      if (isPlaying) stop(false);
      else play();
    }

    function setPlaybackState(state) {
      document.body.dataset.playbackState = state;
      window.dispatchEvent(new CustomEvent('ai-improv:playback-state', {
        detail: { state }
      }));
    }
    
    function setCaptionsEnabled(enabled) {
      document.body.classList.toggle('captions-off', !enabled);
      const btn = document.getElementById('captionBtn');
      btn.classList.toggle('active', enabled);
      btn.setAttribute('aria-pressed', String(enabled));
    }

    function toggleCaptions() {
      setCaptionsEnabled(document.body.classList.contains('captions-off'));
    }
    
    // Sequential playback state
    let sequentialIndex = 0;
    let waitingForAudio = false;
    let sequentialMode = false;
    let playSessionId = 0;
    let scheduledAdvanceIndices = new Set();

    function getActionDuration(beat) {
      if (beat.duration !== undefined) {
        return beat.duration;
      }

      switch (beat.do) {
        case 'say': {
          const sayActions = currentSkit.script.filter(b => b.do === 'say');
          const sayIdx = sayActions.indexOf(beat);
          const cacheKey = beat.t !== undefined ? `${beat.t}-${beat.who}` : `seq-${sayIdx}-${beat.who}`;
          const cached = audioCache.get(cacheKey);
          const speed = cached?.speed || 1.0;

          if (cached?.buffer && Number.isFinite(cached.buffer.duration)) {
            return cached.buffer.duration / speed;
          }
          if (cached?.audio && Number.isFinite(cached.audio.duration)) {
            return cached.audio.duration / speed;
          }
          return 2;
        }
        case 'move':
        case 'prop-move':
          return 1;
        case 'enter':
        case 'exit':
          return 1.5;
        case 'pause':
          return beat.duration || 1;
        case 'prop-rotate':
        case 'prop-scale':
          return 0.5;
        default:
          return 0;
      }
    }

    function hasMeaningfulDuration(beat) {
      return beat.do === 'say' || beat.do === 'pause' || beat.do === 'delay';
    }
    
    function play() {
      if (audioContext.state === 'suspended') audioContext.resume();
      isPlaying = true;
      setPlaybackState('playing');
      startTime = performance.now();
      triggeredBeats = new Set();
      sequentialIndex = 0;
      waitingForAudio = false;
      playSessionId += 1;
      scheduledAdvanceIndices.clear();
      
      // Check if skit uses sequential mode (first beat has no 't' property)
      sequentialMode = currentSkit.script.length > 0 && currentSkit.script[0].t === undefined;
      
      // Start global blink scheduler
      startGlobalBlinking();
      
      document.getElementById('playBtn').textContent = '⏸';
      document.getElementById('playBtn').setAttribute('aria-label', 'Pause skit');
      
      if (sequentialMode) {
        processNextSequentialBeat();
      }
      animate();
    }
    
    function stop(completed = false) {
      isPlaying = false;
      setPlaybackState(completed ? 'complete' : 'idle');
      currentSpeaker = null;
      peakAmp = 50;
      openDuration = 0;
      stopGlobalBlinking();
      Object.keys(props).forEach(id => animateProp(id, null));
      if (animationId) cancelAnimationFrame(animationId);
      document.getElementById('playBtn').textContent = '▶';
      document.getElementById('playBtn').setAttribute('aria-label', 'Play skit');
      document.getElementById('caption').classList.remove('visible');
      Object.values(characters).forEach(c => {
        c.el.classList.remove('speaking', 'look-left', 'look-right', 'look-up', 'look-down', 'blinking');
        // Reset mouth state using mouth group
        const svg = c.el.querySelector('svg');
        if (svg) {
          resetMouthAfterSpeaking(svg, 'neutral');
          c.currentEmotion = 'neutral';
        }
        resetHeadTransforms(c.el);
      });
      audioCache.forEach((cached) => { 
        if (cached.audio) {
          cached.audio.pause(); 
          cached.audio.currentTime = 0; 
        }
      });
      if (currentSourceNode) {
        try { currentSourceNode.stop(); } catch(e) {}
        currentSourceNode = null;
      }
      scheduledAdvanceIndices.clear();
    }
    
    let currentSpeaker = null;
    let peakAmp = 50;
    let openDuration = 0;
    
    // Process next beat in sequential mode
    function processNextSequentialBeat() {
      // Resume audio context on mobile (may be suspended)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      if (!isPlaying || sequentialIndex >= currentSkit.script.length) {
        if (sequentialIndex >= currentSkit.script.length) {
          stop(true);
        }
        return;
      }
      
      const beatIndex = sequentialIndex;
      const sessionId = playSessionId;
      const beat = currentSkit.script[sequentialIndex];
      const prevBeat = sequentialIndex > 0 ? currentSkit.script[sequentialIndex - 1] : null;
      const nextBeat = currentSkit.script[sequentialIndex + 1];
      sequentialIndex++;

      const isStaleSession = () => sessionId !== playSessionId;
      
      // If beat has a 't' value, it's timed - let the normal animate loop handle it
      if (beat.t !== undefined) {
        // Mark as triggered so animate doesn't double-process
        const key = `${beat.t}-${beat.do}-${beat.who || ''}`;
        triggeredBeats.add(key);
      }

      if (beat.offset < 0 && prevBeat && !hasMeaningfulDuration(prevBeat)) {
        console.warn(`Offset on beat ${beatIndex} ignored: previous action '${prevBeat.do}' has no meaningful duration`);
      }
      
      // Handle delay/pause beats
      if (beat.do === 'pause' || beat.do === 'delay') {
        const duration = beat.duration || beat.delay || 1;
        const durationMs = duration * 1000;

        if (nextBeat?.offset < 0) {
          const triggerTime = Math.max(0, duration + nextBeat.offset) * 1000;
          scheduledAdvanceIndices.add(beatIndex);
          setTimeout(() => {
            if (isStaleSession()) return;
            processNextSequentialBeat();
          }, triggerTime);
        }

        setTimeout(() => {
          if (isStaleSession()) return;
          if (!scheduledAdvanceIndices.has(beatIndex)) {
            processNextSequentialBeat();
          }
        }, durationMs);
        return;
      }
      
      // Process the beat
      processBeat(beat, () => {
        // Callback for when beat completes (used for 'say' to wait for audio)
        if (isStaleSession()) return;
        if (!scheduledAdvanceIndices.has(beatIndex)) {
          processNextSequentialBeat();
        }
      });
      
      // If it's not a 'say' beat, continue immediately (unless it has a delay)
      if (beat.do !== 'say') {
        const delay = (beat.delay || 0) * 1000;
        setTimeout(() => {
          if (isStaleSession()) return;
          if (!scheduledAdvanceIndices.has(beatIndex)) {
            processNextSequentialBeat();
          }
        }, delay);
      }
      // For 'say' beats, the callback in processBeat handles continuation
    }
    
    function animate() {
      if (!isPlaying) return;
      
      const elapsed = (performance.now() - startTime) / 1000;
      
      // Only check duration limit for timed mode
      if (!sequentialMode && elapsed > currentSkit.meta.duration) {
        stop(true);
        return;
      }
      
      // Process timed beats (those with 't' property)
      currentSkit.script.forEach(beat => {
        if (beat.t === undefined) return; // Skip sequential beats
        const key = `${beat.t}-${beat.do}-${beat.who || ''}`;
        if (elapsed >= beat.t && !triggeredBeats.has(key)) {
          triggeredBeats.add(key);
          processBeat(beat);
        }
      });
      
      // Lip sync based on audio amplitude - dynamic mouth scaling
      if (currentSpeaker && characters[currentSpeaker]) {
        const rawAmp = getAmplitude();
        if (rawAmp > peakAmp) peakAmp = rawAmp;
        peakAmp = Math.max(30, peakAmp * 0.995);
        const normalizedAmp = rawAmp / peakAmp; // 0 to 1
        
        const charEl = characters[currentSpeaker].el;
        const svg = charEl.querySelector('svg');
        const isPhotoSprite = svg && svg.dataset.photoSprite === 'true';
        
        // Threshold for mouth movement
        const threshold = 0.25;
        const minRawAmp = 15;
        const isOpen = normalizedAmp > threshold && rawAmp > minRawAmp;
        
        if (isPhotoSprite) {
          // Photo sprite: use jaw puppet animation
          const headBottom = charEl.querySelector('#head-bottom');
          const mouthOpen = charEl.querySelector('#mouth-open');
          
          if (headBottom) {
            if (isOpen) {
              openDuration++;
              // Rotate jaw based on amplitude (max ~10 degrees)
              const angle = Math.min(10, (normalizedAmp - threshold) * 15);
              headBottom.style.transform = `rotate(${angle}deg)`;
              
              // Show mouth hole
              if (mouthOpen) {
                const holeSize = 1 + angle * 0.3;
                mouthOpen.setAttribute('ry', holeSize.toFixed(1));
                mouthOpen.setAttribute('opacity', '1');
              }
              charEl.classList.add('speaking');
            } else {
              openDuration = 0;
              headBottom.style.transform = 'rotate(0deg)';
              if (mouthOpen) {
                mouthOpen.setAttribute('ry', '1');
                mouthOpen.setAttribute('opacity', '0');
              }
              charEl.classList.remove('speaking');
            }
          }
        } else {
          // Regular sprite: use mouth group system
          const mouthGroup = svg?.querySelector('#mouth-group');

          if (mouthGroup) {
            if (isOpen) {
              openDuration++;

              // Scale mouth opening based on amplitude
              const mouthScale = 1 + (normalizedAmp - threshold) * 4;
              const amplitude = Math.min(4, Math.max(1, mouthScale));

              animateMouthForSpeaking(svg, amplitude);
              applyHeadBobAndRotation(charEl, svg, normalizedAmp);
              charEl.classList.add('speaking');
            } else {
              openDuration = 0;
              // Reset to character's current emotion mouth shape
              const char = characters[currentSpeaker];
              const emotion = char?.currentEmotion || 'neutral';
              resetMouthAfterSpeaking(svg, emotion);
              charEl.classList.remove('speaking');
              resetHeadTransforms(charEl);
            }
          } else {
            // Fallback for sprites without mouth group (legacy)
            const mouthOpen = charEl.querySelector('#mouth-open');
            const mouthClosed = charEl.querySelector('#mouth-closed');

            if (mouthOpen && mouthClosed) {
              if (isOpen) {
                openDuration++;
                const mouthScale = 1 + (normalizedAmp - threshold) * 4;
                const mouthRy = Math.min(4, Math.max(1, mouthScale));
                const mouthRx = 3 + (normalizedAmp - threshold) * 2;

                mouthOpen.setAttribute('ry', mouthRy.toFixed(1));
                mouthOpen.setAttribute('rx', mouthRx.toFixed(1));
                mouthOpen.setAttribute('opacity', '1');
                mouthClosed.setAttribute('opacity', '0');
                applyHeadBobAndRotation(charEl, svg, normalizedAmp);
                charEl.classList.add('speaking');
              } else {
                openDuration = 0;
                mouthOpen.setAttribute('ry', '1');
                mouthOpen.setAttribute('rx', '2');
                mouthOpen.setAttribute('opacity', '0');
                mouthClosed.setAttribute('opacity', '1');
                charEl.classList.remove('speaking');
                resetHeadTransforms(charEl);
              }
            }
          }
        }
      }
      
      animationId = requestAnimationFrame(animate);
    }
    
    function processBeat(beat, onComplete) {
      switch (beat.do) {
        case 'background':
          void setBackground(beat.name, beat.orientation || currentSkit?.stage?.orientation || 'landscape');
          if (Array.isArray(beat.show)) {
            const visibleCharacters = new Set(beat.show);
            for (const [name, character] of Object.entries(characters)) {
              const visible = visibleCharacters.has(name);
              character.el.classList.toggle('offscreen', !visible);
              character.el.style.opacity = visible ? '1' : '0';
            }
          }
          break;

        case 'shot':
          shot(beat.type, beat.who);
          break;
          
        case 'say':
          // Support both timed (beat.t) and sequential cache keys
          // For sequential mode, use index within say-actions only (matches generation)
          const sayActions = currentSkit.script.filter(b => b.do === 'say');
          const sayIdx = sayActions.indexOf(beat);
          const beatIndex = currentSkit.script.indexOf(beat);
          const cacheKey = beat.t !== undefined ? `${beat.t}-${beat.who}` : `seq-${sayIdx}-${beat.who}`;
          const cached = audioCache.get(cacheKey);
          if (cached) {
            const announceAudioStart = (effectivePlaybackRate = 1) => {
              window.dispatchEvent(new CustomEvent('ai-improv:audio-start', {
                detail: {
                  lineIndex: sayIdx,
                  text: beat.line,
                  who: beat.who,
                  effectivePlaybackRate,
                  durationSeconds: (cached.buffer?.duration ?? cached.audio?.duration) / effectivePlaybackRate,
                  volume: cached.volume ?? 1
                }
              }));
            };

            // Show caption
            document.getElementById('caption').textContent = beat.line;
            document.getElementById('caption').classList.add('visible');
            
            // Stop previous speaker animation and audio
            if (currentSpeaker && characters[currentSpeaker]) {
              characters[currentSpeaker].el.classList.remove('speaking');
              resetHeadTransforms(characters[currentSpeaker].el);
              // Stop any currently playing audio (only for entries with Audio elements, not AudioBuffers)
              audioCache.forEach(({ audio }) => {
                if (audio && !audio.paused) {
                  audio.pause();
                  audio.currentTime = 0;
                }
              });
            }
            
            // Eye contact is now handled by explicit 'look' commands in the script
            // This keeps eyes stable instead of moving around
            
            // Start speaking
            currentSpeaker = beat.who;
            peakAmp = 50; // Reset peak for new speaker
            openDuration = 0;
            
            const onAudioEnd = () => {
              const isInterrupted = sequentialMode && scheduledAdvanceIndices.has(beatIndex);
              const shouldClear = currentSpeaker === beat.who;
              const charEl = characters[beat.who]?.el;
              const char = characters[beat.who];
              if (charEl && shouldClear) {
                charEl.classList.remove('speaking');
                resetHeadTransforms(charEl);
                const svg = charEl.querySelector('svg');
                if (svg) {
                  // Reset mouth to character's current emotion
                  const emotion = char?.currentEmotion || 'neutral';
                  setTimeout(() => {
                    resetMouthAfterSpeaking(svg, emotion);
                  }, 100);
                }
              }
              if (shouldClear) {
                document.getElementById('caption').classList.remove('visible');
                currentSpeaker = null;
                currentSourceNode = null;
              }
              if (onComplete) {
                if (isInterrupted) onComplete();
                else setTimeout(onComplete, 200);
              }
            };
            
            // Stop any current audio
            if (currentSourceNode) {
              try { currentSourceNode.stop(); } catch(e) {}
            }
            if (cached.buffer) {
              // New-style: AudioBuffer (mobile-friendly)
              const sourceNode = audioContext.createBufferSource();
              sourceNode.buffer = cached.buffer;

              // Apply speed (playbackRate) and pitch (detune in cents)
              sourceNode.playbackRate.value = cached.speed || 1.0;
              // Convert pitch (-1 to 1) to cents (-600 to +600, i.e. 6 semitones)
              sourceNode.detune.value = (cached.pitch || 0) * 600;

              const gainNode = audioContext.createGain();
              gainNode.gain.value = cached.volume || 1.0;
              sourceNode.connect(gainNode);
              gainNode.connect(analyser);
              
              if (sequentialMode) {
                const nextBeat = currentSkit.script[sequentialIndex];
                if (nextBeat?.offset < 0) {
                  const speed = cached.speed || 1.0;
                  const duration = Number.isFinite(cached.buffer.duration)
                    ? cached.buffer.duration / speed
                    : getActionDuration(beat);
                  const triggerTime = Math.max(0, duration + nextBeat.offset) * 1000;
                  const currentBeatIndex = sequentialIndex - 1;
                  const sessionId = playSessionId;
                  scheduledAdvanceIndices.add(currentBeatIndex);
                  setTimeout(() => {
                    if (sessionId !== playSessionId) return;
                    processNextSequentialBeat();
                  }, triggerTime);
                }
              }

              sourceNode.onended = onAudioEnd;
              announceAudioStart(
                sourceNode.playbackRate.value * Math.pow(2, sourceNode.detune.value / 1200)
              );
              sourceNode.start(0);
              currentSourceNode = sourceNode;
              currentGainNode = gainNode;
            } else if (cached.audio) {
              // Old-style: Audio element (for live TTS)
              if (sequentialMode) {
                const nextBeat = currentSkit.script[sequentialIndex];
                if (nextBeat?.offset < 0) {
                  const speed = cached.speed || 1.0;
                  const duration = Number.isFinite(cached.audio.duration)
                    ? cached.audio.duration / speed
                    : getActionDuration(beat);
                  const triggerTime = Math.max(0, duration + nextBeat.offset) * 1000;
                  const currentBeatIndex = sequentialIndex - 1;
                  const sessionId = playSessionId;
                  scheduledAdvanceIndices.add(currentBeatIndex);
                  setTimeout(() => {
                    if (sessionId !== playSessionId) return;
                    processNextSequentialBeat();
                  }, triggerTime);
                }
              }
              // Apply speed via playbackRate (note: also affects pitch for Audio elements)
              cached.audio.playbackRate = cached.speed || 1.0;
              cached.audio.onended = onAudioEnd;
              cached.audio.currentTime = 0;
              announceAudioStart(cached.audio.playbackRate);
              cached.audio.play().catch(e => {
                console.warn('Audio play failed:', e);
                onAudioEnd();
              });
            } else {
              // No audio - skip after brief delay
              setTimeout(onAudioEnd, 1500);
            }
          } else {
            // No audio cached - show caption briefly and continue
            setCaptionsEnabled(true);
            document.getElementById('caption').textContent = beat.line;
            document.getElementById('caption').classList.add('visible');
            console.warn(`No audio for: ${cacheKey}`);
            setTimeout(() => {
              document.getElementById('caption').classList.remove('visible');
              if (onComplete) onComplete();
            }, 2000);
          }
          break;
          
        case 'emote':
          setEmotion(beat.who, beat.emotion);
          break;
          
        case 'move':
          moveCharacter(beat.who, beat.to, beat.duration || 1);
          break;
          
        case 'enter':
          enterCharacter(beat.who, beat.from, beat.to);
          break;
          
        case 'exit':
          exitCharacter(beat.who, beat.to);
          break;
          
        case 'follow':
          if (beat.who) followCharacter(beat.who);
          else camera.follow = null;
          break;
          
        case 'look':
          // Handle look directions with both horizontal and vertical support
          let lookDir = beat.at;
          const looker = characters[beat.who];
          if (!looker) break;

          // Character eye level: characters are at bottom:12%, height:40%
          // Eyes are ~25% down from top of character, so eye y ≈ 58% from top
          const CHAR_EYE_Y = 58;
          const V_THRESHOLD = 10; // Vertical difference needed to trigger up/down

          // Helper to calculate compound direction from target coordinates
          function calcLookDir(targetX, targetY) {
            const dir = {};
            dir.h = targetX > looker.x ? 'right' : 'left';
            const yDiff = targetY - CHAR_EYE_Y;
            if (yDiff < -V_THRESHOLD) dir.v = 'up';
            else if (yDiff > V_THRESHOLD) dir.v = 'down';
            return dir;
          }

          if (beat.at === 'audience') {
            // Look away from center (toward camera) - no vertical
            lookDir = looker.x < 50 ? 'left' : 'right';
          } else if (beat.at === 'other') {
            // Look at the other character (same eye level, just horizontal)
            const charNames = Object.keys(characters);
            const other = charNames.find(n => n !== beat.who);
            if (other) {
              lookDir = characters[other].x > looker.x ? 'right' : 'left';
            }
          } else if (characters[beat.at]) {
            // Look at a specific character by name (same eye level)
            lookDir = characters[beat.at].x > looker.x ? 'right' : 'left';
          } else if (props[beat.at]) {
            // Look at a prop - use both x and y
            const prop = props[beat.at];
            lookDir = calcLookDir(prop.x, prop.y);
          } else if (Array.isArray(beat.at)) {
            // Look at a position [x, y]
            lookDir = calcLookDir(beat.at[0], beat.at[1]);
          }
          setEyeDirection(beat.who, lookDir);
          break;
          
        case 'turn':
          setCharacterView(beat.who, beat.to);
          break;
          
        case 'face':
          setFacing(beat.who, beat.dir);
          break;

        // Prop actions
        case 'spawn':
          spawnProp(beat.what, beat.at, beat.who);
          break;

        case 'despawn':
          despawnProp(beat.what);
          break;

        case 'prop-move':
          moveProp(beat.what, beat.to, beat.duration || 1);
          break;

        case 'prop-hold':
          if (beat.svgMount) mountProp(beat.what, beat.who, beat.svgMount);
          else holdProp(beat.what, beat.who, beat.holdOffset);
          break;

        case 'prop-drop':
          dropProp(beat.what, beat.at);
          break;

        case 'prop-rotate':
          rotateProp(beat.what, beat.angle, beat.duration || 0.5);
          break;

        case 'prop-scale':
          scaleProp(beat.what, beat.scale, beat.duration || 0.5);
          break;

        case 'prop-animate':
          animateProp(beat.what, beat.animation, beat.duration || 2);
          break;

        case 'prop-flip':
          flipProp(beat.what, beat.flipped);
          break;
      }
    }

    // === HELPERS ===
    function publishCurrentSkit() {
      if (currentSkitName) {
        publishSkit(currentSkitName);
      } else {
        alert('No skit loaded to publish');
      }
    }
    
    function loadFromUrlInput() {
      const url = document.getElementById('skitUrl').value.trim();
      if (url) {
        loadFromUrl(url);
      }
    }
    
    // === LOAD SKIT FROM INDEXEDDB (browser mode) ===
    async function loadSkitFromIndexedDB(id) {
      if (!window.AITStorageIDB) throw new Error('IndexedDB storage not available');
      const storage = new window.AITStorageIDB();
      await storage.init();
      const rec = await storage.getSkitRecord(id);
      if (!rec) throw new Error(`Skit not found in IndexedDB: ${id}`);
      return { id: rec.id, ...(rec.data || {}) };
    }

    // === LOAD RAW SKIT FROM API ===
    async function loadSkitFromApi(id) {
      console.log('[Player] Loading skit:', id);
      document.getElementById('status').textContent = 'Loading skit...';
      document.getElementById('playBtn').disabled = true;
      window.publishedAssets = null;

      try {
        // Try IndexedDB first (browser mode stores skits there)
        let skit;
        try {
          skit = await loadSkitFromIndexedDB(id);
          console.log('[Player] Loaded skit from IndexedDB');
        } catch (idbErr) {
          console.log('[Player] IndexedDB not available, trying server API:', idbErr.message);
          const resp = await fetch(`/api/skits/${id}`);
          if (!resp.ok) {
            throw new Error(`Failed to load skit: ${resp.status}`);
          }
          skit = await resp.json();
          console.log('[Player] Loaded skit from server API');
        }

        currentSkit = skit;
        currentSkitName = id;
        triggeredBeats = new Set();
        audioCache.clear();

        // Clear stage
        const stage = document.getElementById('stage');
        stage.querySelectorAll('.character').forEach(el => el.remove());
        stage.querySelectorAll('.prop').forEach(el => el.remove());
        Object.keys(characters).forEach(k => delete characters[k]);
        clearAllProps();

        // Set background (with orientation support and legacy fallback)
        if (skit.stage?.background) {
          setBackground(skit.stage.background, skit.stage.orientation || 'landscape');
        }

        // Create characters (voice comes from sprite meta.json, not skit)
        for (const [name, config] of Object.entries(skit.cast || {})) {
          await createCharacter(name, config);
        }

        // Create props
        for (const [id, config] of Object.entries(skit.props || {})) {
          await createProp(id, config);
        }

        // Reset camera
        camera.x = 50; camera.y = 50; camera.zoom = 1; camera.follow = null;
        updateCamera();

        // Set initial eye directions
        const charNames = Object.keys(characters);
        if (charNames.length >= 2) {
          const [char1, char2] = charNames;
          const char1LooksRight = characters[char2].x > characters[char1].x;
          setEyeDirection(char1, char1LooksRight ? 'right' : 'left');
          setEyeDirection(char2, char1LooksRight ? 'left' : 'right');
        }

        // Generate audio and set up cache (same pattern as loadSkit)
        const sayActions = (skit.script || []).filter(b => b.do === 'say');
        const totalLines = sayActions.length;
        const ttsMode = getTtsMode();

        if (ttsMode !== 'none') {
          // For ElevenLabs, assign different voices to each character
          const cloudVoiceMap = {};
          const ttsSettings = getTtsSettings();
          if (ttsMode === 'cloud' && ttsSettings?.ttsProvider === 'elevenlabs' && typeof AITTtsProvider !== 'undefined') {
            const voices = await AITTtsProvider.fetchElevenLabsVoices(ttsSettings.ttsKey);
            if (voices.length) {
              const castNames = Object.keys(skit.cast || {});
              castNames.forEach((name, idx) => {
                cloudVoiceMap[name] = voices[idx % voices.length].id;
                console.log(`[Player] Assigned ElevenLabs voice "${voices[idx % voices.length].name}" to ${name}`);
              });
            }
          }

          for (let i = 0; i < sayActions.length; i++) {
            const beat = sayActions[i];
            document.getElementById('status').textContent = `Generating audio ${i + 1}/${totalLines}...`;

            const char = characters[beat.who];
            if (!char) {
              console.warn(`Character "${beat.who}" not found`);
              continue;
            }

            // Use character's voice from meta.json (with fallback validation)
            let voice = char.voice || DEFAULT_VOICE;
            if (ttsMode !== 'cloud' && ttsMode !== 'custom') {
              if (!VALID_VOICES.includes(voice) && !voice.startsWith('http') && !voice.startsWith('custom:')) {
                console.warn(`Invalid voice "${voice}" for ${beat.who}, using default`);
                voice = DEFAULT_VOICE;
              }
            }

            try {
              const selectedVoice = char.voiceAssigned ? voice : (cloudVoiceMap[beat.who] || voice);
              const blob = await generateAudio(beat.line, selectedVoice);
              if (!blob) continue;
              const audio = new Audio(URL.createObjectURL(blob));
              const source = audioContext.createMediaElementSource(audio);

              // Use gain node for volume
              const gainNode = audioContext.createGain();
              gainNode.gain.value = char.volume !== undefined ? char.volume : 1.0;
              source.connect(gainNode);
              gainNode.connect(analyser);

              // Use sequential index for cache key (API skits don't have t values)
              const cacheKey = `seq-${i}-${beat.who}`;
              audioCache.set(cacheKey, {
                audio,
                beat,
                charName: beat.who,
                gainNode,
                volume: char.volume !== undefined ? char.volume : 1.0,
                speed: char.speed !== undefined ? char.speed : 1.0,
                pitch: char.pitch !== undefined ? char.pitch : 0
              });
            } catch (e) {
              console.error('TTS error for', beat.who, ':', e);
              // Stop on auth errors — no point retrying every line
              if (e.message?.includes('(401)') || e.message?.includes('(403)')) {
                document.getElementById('status').textContent = `TTS auth error: ${e.message}`;
                break;
              }
            }
          }
        }

        if (sayActions.length && audioCache.size === 0) setCaptionsEnabled(true);

        document.getElementById('status').textContent = `Loaded: ${skit.meta?.title || id}`;
        document.getElementById('playBtn').disabled = false;
      } catch (err) {
        console.error('Failed to load skit from API:', err);
        document.getElementById('status').textContent = `Error: ${err.message}`;
      }
    }

    // === INIT ===
    async function init() {
      setPlaybackState('loading');
      console.log('[Player] Init starting...');
      console.log('[Player] URL:', window.location.href);

      // Check for URL parameter to auto-load skit
      const params = new URLSearchParams(window.location.search);

      // Embed mode - hide UI chrome for iframe embedding
      if (params.get('embed') === '1') {
        document.body.classList.add('embed-mode');
      }
      if (params.get('captions') === '1') {
        setCaptionsEnabled(true);
      }

      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.connect(audioContext.destination);
      const skitParam = params.get('skit');
      const urlParam = params.get('url');
      console.log('[Player] Skit param:', skitParam, 'URL param:', urlParam);

      if (urlParam || skitParam) {
        console.log('[Player] Loading skit from param, hiding old buttons...');
        // Hide skit switcher and URL loader immediately
        document.querySelectorAll('#controls button:not(#playBtn):not(#captionBtn)').forEach(b => {
          console.log('[Player] Hiding button:', b.textContent);
          b.style.display = 'none';
        });
        document.getElementById('url-loader').style.display = 'none';

        if (urlParam) {
          // Direct URL to a published skit JSON (e.g. from community page)
          try {
            console.log('[Player] Loading from direct URL:', urlParam);
            await loadFromUrl(urlParam);
            console.log('[Player] Loaded from direct URL');
          } catch (err) {
            console.error('[Player] Failed to load from URL:', err);
            document.getElementById('status').textContent = `Failed to load skit from URL`;
          }
        } else {
          // Try published version first (pre-bundled assets, no TTS needed)
          try {
            console.log('[Player] Trying published version...');
            await loadFromUrl(`published/${skitParam}.json`);
            console.log('[Player] Loaded from published bundle');
          } catch (pubErr) {
            console.warn('[Player] No published version, falling back to API:', pubErr);
            // Fall back to live API (generates TTS on the fly)
            try {
              await loadSkitFromApi(skitParam);
              console.log('[Player] loadSkitFromApi succeeded');
            } catch (apiErr) {
              console.error('[Player] Failed to load skit:', apiErr);
              document.getElementById('status').textContent = `Failed to load skit: ${skitParam}`;
            }
          }
        }
      } else {
        console.log('[Player] No skit param, loading default luckyCharms');
        // No skit param - show default demo skit
        await loadSkit('luckyCharms');
      }
      if (document.body.dataset.playbackState === 'loading') {
        setPlaybackState('ready');
      }
      console.log('[Player] Init complete');
    }

    document.getElementById('playBtn').addEventListener('click', togglePlay);
    document.getElementById('captionBtn').addEventListener('click', toggleCaptions);
    document.getElementById('publishBtn').addEventListener('click', publishCurrentSkit);
    document.getElementById('loadUrlBtn').addEventListener('click', loadFromUrlInput);
    document.querySelectorAll('.demo-skit-btn').forEach((button) => {
      button.addEventListener('click', () => loadSkit(button.dataset.skit));
    });

    init();
