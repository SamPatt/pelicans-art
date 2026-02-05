import {
  OPENROUTER_API_KEY, OPENROUTER_BASE_URL,
  OPENCLAW_URL, OPENCLAW_TOKEN, OPENCLAW_AGENT_ID
} from '../config.js';

let modelsCache = null;
let modelsCacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Unified backend dispatcher
 */
export async function callBackend(backendId, model, messages, options = {}) {
  const start = Date.now();
  try {
    let result;
    if (backendId === 'openrouter') {
      result = await callOpenRouter(model, messages, options);
    } else if (backendId === 'openclaw') {
      result = await callOpenClaw(model, messages, options);
    } else {
      throw new Error(`Unknown backend: ${backendId}`);
    }
    return {
      ...result,
      backend: backendId,
      model,
      latencyMs: Date.now() - start,
      error: null
    };
  } catch (err) {
    return {
      content: null,
      backend: backendId,
      model,
      usage: null,
      latencyMs: Date.now() - start,
      error: err.message
    };
  }
}

async function callOpenRouter(model, messages, options) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const temp = Number.isFinite(options.temperature) ? options.temperature : 0.7;
  const maxTok = Number.isFinite(options.maxTokens) ? options.maxTokens : 4096;

  const body = {
    model,
    messages,
    stream: false,
    temperature: temp,
    max_tokens: maxTok
  };

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://svg-prompt-lab.local',
      'X-Title': 'SVG Prompt Lab'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeout || 120000)
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`OpenRouter ${response.status}: ${text}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error('No content in OpenRouter response');
  }

  return {
    content: choice.message.content,
    usage: data.usage || null
  };
}

async function callOpenClaw(model, messages, options) {
  if (!OPENCLAW_TOKEN) {
    throw new Error('OPENCLAW_TOKEN not configured');
  }

  const response = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
      'Content-Type': 'application/json',
      'x-openclaw-agent-id': OPENCLAW_AGENT_ID
    },
    body: JSON.stringify({
      model: model || `openclaw:${OPENCLAW_AGENT_ID}`,
      messages,
      stream: false
    }),
    signal: AbortSignal.timeout(options.timeout || 120000)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenClaw ${response.status}: ${text}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error('No content in OpenClaw response');
  }

  return {
    content: choice.message.content,
    usage: data.usage || null
  };
}

/**
 * List available models from all configured backends
 */
export async function listModels() {
  const models = [];

  // OpenClaw - always available if configured
  if (OPENCLAW_TOKEN) {
    models.push({
      id: `openclaw:${OPENCLAW_AGENT_ID}`,
      name: `OpenClaw (${OPENCLAW_AGENT_ID})`,
      backend: 'openclaw'
    });
  }

  // OpenRouter - fetch model list with caching
  if (OPENROUTER_API_KEY) {
    const now = Date.now();
    if (!modelsCache || now - modelsCacheTime > CACHE_TTL) {
      try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
          headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}` }
        });
        if (response.ok) {
          const data = await response.json();
          modelsCache = data.data || [];
          modelsCacheTime = now;
        }
      } catch (err) {
        console.error('Failed to fetch OpenRouter models:', err.message);
      }
    }

    if (modelsCache) {
      for (const m of modelsCache) {
        models.push({
          id: m.id,
          name: m.name || m.id,
          backend: 'openrouter',
          contextLength: m.context_length,
          pricing: m.pricing
        });
      }
    }
  }

  return models;
}
