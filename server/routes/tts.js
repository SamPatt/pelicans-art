import { Router } from 'express';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { HERMES_TTS_TOKEN, HERMES_TTS_URL, HERMES_TTS_AUTH_HEADER, TTS_URL } from '../config.js';

import { proxyAuthHeaders } from '../services/tts-auth.js';

const router = Router();

function normalizeVoiceList(payload) {
  const list = Array.isArray(payload) ? payload : (payload?.voices || payload?.data || []);
  return (Array.isArray(list) ? list : []).map((voice) => {
    if (!voice) return null;
    if (typeof voice === 'string') return { id: voice, name: voice };
    const id = voice.id || voice.voice_id || voice.name;
    return id ? { id, name: voice.name || voice.display_name || id, description: voice.description || '' } : null;
  }).filter(Boolean);
}

// Available voices from Pocket TTS
const VOICES = [
  { id: 'alba', description: 'Neutral voice', gender: 'neutral' },
  { id: 'marius', description: 'Male voice', gender: 'male' },
  { id: 'javert', description: 'Male voice (deeper)', gender: 'male' },
  { id: 'jean', description: 'Male voice', gender: 'male' },
  { id: 'fantine', description: 'Female voice', gender: 'female' },
  { id: 'cosette', description: 'Female voice (younger)', gender: 'female' },
  { id: 'eponine', description: 'Female voice', gender: 'female' },
  { id: 'azelma', description: 'Female voice', gender: 'female' }
];

/**
 * GET /api/tts/voices
 * List available TTS voices
 */
router.get('/voices', (req, res) => {
  res.json(VOICES);
});

/**
 * POST /api/tts/proxy
 * Relay a user-configured TTS endpoint from the private local studio.
 * This is intentionally part of the trusted authoring server, not the public
 * static deployment. It enables tailnet services and servers without CORS.
 */
router.post('/proxy/voices', async (req, res) => {
  const { endpoint, authHeader = '', authToken = '' } = req.body || {};
  let target;
  try {
    target = new URL(endpoint);
  } catch (_) {
    return res.status(400).json({ error: true, message: 'Voice list URL must be valid.' });
  }
  if (!['http:', 'https:'].includes(target.protocol)) return res.status(400).json({ error: true, message: 'Voice list URL must use HTTP or HTTPS.' });
  if (authHeader && !/^[A-Za-z0-9-]{1,64}$/.test(authHeader)) return res.status(400).json({ error: true, message: 'Authentication header contains invalid characters.' });
  const headers = {};
  if (authHeader && authToken) headers[authHeader] = authToken;
  try {
    const response = await fetch(target, { headers, redirect: 'error', signal: AbortSignal.timeout(15_000), size: 1024 * 1024 });
    if (!response.ok) return res.status(502).json({ error: true, message: `Voice list endpoint returned ${response.status}` });
    return res.json(normalizeVoiceList(await response.json()));
  } catch (_) {
    return res.status(502).json({ error: true, message: 'Voice list endpoint could not be reached.' });
  }
});

