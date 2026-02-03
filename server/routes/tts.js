import { Router } from 'express';
import FormData from 'form-data';
import fetch from 'node-fetch';

const router = Router();

const TTS_URL = process.env.TTS_URL || 'http://127.0.0.1:8001';

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
