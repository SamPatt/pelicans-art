const { test, expect } = require('@playwright/test');
const http = require('node:http');

test('a first-time visitor can remix the bundled sample without credentials', async ({ page }) => {
  await page.goto('/editor?mode=browser');

  const wizard = page.locator('#ait-onboarding');
  await expect(wizard).toBeVisible();
  await expect(wizard.getByRole('heading', { name: 'What would you like to do?' })).toBeVisible();
  await wizard.getByRole('button', { name: /Remix a sample/ }).click();

  await expect(wizard).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('.skit-item', { hasText: 'Careful What You Wish For — Remix' })).toBeVisible();
  await expect(page.locator('#skit-editor-panel')).toBeVisible();
  await expect(page.locator('#status-left')).toContainText('Sample imported');
});

test('AI onboarding validates one key and offers curated model choices', async ({ page }) => {
  await page.route('https://api.openai.com/v1/models', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
  });

  await page.goto('/editor?mode=browser');
  const wizard = page.locator('#ait-onboarding');
  await wizard.getByRole('button', { name: /Create with AI/ }).click();

  await expect(wizard.getByRole('heading', { name: 'Who should power the stage?' })).toBeVisible();
  await wizard.locator('#ait-wizard-next').click();
  await expect(wizard.getByRole('heading', { name: 'Connect OpenAI' })).toBeVisible();
  await wizard.locator('#ait-wizard-key').fill('sk-test-only');
  await wizard.locator('#ait-wizard-remember').check();
  await wizard.locator('#ait-wizard-next').click();

  const modelSelect = wizard.locator('#ait-wizard-model');
  await expect(modelSelect).toBeVisible();
  await expect(modelSelect.locator('option')).toHaveCount(5);
  await expect(modelSelect.locator('option[value="gpt-6-astra"]')).toHaveText(/GPT-6 Astra/);
  await expect(modelSelect).toHaveValue('gpt-5.6-terra');
  await modelSelect.selectOption('gpt-5.6-luna');
  await wizard.locator('#ait-wizard-next').click();

  await expect(wizard.getByRole('heading', { name: 'How should dialogue play?' })).toBeVisible();
  await wizard.locator('#ait-wizard-next').click();
  await expect(wizard.getByRole('heading', { name: 'Your studio is ready' })).toBeVisible();
  await expect(wizard).toContainText('gpt-5.6-luna');
  await wizard.getByRole('button', { name: 'Enter the studio' }).click();
  await expect(wizard).toBeHidden();

  const stored = await page.evaluate(() => ({
    provider: localStorage.getItem('ait-provider'),
    model: localStorage.getItem('ait-model'),
    key: localStorage.getItem('ait-api-key'),
    voice: localStorage.getItem('ait-tts-mode')
  }));
  expect(stored).toEqual({ provider: 'openai', model: 'gpt-5.6-luna', key: 'sk-test-only', voice: 'none' });

  await page.locator('#btn-settings').click();
  await expect(page.locator('#ait-settings-backdrop')).toBeVisible();
  await expect(page.locator('#ait-model')).toHaveValue('gpt-5.6-luna');
  await page.getByRole('tab', { name: 'Voices', exact: true }).click();
  await expect(page.locator('.ait-cloud-field').first()).toBeHidden();
  await expect(page.locator('#ait-tts-mode')).toHaveValue('none');
  await expect(page.locator('#ait-tts-mode option[value="webspeech"]')).toHaveCount(0);
  await expect(page.locator('#ait-tts-mode')).toContainText('No voices (captions only)');
  await expect(page.locator('#ait-tts-mode option')).toHaveCount(3);
  await page.locator('#ait-tts-mode').selectOption('cloud');
  await expect(page.locator('#ait-tts-model')).toHaveValue('gpt-4o-mini-tts');
  await expect(page.locator('#ait-tts-instructions')).toBeVisible();
  await page.locator('#ait-tts-provider').selectOption('elevenlabs');
  await expect(page.locator('#ait-tts-model')).toHaveValue('eleven_multilingual_v2');
  await expect(page.locator('#ait-tts-stability')).toBeVisible();
  await expect(page.locator('#ait-tts-voice')).toHaveCount(0);
  await expect(page.locator('#ait-test-tts')).toHaveCount(0);
  await page.locator('#ait-tts-mode').selectOption('custom');
  await expect(page.locator('input[name="ait-tts-custom-location"][value="local"]')).toBeChecked();
  await expect(page.locator('#ait-tts-custom-preset')).toHaveValue('openai-compatible');
  await expect(page.locator('#ait-tts-endpoint')).toHaveValue('http://127.0.0.1:8000/v1/audio/speech');
  await page.getByText('Hosted elsewhere', { exact: true }).click();
  await expect(page.locator('#ait-tts-endpoint')).toHaveValue('');
  await expect(page.locator('#ait-tts-voices-endpoint')).toBeVisible();
});

