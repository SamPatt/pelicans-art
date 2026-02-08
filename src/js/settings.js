(function initSettings(global) {
  const PREFIX = 'ait-';

  const keys = {
    provider: PREFIX + 'provider',
    apiKey: PREFIX + 'api-key',
    model: PREFIX + 'model',
    ttsMode: PREFIX + 'tts-mode',
    ttsProvider: PREFIX + 'tts-provider',
    ttsKey: PREFIX + 'tts-key',
    ttsEndpoint: PREFIX + 'tts-endpoint',
    ttsVoice: PREFIX + 'tts-voice',
    ttsWebSpeechVoice: PREFIX + 'tts-webspeech-voice',
    ttsRate: PREFIX + 'tts-rate',
    ttsPitch: PREFIX + 'tts-pitch',
    ttsVolume: PREFIX + 'tts-volume',
    welcomeDismissed: PREFIX + 'welcome-dismissed'
  };

  const defaults = {
    provider: 'openrouter',
    model: 'anthropic/claude-sonnet-4',
    ttsMode: 'none',
    ttsProvider: 'openai',
    ttsVoice: 'alloy',
    ttsRate: '1',
    ttsPitch: '1',
    ttsVolume: '1'
  };

  function getRaw(key, fallback = '') {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value;
  }

  function setRaw(key, value) {
    if (value == null || value === '') {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, String(value));
    }
  }

  function get() {
    return {
      provider: getRaw(keys.provider, defaults.provider),
      apiKey: getRaw(keys.apiKey, ''),
      model: getRaw(keys.model, defaults.model),
      ttsMode: getRaw(keys.ttsMode, defaults.ttsMode),
      ttsProvider: getRaw(keys.ttsProvider, defaults.ttsProvider),
      ttsKey: getRaw(keys.ttsKey, ''),
      ttsEndpoint: getRaw(keys.ttsEndpoint, ''),
      ttsVoice: getRaw(keys.ttsVoice, defaults.ttsVoice),
      ttsWebSpeechVoice: getRaw(keys.ttsWebSpeechVoice, ''),
      ttsRate: Number(getRaw(keys.ttsRate, defaults.ttsRate)) || 1,
      ttsPitch: Number(getRaw(keys.ttsPitch, defaults.ttsPitch)) || 1,
      ttsVolume: Number(getRaw(keys.ttsVolume, defaults.ttsVolume)) || 1,
      welcomeDismissed: getRaw(keys.welcomeDismissed, '') === '1'
    };
  }

  function set(next) {
    const merged = { ...get(), ...next };
    setRaw(keys.provider, merged.provider);
    setRaw(keys.apiKey, merged.apiKey);
    setRaw(keys.model, merged.model);
    setRaw(keys.ttsMode, merged.ttsMode);
    setRaw(keys.ttsProvider, merged.ttsProvider);
    setRaw(keys.ttsKey, merged.ttsKey);
    setRaw(keys.ttsEndpoint, merged.ttsEndpoint);
    setRaw(keys.ttsVoice, merged.ttsVoice);
    setRaw(keys.ttsWebSpeechVoice, merged.ttsWebSpeechVoice);
    setRaw(keys.ttsRate, merged.ttsRate);
    setRaw(keys.ttsPitch, merged.ttsPitch);
    setRaw(keys.ttsVolume, merged.ttsVolume);
    setRaw(keys.welcomeDismissed, merged.welcomeDismissed ? '1' : '');
    return merged;
  }

  function clearKeys() {
    setRaw(keys.apiKey, '');
    setRaw(keys.ttsKey, '');
    setRaw(keys.ttsEndpoint, '');
  }

  function clearAll() {
    Object.values(keys).forEach((storageKey) => {
      localStorage.removeItem(storageKey);
    });
  }

  const api = { keys, defaults, get, set, clearKeys, clearAll };
  global.AITSettings = api;
})(window);