router.post('/proxy', async (req, res) => {
  const {
    endpoint,
    preset = 'generic-form',
    text,
    voice = '',
    pitch = 1,
    rate = 1,
    volume = 1,
    authHeader = '',
    authToken = '',
    model = ''
  } = req.body || {};

  if (typeof text !== 'string' || !text.trim() || text.length > 1000) {
    return res.status(400).json({ error: true, message: 'Test text must be between 1 and 1000 characters.' });
  }

  let target;
  try {
    target = new URL(endpoint);
  } catch (_) {
    return res.status(400).json({ error: true, message: 'Endpoint must be a valid URL.' });
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    return res.status(400).json({ error: true, message: 'Endpoint must use HTTP or HTTPS.' });
  }
  if (authHeader && !/^[A-Za-z0-9-]{1,64}$/.test(authHeader)) {
    return res.status(400).json({ error: true, message: 'Authentication header contains invalid characters.' });
  }
  if (!['openai-compatible', 'hermes-piper', 'generic-json', 'generic-form'].includes(preset)) {
    return res.status(400).json({ error: true, message: 'Unsupported custom TTS preset.' });
  }

  const headers = proxyAuthHeaders({ target, preset, authHeader, authToken }, { endpoint: HERMES_TTS_URL, token: HERMES_TTS_TOKEN, header: HERMES_TTS_AUTH_HEADER });
  let body;

  if (preset === 'hermes-piper') {
    headers['Content-Type'] = 'application/json';
    // Wire format for a Piper speech relay; configure your service's URL.
    body = JSON.stringify({ text: text.trim(), voice, rate: 16000, depth: 16, format: 'linear' });
  } else if (preset === 'openai-compatible') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ model: model || 'tts-1', input: text.trim(), voice: voice || 'alloy', response_format: 'mp3', speed: rate });
  } else if (preset === 'generic-json') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({ text: text.trim(), voice, pitch, rate, volume });
  } else {
    const formData = new FormData();
    formData.append('text', text.trim());
    formData.append('voice', voice);
    formData.append('voice_url', voice);
    formData.append('pitch', String(pitch));
    formData.append('rate', String(rate));
    formData.append('volume', String(volume));
    Object.assign(headers, formData.getHeaders());
    body = formData;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(target, { method: 'POST', headers, body, signal: controller.signal, redirect: 'error', size: 20 * 1024 * 1024 });
    if (!response.ok) {
      return res.status(502).json({ error: true, message: `TTS endpoint returned ${response.status}` });
    }
    const buffer = await response.arrayBuffer();
    res.set('Content-Type', response.headers.get('content-type') || 'audio/wav');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    const message = error.name === 'AbortError' ? 'TTS endpoint timed out.' : 'TTS endpoint could not be reached.';
    return res.status(502).json({ error: true, message });
  } finally {
    clearTimeout(timeout);
  }
});

/**
 * POST /api/tts
 * Generate TTS audio
 *
 * Body: { text: string, voice: string }
 * Returns: audio/wav
 */
router.post('/', async (req, res, next) => {
  try {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({ error: true, message: 'Text is required' });
    }

    if (!voice) {
      return res.status(400).json({ error: true, message: 'Voice is required' });
    }

    // Add small pause prefix to prevent TTS cutoff on first word
    const paddedText = ', ' + text;

    const formData = new FormData();
    formData.append('text', paddedText);
    formData.append('voice_url', voice);

    const response = await fetch(`${TTS_URL}/tts`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS error:', response.status, errorText);
      return res.status(502).json({
        error: true,
        message: `TTS service error: ${response.status}`
      });
    }

    // Stream the audio response back
    res.set('Content-Type', 'audio/wav');
    response.body.pipe(res);
  } catch (err) {
    console.error('TTS error:', err.code || err.type, err.message);
    if (err.code === 'ECONNREFUSED' || err.errno === 'ECONNREFUSED' || err.type === 'system') {
      return res.status(503).json({
        error: true,
        message: 'TTS service unavailable. Is pocket-tts running?'
      });
    }
    return res.status(500).json({
      error: true,
      message: `TTS error: ${err.message}`
    });
  }
});

/**
 * POST /api/tts/generate
 * Generate TTS and return as base64
 *
 * Body: { text: string, voice: string }
 * Returns: { audio: "data:audio/wav;base64,..." }
 */
router.post('/generate', async (req, res, next) => {
  try {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({ error: true, message: 'Text is required' });
    }

    if (!voice) {
      return res.status(400).json({ error: true, message: 'Voice is required' });
    }

    const paddedText = ', ' + text;

    const formData = new FormData();
    formData.append('text', paddedText);
    formData.append('voice_url', voice);

    const response = await fetch(`${TTS_URL}/tts`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      return res.status(502).json({
        error: true,
        message: `TTS service error: ${response.status}`
      });
    }

    const buffer = await response.buffer();
    const base64 = buffer.toString('base64');

    res.json({
      audio: `data:audio/wav;base64,${base64}`
    });
  } catch (err) {
    console.error('TTS generate error:', err.code || err.type, err.message);
    if (err.code === 'ECONNREFUSED' || err.errno === 'ECONNREFUSED' || err.type === 'system') {
      return res.status(503).json({
        error: true,
        message: 'TTS service unavailable. Is pocket-tts running?'
      });
    }
    return res.status(500).json({
      error: true,
      message: `TTS error: ${err.message}`
    });
  }
});

/**
 * GET /api/tts/health
 * Check if TTS service is available
 */
router.get('/health', async (req, res) => {
  try {
    const response = await fetch(`${TTS_URL}/`, { method: 'GET' });
    res.json({
      available: response.ok,
      url: TTS_URL
    });
  } catch (err) {
    res.json({
      available: false,
      url: TTS_URL,
      error: err.message
    });
  }
});

export default router;