test('the Hermes voice preset builds an authenticated WAV request through the local relay', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ait-welcome-dismissed', '1'));
  await page.goto('/editor?mode=browser');

  const result = await page.evaluate(async () => {
    let captured = null;
    const fetchStub = async (url, init) => {
      captured = { url, body: JSON.parse(init.body) };
      return new Response(new Blob(['wave-bytes'], { type: 'audio/wav' }), {
        status: 200,
        headers: { 'Content-Type': 'audio/wav' }
      });
    };
    const blob = await window.AITTtsProvider.generateSpeech(
      'The pelicans are ready for rehearsal.',
      'alba',
      {
        ttsMode: 'custom',
        ttsCustomPreset: 'hermes-piper',
        ttsEndpoint: 'http://100.71.209.26:8787',
        ttsAuthHeader: 'X-Watch-Token',
        ttsAuthToken: 'test-token'
      },
      {},
      fetchStub
    );
    return { type: blob.type, captured };
  });

  expect(result.type).toBe('audio/wav');
  expect(result.captured.url).toBe('/api/tts/proxy');
  expect(result.captured.body).toMatchObject({
    preset: 'hermes-piper',
    authHeader: 'X-Watch-Token',
    authToken: 'test-token',
    text: 'The pelicans are ready for rehearsal.'
  });
  expect(result.captured.body.endpoint).toContain('/tts?wav=1');
});

test('browser character casting follows the active voice provider and remembers each provider', async ({ page }) => {
  const elevenVoiceId = 'abcdefghijklmnopqrst';
  await page.route('https://api.elevenlabs.io/v1/voices', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ voices: [{ voice_id: elevenVoiceId, name: 'Stage Eleven' }] })
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem('ait-welcome-dismissed', '1');
    localStorage.setItem('ait-tts-mode', 'cloud');
    localStorage.setItem('ait-tts-provider', 'openai');
    localStorage.setItem('ait-tts-voice', 'alloy');
  });
  await page.goto('/editor?mode=browser');

  await page.evaluate(async () => {
    await window.backend.saveSprite(
      'voice-test-character',
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150"><circle cx="50" cy="50" r="20"/></svg>',
      { displayName: 'Voice Test Character' }
    );
    window.dispatchEvent(new CustomEvent('ait:data-updated'));
  });
  await page.locator('.sprite-item[data-char="voice-test-character"]').click();

  await expect(page.locator('#voice-select option[value="onyx"]')).toHaveCount(1);
  await expect(page.locator('#voice-select option[value="marius"]')).toHaveCount(0);
  await page.locator('.voice-section').click();
  await page.locator('#voice-select').selectOption('onyx');
  await page.getByRole('button', { name: /Save Voice Settings/ }).click();
  await expect(page.locator('#status-left')).toContainText('Voice settings saved');

  await page.evaluate(() => {
    window.AITSettings.set({ ttsMode: 'cloud', ttsProvider: 'elevenlabs', ttsKey: 'test-eleven-key' });
    window.dispatchEvent(new CustomEvent('ait:settings-updated'));
  });
  await expect(page.locator(`#voice-select option[value="${elevenVoiceId}"]`)).toHaveCount(1);
  await expect(page.locator('#voice-source-note')).toContainText('1 voice');
  await page.locator('#voice-select').selectOption(elevenVoiceId);
  await page.getByRole('button', { name: /Save Voice Settings/ }).click();

  await page.evaluate(() => {
    window.AITSettings.set({ ttsMode: 'cloud', ttsProvider: 'openai', ttsKey: 'test-openai-key' });
    window.dispatchEvent(new CustomEvent('ait:settings-updated'));
  });
  await expect(page.locator('#voice-select')).toHaveValue('onyx');
});

