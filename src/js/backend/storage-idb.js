(function initStorage(global) {
  const DB_NAME = 'ai-improv-theater';
  const DB_VERSION = 1;
  const STORES = {
    sprites: 'sprites',
    backgrounds: 'backgrounds',
    props: 'props',
    skits: 'skits',
    published: 'published',
    voices: 'voices'
  };

  function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
  }

  class AITStorageIDB {
    constructor(name = DB_NAME) {
      this.name = name;
      this.db = null;
    }

    async init() {
      if (this.db) return this.db;
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(this.name, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORES.sprites)) {
            db.createObjectStore(STORES.sprites, { keyPath: 'name' });
          }
          if (!db.objectStoreNames.contains(STORES.backgrounds)) {
            db.createObjectStore(STORES.backgrounds, { keyPath: 'name' });
          }
          if (!db.objectStoreNames.contains(STORES.props)) {
            db.createObjectStore(STORES.props, { keyPath: 'name' });
          }
          if (!db.objectStoreNames.contains(STORES.skits)) {
            db.createObjectStore(STORES.skits, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORES.published)) {
            db.createObjectStore(STORES.published, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORES.voices)) {
            db.createObjectStore(STORES.voices, { keyPath: 'name' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return this.db;
    }

    async _store(name, mode = 'readonly') {
      const db = await this.init();
      return db.transaction(name, mode).objectStore(name);
    }

    async _get(store, key) {
      const s = await this._store(store, 'readonly');
      return promisifyRequest(s.get(key));
    }

    async _put(store, value) {
      const s = await this._store(store, 'readwrite');
      await promisifyRequest(s.put(value));
      return value;
    }

    async _delete(store, key) {
      const s = await this._store(store, 'readwrite');
      await promisifyRequest(s.delete(key));
    }

    async _all(store) {
      const s = await this._store(store, 'readonly');
      return promisifyRequest(s.getAll());
    }

    async clearAll() {
      await Promise.all(Object.values(STORES).map(async (store) => {
        const s = await this._store(store, 'readwrite');
        await promisifyRequest(s.clear());
      }));
    }

    async listSprites() {
      const rows = await this._all(STORES.sprites);
      return rows.map((r) => ({ name: r.name, description: r.meta?.description || r.meta?.name || r.name }));
    }

    async getSpriteRecord(name) {
      return this._get(STORES.sprites, name);
    }

    async saveSpriteRecord(record) {
      return this._put(STORES.sprites, record);
    }

    async deleteSprite(name) {
      await this._delete(STORES.sprites, name);
    }

    async listBackgrounds() {
      const rows = await this._all(STORES.backgrounds);
      return rows.map((r) => ({
        name: r.name,
        orientations: Object.keys(r.orientations || {}).length ? Object.keys(r.orientations) : ['landscape']
      }));
    }

    async getBackgroundRecord(name) {
      return this._get(STORES.backgrounds, name);
    }

    async saveBackgroundRecord(record) {
      return this._put(STORES.backgrounds, record);
    }

    async deleteBackground(name) {
      await this._delete(STORES.backgrounds, name);
    }

    async listProps() {
      const rows = await this._all(STORES.props);
      return rows.map((r) => ({ name: r.name, description: r.meta?.description || r.name }));
    }

    async getPropRecord(name) {
      return this._get(STORES.props, name);
    }

    async savePropRecord(record) {
      return this._put(STORES.props, record);
    }

    async deleteProp(name) {
      await this._delete(STORES.props, name);
    }

    async listSkits() {
      const rows = await this._all(STORES.skits);
      return rows.map((r) => ({
        id: r.id,
        title: r.data?.meta?.title || 'Untitled',
        description: r.data?.meta?.description,
        updatedAt: r.updatedAt || new Date().toISOString()
      }));
    }

    async getSkitRecord(id) {
      return this._get(STORES.skits, id);
    }

    async saveSkitRecord(record) {
      return this._put(STORES.skits, record);
    }

    async deleteSkit(id) {
      await this._delete(STORES.skits, id);
    }

    async getPublishedRecord(id) {
      return this._get(STORES.published, id);
    }

    async savePublishedRecord(record) {
      return this._put(STORES.published, record);
    }

    async listPublished() {
      return this._all(STORES.published);
    }

    async saveVoiceRecord(record) {
      return this._put(STORES.voices, record);
    }

    async getVoiceRecord(name) {
      return this._get(STORES.voices, name);
    }

    async listVoices() {
      return this._all(STORES.voices);
    }

    async deleteVoice(name) {
      await this._delete(STORES.voices, name);
    }

    async exportAll() {
      const payload = {};
      for (const [key, store] of Object.entries(STORES)) {
        payload[key] = await this._all(store);
      }
      return payload;
    }

    async importAll(payload) {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid import payload');
      }
      for (const [key, store] of Object.entries(STORES)) {
        const rows = Array.isArray(payload[key]) ? payload[key] : [];
        const s = await this._store(store, 'readwrite');
        await promisifyRequest(s.clear());
        for (const row of rows) {
          await promisifyRequest(s.put(row));
        }
      }
    }
  }

  global.AITStorageIDB = AITStorageIDB;
})(window);
