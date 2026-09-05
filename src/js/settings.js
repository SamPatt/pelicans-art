(function initSettings(global) {
  const PREFIX = 'ait-';

  const keys = {
    provider: PREFIX + 'provider',
    apiKey: PREFIX + 'api-key',
    model: PREFIX + 'model',
    ttsMode: PREFIX + 'tts-mode',
    ttsProvider: PREFIX + 'tts-provider',
    ttsKey: PREFIX + 'tts-key',
    ttsModel: PREFIX + 'tts-model',
    ttsInstructions: PREFIX + 'tts-instructions',
    ttsEndpoint: PREFIX + 'tts-endpoint',
    ttsCustomLocation: PREFIX + 'tts-custom-location',
    ttsCustomPreset: PREFIX + 'tts-custom-preset',
    ttsVoicesEndpoint: PREFIX + 'tts-voices-endpoint',
    ttsCustomModel: PREFIX + 'tts-custom-model',
    ttsAuthHeader: PREFIX + 'tts-auth-header',
    ttsAuthToken: PREFIX + 'tts-auth-token',
    ttsVoice: PREFIX + 'tts-voice',
    ttsRate: PREFIX + 'tts-rate',
    ttsPitch: PREFIX + 'tts-pitch',
    ttsVolume: PREFIX + 'tts-volume',
    ttsStability: PREFIX + 'tts-stability',
    ttsSimilarity: PREFIX + 'tts-similarity',
    ttsStyle: PREFIX + 'tts-style',
    ttsSpeakerBoost: PREFIX + 'tts-speaker-boost',
    rememberKeys: PREFIX + 'remember-keys',
    welcomeDismissed: PREFIX + 'welcome-dismissed'
  };

  const defaults = {
    provider: 'openai',
    model: 'gpt-5.6-terra',
    ttsMode: 'none',
    ttsProvider: 'openai',
    ttsModel: 'gpt-4o-mini-tts',
    ttsCustomPreset: 'openai-compatible',
    ttsAuthHeader: '',
    ttsVoice: '',
    ttsCustomLocation: 'local',
    ttsRate: '1',
    ttsPitch: '1',
    ttsVolume: '1',
    ttsStability: '0.5',
    ttsSimilarity: '0.75',
    ttsStyle: '0',
    ttsSpeakerBoost: '1'
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

  function getSecret(key) {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key) ?? '';
  }

  function setSecret(key, value, remember) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    if (!value) return;
    (remember ? localStorage : sessionStorage).setItem(key, String(value));
  }

  function get() {
    const storedTtsMode = getRaw(keys.ttsMode, defaults.ttsMode);
    const storedTtsEndpoint = getRaw(keys.ttsEndpoint, '');
    const inferredCustomLocation = storedTtsEndpoint && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(storedTtsEndpoint) ? 'hosted' : 'local';
    return {
      provider: getRaw(keys.provider, defaults.provider),
      apiKey: getSecret(keys.apiKey),
      model: getRaw(keys.model, defaults.model),
      // Browser speech was previously offered here. Treat old saved choices as
      // caption-only so returning visitors never get an unexpected system voice.
      ttsMode: storedTtsMode === 'webspeech' ? 'none' : storedTtsMode,
      ttsProvider: getRaw(keys.ttsProvider, defaults.ttsProvider),
      ttsKey: getSecret(keys.ttsKey),
      ttsModel: getRaw(keys.ttsModel, defaults.ttsModel),
      ttsInstructions: getRaw(keys.ttsInstructions, ''),
      ttsEndpoint: storedTtsEndpoint,
      ttsCustomLocation: getRaw(keys.ttsCustomLocation, inferredCustomLocation),
      ttsCustomPreset: getRaw(keys.ttsCustomPreset, defaults.ttsCustomPreset),
      ttsVoicesEndpoint: getRaw(keys.ttsVoicesEndpoint, ''),
      ttsCustomModel: getRaw(keys.ttsCustomModel, ''),
      ttsAuthHeader: getRaw(keys.ttsAuthHeader, defaults.ttsAuthHeader),
      ttsAuthToken: getSecret(keys.ttsAuthToken),
      ttsVoice: getRaw(keys.ttsVoice, defaults.ttsVoice),
      ttsRate: Number(getRaw(keys.ttsRate, defaults.ttsRate)) || 1,
      ttsPitch: Number(getRaw(keys.ttsPitch, defaults.ttsPitch)) || 1,
      ttsVolume: Number(getRaw(keys.ttsVolume, defaults.ttsVolume)) || 1,
      ttsStability: Number(getRaw(keys.ttsStability, defaults.ttsStability)),
      ttsSimilarity: Number(getRaw(keys.ttsSimilarity, defaults.ttsSimilarity)),
      ttsStyle: Number(getRaw(keys.ttsStyle, defaults.ttsStyle)),
      ttsSpeakerBoost: getRaw(keys.ttsSpeakerBoost, defaults.ttsSpeakerBoost) === '1',
      rememberKeys: getRaw(keys.rememberKeys, localStorage.getItem(keys.apiKey) ? '1' : '') === '1',
      welcomeDismissed: getRaw(keys.welcomeDismissed, '') === '1'
    };
  }

  function set(next) {
    const merged = { ...get(), ...next };
    setRaw(keys.provider, merged.provider);
    setSecret(keys.apiKey, merged.apiKey, Boolean(merged.rememberKeys));
    setRaw(keys.model, merged.model);
    setRaw(keys.ttsMode, merged.ttsMode === 'webspeech' ? 'none' : merged.ttsMode);
    setRaw(keys.ttsProvider, merged.ttsProvider);
    setSecret(keys.ttsKey, merged.ttsKey, Boolean(merged.rememberKeys));
    setRaw(keys.ttsModel, merged.ttsModel);
    setRaw(keys.ttsInstructions, merged.ttsInstructions);
    setRaw(keys.ttsEndpoint, merged.ttsEndpoint);
    setRaw(keys.ttsCustomLocation, merged.ttsCustomLocation);
    setRaw(keys.ttsCustomPreset, merged.ttsCustomPreset);
    setRaw(keys.ttsVoicesEndpoint, merged.ttsVoicesEndpoint);
    setRaw(keys.ttsCustomModel, merged.ttsCustomModel);
    setRaw(keys.ttsAuthHeader, merged.ttsAuthHeader);
    setSecret(keys.ttsAuthToken, merged.ttsAuthToken, Boolean(merged.rememberKeys));
    setRaw(keys.ttsVoice, merged.ttsVoice);
    setRaw(keys.ttsRate, merged.ttsRate);
    setRaw(keys.ttsPitch, merged.ttsPitch);
    setRaw(keys.ttsVolume, merged.ttsVolume);
    setRaw(keys.ttsStability, merged.ttsStability);
    setRaw(keys.ttsSimilarity, merged.ttsSimilarity);
    setRaw(keys.ttsStyle, merged.ttsStyle);
    setRaw(keys.ttsSpeakerBoost, merged.ttsSpeakerBoost ? '1' : '0');
    setRaw(keys.rememberKeys, merged.rememberKeys ? '1' : '');
    setRaw(keys.welcomeDismissed, merged.welcomeDismissed ? '1' : '');
    return merged;
  }

  function clearKeys() {
    setSecret(keys.apiKey, '', false);
    setSecret(keys.ttsKey, '', false);
    setSecret(keys.ttsAuthToken, '', false);
  }

  function clearAll() {
    Object.values(keys).forEach((storageKey) => {
      localStorage.removeItem(storageKey);
      sessionStorage.removeItem(storageKey);
    });
  }

  const api = { keys, defaults, get, set, clearKeys, clearAll };
  global.AITSettings = api;
})(window);