test('OpenAI speech generation honors a character-specific voice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ait-welcome-dismissed', '1'));
  await page.goto('/editor?mode=browser');

  const result = await page.evaluate(async () => {
    let requestBody = null;
    const fetchStub = async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' }
      });
    };
    await window.AITTtsProvider.generateSpeech(
      'A line for Coral.',
      { id: 'coral', speed: 1, pitch: 0, volume: 1 },
      { ttsMode: 'cloud', ttsProvider: 'openai', ttsKey: 'test-key', ttsVoice: 'alloy' },
      {},
      fetchStub
    );
    const scoped = window.AITTtsProvider.resolveVoiceConfig({
      id: 'onyx',
      source: 'cloud:openai',
      assignments: {
        'cloud:openai': { id: 'onyx', speed: 0.9 },
        'cloud:elevenlabs': { id: 'abcdefghijklmnopqrst', speed: 1.1 }
      }
    }, { ttsMode: 'cloud', ttsProvider: 'elevenlabs', ttsVoice: '' });
    return { requestBody, scoped };
  });

  expect(result.requestBody.voice).toBe('coral');
  expect(result.scoped.id).toBe('abcdefghijklmnopqrst');
  expect(result.scoped.speed).toBe(1.1);
});

test('a browser skit shows its cast and saves per-skit voice overrides', async ({ page }) => {
  await page.goto('/editor?mode=browser');
  await page.getByRole('button', { name: /Remix a sample/ }).click();
  await expect(page.locator('#ait-onboarding')).toBeHidden({ timeout: 20_000 });
  await page.evaluate(() => {
    window.AITSettings.set({ ttsMode: 'cloud', ttsProvider: 'openai', ttsKey: 'test-key', ttsVoice: '' });
    window.dispatchEvent(new CustomEvent('ait:settings-updated'));
  });

  const skitItem = page.locator('.skit-item', { hasText: 'Careful What You Wish For — Remix' });
  const skitId = await skitItem.getAttribute('data-id');
  await skitItem.click();
  const castCards = page.locator('.cast-member');
  await expect(castCards).toHaveCount(2);
  await expect(castCards.first()).toHaveAttribute('data-voice-ready', '1');
  await expect(castCards.first().locator('.cast-portrait')).toBeVisible();
  await expect(castCards.first().locator('.cast-voice-select option[value="onyx"]')).toHaveCount(1);
  await expect(castCards.first().locator('.cast-voice-test')).toBeEnabled();

  const castId = await castCards.first().getAttribute('data-char-id');
  await castCards.first().locator('.cast-voice-select').selectOption('onyx');
  await expect(page.locator('#skit-save-btn')).toHaveClass(/dirty/);
  await page.locator('#skit-save-btn').click();
  await expect(page.locator('#skit-save-btn')).not.toHaveClass(/dirty/);

  const savedCharacter = await page.evaluate(async ({ skitId, castId }) => {
    const skit = await window.backend.getSkit(skitId);
    return skit.cast[castId];
  }, { skitId, castId });
  expect(savedCharacter.voiceAssignments?.['cloud:openai']?.id).toBe('onyx');
});

test('custom TTS can load a hosted server voice list through the private relay', async ({ page }) => {
  const upstream = http.createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ voices: [{ id: 'local-narrator', name: 'Local Narrator' }, { voice_id: 'local-comic', name: 'Local Comic' }] }));
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const port = upstream.address().port;

  try {
    await page.addInitScript(() => localStorage.setItem('ait-welcome-dismissed', '1'));
    await page.goto('/editor?mode=browser');
    const voices = await page.evaluate(async ({ port }) => window.AITTtsProvider.listAvailableVoices({
      ttsMode: 'custom',
      ttsCustomPreset: 'openai-compatible',
      ttsCustomLocation: 'hosted',
      ttsVoicesEndpoint: `http://127.0.0.1:${port}/voices`
    }), { port });
    expect(voices).toEqual([
      { id: 'local-narrator', name: 'Local Narrator', description: '' },
      { id: 'local-comic', name: 'Local Comic', description: '' }
    ]);
  } finally {
    await new Promise(resolve => upstream.close(resolve));
  }
});

