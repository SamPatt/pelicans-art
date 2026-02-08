(function initAiProvider(global) {
  async function parseError(response) {
    try {
      const json = await response.json();
      return json.error?.message || json.message || JSON.stringify(json);
    } catch (_) {
      return await response.text();
    }
  }

  async function callOpenAICompatible({ baseUrl, apiKey, model, systemPrompt, userPrompt, extraHeaders = {}, fetchImpl = fetch }) {
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders
      },
      body: JSON.stringify({
        model,
        temperature: 0.6,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`AI request failed (${response.status}): ${await parseError(response)}`);
    }

    const json = await response.json();
    return json?.choices?.[0]?.message?.content || '';
  }

  async function callAnthropic({ apiKey, model, systemPrompt, userPrompt, fetchImpl = fetch }) {
    const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-dangerous-direct-browser-access': 'true',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 3000,
        temperature: 0.6,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed (${response.status}): ${await parseError(response)}`);
    }

    const json = await response.json();
    const textBlock = (json.content || []).find((b) => b.type === 'text');
    return textBlock?.text || '';
  }

  async function callLLM(systemPrompt, userPrompt, settings, fetchImpl = fetch) {
    const provider = settings?.provider || 'openrouter';
    const apiKey = settings?.apiKey || '';
    const model = settings?.model || (provider === 'openai' ? 'gpt-4o' : provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'anthropic/claude-sonnet-4');

    if (!apiKey) {
      throw new Error('Missing AI API key. Open Settings and configure your provider key.');
    }

    if (provider === 'openrouter') {
      return callOpenAICompatible({
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey,
        model,
        systemPrompt,
        userPrompt,
        extraHeaders: {
          'HTTP-Referer': location.origin,
          'X-Title': 'AI Improv Theater'
        },
        fetchImpl
      });
    }

    if (provider === 'openai') {
      return callOpenAICompatible({
        baseUrl: 'https://api.openai.com/v1',
        apiKey,
        model,
        systemPrompt,
        userPrompt,
        fetchImpl
      });
    }

    if (provider === 'anthropic') {
      return callAnthropic({ apiKey, model, systemPrompt, userPrompt, fetchImpl });
    }

    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  async function validateKey(provider, key, fetchImpl = fetch) {
    if (!key) return { ok: false, message: 'Missing key' };
    try {
      if (provider === 'openrouter') {
        const r = await fetchImpl('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${key}` } });
        return r.ok ? { ok: true } : { ok: false, message: `OpenRouter auth failed (${r.status})` };
      }
      if (provider === 'openai') {
        const r = await fetchImpl('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
        return r.ok ? { ok: true } : { ok: false, message: `OpenAI auth failed (${r.status})` };
      }
      if (provider === 'anthropic') {
        const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-dangerous-direct-browser-access': 'true',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4,
            messages: [{ role: 'user', content: 'ping' }]
          })
        });
        return r.ok ? { ok: true } : { ok: false, message: `Anthropic auth failed (${r.status})` };
      }
      return { ok: false, message: `Unsupported provider: ${provider}` };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  global.AITAiProvider = {
    callLLM,
    validateKey
  };
})(window);
