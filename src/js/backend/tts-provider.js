(function initTtsProvider(global) {
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

  function playWebSpeech(text, voiceConfig, settings) {
    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('Web Speech API not available in this browser'));
        return;
      }
      const cfg = normalizeVoiceConfig(voiceConfig);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = Math.max(0, Math.min(2, Number(cfg.pitch) || 1));
      utterance.rate = Math.max(0.1, Math.min(10, Number(cfg.speed) || 1));
      utterance.volume = Math.max(0, Math.min(1, Number(cfg.volume) || 1));
      const preferredName = settings?.ttsWebSpeechVoice || cfg.id;
      const voices = speechSynthesis.getVoices();
      const match = voices.find((v) => v.name === preferredName || v.voiceURI === preferredName);
      if (match) utterance.voice = match;
      utterance.onend = () => resolve();
      utterance.onerror = (event) => reject(new Error(event.error || 'speech synthesis failed'));
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
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
        model: 'tts-1',
        voice: settings?.ttsVoice || cfg.id || 'alloy',
        input: text,
        format: 'mp3'
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

  let _elevenLabsDefaultVoice = null;

  async function getElevenLabsDefaultVoice(key, fetchImpl = fetch) {
    if (_elevenLabsDefaultVoice) return _elevenLabsDefaultVoice;
    try {
      const r = await fetchImpl('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': key }
      });
      if (r.ok) {
        const data = await r.json();
        if (data.voices?.length) {
          _elevenLabsDefaultVoice = data.voices[0].voice_id;
          return _elevenLabsDefaultVoice;
        }
      }
    } catch (e) {}
    return null;
  }

  // ElevenLabs voice IDs are 20-char alphanumeric strings
  function isElevenLabsVoiceId(v) {
    return typeof v === 'string' && /^[a-zA-Z0-9]{15,}$/.test(v);
  }

  async function callElevenLabsTts(text, voiceConfig, settings, fetchImpl = fetch) {
    const key = settings?.ttsKey;
    let voice = settings?.ttsVoice || normalizeVoiceConfig(voiceConfig).id;
    console.log('[TTS] ElevenLabs call — key present:', !!key, 'key length:', key?.length || 0, 'voice:', voice);
    if (!key) {
      throw new Error('ElevenLabs requires a TTS API key. Add it in Settings > Cloud TTS API Key, then Save.');
    }

    // If voice doesn't look like an ElevenLabs ID (e.g. "alloy"), auto-fetch a valid one
    if (!isElevenLabsVoiceId(voice)) {
      const defaultVoice = await getElevenLabsDefaultVoice(key, fetchImpl);
      if (defaultVoice) {
        console.log(`[TTS] Voice "${voice}" is not a valid ElevenLabs ID, using "${defaultVoice}" from your account`);
        voice = defaultVoice;
      }
    }

    const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': key,
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({ text })
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

  async function callCustomTts(text, voiceConfig, settings, fetchImpl = fetch) {
    const endpoint = settings?.ttsEndpoint;
    if (!endpoint) {
      throw new Error('Missing custom TTS endpoint URL');
    }
    const cfg = normalizeVoiceConfig(voiceConfig);

    // Use FormData to avoid CORS preflight (multipart/form-data is a "simple" content type).
    // Many TTS servers (pocket-tts, etc.) also accept form data natively.
    const formData = new FormData();
    formData.append('text', text);
    formData.append('voice', cfg.id);
    formData.append('pitch', String(cfg.pitch));
    formData.append('rate', String(cfg.speed));
    formData.append('volume', String(cfg.volume));

    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        body: formData
      });
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('NetworkError')) {
        throw new Error(
          `Cannot reach TTS endpoint at ${endpoint}. ` +
          'If the server is running on a different port, it must send CORS headers ' +
          '(Access-Control-Allow-Origin: *). Alternatively, use "Browser Voices" TTS mode.'
        );
      }
      throw err;
    }
    if (!response.ok) {
      throw new Error(`Custom TTS failed (${response.status})`);
    }
    return response.blob();
  }

  async function generateSpeech(text, voiceConfig, settings, options = {}, fetchImpl = fetch) {
    const mode = settings?.ttsMode || 'none';

    if (mode === 'none') {
      return null;
    }

    if (mode === 'webspeech') {
      if (options.forPublishing) return null;
      await playWebSpeech(text, voiceConfig, settings);
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
    playWebSpeech
  };
})(window);