test('an OpenAI-compatible local TTS receives the selected character voice', async ({ page }) => {
  let received = null;
  const upstream = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      received = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      response.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      response.end('test-mp3');
    });
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const port = upstream.address().port;

  try {
    await page.addInitScript(() => localStorage.setItem('ait-welcome-dismissed', '1'));
    await page.goto('/editor?mode=browser');
    const result = await page.evaluate(async ({ port }) => {
      const blob = await window.AITTtsProvider.generateSpeech('Read this line.', 'local-comic', {
        ttsMode: 'custom',
        ttsCustomLocation: 'local',
        ttsCustomPreset: 'openai-compatible',
        ttsCustomModel: 'kokoro',
        ttsEndpoint: `http://127.0.0.1:${port}/v1/audio/speech`
      });
      return { size: blob.size, type: blob.type };
    }, { port });
    expect(result).toEqual({ size: 8, type: 'audio/mpeg' });
    expect(received).toMatchObject({ model: 'kokoro', input: 'Read this line.', voice: 'local-comic' });
  } finally {
    await new Promise(resolve => upstream.close(resolve));
  }
});

test('the private TTS relay reaches a non-CORS JSON server and returns its audio', async ({ page }) => {
  let received = null;
  const upstream = http.createServer((request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      received = {
        url: request.url,
        token: request.headers['x-watch-token'],
        body: JSON.parse(Buffer.concat(chunks).toString('utf8'))
      };
      response.writeHead(200, { 'Content-Type': 'audio/wav' });
      response.end('test-wave');
    });
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const port = upstream.address().port;

  try {
    await page.addInitScript(() => localStorage.setItem('ait-welcome-dismissed', '1'));
    await page.goto('/editor?mode=browser');
    const result = await page.evaluate(async ({ port }) => {
      const blob = await window.AITTtsProvider.generateSpeech(
        'Relay this line.',
        'alba',
        {
          ttsMode: 'custom',
          ttsCustomPreset: 'hermes-piper',
          ttsEndpoint: `http://127.0.0.1:${port}`,
          ttsAuthHeader: 'X-Watch-Token',
          ttsAuthToken: 'relay-test-token'
        }
      );
      return { size: blob.size, type: blob.type };
    }, { port });

    expect(result).toEqual({ size: 9, type: 'audio/wav' });
    expect(received).toEqual({
      url: '/tts?wav=1',
      token: 'relay-test-token',
      body: { text: 'Relay this line.', voice: 'alba', rate: 16000, depth: 16, format: 'linear' }
    });
  } finally {
    await new Promise(resolve => upstream.close(resolve));
  }
});

test('the OpenAI browser adapter uses the Responses API and extracts text output', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ait-welcome-dismissed', '1'));
  await page.goto('/editor?mode=browser');

  const result = await page.evaluate(async () => {
    let captured = null;
    const fetchStub = async (url, init) => {
      captured = { url, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({
        output: [{ content: [{ type: 'output_text', text: '<svg viewBox="0 0 100 150"></svg>' }] }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const text = await window.AITAiProvider.callLLM(
      'Return SVG.',
      'Draw a pelican.',
      { provider: 'openai', apiKey: 'sk-test-only', model: 'gpt-5.6-terra' },
      fetchStub
    );
    return { text, captured };
  });

  expect(result.text).toContain('<svg');
  expect(result.captured.url).toBe('https://api.openai.com/v1/responses');
  expect(result.captured.body.model).toBe('gpt-5.6-terra');
  expect(result.captured.body.instructions).toBe('Return SVG.');
  expect(result.captured.body.max_output_tokens).toBe(16384);
});

test('the first wizard screen fits a phone viewport and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/editor?mode=browser');

  const wizard = page.locator('#ait-onboarding');
  await expect(wizard).toBeVisible();
  await expect(wizard.locator('#ait-wizard-footer')).toBeHidden();
  const box = await wizard.locator('.ait-dialog').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(wizard).toBeHidden();
});
