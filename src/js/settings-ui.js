(function initSettingsUi(global) {
  const CUSTOM_MODEL = '__custom__';
  const wizardSteps = ['Start', 'Provider', 'Access', 'Model', 'Voice', 'Ready'];
  const OPENAI_TTS_MODELS = [
    { id: 'gpt-4o-mini-tts', label: 'GPT-4o Mini TTS — recommended' },
    { id: 'tts-1', label: 'TTS-1 — fastest legacy model' },
    { id: 'tts-1-hd', label: 'TTS-1 HD — higher-quality legacy model' }
  ];
  const ELEVENLABS_TTS_MODELS = [
    { id: 'eleven_multilingual_v2', label: 'Multilingual v2 — recommended' },
    { id: 'eleven_flash_v2_5', label: 'Flash v2.5 — lower latency' },
    { id: 'eleven_v3', label: 'Eleven v3 — most expressive' }
  ];
  const HERMES_TTS_ENDPOINT = ''; // Hosted endpoints are supplied by the user.
  const LOCAL_TTS_ENDPOINT = 'http://127.0.0.1:8000/v1/audio/speech';
  let wizardState = null;
  let wizardCallbacks = {};

  function q(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function providerInfo(provider) {
    return global.AITModelCatalog?.getProvider?.(provider) || {
      label: provider,
      description: '',
      keyUrl: '#',
      defaultModel: '',
      models: []
    };
  }

  function populateModelSelect(select, provider, currentModel) {
    if (!select) return;
    const info = providerInfo(provider);
    select.innerHTML = '';
    info.models.forEach((model) => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = `${model.label} — ${model.note}`;
      select.appendChild(option);
    });
    const custom = document.createElement('option');
    custom.value = CUSTOM_MODEL;
    custom.textContent = 'Other model ID…';
    select.appendChild(custom);

    if (info.models.some((model) => model.id === currentModel)) {
      select.value = currentModel;
    } else if (currentModel) {
      select.value = CUSTOM_MODEL;
    } else {
      select.value = info.defaultModel;
    }
  }

  function selectedModel(select, customInput) {
    if (!select) return '';
    return select.value === CUSTOM_MODEL ? customInput?.value.trim() || '' : select.value;
  }

  function ensureStyles() {
    if (q('ait-settings-style')) return;
    const style = document.createElement('style');
    style.id = 'ait-settings-style';
    style.textContent = `
      .ait-overlay { position:fixed; inset:0; z-index:3500; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(22,38,48,.72); backdrop-filter:blur(5px); }
      .ait-overlay.visible { display:flex; }
      .ait-dialog { width:min(760px,96vw); max-height:92vh; overflow:auto; border:1px solid var(--sand-warm,#cbbd9e); border-radius:18px; background:var(--plumage-white,#fff); color:var(--wing-dark,#202d35); box-shadow:0 26px 80px rgba(12,31,42,.34); }
      .ait-dialog-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:22px 24px 16px; }
      .ait-dialog-header h2,.ait-dialog-header h3 { margin:0; letter-spacing:-.025em; }
      .ait-dialog-header p { margin:5px 0 0; color:var(--wing-gray,#60717c); font-size:14px; }
      .ait-close { border:1px solid var(--sand-warm,#cbbd9e); border-radius:999px; width:34px; height:34px; cursor:pointer; background:var(--plumage-cream,#f7f2e6); color:inherit; font-size:18px; }
      .ait-close:focus-visible,.ait-btn:focus-visible,.ait-choice:focus-visible,.ait-tab:focus-visible,input:focus-visible,select:focus-visible { outline:3px solid color-mix(in srgb,var(--ocean-blue,#2d8ec4) 45%,transparent); outline-offset:2px; }
      .ait-tabs { display:flex; gap:4px; padding:0 24px; border-bottom:1px solid var(--sand-warm,#d8ceb7); overflow-x:auto; }
      .ait-tab { border:0; border-bottom:3px solid transparent; padding:10px 13px; color:var(--wing-gray,#60717c); background:transparent; cursor:pointer; font-weight:700; white-space:nowrap; }
      .ait-tab.active { color:var(--ocean-dark,#165d83); border-bottom-color:var(--pouch-orange,#e8843c); }
      .ait-panel { display:none; padding:22px 24px 8px; }
      .ait-panel.active { display:block; }
      .ait-section-title { margin:0 0 4px; font-size:18px; }
      .ait-section-copy { margin:0 0 18px; color:var(--wing-gray,#60717c); font-size:14px; line-height:1.5; }
      .ait-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:15px; }
      .ait-field.full,.ait-form-grid > .full { grid-column:1/-1; }
      .ait-field label { display:block; margin:0 0 6px; color:var(--wing-gray,#60717c); font-size:12px; font-weight:700; letter-spacing:.02em; }
      .ait-field input,.ait-field select,.ait-field textarea { width:100%; box-sizing:border-box; min-height:42px; padding:9px 11px; border:1px solid var(--sand-warm,#cbbd9e); border-radius:8px; background:var(--plumage-cream,#fbf8ef); color:inherit; font:inherit; }
      .ait-field textarea { min-height:72px; resize:vertical; }
      .ait-field input[type="range"] { min-height:auto; padding:0; accent-color:var(--ocean-blue,#2d8ec4); }
      .ait-inline { display:flex; align-items:flex-end; gap:8px; }
      .ait-inline > :first-child { flex:1; }
      .ait-check { display:flex; gap:8px; align-items:flex-start; color:var(--wing-gray,#60717c); font-size:13px; line-height:1.4; }
      .ait-check input { width:auto; min-height:auto; margin-top:2px; }
      .ait-help { margin-top:7px; color:var(--wing-gray,#60717c); font-size:12px; line-height:1.45; }
      .ait-help a { color:var(--ocean-dark,#165d83); }
      .ait-status { min-height:20px; padding:8px 24px 0; color:var(--wing-gray,#60717c); font-size:13px; }
      .ait-status.ok { color:#237245; }.ait-status.error { color:#a43f3f; }
      .ait-footer { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:18px 24px 22px; }
      .ait-footer-actions { display:flex; gap:8px; margin-left:auto; }
      .ait-btn { min-height:40px; padding:9px 14px; border:1px solid transparent; border-radius:8px; cursor:pointer; font-weight:700; }
      .ait-btn:disabled { opacity:.5; cursor:not-allowed; }
      .ait-btn-primary { background:var(--ocean-blue,#2d8ec4); color:#fff; }
      .ait-btn-secondary { border-color:var(--sand-warm,#cbbd9e); background:var(--plumage-cream,#f7f2e6); color:inherit; }
      .ait-btn-danger { background:#b95850; color:#fff; }
      .ait-data-actions { display:flex; flex-wrap:wrap; gap:8px; }
      .ait-data-danger { margin-top:20px; padding-top:18px; border-top:1px solid var(--sand-warm,#d8ceb7); }
      .ait-voice-note { grid-column:1/-1; padding:12px 14px; border-left:4px solid var(--pouch-orange,#e8843c); border-radius:7px; background:var(--plumage-cream,#fbf8ef); color:var(--wing-gray,#60717c); font-size:13px; line-height:1.5; }
      .ait-location-choice { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .ait-location-choice label { position:relative; display:block; cursor:pointer; }
      .ait-location-choice input { position:absolute; opacity:0; pointer-events:none; }
      .ait-location-card { display:block; min-height:74px; padding:12px; border:1px solid var(--sand-warm,#cbbd9e); border-radius:9px; background:var(--plumage-cream,#fbf8ef); }
      .ait-location-card strong { display:block; margin-bottom:4px; color:var(--wing-dark,#202d35); }
      .ait-location-card span { color:var(--wing-gray,#60717c); font-size:12px; line-height:1.4; }
      .ait-location-choice input:checked + .ait-location-card { border-color:var(--ocean-blue,#2d8ec4); box-shadow:inset 0 0 0 2px var(--ocean-blue,#2d8ec4); background:color-mix(in srgb,var(--ocean-blue,#2d8ec4) 8%,var(--plumage-cream,#fbf8ef)); }
      .ait-location-choice input:focus-visible + .ait-location-card { outline:3px solid color-mix(in srgb,var(--ocean-blue,#2d8ec4) 45%,transparent); outline-offset:2px; }
      .ait-range-value { float:right; color:var(--wing-dark,#202d35); font-variant-numeric:tabular-nums; }
      .ait-test-row { display:flex; align-items:flex-end; gap:8px; }
      .ait-test-row .ait-field { flex:1; }
      .ait-hidden { display:none !important; }
      .ait-connection-summary { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px; }
      .ait-chip { padding:6px 9px; border-radius:999px; background:var(--plumage-cream,#f7f2e6); color:var(--wing-gray,#60717c); font-size:12px; font-weight:700; }
      .ait-chip.connected { background:#e2f3e8; color:#27643d; }
      .ait-wizard { width:min(820px,96vw); }
      .ait-marquee { display:grid; grid-template-columns:repeat(6,1fr); gap:5px; padding:0 24px 18px; }
      .ait-marquee-step { position:relative; padding-top:13px; color:var(--wing-gray,#60717c); font-size:10px; text-align:center; text-transform:uppercase; letter-spacing:.07em; }
      .ait-marquee-step::before { content:''; position:absolute; top:0; left:calc(50% - 4px); width:8px; height:8px; border-radius:50%; background:var(--sand-warm,#cbbd9e); box-shadow:0 0 0 3px var(--plumage-white,#fff); }
      .ait-marquee-step.done::before { background:var(--ocean-blue,#2d8ec4); }
      .ait-marquee-step.active { color:var(--wing-dark,#202d35); font-weight:800; }
      .ait-marquee-step.active::before { background:var(--pouch-orange,#e8843c); box-shadow:0 0 0 3px var(--plumage-white,#fff),0 0 0 5px color-mix(in srgb,var(--pouch-orange,#e8843c) 28%,transparent); }
      .ait-wizard-body { padding:18px 24px 8px; min-height:285px; }
      .ait-wizard-kicker { margin:0 0 6px; color:var(--pouch-orange,#d66f2e); font-size:12px; font-weight:900; text-transform:uppercase; letter-spacing:.09em; }
      .ait-wizard-body h2 { margin:0 0 8px; font-size:28px; letter-spacing:-.035em; }
      .ait-wizard-lede { max-width:620px; margin:0 0 20px; color:var(--wing-gray,#60717c); line-height:1.55; }
      .ait-choice-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .ait-choice-grid.providers { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .ait-choice { position:relative; min-height:115px; padding:16px; border:1px solid var(--sand-warm,#cbbd9e); border-radius:12px; background:var(--plumage-cream,#fbf8ef); color:inherit; cursor:pointer; text-align:left; transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease; }
      .ait-choice:hover { transform:translateY(-2px); border-color:var(--ocean-blue,#2d8ec4); box-shadow:0 8px 22px rgba(30,75,98,.1); }
      .ait-choice.selected { border:2px solid var(--ocean-blue,#2d8ec4); background:#eef8fc; }
      .ait-choice strong { display:block; margin-bottom:6px; font-size:16px; }
      .ait-choice span { display:block; color:var(--wing-gray,#60717c); font-size:13px; line-height:1.45; }
      .ait-choice-badge { position:absolute; top:10px; right:10px; padding:3px 7px; border-radius:999px; background:var(--pouch-orange,#e8843c); color:white !important; font-size:9px !important; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
      .ait-ready-card { padding:17px; border:1px solid var(--sand-warm,#cbbd9e); border-radius:12px; background:var(--plumage-cream,#fbf8ef); }
      .ait-ready-row { display:flex; justify-content:space-between; gap:20px; padding:8px 0; border-bottom:1px solid color-mix(in srgb,var(--sand-warm,#cbbd9e) 65%,transparent); }
      .ait-ready-row:last-child { border-bottom:0; }.ait-ready-row span { color:var(--wing-gray,#60717c); }
      .ait-wizard-message { min-height:20px; margin-top:12px; font-size:13px; color:var(--wing-gray,#60717c); }
      .ait-wizard-message.error { color:#a43f3f; }.ait-wizard-message.ok { color:#237245; }
      @media (max-width:680px) {
        .ait-overlay { padding:8px; align-items:flex-end; }.ait-dialog { width:100%; max-height:96vh; border-radius:18px 18px 0 0; }
        .ait-form-grid,.ait-choice-grid,.ait-choice-grid.providers { grid-template-columns:1fr; }
        .ait-dialog-header,.ait-panel,.ait-wizard-body { padding-left:17px; padding-right:17px; }.ait-tabs,.ait-marquee { padding-left:17px; padding-right:17px; }.ait-footer { padding-left:17px; padding-right:17px; }.ait-marquee-step { font-size:0; }
      }
      @media (prefers-reduced-motion:reduce) { .ait-choice { transition:none; } }
    `;
    document.head.appendChild(style);
  }

  function setStatus(message, type = '') {
    const el = q('ait-settings-status');
    if (!el) return;
    el.textContent = message || '';
    el.className = `ait-status ${type}`.trim();
  }

  function ensureModal() {
    if (q('ait-settings-backdrop')) return;
    ensureStyles();
    const root = document.createElement('div');
    root.id = 'ait-settings-backdrop';
    root.className = 'ait-overlay';
    root.innerHTML = `
      <div class="ait-dialog" role="dialog" aria-modal="true" aria-labelledby="ait-settings-title">
        <div class="ait-dialog-header"><div><h3 id="ait-settings-title">Studio settings</h3><p>Change only the parts of the studio you use.</p></div><button id="ait-settings-close" class="ait-close" type="button" aria-label="Close settings">×</button></div>
        <div class="ait-tabs" role="tablist"><button class="ait-tab active" data-tab="ai" type="button" role="tab" aria-selected="true">AI</button><button class="ait-tab" data-tab="voice" type="button" role="tab" aria-selected="false">Voices</button><button class="ait-tab" data-tab="data" type="button" role="tab" aria-selected="false">Data</button><button class="ait-tab" data-tab="advanced" type="button" role="tab" aria-selected="false">Advanced</button></div>
        <section class="ait-panel active" data-panel="ai" role="tabpanel">
          <div id="ait-connection-summary" class="ait-connection-summary"></div><h4 class="ait-section-title">AI generation</h4><p class="ait-section-copy">A provider key is needed only when you generate or revise something with AI.</p>
          <div class="ait-form-grid"><div class="ait-field"><label for="ait-provider">Provider</label><select id="ait-provider"></select></div><div class="ait-field"><label for="ait-model">Model</label><select id="ait-model"></select></div><div id="ait-model-custom-field" class="ait-field full ait-hidden"><label for="ait-model-custom">Other model ID</label><input id="ait-model-custom" autocomplete="off"></div><div class="ait-field full"><div class="ait-inline"><div><label for="ait-api-key">API key</label><input id="ait-api-key" type="password" autocomplete="off" placeholder="Paste your provider key"></div><button id="ait-validate-ai" class="ait-btn ait-btn-secondary" type="button">Check key</button></div><div id="ait-provider-help" class="ait-help"></div></div><label class="ait-check full"><input id="ait-remember-keys" type="checkbox"><span>Remember keys on this device. Leave this off to keep them only until this browser session ends.</span></label></div>
        </section>
        <section class="ait-panel" data-panel="voice" role="tabpanel">
          <h4 class="ait-section-title">Voice source</h4>
          <p class="ait-section-copy">Connect speech here. Choose and test voices on a character or in a skit's cast.</p>
          <div class="ait-form-grid">
            <div class="ait-field full"><label for="ait-tts-mode">How should dialogue play?</label><select id="ait-tts-mode"><option value="none">No voices (captions only)</option><option value="cloud">Cloud provider</option><option value="custom">Custom TTS</option></select></div>
            <div class="ait-voice-note ait-none-field">No connection needed. Captions turn on automatically and dialogue keeps readable timing.</div>

            <div class="ait-field ait-cloud-field"><label for="ait-tts-provider">Cloud provider</label><select id="ait-tts-provider"><option value="openai">OpenAI</option><option value="elevenlabs">ElevenLabs</option></select></div>
            <div class="ait-field ait-cloud-field"><label for="ait-tts-model">Speech model</label><select id="ait-tts-model"></select></div>
            <div class="ait-field full ait-cloud-field"><div class="ait-inline"><div><label for="ait-tts-key">Provider API key</label><input id="ait-tts-key" type="password" autocomplete="off" placeholder="Paste the voice provider key"></div><button id="ait-use-ai-key" class="ait-btn ait-btn-secondary" type="button">Use AI key</button><button id="ait-validate-tts" class="ait-btn ait-btn-secondary" type="button">Check connection</button></div><div class="ait-help">Voice selection lives with each character, not in Settings.</div></div>
            <div class="ait-field full ait-openai-field"><label for="ait-tts-instructions">Default speaking direction (optional)</label><textarea id="ait-tts-instructions" placeholder="Dry, patient delivery with a brief pause before the last sentence."></textarea><div class="ait-help">Used by GPT-4o Mini TTS for every character unless a future skit control overrides it.</div></div>
            <div class="ait-field ait-eleven-field"><label for="ait-tts-stability">Stability <span id="ait-tts-stability-value" class="ait-range-value"></span></label><input id="ait-tts-stability" type="range" min="0" max="1" step="0.05"></div>
            <div class="ait-field ait-eleven-field"><label for="ait-tts-similarity">Similarity <span id="ait-tts-similarity-value" class="ait-range-value"></span></label><input id="ait-tts-similarity" type="range" min="0" max="1" step="0.05"></div>
            <div class="ait-field ait-eleven-field"><label for="ait-tts-style">Style exaggeration <span id="ait-tts-style-value" class="ait-range-value"></span></label><input id="ait-tts-style" type="range" min="0" max="1" step="0.05"></div>
            <label class="ait-check ait-eleven-field"><input id="ait-tts-speaker-boost" type="checkbox"><span>Use speaker boost</span></label>

            <div class="ait-field full ait-custom-field"><label>Where is the TTS server?</label><div class="ait-location-choice"><label><input type="radio" name="ait-tts-custom-location" value="local"><span class="ait-location-card"><strong>On this computer</strong><span>Connect to a TTS app listening on localhost.</span></span></label><label><input type="radio" name="ait-tts-custom-location" value="hosted"><span class="ait-location-card"><strong>Hosted elsewhere</strong><span>Connect to a VPS, tailnet service, or public API.</span></span></label></div></div>
            <div class="ait-field ait-custom-field"><label for="ait-tts-custom-preset">API format</label><select id="ait-tts-custom-preset"><option value="openai-compatible">OpenAI-compatible</option><option value="hermes-piper">Hermes / Piper</option><option value="generic-json">Generic JSON</option><option value="generic-form">Generic form-data</option></select></div>
            <div class="ait-field ait-custom-field ait-custom-model-field"><label for="ait-tts-custom-model">Model name (optional)</label><input id="ait-tts-custom-model" autocomplete="off" placeholder="tts-1"></div>
            <div class="ait-field full ait-custom-field"><label for="ait-tts-endpoint">Speech endpoint</label><input id="ait-tts-endpoint" type="url" autocomplete="off" placeholder="http://127.0.0.1:8000/v1/audio/speech"><div id="ait-tts-endpoint-help" class="ait-help"></div></div>
            <div class="ait-field full ait-custom-field"><label for="ait-tts-voices-endpoint">Voice list URL (optional)</label><input id="ait-tts-voices-endpoint" type="url" autocomplete="off" placeholder="http://127.0.0.1:8000/v1/audio/voices"><div class="ait-help">If your server provides a voice-list API, character and skit dropdowns load it. Otherwise they allow a manual voice ID.</div></div>
            <div class="ait-field ait-custom-field"><label for="ait-tts-auth-header">Authentication header (optional)</label><input id="ait-tts-auth-header" autocomplete="off" placeholder="Authorization"></div>
            <div class="ait-field ait-custom-field"><label for="ait-tts-auth-token">Authentication token (optional)</label><input id="ait-tts-auth-token" type="password" autocomplete="off" placeholder="Bearer …"><div class="ait-help">The private preview can supply its Hermes credential when left blank.</div></div>

            <label class="ait-check full ait-voice-secret-field"><input id="ait-remember-voice-keys" type="checkbox"><span>Remember voice keys and tokens on this device. Leave this off to keep them only for this browser session.</span></label>
          </div>
        </section>
        <section class="ait-panel" data-panel="data" role="tabpanel"><h4 class="ait-section-title">Projects in this browser</h4><p class="ait-section-copy">Back up or move your locally stored characters, scenery, props, and skits.</p><div class="ait-data-actions"><button id="ait-export-data" class="ait-btn ait-btn-secondary" type="button">Export backup</button><button id="ait-import-data" class="ait-btn ait-btn-secondary" type="button">Import backup</button><input id="ait-import-file" type="file" accept="application/json" hidden></div><div class="ait-data-danger"><h4 class="ait-section-title">Clear local projects</h4><p class="ait-section-copy">This cannot be undone unless you exported a backup.</p><button id="ait-clear-data" class="ait-btn ait-btn-danger" type="button">Clear all browser data</button></div></section>
        <section class="ait-panel" data-panel="advanced" role="tabpanel"><h4 class="ait-section-title">Stored credentials</h4><p class="ait-section-copy">Keys and TTS tokens are kept for this session unless you choose to remember them on this device.</p><div class="ait-data-danger"><button id="ait-clear-keys" class="ait-btn ait-btn-danger" type="button">Remove saved keys and tokens</button></div></section>
        <div id="ait-settings-status" class="ait-status" role="status"></div><div class="ait-footer"><span class="ait-help">Cloud keys go directly to their provider. Private TTS endpoints may use the local relay.</span><div class="ait-footer-actions"><button id="ait-settings-cancel" class="ait-btn ait-btn-secondary" type="button">Cancel</button><button id="ait-settings-save" class="ait-btn ait-btn-primary" type="button">Save changes</button></div></div>
      </div>`;
    document.body.appendChild(root);

    Object.entries(global.AITModelCatalog?.providers || {}).forEach(([id, info]) => q('ait-provider').add(new Option(info.label, id)));
    root.addEventListener('click', (event) => { if (event.target === root) close(); });
    root.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); }, true);
    q('ait-settings-close').addEventListener('click', close); q('ait-settings-cancel').addEventListener('click', close); q('ait-settings-save').addEventListener('click', save);
    q('ait-provider').addEventListener('change', () => updateProviderFields(true)); q('ait-model').addEventListener('change', updateCustomModelVisibility); q('ait-tts-mode').addEventListener('change', updateVoiceFields);
    q('ait-tts-provider').addEventListener('change', () => {
      populateTtsModels(true);
      updateVoiceFields();
    });
    q('ait-tts-custom-preset').addEventListener('change', () => updateCustomPreset(true));
    root.querySelectorAll('input[name="ait-tts-custom-location"]').forEach((input) => input.addEventListener('change', () => updateCustomLocation(true)));
    ['ait-tts-stability','ait-tts-similarity','ait-tts-style'].forEach((id) => q(id).addEventListener('input', updateRangeLabels));
    q('ait-remember-keys').addEventListener('change', () => { q('ait-remember-voice-keys').checked = q('ait-remember-keys').checked; });
    q('ait-remember-voice-keys').addEventListener('change', () => { q('ait-remember-keys').checked = q('ait-remember-voice-keys').checked; });
    q('ait-validate-ai').addEventListener('click', validateAiKey); q('ait-validate-tts').addEventListener('click', validateTtsKey);
    q('ait-use-ai-key').addEventListener('click', () => { q('ait-tts-key').value = q('ait-api-key').value; setStatus('Copied the AI key into cloud voice settings.', 'ok'); });
    q('ait-clear-keys').addEventListener('click', () => { global.AITSettings?.clearKeys?.(); load(); setStatus('Removed stored API keys.', 'ok'); global.dispatchEvent(new CustomEvent('ait:settings-updated')); });
    q('ait-export-data').addEventListener('click', exportData); q('ait-import-data').addEventListener('click', () => q('ait-import-file').click()); q('ait-import-file').addEventListener('change', importData); q('ait-clear-data').addEventListener('click', clearData);
    root.querySelectorAll('.ait-tab').forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
  }

  function showTab(name) {
    document.querySelectorAll('#ait-settings-backdrop .ait-tab').forEach((tab) => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('#ait-settings-backdrop .ait-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === name));
  }

  function updateProviderFields(resetModel = false) {
    const provider = q('ait-provider').value;
    const info = providerInfo(provider);
    const current = resetModel ? info.defaultModel : q('ait-model-custom').dataset.savedModel || '';
    populateModelSelect(q('ait-model'), provider, current);
    q('ait-model-custom').value = current && !info.models.some((model) => model.id === current) ? current : '';
    q('ait-provider-help').innerHTML = `${escapeHtml(info.description)} <a href="${escapeHtml(info.keyUrl)}" target="_blank" rel="noopener">Create a ${escapeHtml(info.label)} key ↗</a>`;
    updateCustomModelVisibility();
  }

  function updateCustomModelVisibility() { q('ait-model-custom-field')?.classList.toggle('ait-hidden', q('ait-model')?.value !== CUSTOM_MODEL); }

  function populateTtsModels(reset = false) {
    const select = q('ait-tts-model');
    if (!select) return;
    const provider = q('ait-tts-provider')?.value || 'openai';
    const models = provider === 'elevenlabs' ? ELEVENLABS_TTS_MODELS : OPENAI_TTS_MODELS;
    const current = reset ? models[0].id : select.dataset.savedModel || select.value;
    select.innerHTML = models.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.label)}</option>`).join('');
    select.value = models.some((model) => model.id === current) ? current : models[0].id;
    select.dataset.savedModel = select.value;
  }

  function updateRangeLabels() {
    ['stability','similarity','style'].forEach((name) => {
      const input = q(`ait-tts-${name}`);
      const output = q(`ait-tts-${name}-value`);
      if (input && output) output.textContent = Number(input.value).toFixed(2);
    });
  }

  function updateCustomPreset(resetEndpoint = false) {
    const preset = q('ait-tts-custom-preset')?.value || 'generic-form';
    const location = document.querySelector('input[name="ait-tts-custom-location"]:checked')?.value || 'local';
    if (preset === 'hermes-piper') {
      if (resetEndpoint || !q('ait-tts-endpoint').value) q('ait-tts-endpoint').value = location === 'local' ? 'http://127.0.0.1:8787' : HERMES_TTS_ENDPOINT;
      if (resetEndpoint || !q('ait-tts-auth-header').value) q('ait-tts-auth-header').value = 'X-Watch-Token';
      q('ait-tts-endpoint-help').textContent = location === 'local' ? 'Your browser connects to this service on the same computer. The TTS app must be running and allow this site, unless you use the private studio relay.' : 'The private studio can relay a tailnet or non-CORS endpoint. A public static page needs HTTPS and browser CORS.';
    } else if (preset === 'openai-compatible') {
      if (resetEndpoint || !q('ait-tts-endpoint').value) q('ait-tts-endpoint').value = location === 'local' ? LOCAL_TTS_ENDPOINT : '';
      q('ait-tts-endpoint-help').textContent = location === 'local' ? 'Enter the local OpenAI-compatible speech URL exposed by your TTS app.' : 'Enter the full HTTPS or private-network speech URL supplied by the host.';
    } else {
      q('ait-tts-endpoint-help').textContent = location === 'local' ? 'Enter the localhost URL exposed by your TTS app.' : 'The private studio can relay this request. A public static deployment requires HTTPS and browser CORS.';
    }
    q('ait-tts-custom-model')?.closest('.ait-custom-model-field')?.classList.toggle('ait-hidden', preset !== 'openai-compatible');
  }

  function updateCustomLocation(resetEndpoint = false) {
    updateCustomPreset(resetEndpoint);
    const location = document.querySelector('input[name="ait-tts-custom-location"]:checked')?.value || 'local';
    const endpoint = q('ait-tts-endpoint');
    const voicesEndpoint = q('ait-tts-voices-endpoint');
    endpoint.placeholder = location === 'local' ? LOCAL_TTS_ENDPOINT : 'https://voices.example.com/v1/audio/speech';
    voicesEndpoint.placeholder = location === 'local' ? 'http://127.0.0.1:8000/v1/audio/voices' : 'https://voices.example.com/v1/audio/voices';
  }

  function updateVoiceFields() {
    const mode = q('ait-tts-mode')?.value;
    const provider = q('ait-tts-provider')?.value || 'openai';
    document.querySelectorAll('.ait-cloud-field').forEach((el) => el.classList.toggle('ait-hidden', mode !== 'cloud'));
    document.querySelectorAll('.ait-custom-field').forEach((el) => el.classList.toggle('ait-hidden', mode !== 'custom'));
    document.querySelectorAll('.ait-none-field').forEach((el) => el.classList.toggle('ait-hidden', mode !== 'none'));
    document.querySelectorAll('.ait-voice-secret-field').forEach((el) => el.classList.toggle('ait-hidden', mode === 'none'));
    document.querySelectorAll('.ait-openai-field').forEach((el) => el.classList.toggle('ait-hidden', mode !== 'cloud' || provider !== 'openai'));
    document.querySelectorAll('.ait-eleven-field').forEach((el) => el.classList.toggle('ait-hidden', mode !== 'cloud' || provider !== 'elevenlabs'));
    q('ait-use-ai-key')?.classList.toggle('ait-hidden', mode !== 'cloud' || provider !== 'openai');
    q('ait-validate-tts').textContent = 'Check connection';
    if (mode === 'custom') updateCustomLocation(false);
  }

  function updateConnectionSummary(settings) {
    const ai = settings.apiKey ? `${providerInfo(settings.provider).label} connected` : 'AI not connected';
    const voiceLabels = { none:'No voices (captions only)', cloud:`Cloud: ${settings.ttsProvider === 'elevenlabs' ? 'ElevenLabs' : 'OpenAI'}`, custom:`Custom TTS: ${settings.ttsCustomLocation === 'hosted' ? 'hosted' : 'this computer'}` };
    q('ait-connection-summary').innerHTML = `<span class="ait-chip ${settings.apiKey ? 'connected' : ''}">${escapeHtml(ai)}</span><span class="ait-chip">${escapeHtml(voiceLabels[settings.ttsMode] || 'No voices (captions only)')}</span><span class="ait-chip">Storage: this browser</span>`;
  }

  function load() {
    const settings = global.AITSettings?.get?.() || {};
    q('ait-provider').value = settings.provider || 'openai';
    q('ait-model-custom').dataset.savedModel = settings.model || '';
    updateProviderFields(false);
    populateModelSelect(q('ait-model'), q('ait-provider').value, settings.model);
    if (q('ait-model').value === CUSTOM_MODEL) q('ait-model-custom').value = settings.model || '';
    q('ait-api-key').value = settings.apiKey || '';
    q('ait-remember-keys').checked = Boolean(settings.rememberKeys);
    q('ait-remember-voice-keys').checked = Boolean(settings.rememberKeys);
    q('ait-tts-mode').value = settings.ttsMode || 'none';
    q('ait-tts-provider').value = settings.ttsProvider || 'openai';
    q('ait-tts-key').value = settings.ttsKey || '';
    q('ait-tts-model').dataset.savedModel = settings.ttsModel || '';
    populateTtsModels(false);
    q('ait-tts-instructions').value = settings.ttsInstructions || '';
    q('ait-tts-endpoint').value = settings.ttsEndpoint || '';
    q('ait-tts-custom-preset').value = settings.ttsCustomPreset || 'openai-compatible';
    q('ait-tts-voices-endpoint').value = settings.ttsVoicesEndpoint || '';
    q('ait-tts-custom-model').value = settings.ttsCustomModel || '';
    q('ait-tts-auth-header').value = settings.ttsAuthHeader || '';
    q('ait-tts-auth-token').value = settings.ttsAuthToken || '';
    const location = settings.ttsCustomLocation || 'local';
    const locationInput = document.querySelector(`input[name="ait-tts-custom-location"][value="${location}"]`);
    if (locationInput) locationInput.checked = true;
    q('ait-tts-stability').value = settings.ttsStability ?? 0.5;
    q('ait-tts-similarity').value = settings.ttsSimilarity ?? 0.75;
    q('ait-tts-style').value = settings.ttsStyle ?? 0;
    q('ait-tts-speaker-boost').checked = settings.ttsSpeakerBoost !== false;
    const isBrowserMode = global.backend?.mode === 'browser'; ['ait-export-data','ait-import-data','ait-clear-data'].forEach((id) => { if (q(id)) q(id).disabled = !isBrowserMode; });
    updateRangeLabels(); updateVoiceFields(); updateConnectionSummary(settings); setStatus(isBrowserMode ? '' : 'Browser backup tools are unavailable in local server mode.');
  }

  function save() {
    const model = selectedModel(q('ait-model'), q('ait-model-custom'));
    if (!model) { showTab('ai'); setStatus('Choose a model or enter a model ID.', 'error'); return; }
    const voiceSettings = collectVoiceSettings();
    if (voiceSettings.ttsMode === 'custom' && !voiceSettings.ttsEndpoint) { showTab('voice'); setStatus('Enter the speech endpoint for your TTS server.', 'error'); return; }
    const settings = global.AITSettings?.set?.({ provider:q('ait-provider').value, model, apiKey:q('ait-api-key').value.trim(), rememberKeys:q('ait-remember-keys').checked, ...voiceSettings });
    updateConnectionSummary(settings || {}); global.dispatchEvent(new CustomEvent('ait:settings-updated')); close();
  }

  async function validateAiKey() {
    const provider = q('ait-provider').value; const key = q('ait-api-key').value.trim(); const model = selectedModel(q('ait-model'), q('ait-model-custom'));
    setStatus('Checking the key…'); const result = await global.AITAiProvider?.validateKey?.(provider, key, global.fetch, model); setStatus(result?.ok ? 'Key accepted.' : `Key check failed: ${result?.message || 'Unknown error'}`, result?.ok ? 'ok' : 'error');
  }

  async function validateTtsKey() {
    const provider = q('ait-tts-provider').value; const key = q('ait-tts-key').value.trim(); setStatus('Checking the voice key…'); const result = await global.AITTtsProvider?.validateKey?.(provider, key); setStatus(result?.ok ? 'Voice key accepted.' : `Voice key check failed: ${result?.message || 'Unknown error'}`, result?.ok ? 'ok' : 'error');
  }

  function collectVoiceSettings() {
    const mode = q('ait-tts-mode').value;
    const provider = q('ait-tts-provider').value;
    return {
      ttsMode: mode,
      ttsProvider: provider,
      ttsKey: q('ait-tts-key').value.trim(),
      ttsModel: q('ait-tts-model').value,
      ttsInstructions: q('ait-tts-instructions').value.trim(),
      ttsEndpoint: q('ait-tts-endpoint').value.trim(),
      ttsCustomLocation: document.querySelector('input[name="ait-tts-custom-location"]:checked')?.value || 'local',
      ttsCustomPreset: q('ait-tts-custom-preset').value,
      ttsVoicesEndpoint: q('ait-tts-voices-endpoint').value.trim(),
      ttsCustomModel: q('ait-tts-custom-model').value.trim(),
      ttsAuthHeader: q('ait-tts-auth-header').value.trim(),
      ttsAuthToken: q('ait-tts-auth-token').value.trim(),
      ttsVoice: '',
      ttsStability: Number(q('ait-tts-stability').value),
      ttsSimilarity: Number(q('ait-tts-similarity').value),
      ttsStyle: Number(q('ait-tts-style').value),
      ttsSpeakerBoost: q('ait-tts-speaker-boost').checked
    };
  }

  function requireBrowserStorage() {
    if (!global.backend || global.backend.mode !== 'browser' || !global.backend.storage) throw new Error('Browser backups are available only in the Browser Studio.');
    return global.backend.storage;
  }

  async function exportData() {
    try { setStatus('Preparing backup…'); const payload = await requireBrowserStorage().exportAll(); const url = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})); const link = document.createElement('a'); link.href=url; link.download=`pelicans-art-backup-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setStatus('Backup exported.','ok'); }
    catch (error) { setStatus(error.message || 'Export failed.','error'); }
  }

  async function importData(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try { setStatus('Importing backup…'); await requireBrowserStorage().importAll(JSON.parse(await file.text())); setStatus('Backup imported.','ok'); global.dispatchEvent(new CustomEvent('ait:data-updated')); }
    catch (error) { setStatus(error.message || 'Import failed.','error'); } finally { event.target.value=''; }
  }

  async function clearData() {
    if (!confirm('Clear every character, background, prop, skit, and voice stored in this browser?')) return;
    try { await requireBrowserStorage().clearAll(); setStatus('Browser data cleared.','ok'); global.dispatchEvent(new CustomEvent('ait:data-updated')); } catch (error) { setStatus(error.message || 'Clear failed.','error'); }
  }

  function open(options = {}) { ensureModal(); load(); showTab(options.tab || 'ai'); q('ait-settings-backdrop').classList.add('visible'); q('ait-settings-close').focus(); }
  function close() { q('ait-settings-backdrop')?.classList.remove('visible'); }
  function attachButton(selector = '#btn-settings') { const button=document.querySelector(selector); if (!button || button.dataset.aitSettingsBound === '1') return; button.dataset.aitSettingsBound='1'; button.addEventListener('click',()=>open()); }

  function ensureWizard() {
    if (q('ait-onboarding')) return;
    ensureStyles(); const root=document.createElement('div'); root.id='ait-onboarding'; root.className='ait-overlay'; root.innerHTML=`<div class="ait-dialog ait-wizard" role="dialog" aria-modal="true" aria-labelledby="ait-wizard-title"><div class="ait-dialog-header"><div><h3 id="ait-wizard-title">Welcome to pelicans.art</h3><p>A tiny stage for strange little SVG performances.</p></div><button id="ait-wizard-close" class="ait-close" type="button" aria-label="Close setup">×</button></div><div id="ait-wizard-progress" class="ait-marquee"></div><div id="ait-wizard-body" class="ait-wizard-body"></div><div id="ait-wizard-footer" class="ait-footer"><button id="ait-wizard-back" class="ait-btn ait-btn-secondary" type="button">Back</button><div class="ait-footer-actions"><button id="ait-wizard-next" class="ait-btn ait-btn-primary" type="button">Continue</button></div></div></div>`; document.body.appendChild(root);
    root.addEventListener('click',(event)=>{if(event.target===root)closeWizard();}); root.addEventListener('keydown',(event)=>{if(event.key==='Escape')closeWizard();},true);
    document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&root.classList.contains('visible'))closeWizard();},true);
    q('ait-wizard-close').addEventListener('click',closeWizard); q('ait-wizard-back').addEventListener('click',wizardBack); q('ait-wizard-next').addEventListener('click',wizardNext);
  }

  function wizardMessage(message,type='') { const el=q('ait-wizard-message'); if (!el) return; el.textContent=message || ''; el.className=`ait-wizard-message ${type}`.trim(); }
  function renderProgress() { q('ait-wizard-progress').innerHTML=wizardSteps.map((label,index)=>`<div class="ait-marquee-step ${index < wizardState.step ? 'done' : ''} ${index === wizardState.step ? 'active' : ''}">${label}</div>`).join(''); }

  function renderWizard() {
    if (!wizardState) return; renderProgress(); const body=q('ait-wizard-body'); const back=q('ait-wizard-back'); const next=q('ait-wizard-next'); q('ait-wizard-footer').classList.toggle('ait-hidden',wizardState.step===0); back.classList.toggle('ait-hidden',wizardState.step===0); next.classList.toggle('ait-hidden',wizardState.step===0); next.textContent=wizardState.step===5 ? 'Enter the studio' : 'Continue';
    if (wizardState.step===0) {
      body.innerHTML=`<p class="ait-wizard-kicker">Choose your entrance</p><h2>What would you like to do?</h2><p class="ait-wizard-lede">You can explore and edit without setting anything up. Connect an AI provider only when you want the studio to generate something new.</p><div class="ait-choice-grid"><button class="ait-choice" data-path="remix" type="button"><span class="ait-choice-badge">Recommended</span><strong>Remix a sample</strong><span>Open a finished skit with its actors and scenery ready to change.</span></button><button class="ait-choice" data-path="ai" type="button"><strong>Create with AI</strong><span>Connect a provider, then generate characters, scenery, and scripts.</span></button><button class="ait-choice" data-path="import" type="button"><strong>Import from the Pouch</strong><span>Bring a shared community character or skit into your studio.</span></button><button class="ait-choice" data-path="scratch" type="button"><strong>Start empty</strong><span>Draw and write manually. No account or API key needed.</span></button></div><div id="ait-wizard-message" class="ait-wizard-message"></div>`;
      body.querySelectorAll('[data-path]').forEach((button)=>button.addEventListener('click',()=>choosePath(button.dataset.path,button))); return;
    }
    if (wizardState.step===1) {
      body.innerHTML=`<p class="ait-wizard-kicker">AI provider</p><h2>Who should power the stage?</h2><p class="ait-wizard-lede">OpenAI is the shortest setup because the same account can also provide voices. You can change this later.</p><div class="ait-choice-grid providers">${Object.entries(global.AITModelCatalog?.providers || {}).map(([id,info])=>`<button class="ait-choice ${wizardState.provider===id?'selected':''}" data-provider="${id}" type="button"><strong>${escapeHtml(info.label)}</strong><span>${escapeHtml(info.description)}</span></button>`).join('')}</div><div id="ait-wizard-message" class="ait-wizard-message"></div>`;
      body.querySelectorAll('[data-provider]').forEach((button)=>button.addEventListener('click',()=>{wizardState.provider=button.dataset.provider; wizardState.model=providerInfo(wizardState.provider).defaultModel; renderWizard();})); return;
    }
    if (wizardState.step===2) {
      const info=providerInfo(wizardState.provider); body.innerHTML=`<p class="ait-wizard-kicker">Private access</p><h2>Connect ${escapeHtml(info.label)}</h2><p class="ait-wizard-lede">The key goes directly from this browser to ${escapeHtml(info.label)}. pelicans.art does not receive it.</p><div class="ait-form-grid"><div class="ait-field full"><label for="ait-wizard-key">API key</label><input id="ait-wizard-key" type="password" autocomplete="off" placeholder="Paste your ${escapeHtml(info.label)} key"><div class="ait-help"><a href="${escapeHtml(info.keyUrl)}" target="_blank" rel="noopener">Create a ${escapeHtml(info.label)} key ↗</a></div></div><label class="ait-check full"><input id="ait-wizard-remember" type="checkbox"><span>Remember this key on this device. Otherwise it is removed when this browser session ends.</span></label></div><div id="ait-wizard-message" class="ait-wizard-message"></div>`; q('ait-wizard-key').value=wizardState.apiKey; q('ait-wizard-remember').checked=wizardState.rememberKeys; return;
    }
    if (wizardState.step===3) {
      body.innerHTML=`<p class="ait-wizard-kicker">Cast the model</p><h2>Choose a model</h2><p class="ait-wizard-lede">The recommended option is the best balance for SVG generation. Higher-quality models usually cost more.</p><div class="ait-form-grid"><div class="ait-field full"><label for="ait-wizard-model">AI model</label><select id="ait-wizard-model"></select></div><div id="ait-wizard-model-custom-field" class="ait-field full ait-hidden"><label for="ait-wizard-model-custom">Other model ID</label><input id="ait-wizard-model-custom" autocomplete="off"></div></div><div id="ait-wizard-message" class="ait-wizard-message"></div>`; populateModelSelect(q('ait-wizard-model'),wizardState.provider,wizardState.model); q('ait-wizard-model-custom').value=providerInfo(wizardState.provider).models.some((m)=>m.id===wizardState.model)?'':wizardState.model; const sync=()=>q('ait-wizard-model-custom-field').classList.toggle('ait-hidden',q('ait-wizard-model').value!==CUSTOM_MODEL); q('ait-wizard-model').addEventListener('change',sync); sync(); return;
    }
    if (wizardState.step===4) {
      const needsCloudKey=wizardState.voiceChoice==='cloud' && !(wizardState.ttsProvider==='openai'&&wizardState.provider==='openai');
      body.innerHTML=`<p class="ait-wizard-kicker">Give them a voice</p><h2>How should dialogue play?</h2><p class="ait-wizard-lede">Connect the source now. You will cast and test individual voices on the characters themselves.</p><div class="ait-choice-grid"><button class="ait-choice ${wizardState.voiceChoice==='none'?'selected':''}" data-voice="none" type="button"><span class="ait-choice-badge">Recommended</span><strong>No voices</strong><span>Captions only, with readable dialogue timing.</span></button><button class="ait-choice ${wizardState.voiceChoice==='cloud'?'selected':''}" data-voice="cloud" type="button"><strong>Cloud provider</strong><span>Connect OpenAI or ElevenLabs.</span></button><button class="ait-choice ${wizardState.voiceChoice==='custom'?'selected':''}" data-voice="custom" type="button"><strong>Custom TTS</strong><span>Use a server on this computer or hosted elsewhere.</span></button></div>
        <div id="ait-wizard-cloud-wrap" class="ait-form-grid ${wizardState.voiceChoice==='cloud'?'':'ait-hidden'}" style="margin-top:15px"><div class="ait-field full"><label for="ait-wizard-tts-provider">Cloud provider</label><select id="ait-wizard-tts-provider"><option value="openai">OpenAI</option><option value="elevenlabs">ElevenLabs</option></select></div><div id="ait-wizard-voice-key-wrap" class="ait-field full ${needsCloudKey?'':'ait-hidden'}"><label for="ait-wizard-voice-key">Voice provider key</label><input id="ait-wizard-voice-key" type="password" autocomplete="off" placeholder="Paste the provider key"></div></div>
        <div id="ait-wizard-custom-wrap" class="ait-form-grid ${wizardState.voiceChoice==='custom'?'':'ait-hidden'}" style="margin-top:15px"><div class="ait-field full"><label for="ait-wizard-custom-location">Server location</label><select id="ait-wizard-custom-location"><option value="local">On this computer</option><option value="hosted">Hosted elsewhere</option></select></div><div class="ait-field full"><label for="ait-wizard-custom-preset">API format</label><select id="ait-wizard-custom-preset"><option value="openai-compatible">OpenAI-compatible</option><option value="hermes-piper">Hermes / Piper</option><option value="generic-json">Generic JSON</option><option value="generic-form">Generic form-data</option></select></div><div class="ait-field full"><label for="ait-wizard-custom-endpoint">Speech endpoint</label><input id="ait-wizard-custom-endpoint" type="url" autocomplete="off" placeholder="${LOCAL_TTS_ENDPOINT}"></div><div class="ait-field full"><label for="ait-wizard-custom-voices-endpoint">Voice list URL (optional)</label><input id="ait-wizard-custom-voices-endpoint" type="url" autocomplete="off"></div><div class="ait-field"><label for="ait-wizard-custom-header">Authentication header</label><input id="ait-wizard-custom-header" autocomplete="off"></div><div class="ait-field"><label for="ait-wizard-custom-token">Authentication token</label><input id="ait-wizard-custom-token" type="password" autocomplete="off"></div></div><div id="ait-wizard-message" class="ait-wizard-message"></div>`;
      body.querySelectorAll('[data-voice]').forEach((button)=>button.addEventListener('click',()=>{persistWizardVoiceFields();wizardState.voiceChoice=button.dataset.voice;renderWizard();}));
      if(q('ait-wizard-tts-provider')) { q('ait-wizard-tts-provider').value=wizardState.ttsProvider; q('ait-wizard-tts-provider').addEventListener('change',()=>{persistWizardVoiceFields();wizardState.ttsProvider=q('ait-wizard-tts-provider').value;renderWizard();}); }
      if(q('ait-wizard-voice-key'))q('ait-wizard-voice-key').value=wizardState.ttsKey;
      if(q('ait-wizard-custom-location'))q('ait-wizard-custom-location').value=wizardState.ttsCustomLocation;
      if(q('ait-wizard-custom-preset'))q('ait-wizard-custom-preset').value=wizardState.ttsCustomPreset;
      if(q('ait-wizard-custom-endpoint'))q('ait-wizard-custom-endpoint').value=wizardState.ttsEndpoint;
      if(q('ait-wizard-custom-voices-endpoint'))q('ait-wizard-custom-voices-endpoint').value=wizardState.ttsVoicesEndpoint;
      if(q('ait-wizard-custom-header'))q('ait-wizard-custom-header').value=wizardState.ttsAuthHeader;
      if(q('ait-wizard-custom-token'))q('ait-wizard-custom-token').value=wizardState.ttsAuthToken;
      return;
    }
    const voiceLabel={none:'No voices (captions only)',cloud:`Cloud: ${wizardState.ttsProvider==='elevenlabs'?'ElevenLabs':'OpenAI'}`,custom:`Custom TTS: ${wizardState.ttsCustomLocation==='hosted'?'hosted elsewhere':'this computer'}`}[wizardState.voiceChoice]; body.innerHTML=`<p class="ait-wizard-kicker">Curtain up</p><h2>Your studio is ready</h2><p class="ait-wizard-lede">Start with a character, then add scenery and write the skit. Every setting can be changed from the gear button.</p><div class="ait-ready-card"><div class="ait-ready-row"><span>AI provider</span><strong>${escapeHtml(providerInfo(wizardState.provider).label)}</strong></div><div class="ait-ready-row"><span>Model</span><strong>${escapeHtml(wizardState.model)}</strong></div><div class="ait-ready-row"><span>Voices</span><strong>${escapeHtml(voiceLabel)}</strong></div><div class="ait-ready-row"><span>Projects</span><strong>Stored in this browser</strong></div></div><div id="ait-wizard-message" class="ait-wizard-message"></div>`;
  }

  function persistWizardVoiceFields() {
    if(q('ait-wizard-tts-provider'))wizardState.ttsProvider=q('ait-wizard-tts-provider').value;
    if(q('ait-wizard-voice-key'))wizardState.ttsKey=q('ait-wizard-voice-key').value.trim();
    if(q('ait-wizard-custom-location'))wizardState.ttsCustomLocation=q('ait-wizard-custom-location').value;
    if(q('ait-wizard-custom-preset'))wizardState.ttsCustomPreset=q('ait-wizard-custom-preset').value;
    if(q('ait-wizard-custom-endpoint'))wizardState.ttsEndpoint=q('ait-wizard-custom-endpoint').value.trim();
    if(q('ait-wizard-custom-voices-endpoint'))wizardState.ttsVoicesEndpoint=q('ait-wizard-custom-voices-endpoint').value.trim();
    if(q('ait-wizard-custom-header'))wizardState.ttsAuthHeader=q('ait-wizard-custom-header').value.trim();
    if(q('ait-wizard-custom-token'))wizardState.ttsAuthToken=q('ait-wizard-custom-token').value.trim();
  }

  async function choosePath(path,button) {
    if(path==='ai'){wizardState.path=path;wizardState.step=1;renderWizard();return;} button.disabled=true; wizardMessage(path==='remix'?'Bringing the sample onto your stage…':'Opening…');
    try { if(path==='remix'){global.AITSettings?.set?.({ttsMode:'none'});await wizardCallbacks.onRemix?.();} if(path==='import')await wizardCallbacks.onImport?.(); if(path==='scratch')await wizardCallbacks.onScratch?.(); global.AITSettings?.set?.({welcomeDismissed:true}); global.dispatchEvent(new CustomEvent('ait:settings-updated')); closeWizard(); }
    catch(error){button.disabled=false;wizardMessage(error.message||'That entrance did not open. Try again.','error');}
  }

  function wizardBack() {
    if(!wizardState||wizardState.step<=0)return; if(wizardState.step===2)wizardState.apiKey=q('ait-wizard-key')?.value.trim()||wizardState.apiKey; if(wizardState.step===3)wizardState.model=selectedModel(q('ait-wizard-model'),q('ait-wizard-model-custom'))||wizardState.model; if(wizardState.step===4)persistWizardVoiceFields(); wizardState.step-=1; renderWizard();
  }

  async function wizardNext() {
    if(wizardState.step===1){wizardState.step=2;renderWizard();return;}
    if(wizardState.step===2){wizardState.apiKey=q('ait-wizard-key').value.trim();wizardState.rememberKeys=q('ait-wizard-remember').checked;if(!wizardState.apiKey){wizardMessage('Paste an API key to continue.','error');return;}q('ait-wizard-next').disabled=true;wizardMessage('Checking the key…');const result=await global.AITAiProvider?.validateKey?.(wizardState.provider,wizardState.apiKey,global.fetch,wizardState.model);q('ait-wizard-next').disabled=false;if(!result?.ok){wizardMessage(`Key check failed: ${result?.message||'Unknown error'}`,'error');return;}wizardState.step=3;renderWizard();return;}
    if(wizardState.step===3){wizardState.model=selectedModel(q('ait-wizard-model'),q('ait-wizard-model-custom'));if(!wizardState.model){wizardMessage('Choose a model or enter a model ID.','error');return;}wizardState.step=4;renderWizard();return;}
    if(wizardState.step===4){persistWizardVoiceFields();if(wizardState.voiceChoice==='cloud'&&!(wizardState.ttsProvider==='openai'&&wizardState.provider==='openai')&&!wizardState.ttsKey){wizardMessage('Paste the cloud voice provider key, or choose caption-only playback.','error');return;}if(wizardState.voiceChoice==='custom'&&!wizardState.ttsEndpoint){wizardMessage('Enter the speech endpoint for your TTS server.','error');return;}wizardState.step=5;renderWizard();return;}
    if(wizardState.step===5){const ttsMode=wizardState.voiceChoice;const ttsProvider=wizardState.ttsProvider;const ttsKey=ttsProvider==='openai'&&wizardState.provider==='openai'?wizardState.apiKey:wizardState.ttsKey;global.AITSettings?.set?.({provider:wizardState.provider,model:wizardState.model,apiKey:wizardState.apiKey,rememberKeys:wizardState.rememberKeys,ttsMode,ttsProvider,ttsKey,ttsModel:ttsProvider==='elevenlabs'?'eleven_multilingual_v2':'gpt-4o-mini-tts',ttsEndpoint:wizardState.ttsEndpoint,ttsCustomLocation:wizardState.ttsCustomLocation,ttsCustomPreset:wizardState.ttsCustomPreset,ttsVoicesEndpoint:wizardState.ttsVoicesEndpoint,ttsAuthHeader:wizardState.ttsAuthHeader,ttsAuthToken:wizardState.ttsAuthToken,ttsVoice:'',welcomeDismissed:true});global.dispatchEvent(new CustomEvent('ait:settings-updated'));await wizardCallbacks.onReady?.();closeWizard();}
  }

  function openOnboarding(callbacks={}) { ensureWizard(); wizardCallbacks=callbacks; const settings=global.AITSettings?.get?.()||{}; const provider=settings.provider||'openai'; wizardState={step:0,path:'',provider,model:settings.model||providerInfo(provider).defaultModel,apiKey:settings.apiKey||'',rememberKeys:Boolean(settings.rememberKeys),voiceChoice:'none',ttsProvider:settings.ttsProvider||'openai',ttsKey:settings.ttsKey||'',ttsCustomLocation:settings.ttsCustomLocation||'local',ttsCustomPreset:settings.ttsCustomPreset||'openai-compatible',ttsEndpoint:settings.ttsEndpoint||LOCAL_TTS_ENDPOINT,ttsVoicesEndpoint:settings.ttsVoicesEndpoint||'',ttsAuthHeader:settings.ttsAuthHeader||'',ttsAuthToken:settings.ttsAuthToken||''}; renderWizard(); q('ait-onboarding').classList.add('visible'); q('ait-wizard-body [data-path]')?.focus(); }
  function closeWizard(){q('ait-onboarding')?.classList.remove('visible');}

  global.AITSettingsUI={open,close,attachButton,ensureModal,openOnboarding,closeWizard};
})(window);
