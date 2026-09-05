(function initTtsProvider(global) {
  const OPENAI_VOICES = [
    { id: 'alloy', name: 'Alloy' },
    { id: 'ash', name: 'Ash' },
    { id: 'ballad', name: 'Ballad' },
    { id: 'coral', name: 'Coral' },
    { id: 'echo', name: 'Echo' },
    { id: 'fable', name: 'Fable' },
    { id: 'nova', name: 'Nova' },
    { id: 'onyx', name: 'Onyx' },
    { id: 'sage', name: 'Sage' },
    { id: 'shimmer', name: 'Shimmer' },
    { id: 'verse', name: 'Verse' }
  ];

  function getVoiceSourceKey(settings = {}) {
    const mode = settings.ttsMode || 'none';
    if (mode === 'none') return 'none';
    if (mode === 'cloud') return `cloud:${settings.ttsProvider || 'openai'}`;
    if (mode === 'custom') return `custom:${settings.ttsCustomPreset || 'generic-form'}`;
    return mode;
  }

  function isVoiceCompatible(voiceId, settings = {}) {
    if (!voiceId) return false;
    const source = getVoiceSourceKey(settings);
    if (source === 'cloud:openai') return OPENAI_VOICES.some((voice) => voice.id === voiceId);
    if (source === 'cloud:elevenlabs') return isElevenLabsVoiceId(voiceId);
    if (source === 'custom:hermes-piper') return voiceId === 'alba';
    return source.startsWith('custom:');
  }

  function getAssignedVoiceConfig(metaVoice, settings = {}) {
    if (!metaVoice) return null;
    if (typeof metaVoice === 'string') {
      return isVoiceCompatible(metaVoice, settings) ? normalizeVoiceConfig(metaVoice) : null;
    }

    const source = getVoiceSourceKey(settings);
    const scoped = metaVoice.assignments?.[source];
    if (scoped?.id) return normalizeVoiceConfig(scoped);
    if (metaVoice.source === source && metaVoice.id) return normalizeVoiceConfig(metaVoice);

    // Older sprites stored one unscoped voice. Reuse it only when that ID is
    // meaningful to the active provider, avoiding e.g. Pocket's "marius"
    // being sent to OpenAI or ElevenLabs.
    if (!metaVoice.source && isVoiceCompatible(metaVoice.id, settings)) {
      return normalizeVoiceConfig(metaVoice);
    }
    return null;
  }

  function defaultVoiceId(settings = {}) {
    const source = getVoiceSourceKey(settings);
    if (source === 'custom:hermes-piper') return 'alba';
    if (isVoiceCompatible(settings.ttsVoice, settings)) return settings.ttsVoice;
    if (source === 'cloud:openai') return 'alloy';
    return settings.ttsVoice || '';
  }

  function resolveVoiceConfig(metaVoice, settings = {}, fallbackId = '') {
    const assigned = getAssignedVoiceConfig(metaVoice, settings);
    if (assigned) return assigned;
    const compatibleFallback = isVoiceCompatible(fallbackId, settings) ? fallbackId : '';
    return normalizeVoiceConfig({
      id: compatibleFallback || defaultVoiceId(settings),
      pitch: settings.ttsPitch ?? 0,
      speed: settings.ttsRate ?? 1,
      volume: settings.ttsVolume ?? 1
    });
  }

  function normalizeVoiceConfig(voiceConfig) {
    if (!voiceConfig) return { id: 'alloy', pitch: 1, speed: 1, volume: 1 };
    if (typeof voiceConfig === 'string') return { id: voiceConfig, pitch: 1, speed: 1, volume: 1 };
    return {
      id: voiceConfig.id || 'alloy',
      pitch: Number(voiceConfig.pitch ?? 1),
      speed: Number(voiceConfig.speed ?? voiceConfig.rate ?? 1),
      volume: Number(voiceConfig.volume ?? 1)
    };
  }

  async function callOpenAiTts(text, voiceConfig, settings, fetchImpl = fetch) {
    const key = settings?.ttsKey;
    if (!key) {
      throw new Error('Missing Cloud TTS key. Configure it in Settings.');
    }
    const cfg = normalizeVoiceConfig(voiceConfig);
    const response = await fetchImpl('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: settings?.ttsModel || 'gpt-4o-mini-tts',
        voice: cfg.id || settings?.ttsVoice || 'alloy',
        input: text,
        response_format: 'mp3',
        ...((settings?.ttsModel || 'gpt-4o-mini-tts').startsWith('gpt-4o-mini-tts') && settings?.ttsInstructions
          ? { instructions: settings.ttsInstructions }
          : {})
      })
    });

    if (!response.ok) {
      let message = await response.text();
      try {
        const json = JSON.parse(message);
        message = json.error?.message || message;
      } catch (_) {}
      throw new Error(`Cloud TTS failed (${response.status}): ${message}`);
    }

    return response.blob();
  }

  let _elevenLabsVoicesCache = null;

  // ElevenLabs voice IDs are 20-char alphanumeric strings
  function isElevenLabsVoiceId(v) {
    return typeof v === 'string' && /^[a-zA-Z0-9]{15,}$/.test(v);
  }

  async function fetchElevenLabsVoices(key, fetchImpl = fetch, force = false) {
    if (_elevenLabsVoicesCache && !force) return _elevenLabsVoicesCache;
    try {
      const r = await fetchImpl('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': key }
      });
      if (r.ok) {
        const data = await r.json();
        if (data.voices?.length) {
          _elevenLabsVoicesCache = data.voices.map(v => ({ id: v.voice_id, name: v.name }));
          return _elevenLabsVoicesCache;
        }
      }
    } catch (e) {}
    return [];
  }

  async function listAvailableVoices(settings = {}, fetchImpl = fetch, force = false) {
    const source = getVoiceSourceKey(settings);
    if (source === 'none') return [];
    if (source === 'cloud:openai') {
      return OPENAI_VOICES.map((voice) => ({ ...voice, description: 'OpenAI voice' }));
    }
    if (source === 'cloud:elevenlabs') {
      if (!settings.ttsKey) return [];
      return fetchElevenLabsVoices(settings.ttsKey, fetchImpl, force);
    }
    if (source === 'custom:hermes-piper') {
      // The current Hermes API has one loaded synthesizer. A second model may
      // be installed on its host, but it is not selectable until the API
      // exposes a voice parameter.
      return [{ id: 'alba', name: 'Alba', description: 'Hermes / Piper server voice' }];
    }
    if (source.startsWith('custom:') && settings.ttsVoicesEndpoint) {
      return fetchCustomVoices(settings, fetchImpl);
    }
    return [];
  }

  function normalizeCustomVoiceList(payload) {
    const list = Array.isArray(payload) ? payload : (payload?.voices || payload?.data || []);
    return list.map((voice) => {
      if (typeof voice === 'string') return { id: voice, name: voice };
      const id = voice.id || voice.voice_id || voice.name;
      return id ? { id, name: voice.name || voice.display_name || id, description: voice.description || '' } : null;
    }).filter(Boolean);
  }

  async function fetchCustomVoices(settings, fetchImpl = fetch) {
    const payload = {
      endpoint: settings.ttsVoicesEndpoint,
      authHeader: settings.ttsAuthHeader || '',
      authToken: settings.ttsAuthToken || ''
    };
    try {
      const proxied = await fetchImpl('/api/tts/proxy/voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (proxied.ok) return normalizeCustomVoiceList(await proxied.json());
      if (![404, 405].includes(proxied.status)) return [];
    } catch (_) {}

    try {
      const headers = {};
      if (payload.authHeader && payload.authToken) headers[payload.authHeader] = payload.authToken;
      const response = await fetchImpl(payload.endpoint, { headers });
      return response.ok ? normalizeCustomVoiceList(await response.json()) : [];
    } catch (_) {
      return [];
    }
  }

  async function callElevenLabsTts(text, voiceConfig, settings, fetchImpl = fetch) {
    const key = settings?.ttsKey;
    const cfg = normalizeVoiceConfig(voiceConfig);
    // Prefer per-character voice (voiceConfig.id) if it's a valid ElevenLabs ID,
    // otherwise fall back to settings.ttsVoice
    let voice = isElevenLabsVoiceId(cfg.id) ? cfg.id : (settings?.ttsVoice || cfg.id);
    if (!key) {
      throw new Error('ElevenLabs requires a TTS API key. Add it in Settings > Cloud TTS API Key, then Save.');
    }

    // If voice still doesn't look like an ElevenLabs ID, auto-fetch first available
    if (!isElevenLabsVoiceId(voice)) {
      const voices = await fetchElevenLabsVoices(key, fetchImpl);
      if (voices.length) {
        console.log(`[TTS] Voice "${voice}" is not a valid ElevenLabs ID, using "${voices[0].name}" from your account`);
        voice = voices[0].id;
      }
    }

    const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': key,
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: settings?.ttsModel || 'eleven_multilingual_v2',
        voice_settings: {
          stability: Number(settings?.ttsStability ?? 0.5),
          similarity_boost: Number(settings?.ttsSimilarity ?? 0.75),
          style: Number(settings?.ttsStyle ?? 0),
          use_speaker_boost: settings?.ttsSpeakerBoost !== false,
          speed: Math.max(0.7, Math.min(1.2, Number(cfg.speed) || 1))
        }
      })
    });
    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.detail?.message || body?.detail || JSON.stringify(body);
      } catch (_) {}
      throw new Error(`ElevenLabs TTS failed (${response.status})${detail ? ': ' + detail : ''}`);
    }
    return response.blob();
  }

  function customEndpoint(settings) {
    const endpoint = settings?.ttsEndpoint;
    if (!endpoint) {
      throw new Error('Missing custom TTS endpoint URL');
    }
    let parsed;
    try {
      parsed = new URL(endpoint, global.location?.href);
    } catch (_) {
      throw new Error('Custom TTS endpoint must be a valid URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Custom TTS endpoint must use HTTP or HTTPS');
    }
    if (settings?.ttsCustomPreset === 'hermes-piper') {
      if (!parsed.pathname || parsed.pathname === '/') parsed.pathname = '/tts';
      parsed.searchParams.set('wav', '1');
    }
    return parsed.toString();
  }

  function customProxyPayload(text, voiceConfig, settings) {
    const cfg = normalizeVoiceConfig(voiceConfig);
    return {
      endpoint: customEndpoint(settings),
      preset: settings?.ttsCustomPreset || 'generic-form',
      text,
      voice: cfg.id,
      pitch: cfg.pitch,
      rate: cfg.speed,
      volume: cfg.volume,
      authHeader: settings?.ttsAuthHeader || '',
      authToken: settings?.ttsAuthToken || '',
      model: settings?.ttsCustomModel || ''
    };
  }

  function buildDirectCustomRequest(payload) {
    const headers = {};
    if (payload.authHeader && payload.authToken) headers[payload.authHeader] = payload.authToken;

    if (payload.preset === 'hermes-piper') {
      headers['Content-Type'] = 'application/json';
      return {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: payload.text, voice: payload.voice, rate: 16000, depth: 16, format: 'linear' })
      };
    }

    if (payload.preset === 'openai-compatible') {
      headers['Content-Type'] = 'application/json';
      return {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: payload.model || 'tts-1',
          input: payload.text,
          voice: payload.voice || 'alloy',
          response_format: 'mp3',
          speed: payload.rate
        })
      };
    }

    if (payload.preset === 'generic-json') {
      headers['Content-Type'] = 'application/json';
      return {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: payload.text,
          voice: payload.voice,
          pitch: payload.pitch,
          rate: payload.rate,
          volume: payload.volume
        })
      };
    }

    const formData = new FormData();
    formData.append('text', payload.text);
    formData.append('voice', payload.voice);
    formData.append('voice_url', payload.voice);
    formData.append('pitch', String(payload.pitch));
    formData.append('rate', String(payload.rate));
    formData.append('volume', String(payload.volume));
    return { method: 'POST', headers, body: formData };
  }

  async function callCustomTts(text, voiceConfig, settings, fetchImpl = fetch) {
    const payload = customProxyPayload(text, voiceConfig, settings);

    // A local/private studio can relay tailnet and non-CORS endpoints. On a
    // static deployment this route is absent, so compatible HTTPS endpoints
    // fall back to a direct browser request.
    let proxyResponse;
    try {
      proxyResponse = await fetchImpl('/api/tts/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (proxyResponse.ok) return proxyResponse.blob();
      if (![404, 405].includes(proxyResponse.status)) {
        const detail = await proxyResponse.text();
        throw new Error(`Custom TTS proxy failed (${proxyResponse.status})${detail ? `: ${detail}` : ''}`);
      }
    } catch (error) {
      if (!String(error?.message || '').includes('Failed to fetch')) throw error;
    }

    let response;
    try {
      response = await fetchImpl(payload.endpoint, buildDirectCustomRequest(payload));
    } catch (_) {
      throw new Error('Cannot reach this TTS endpoint from the browser. Use an HTTPS endpoint with CORS, or open the studio through its private local server so it can relay the request.');
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Custom TTS failed (${response.status})${detail ? `: ${detail}` : ''}`);
    }
    return response.blob();
  }

  async function generateSpeech(text, voiceConfig, settings, options = {}, fetchImpl = fetch) {
    const mode = settings?.ttsMode || 'none';

    if (mode === 'none') {
      return null;
    }

    if (mode === 'cloud') {
      const provider = settings?.ttsProvider || 'openai';
      if (provider === 'openai') return callOpenAiTts(text, voiceConfig, settings, fetchImpl);
      if (provider === 'elevenlabs') return callElevenLabsTts(text, voiceConfig, settings, fetchImpl);
      throw new Error(`Unsupported cloud TTS provider: ${provider}`);
    }

    if (mode === 'custom') {
      return callCustomTts(text, voiceConfig, settings, fetchImpl);
    }

    throw new Error(`Unsupported TTS mode: ${mode}`);
  }

  async function validateKey(provider, key, fetchImpl = fetch) {
    if (!key) return { ok: false, message: 'Missing key' };
    try {
      if (provider === 'openai') {
        const r = await fetchImpl('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
        return r.ok ? { ok: true } : { ok: false, message: `OpenAI auth failed (${r.status})` };
      }
      if (provider === 'elevenlabs') {
        const r = await fetchImpl('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } });
        return r.ok ? { ok: true } : { ok: false, message: `ElevenLabs auth failed (${r.status})` };
      }
      return { ok: false, message: `Unsupported provider: ${provider}` };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  global.AITTtsProvider = {
    generateSpeech,
    validateKey,
    fetchElevenLabsVoices,
    fetchCustomVoices,
    isElevenLabsVoiceId,
    listAvailableVoices,
    getVoiceSourceKey,
    getAssignedVoiceConfig,
    resolveVoiceConfig,
    isVoiceCompatible,
    OPENAI_VOICES,
    customEndpoint,
    customProxyPayload
  };
})(window);
