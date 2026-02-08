(function initServerBackend(global) {
  const SPRITE_VARIANTS = ['front', 'back', 'side', 'left', 'right', 'v2', 'v3', 'detailed', 'legacy', 'flop'];
  const BG_ORIENTATIONS = ['landscape', 'portrait'];

  class AITServerBackend {
    constructor(options = {}) {
      this.fetchImpl = options.fetchImpl || fetch.bind(window);
      this.ws = null;
      this.onUpdateCallback = null;
      this.mode = 'server';
      this.supportsVoiceCreation = true;
    }

    async _json(url, init) {
      const response = await this.fetchImpl(url, init);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${init?.method || 'GET'} ${url} failed (${response.status}): ${text}`);
      }
      return response.json();
    }

    async _text(url, init) {
      const response = await this.fetchImpl(url, init);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${init?.method || 'GET'} ${url} failed (${response.status}): ${text}`);
      }
      return response.text();
    }

    async listSprites() { return this._json('/api/sprites'); }
    async getSprite(name, variant = 'front') { return this._text(`sprites/${encodeURIComponent(name)}/${encodeURIComponent(variant)}.svg`); }
    async detectVariants(name) {
      const found = [];
      await Promise.all(SPRITE_VARIANTS.map(async (variant) => {
        try {
          const resp = await this.fetchImpl(`sprites/${encodeURIComponent(name)}/${encodeURIComponent(variant)}.svg`, { method: 'HEAD' });
          if (resp.ok) found.push(variant);
        } catch (_) {}
      }));
      return found.length ? found : ['front'];
    }
    async getSpriteMeta(name) {
      const resp = await this.fetchImpl(`sprites/${encodeURIComponent(name)}/meta.json`);
      if (resp.ok) return resp.json();
      const svg = await this.getSprite(name, 'front');
      return global.AITPrompts?.extractMetaFromSvgString?.(svg) || {};
    }
    async saveSprite(name, svg, meta = {}) {
      const payload = { name, svg, meta };
      let method = 'POST';
      try {
        const existsResponse = await this.fetchImpl(`/api/sprites/${encodeURIComponent(name)}`);
        if (existsResponse.ok) method = 'PUT';
      } catch (_) {}
      if (method === 'PUT') {
        await this._json(`/api/sprites/${encodeURIComponent(name)}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ svg, meta }) });
      } else {
        await this._json('/api/sprites', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
    }
    async saveSpriteVariant(name, variant, svg) {
      await this._json(`/api/sprites/${encodeURIComponent(name)}/variant/${encodeURIComponent(variant)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ svg })
      });
    }
    async deleteSprite(name) {
      const response = await this.fetchImpl(`/api/sprites/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 204) throw new Error('Delete sprite failed');
    }

    async listBackgrounds() { return this._json('/api/backgrounds'); }
    async getBackground(name, orientation = 'landscape') { return this._text(`/api/backgrounds/${encodeURIComponent(name)}/${encodeURIComponent(orientation)}`); }
    async detectBgOrientations(name) {
      const found = [];
      await Promise.all(BG_ORIENTATIONS.map(async (orientation) => {
        try {
          const resp = await this.fetchImpl(`/api/backgrounds/${encodeURIComponent(name)}/${encodeURIComponent(orientation)}`, { method: 'HEAD' });
          if (resp.ok) found.push(orientation);
        } catch (_) {}
      }));
      return found.length ? found : ['landscape'];
    }
    async saveBackground(name, orientation, svg) {
      const payload = { name, svg, orientation };
      const response = await this.fetchImpl(`/api/backgrounds/${encodeURIComponent(name)}/${encodeURIComponent(orientation)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ svg })
      });
      if (!response.ok) {
        await this._json('/api/backgrounds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
    }
    async deleteBackground(name) {
      const response = await this.fetchImpl(`/api/backgrounds/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 204) throw new Error('Delete background failed');
    }

    async listProps() { return this._json('/api/props'); }
    async getProp(name) { return this._json(`/api/props/${encodeURIComponent(name)}`); }
    async saveProp(name, svg, meta = {}) {
      const response = await this.fetchImpl(`/api/props/${encodeURIComponent(name)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ svg, meta })
      });
      if (!response.ok) {
        await this._json('/api/props', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, svg, meta }) });
      }
    }
    async deleteProp(name) {
      const response = await this.fetchImpl(`/api/props/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 204) throw new Error('Delete prop failed');
    }

    async listSkits() { return this._json('/api/skits'); }
    async getSkit(id) { return this._json(`/api/skits/${encodeURIComponent(id)}`); }
    async saveSkit(id, data) {
      if (!id) {
        const created = await this._json('/api/skits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        return created.id;
      }
      await this._json(`/api/skits/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      return id;
    }
    async deleteSkit(id) {
      const response = await this.fetchImpl(`/api/skits/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 204) throw new Error('Delete skit failed');
    }

    async generateAsset(request) { return this._json('/api/agent/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }); }
    async publishSkit(skitId) { return this._json(`/api/publish/${encodeURIComponent(skitId)}`, { method: 'POST' }); }
    async getPublished(skitId) { return this._json(`/api/publish/${encodeURIComponent(skitId)}`); }

    async previewTts(text, voiceConfig) {
      const voice = typeof voiceConfig === 'string' ? voiceConfig : (voiceConfig?.id || 'alba');
      const response = await this.fetchImpl('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice })
      });
      if (!response.ok) throw new Error('TTS preview failed');
      return response.blob();
    }
    async previewCustomVoice(voiceName, text) {
      const response = await this.fetchImpl('/api/voice/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice: voiceName, text })
      });
      if (!response.ok) throw new Error('Custom voice preview failed');
      return response.blob();
    }
    async previewCustomVoiceWav(voiceName, text) {
      const response = await this.fetchImpl('/api/voice/preview-wav', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voice: voiceName, text })
      });
      if (!response.ok) throw new Error('Custom voice WAV preview failed');
      return response.blob();
    }

    async listVoices() { return this._json('/api/voice/list'); }
    async importVoice(payload) { return this._json('/api/voice/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
    async getVoiceFile(name) {
      const response = await this.fetchImpl(`/api/voice/${encodeURIComponent(name)}/file`);
      if (!response.ok) throw new Error('Voice file not found');
      return response.blob();
    }
    async getVoiceWav(name) {
      const response = await this.fetchImpl(`/api/voice/${encodeURIComponent(name)}/wav`);
      if (!response.ok) throw new Error('Voice wav not found');
      return response.blob();
    }
    async analyzeAudio(formData) {
      const response = await this.fetchImpl('/api/voice/analyze', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Analyze audio failed');
      return response.json();
    }
    async processVoice(payload) { return this._json('/api/voice/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
    async finalizeVoice(name, winner) {
      await this._json(`/api/voice/${encodeURIComponent(name)}/finalize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ winner }) });
    }

    async getAssetUrl(type, name, variant) {
      if (type === 'sprite') return `sprites/${encodeURIComponent(name)}/${encodeURIComponent(variant || 'front')}.svg`;
      if (type === 'background') return `backgrounds/${encodeURIComponent(name)}/${encodeURIComponent(variant || 'landscape')}.svg`;
      if (type === 'prop') return `props/${encodeURIComponent(name)}/prop.svg`;
      throw new Error(`Unsupported asset type: ${type}`);
    }

    onUpdate(callback) {
      this.onUpdateCallback = callback;
    }

    connect() {
      if (this.ws) return;
      const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.ws = new WebSocket(`${wsProtocol}//${location.host}/ws`);
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.onUpdateCallback?.(msg);
        } catch (_) {}
      };
      this.ws.onclose = () => {
        this.ws = null;
        setTimeout(() => this.connect(), 3000);
      };
    }

    disconnect() {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    }
  }

  global.AITServerBackend = AITServerBackend;
})(window);
