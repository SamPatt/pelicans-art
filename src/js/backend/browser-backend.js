(function initBrowserBackend(global) {
  function createId() {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    return `skit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function blobToDataUrl(blob) {
    if (!blob) return null;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error('Blob read failed'));
      reader.readAsDataURL(blob);
    });
  }

  class AITBrowserBackend {
    constructor(options = {}) {
      this.fetchImpl = options.fetchImpl || fetch.bind(window);
      this.mode = 'browser';
      this.supportsVoiceCreation = false;
      this.storage = new global.AITStorageIDB('ai-improv-theater');
      this.assetUrlCache = new Map();
      this.onUpdateCallback = null;
    }

    async init() {
      await this.storage.init();
      return this;
    }

    _invalidateAssetCache(prefix) {
      for (const [key, url] of this.assetUrlCache.entries()) {
        if (!prefix || key.startsWith(prefix)) {
          URL.revokeObjectURL(url);
          this.assetUrlCache.delete(key);
        }
      }
    }

    async listSprites() {
      return this.storage.listSprites();
    }

    async getSprite(name, variant = 'front') {
      const rec = await this.storage.getSpriteRecord(name);
      if (!rec) throw new Error(`Sprite not found: ${name}`);
      const svg = rec.variants?.[variant] || rec.variants?.front || Object.values(rec.variants || {})[0];
      if (!svg) throw new Error(`Variant not found: ${name}/${variant}`);
      return svg;
    }

    async detectVariants(name) {
      const rec = await this.storage.getSpriteRecord(name);
      if (!rec) return ['front'];
      const keys = Object.keys(rec.variants || {});
      return keys.length ? keys : ['front'];
    }

    async getSpriteMeta(name) {
      const rec = await this.storage.getSpriteRecord(name);
      if (!rec) throw new Error(`Sprite not found: ${name}`);
      return rec.meta || {};
    }

    async saveSprite(name, svg, meta = {}) {
      const existing = await this.storage.getSpriteRecord(name);
      const record = {
        name,
        variants: { ...(existing?.variants || {}), front: svg },
        meta,
        updatedAt: new Date().toISOString()
      };
      await this.storage.saveSpriteRecord(record);
      this._invalidateAssetCache(`sprite:${name}:`);
      this.onUpdateCallback?.({ type: existing ? 'sprite:updated' : 'sprite:created', name });
    }

    async saveSpriteVariant(name, variant, svg) {
      const existing = await this.storage.getSpriteRecord(name);
      if (!existing) throw new Error(`Sprite not found: ${name}`);
      existing.variants = { ...(existing.variants || {}), [variant]: svg };
      existing.updatedAt = new Date().toISOString();
      await this.storage.saveSpriteRecord(existing);
      this._invalidateAssetCache(`sprite:${name}:`);
      this.onUpdateCallback?.({ type: 'sprite:updated', name, variant });
    }

    async deleteSprite(name) {
      await this.storage.deleteSprite(name);
      this._invalidateAssetCache(`sprite:${name}:`);
      this.onUpdateCallback?.({ type: 'sprite:deleted', name });
    }

    async listBackgrounds() {
      return this.storage.listBackgrounds();
    }

    async getBackground(name, orientation = 'landscape') {
      const rec = await this.storage.getBackgroundRecord(name);
      if (!rec) throw new Error(`Background not found: ${name}`);
      const svg = rec.orientations?.[orientation] || rec.orientations?.landscape || Object.values(rec.orientations || {})[0];
      if (!svg) throw new Error(`Background orientation missing: ${name}/${orientation}`);
      return svg;
    }

    async detectBgOrientations(name) {
      const rec = await this.storage.getBackgroundRecord(name);
      if (!rec) return ['landscape'];
      const keys = Object.keys(rec.orientations || {});
      return keys.length ? keys : ['landscape'];
    }

    async saveBackground(name, orientation, svg) {
      const existing = await this.storage.getBackgroundRecord(name);
      const record = {
        name,
        orientations: { ...(existing?.orientations || {}), [orientation || 'landscape']: svg },
        updatedAt: new Date().toISOString()
      };
      await this.storage.saveBackgroundRecord(record);
      this._invalidateAssetCache(`background:${name}:`);
      this.onUpdateCallback?.({ type: existing ? 'background:updated' : 'background:created', name, orientation });
    }

    async deleteBackground(name) {
      await this.storage.deleteBackground(name);
      this._invalidateAssetCache(`background:${name}:`);
      this.onUpdateCallback?.({ type: 'background:deleted', name });
    }

    async listProps() {
      return this.storage.listProps();
    }

    async getProp(name) {
      const rec = await this.storage.getPropRecord(name);
      if (!rec) throw new Error(`Prop not found: ${name}`);
      return { name: rec.name, svg: rec.svg, meta: rec.meta || {} };
    }

    async saveProp(name, svg, meta = {}) {
      const existing = await this.storage.getPropRecord(name);
      await this.storage.savePropRecord({ name, svg, meta, updatedAt: new Date().toISOString() });
      this._invalidateAssetCache(`prop:${name}:`);
      this.onUpdateCallback?.({ type: existing ? 'prop:updated' : 'prop:created', name });
    }

    async deleteProp(name) {
      await this.storage.deleteProp(name);
      this._invalidateAssetCache(`prop:${name}:`);
      this.onUpdateCallback?.({ type: 'prop:deleted', name });
    }

    async listSkits() {
      return this.storage.listSkits();
    }

    async getSkit(id) {
      const rec = await this.storage.getSkitRecord(id);
      if (!rec) throw new Error(`Skit not found: ${id}`);
      return { id: rec.id, ...(rec.data || {}) };
    }

    async saveSkit(id, data) {
      const recordId = id || createId();
      await this.storage.saveSkitRecord({ id: recordId, data: { ...data, id: undefined }, updatedAt: new Date().toISOString() });
      this.onUpdateCallback?.({ type: id ? 'skit:updated' : 'skit:created', skitId: recordId });
      return recordId;
    }

    async deleteSkit(id) {
      await this.storage.deleteSkit(id);
      this.onUpdateCallback?.({ type: 'skit:deleted', skitId: id });
    }

    async generateAsset(request) {
      const settings = global.AITSettings.get();
      if (!settings.apiKey) {
        throw new Error('AI API key required. Open Settings and configure your AI provider key.');
      }

      const type = request.type;
      const orientation = request.orientation || 'landscape';
      const current = request.current;

      const assetsForSkit = {
        backgrounds: await this.listBackgrounds(),
        sprites: await this.listSprites(),
        props: await this.listProps()
      };
      const systemPrompt = global.AITPrompts.getSystemPrompt(type, {
        orientation,
        assets: assetsForSkit
      });

      let userPrompt = request.command || '';
      if (request.mode === 'edit' && current) {
        if (type === 'sprite' || type === 'prop' || type === 'background') {
          const variant = current.variant || 'front';
          let variantContext = '';
          if (variant !== 'front') {
            variantContext = `\nYou are editing the "${variant}" view variant. Maintain the same character design, colors, and proportions.\n`;
          }
          if (current.otherVariants && Object.keys(current.otherVariants).length) {
            variantContext += '\nOther existing views for reference:\n';
            for (const [v, svg] of Object.entries(current.otherVariants)) {
              const capped = svg.length > 3000 ? svg.slice(0, 3000) + '\n<!-- truncated -->' : svg;
              variantContext += `--- ${v} view ---\n${capped}\n`;
            }
          }
          userPrompt = `Modify this existing ${type}.${variantContext}\n\nCurrent:\n${current.svg || ''}\n\nInstruction:\n${request.command}`;
        } else if (type === 'skit') {
          userPrompt = `Modify this skit JSON.\n\nCurrent:\n${JSON.stringify(current.skit || current, null, 2)}\n\nInstruction:\n${request.command}`;
        }
      }

      const raw = await global.AITAiProvider.callLLM(systemPrompt, userPrompt, settings, this.fetchImpl);
      let asset;

      if (type === 'sprite') {
        const parsed = global.AITPrompts.extractJson(raw);
        const svg = parsed.svg ? String(parsed.svg) : global.AITPrompts.extractSvg(raw);
        const meta = parsed.meta || global.AITPrompts.extractMetaFromSvgString(svg) || {};
        asset = { svg, meta };
      } else if (type === 'prop' || type === 'background') {
        asset = { svg: global.AITPrompts.extractSvg(raw) };
      } else if (type === 'skit') {
        const json = global.AITPrompts.extractJson(raw);
        asset = json.skit ? json : { skit: json };
      } else {
        throw new Error(`Unsupported generation type: ${type}`);
      }

      return { success: true, saved: false, asset };
    }

    async _svgToDataUrl(svg) {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    }

    async publishSkit(skitId) {
      const skit = await this.getSkit(skitId);
      const assets = { sprites: {}, spriteMeta: {}, backgrounds: {}, props: {}, propMeta: {}, audio: {} };
      const failures = [];

      const spriteNames = new Set(Object.values(skit.cast || {}).map((c) => c.sprite).filter(Boolean));
      const propNames = new Set(Object.values(skit.props || {}).map((p) => p.prop).filter(Boolean));

      for (const spriteName of spriteNames) {
        try {
          const spriteRec = await this.storage.getSpriteRecord(spriteName);
          if (!spriteRec) throw new Error('missing sprite');
          const variants = spriteRec.variants || {};
          for (const [variantName, svg] of Object.entries(variants)) {
            if (!svg) continue;
            assets.sprites[`${spriteName}-${variantName}`] = await this._svgToDataUrl(svg);
          }
          if (!Object.keys(variants).length) {
            throw new Error('sprite has no variants');
          }
          if (spriteRec.meta) assets.spriteMeta[spriteName] = spriteRec.meta;
        } catch (err) {
          failures.push({ type: 'sprite', name: spriteName, error: err.message });
        }
      }

      if (skit.stage?.background) {
        try {
          const bgSvg = await this.getBackground(skit.stage.background, skit.stage.orientation || 'landscape');
          assets.backgrounds[skit.stage.background] = await this._svgToDataUrl(bgSvg);
        } catch (err) {
          failures.push({ type: 'background', name: skit.stage.background, error: err.message });
        }
      }

      for (const propName of propNames) {
        try {
          const prop = await this.getProp(propName);
          assets.props[propName] = await this._svgToDataUrl(prop.svg);
          if (prop.meta) assets.propMeta[propName] = prop.meta;
        } catch (err) {
          failures.push({ type: 'prop', name: propName, error: err.message });
        }
      }

      const sayActions = (skit.script || []).map((beat, idx) => ({ beat, idx })).filter(({ beat }) => beat.do === 'say');
      const settings = global.AITSettings.get();

      for (const { beat, idx } of sayActions) {
        try {
          const char = skit.cast?.[beat.who];
          if (!char) continue;
          const voice = assets.spriteMeta?.[char.sprite]?.voice?.id || char.voice || settings.ttsVoice || 'alloy';
          const blob = await global.AITTtsProvider.generateSpeech(beat.line, voice, settings, { forPublishing: true }, this.fetchImpl);
          if (blob) {
            assets.audio[`line-${idx}`] = await blobToDataUrl(blob);
          }
        } catch (err) {
          failures.push({ type: 'audio', line: idx, error: err.message });
        }
      }

      const published = {
        meta: skit.meta,
        stage: skit.stage,
        cast: skit.cast,
        props: skit.props || {},
        script: skit.script || [],
        assets,
        publishedAt: new Date().toISOString()
      };

      const text = JSON.stringify(published);
      await this.storage.savePublishedRecord({ id: skitId, data: published, size: text.length, publishedAt: new Date().toISOString() });

      this.onUpdateCallback?.({ type: 'publish:complete', skitId, url: `published/${skitId}.json`, size: text.length });

      return {
        id: skitId,
        url: `published/${skitId}.json`,
        size: text.length,
        failures: failures.length ? failures : undefined,
        complete: failures.length === 0
      };
    }

    async getPublished(skitId) {
      const rec = await this.storage.getPublishedRecord(skitId);
      if (!rec) throw new Error(`Published skit not found: ${skitId}`);
      return rec.data;
    }

    async previewTts(text, voiceConfig) {
      const settings = global.AITSettings.get();
      return global.AITTtsProvider.generateSpeech(text, voiceConfig, settings, { forPublishing: false }, this.fetchImpl);
    }

    async previewCustomVoice() {
      throw new Error('Custom voice preview requires server mode and local voice files.');
    }

    async previewCustomVoiceWav() {
      throw new Error('Custom WAV voice preview requires server mode.');
    }

    async listVoices() {
      return this.storage.listVoices();
    }

    async importVoice(payload) {
      if (!payload?.name || !payload?.data) throw new Error('Invalid voice payload');
      await this.storage.saveVoiceRecord({
        name: payload.name,
        displayName: payload.displayName || payload.name,
        fileType: payload.fileType || 'wav',
        data: payload.data,
        createdAt: new Date().toISOString()
      });
      return { ok: true, name: payload.name };
    }

    async getVoiceFile(name) {
      const rec = await this.storage.getVoiceRecord(name);
      if (!rec) throw new Error('Voice not found');
      return this._voiceToBlob(rec);
    }

    async getVoiceWav(name) {
      const rec = await this.storage.getVoiceRecord(name);
      if (!rec) throw new Error('Voice not found');
      return this._voiceToBlob(rec);
    }

    _voiceToBlob(rec) {
      const binary = atob(rec.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const type = rec.fileType === 'safetensors' ? 'application/octet-stream' : 'audio/wav';
      return new Blob([bytes], { type });
    }

    async analyzeAudio() {
      throw new Error('Voice analysis requires server mode.');
    }

    async processVoice() {
      throw new Error('Voice processing requires server mode.');
    }

    async finalizeVoice() {
      throw new Error('Voice finalize requires server mode.');
    }

    async getAssetUrl(type, name, variant) {
      const key = `${type}:${name}:${variant || ''}`;
      if (this.assetUrlCache.has(key)) return this.assetUrlCache.get(key);

      let svg;
      if (type === 'sprite') svg = await this.getSprite(name, variant || 'front');
      else if (type === 'background') svg = await this.getBackground(name, variant || 'landscape');
      else if (type === 'prop') svg = (await this.getProp(name)).svg;
      else throw new Error(`Unsupported asset type: ${type}`);

      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      this.assetUrlCache.set(key, url);
      return url;
    }

    onUpdate(callback) {
      this.onUpdateCallback = callback;
    }

    disconnect() {
      this._invalidateAssetCache();
    }
  }

  global.AITBrowserBackend = AITBrowserBackend;
})(window);
