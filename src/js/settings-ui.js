(function initSettingsUi(global) {
  function q(id) {
    return document.getElementById(id);
  }

  function setStatus(message, type = '') {
    const el = q('ait-settings-status');
    if (!el) return;
    el.textContent = message || '';
    el.className = `ait-settings-status ${type}`.trim();
  }

  function ensureStyles() {
    if (q('ait-settings-style')) return;
    const style = document.createElement('style');
    style.id = 'ait-settings-style';
    style.textContent = `
      .ait-settings-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: none; align-items: center; justify-content: center; z-index: 3000; }
      .ait-settings-backdrop.visible { display: flex; }
      .ait-settings-modal { width: min(760px, 94vw); max-height: 90vh; overflow: auto; background: var(--plumage-white, #fff); color: var(--wing-dark, #222); border-radius: 12px; border: 1px solid var(--sand-warm, #ccc); box-shadow: 0 18px 48px rgba(0,0,0,0.35); padding: 16px; }
      .ait-settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .ait-settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; }
      .ait-settings-grid .full { grid-column: 1 / -1; }
      .ait-settings-grid .row-flex { display:flex; gap:8px; align-items:flex-end; }
      .ait-settings-modal label { font-size: 12px; color: var(--wing-gray, #555); display: block; margin-bottom: 4px; }
      .ait-settings-modal input, .ait-settings-modal select { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--sand-warm, #ccc); background: var(--plumage-cream, #faf8f0); color: var(--wing-dark, #222); }
      .ait-settings-footer { display:flex; justify-content:flex-end; gap:8px; margin-top: 14px; }
      .ait-settings-data { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
      .ait-settings-btn { padding: 8px 12px; border: none; border-radius: 6px; cursor: pointer; }
      .ait-btn-primary { background: var(--ocean-blue, #2D8EC4); color: #fff; }
      .ait-btn-danger { background: #b64848; color: #fff; }
      .ait-btn-neutral { background: var(--plumage-cream, #f5f5f5); border: 1px solid var(--sand-warm, #ccc); color: var(--wing-dark, #222); }
      .ait-small { font-size: 12px; color: var(--wing-gray, #666); }
      .ait-settings-status { margin-top: 10px; min-height: 18px; font-size: 12px; color: var(--wing-gray, #666); }
      .ait-settings-status.ok { color: #0b7a28; }
      .ait-settings-status.error { color: #b64848; }
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (q('ait-settings-backdrop')) return;
    ensureStyles();

    const root = document.createElement('div');
    root.id = 'ait-settings-backdrop';
    root.className = 'ait-settings-backdrop';
    root.innerHTML = `
      <div class="ait-settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
        <div class="ait-settings-header">
          <h3 style="margin:0;">Browser Mode Settings</h3>
          <button id="ait-settings-close" class="ait-settings-btn ait-btn-neutral" type="button">Close</button>
        </div>
        <div class="ait-settings-grid">
          <div>
            <label for="ait-provider">AI Provider</label>
            <select id="ait-provider">
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          <div>
            <label for="ait-model">AI Model</label>
            <input id="ait-model" type="text" placeholder="google/gemini-3-flash-preview">
          </div>

          <div class="full row-flex">
            <div style="flex:1;">
              <label for="ait-api-key">AI API Key</label>
              <input id="ait-api-key" type="password" placeholder="sk-...">
            </div>
            <button id="ait-validate-ai" class="ait-settings-btn ait-btn-neutral" type="button">Validate</button>
          </div>

          <div>
            <label for="ait-tts-mode">TTS Mode</label>
            <select id="ait-tts-mode">
              <option value="none">None (Text only)</option>
              <option value="webspeech">Browser Voices (Web Speech)</option>
              <option value="cloud">Cloud TTS</option>
              <option value="custom">Custom TTS Endpoint</option>
            </select>
          </div>
          <div>
            <label for="ait-tts-provider">Cloud TTS Provider</label>
            <select id="ait-tts-provider">
              <option value="openai">OpenAI</option>
              <option value="elevenlabs">ElevenLabs</option>
            </select>
          </div>

          <div class="full row-flex">
            <div style="flex:1;">
              <label for="ait-tts-key">Cloud TTS API Key</label>
              <input id="ait-tts-key" type="password" placeholder="sk-...">
            </div>
            <button id="ait-validate-tts" class="ait-settings-btn ait-btn-neutral" type="button">Validate</button>
          </div>

          <div class="full">
            <label for="ait-tts-endpoint">Custom TTS Endpoint</label>
            <input id="ait-tts-endpoint" type="url" placeholder="https://example.com/tts">
          </div>
          <div>
            <label for="ait-tts-voice">Cloud Voice</label>
            <input id="ait-tts-voice" type="text" placeholder="alloy">
          </div>
          <div>
            <label for="ait-webspeech-voice">Web Speech Voice Name</label>
            <input id="ait-webspeech-voice" type="text" placeholder="Google US English">
          </div>

          <div class="full">
            <label>Local Data</label>
            <div class="ait-settings-data">
              <button id="ait-export-data" class="ait-settings-btn ait-btn-neutral" type="button">Export Data</button>
              <button id="ait-import-data" class="ait-settings-btn ait-btn-neutral" type="button">Import Data</button>
              <button id="ait-clear-data" class="ait-settings-btn ait-btn-danger" type="button">Clear Data</button>
              <input id="ait-import-file" type="file" accept="application/json" style="display:none;">
            </div>
          </div>

          <div class="full ait-small">Keys are stored locally in your browser and never sent to this app's server in browser mode.</div>
          <div id="ait-settings-status" class="full ait-settings-status"></div>
        </div>
        <div class="ait-settings-footer">
          <button id="ait-clear-keys" class="ait-settings-btn ait-btn-danger" type="button">Remove Keys</button>
          <button id="ait-settings-save" class="ait-settings-btn ait-btn-primary" type="button">Save</button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    q('ait-settings-close').addEventListener('click', close);
    root.addEventListener('click', (event) => {
      if (event.target === root) close();
    });

    q('ait-settings-save').addEventListener('click', save);
    q('ait-clear-keys').addEventListener('click', () => {
      global.AITSettings?.clearKeys?.();
      load();
      setStatus('Removed stored API keys.', 'ok');
      global.dispatchEvent(new CustomEvent('ait:settings-updated'));
    });

    q('ait-validate-ai').addEventListener('click', validateAiKey);
    q('ait-validate-tts').addEventListener('click', validateTtsKey);
    q('ait-export-data').addEventListener('click', exportData);
    q('ait-import-data').addEventListener('click', () => q('ait-import-file').click());
    q('ait-import-file').addEventListener('change', importData);
    q('ait-clear-data').addEventListener('click', clearData);
  }

  function load() {
    const settings = global.AITSettings?.get?.() || {};
    q('ait-provider').value = settings.provider || 'openrouter';
    q('ait-model').value = settings.model || '';
    q('ait-api-key').value = settings.apiKey || '';
    q('ait-tts-mode').value = settings.ttsMode || 'none';
    q('ait-tts-provider').value = settings.ttsProvider || 'openai';
    q('ait-tts-key').value = settings.ttsKey || '';
    q('ait-tts-endpoint').value = settings.ttsEndpoint || '';
    q('ait-tts-voice').value = settings.ttsVoice || 'alloy';
    q('ait-webspeech-voice').value = settings.ttsWebSpeechVoice || '';
    const isBrowserMode = global.backend?.mode === 'browser';
    ['ait-export-data', 'ait-import-data', 'ait-clear-data'].forEach((id) => {
      const btn = q(id);
      if (btn) btn.disabled = !isBrowserMode;
    });
    setStatus(isBrowserMode ? '' : 'Local data tools are available in browser mode only.');
  }

  function save() {
    global.AITSettings?.set?.({
      provider: q('ait-provider').value,
      model: q('ait-model').value.trim(),
      apiKey: q('ait-api-key').value.trim(),
      ttsMode: q('ait-tts-mode').value,
      ttsProvider: q('ait-tts-provider').value,
      ttsKey: q('ait-tts-key').value.trim(),
      ttsEndpoint: q('ait-tts-endpoint').value.trim(),
      ttsVoice: q('ait-tts-voice').value.trim(),
      ttsWebSpeechVoice: q('ait-webspeech-voice').value.trim()
    });
    setStatus('Saved.', 'ok');
    close();
    global.dispatchEvent(new CustomEvent('ait:settings-updated'));
  }

  async function validateAiKey() {
    const provider = q('ait-provider').value;
    const key = q('ait-api-key').value.trim();
    setStatus('Validating AI key...');
    const result = await global.AITAiProvider?.validateKey?.(provider, key);
    if (result?.ok) {
      setStatus('AI key is valid.', 'ok');
    } else {
      setStatus(`AI key validation failed: ${result?.message || 'Unknown error'}`, 'error');
    }
  }

  async function validateTtsKey() {
    const provider = q('ait-tts-provider').value;
    const key = q('ait-tts-key').value.trim();
    setStatus('Validating TTS key...');
    const result = await global.AITTtsProvider?.validateKey?.(provider, key);
    if (result?.ok) {
      setStatus('TTS key is valid.', 'ok');
    } else {
      setStatus(`TTS key validation failed: ${result?.message || 'Unknown error'}`, 'error');
    }
  }

  function requireBrowserStorage() {
    const backend = global.backend;
    if (!backend || backend.mode !== 'browser' || !backend.storage) {
      throw new Error('Local data tools are available in browser mode only.');
    }
    return backend.storage;
  }

  async function exportData() {
    try {
      const storage = requireBrowserStorage();
      setStatus('Exporting local data...');
      const payload = await storage.exportAll();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-improv-theater-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus('Export complete.', 'ok');
    } catch (err) {
      setStatus(err.message || 'Export failed.', 'error');
    }
  }

  async function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const storage = requireBrowserStorage();
      setStatus('Importing local data...');
      const text = await file.text();
      const payload = JSON.parse(text);
      await storage.importAll(payload);
      setStatus('Import complete.', 'ok');
      global.dispatchEvent(new CustomEvent('ait:data-updated'));
    } catch (err) {
      setStatus(err.message || 'Import failed.', 'error');
    } finally {
      event.target.value = '';
    }
  }

  async function clearData() {
    if (!confirm('Delete all local browser assets and skits?')) return;
    try {
      const storage = requireBrowserStorage();
      await storage.clearAll();
      setStatus('Local data cleared.', 'ok');
      global.dispatchEvent(new CustomEvent('ait:data-updated'));
    } catch (err) {
      setStatus(err.message || 'Clear failed.', 'error');
    }
  }

  function open() {
    ensureModal();
    load();
    q('ait-settings-backdrop').classList.add('visible');
  }

  function close() {
    q('ait-settings-backdrop')?.classList.remove('visible');
  }

  function attachButton(selector = '#btn-settings') {
    const button = document.querySelector(selector);
    if (!button || button.dataset.aitSettingsBound === '1') return;
    button.dataset.aitSettingsBound = '1';
    button.addEventListener('click', open);
  }

  global.AITSettingsUI = { open, close, attachButton, ensureModal };
})(window);
