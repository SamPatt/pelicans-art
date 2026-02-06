import { Router } from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { createWriteStream, createReadStream } from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { TTS_URL, DATA_DIR } from '../config.js';
import {
  listVoices,
  getVoice,
  saveVoice,
  deleteVoice,
  getVoicePath,
  voiceFileExists,
  getVoicesDir
} from '../services/storage.js';

const router = Router();

// Validate voice name to prevent path traversal
const VOICE_NAME_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function validateVoiceName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Voice name is required' };
  }
  // Reject any path traversal attempts
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return { valid: false, error: 'Invalid voice name' };
  }
  // Ensure name matches allowed pattern
  if (!VOICE_NAME_REGEX.test(name)) {
    return { valid: false, error: 'Voice name must be lowercase alphanumeric with hyphens/underscores, 1-64 chars' };
  }
  return { valid: true };
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'];
    if (allowedMimes.includes(file.mimetype) ||
        file.originalname.endsWith('.wav') ||
        file.originalname.endsWith('.mp3')) {
      cb(null, true);
    } else {
      cb(new Error('Only WAV and MP3 files are allowed'));
    }
  }
});

/**
 * GET /api/voice/list
 * List all custom voices
 */
router.get('/list', async (req, res, next) => {
  try {
    const voices = await listVoices();
    res.json(voices);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/voice/:name
 * Get voice metadata
 */
router.get('/:name', async (req, res, next) => {
  try {
    const validation = validateVoiceName(req.params.name);
    if (!validation.valid) {
      return res.status(400).json({ error: true, message: validation.error });
    }
    const voice = await getVoice(req.params.name);
    res.json(voice);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/voice/:name/file
 * Serve the safetensors file for a voice
 */
router.get('/:name/file', async (req, res, next) => {
  try {
    const name = req.params.name;
    const validation = validateVoiceName(name);
    if (!validation.valid) {
      return res.status(400).json({ error: true, message: validation.error });
    }
    const filePath = getVoicePath(name);

    if (!await voiceFileExists(name)) {
      return res.status(404).json({ error: true, message: 'Voice file not found' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${name}.safetensors"`);

    const stream = createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/voice/analyze
 * Analyze uploaded audio and return waveform data + suggested segment
 *
 * Expects multipart/form-data with 'audio' file field
 * Returns: { duration, sampleRate, waveform[], suggestedStart, suggestedEnd, quality }
 */
router.post('/analyze', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No audio file provided' });
    }

    const audioBuffer = req.file.buffer;

    // Analyze the audio buffer
    const analysis = await analyzeAudio(audioBuffer, req.file.mimetype);

    res.json(analysis);
  } catch (err) {
    console.error('Audio analysis error:', err);
    next(err);
  }
});

/**
 * POST /api/voice/process
 * Process audio segment and create safetensors voice file
 *
 * Body: { audio: base64, start: seconds, end: seconds, name: string }
 * Returns: { name, url }
 */
router.post('/process', async (req, res, next) => {
  try {
    const { audio, start, end, name, displayName } = req.body;

    if (!audio) {
      return res.status(400).json({ error: true, message: 'No audio data provided' });
    }

    if (!name) {
      return res.status(400).json({ error: true, message: 'Voice name is required' });
    }

    // Validate name (alphanumeric, hyphens, underscores only)
    const safeName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!safeName) {
      return res.status(400).json({ error: true, message: 'Invalid voice name' });
    }

    // Check if voice already exists
    try {
      await getVoice(safeName);
      return res.status(409).json({ error: true, message: 'Voice with this name already exists' });
    } catch (e) {
      // Voice doesn't exist, good to proceed
    }

    // Decode base64 audio - handle various data URL formats
    // Matches: data:audio/*, data:application/*, or raw base64
    const base64Data = audio.replace(/^data:[^;]+;base64,/, '');
    const audioBuffer = Buffer.from(base64Data, 'base64');

    // Get voices directory
    const voicesDir = getVoicesDir();
    const tempInputPath = path.join(voicesDir, `${safeName}_temp_input.wav`);
    const tempTrimmedPath = path.join(voicesDir, `${safeName}_temp_trimmed.wav`);
    const outputPath = getVoicePath(safeName);

    try {
      // Write input audio to temp file
      await fs.writeFile(tempInputPath, audioBuffer);

      // Trim and process with ffmpeg
      const trimStart = start || 0;
      const duration = (end || 15) - trimStart;

      await runFfmpeg([
        '-i', tempInputPath,
        '-ss', String(trimStart),
        '-t', String(Math.min(duration, 15)), // Max 15 seconds
        '-af', 'loudnorm,highpass=f=80,lowpass=f=8000',
        '-ar', '24000',
        '-ac', '1',
        '-y',
        tempTrimmedPath
      ]);

      // Run pocket-tts export-voice
      await runPocketTtsExport(tempTrimmedPath, outputPath);

      // Save voice metadata
      await saveVoice(safeName, {
        displayName: displayName || name,
        createdAt: new Date().toISOString(),
        sourceFile: 'uploaded-audio'
      });

      // Get the server URL for the voice file
      const voiceUrl = `/api/voice/${safeName}/file`;

      res.json({
        name: safeName,
        displayName: displayName || name,
        url: voiceUrl
      });

    } finally {
      // Cleanup temp files
      try { await fs.unlink(tempInputPath); } catch (e) {}
      try { await fs.unlink(tempTrimmedPath); } catch (e) {}
    }
  } catch (err) {
    console.error('Voice processing error:', err);
    next(err);
  }
});

/**
 * POST /api/voice/preview
 * Generate TTS preview with a processed voice
 *
 * Body: { voice: string (name or URL), text: string }
 * Returns: audio/wav
 */
router.post('/preview', async (req, res, next) => {
  try {
    const { voice, text } = req.body;

    if (!voice) {
      return res.status(400).json({ error: true, message: 'Voice is required' });
    }

    if (!text) {
      return res.status(400).json({ error: true, message: 'Text is required' });
    }

    // Determine voice URL
    let voiceUrl = voice;
    if (!voice.startsWith('http') && !voice.startsWith('/')) {
      // It's a voice name - validate to prevent path traversal
      const validation = validateVoiceName(voice);
      if (!validation.valid) {
        return res.status(400).json({ error: true, message: validation.error });
      }
      const filePath = getVoicePath(voice);
      if (!await voiceFileExists(voice)) {
        return res.status(404).json({ error: true, message: 'Voice not found' });
      }
      // Use file:// URL for local TTS server
      voiceUrl = `file://${filePath}`;
    }

    // Add small pause prefix to prevent TTS cutoff
    const paddedText = ', ' + text;

    const formData = new FormData();
    formData.append('text', paddedText);
    formData.append('voice_url', voiceUrl);

    const response = await fetch(`${TTS_URL}/tts`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS preview error:', response.status, errorText);
      return res.status(502).json({
        error: true,
        message: `TTS service error: ${response.status}`
      });
    }

    res.set('Content-Type', 'audio/wav');
    response.body.pipe(res);
  } catch (err) {
    console.error('Voice preview error:', err);
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: true,
        message: 'TTS service unavailable'
      });
    }
    next(err);
  }
});

/**
 * DELETE /api/voice/:name
 * Delete a custom voice
 */
router.delete('/:name', async (req, res, next) => {
  try {
    const validation = validateVoiceName(req.params.name);
    if (!validation.valid) {
      return res.status(400).json({ error: true, message: validation.error });
    }
    await deleteVoice(req.params.name);
    res.json({ ok: true, deleted: req.params.name });
  } catch (err) {
    next(err);
  }
});

// === Helper Functions ===

/**
 * Analyze audio buffer and return waveform data + quality metrics
 */
async function analyzeAudio(buffer, mimeType) {
  // Write buffer to temp file for ffprobe/ffmpeg analysis
  const tempPath = path.join(DATA_DIR, 'voices', `temp_analyze_${Date.now()}.audio`);
  const tempWavPath = path.join(DATA_DIR, 'voices', `temp_analyze_${Date.now()}.wav`);

  try {
    await fs.writeFile(tempPath, buffer);

    // Convert to WAV for consistent analysis
    await runFfmpeg([
      '-i', tempPath,
      '-ar', '24000',
      '-ac', '1',
      '-y',
      tempWavPath
    ]);

    // Get duration using ffprobe
    const durationInfo = await runFfprobe(tempWavPath);
    const duration = parseFloat(durationInfo.duration) || 0;
    const sampleRate = parseInt(durationInfo.sample_rate) || 24000;

    // Read WAV file and compute waveform
    const wavBuffer = await fs.readFile(tempWavPath);
    const waveformData = computeWaveform(wavBuffer, 200); // 200 points for visualization

    // Analyze quality and find best segment
    const qualityAnalysis = analyzeQuality(wavBuffer, sampleRate);

    // Find best 15-second segment
    const { suggestedStart, suggestedEnd, segmentScore } = findBestSegment(
      qualityAnalysis.chunks,
      duration,
      15 // target 15 seconds
    );

    return {
      duration,
      sampleRate,
      waveform: waveformData,
      suggestedStart,
      suggestedEnd,
      quality: {
        avgRms: qualityAnalysis.avgRms,
        clippingCount: qualityAnalysis.clippingCount,
        silenceRatio: qualityAnalysis.silenceRatio,
        segmentScore
      }
    };
  } finally {
    try { await fs.unlink(tempPath); } catch (e) {}
    try { await fs.unlink(tempWavPath); } catch (e) {}
  }
}

/**
 * Compute waveform visualization data from WAV buffer
 */
function computeWaveform(wavBuffer, numPoints) {
  // Skip WAV header (44 bytes for standard WAV)
  const headerSize = 44;
  const samples = new Int16Array(
    wavBuffer.buffer,
    wavBuffer.byteOffset + headerSize,
    (wavBuffer.length - headerSize) / 2
  );

  const samplesPerPoint = Math.floor(samples.length / numPoints);
  const waveform = [];

  for (let i = 0; i < numPoints; i++) {
    const start = i * samplesPerPoint;
    const end = Math.min(start + samplesPerPoint, samples.length);

    let max = 0;
    for (let j = start; j < end; j++) {
      const absVal = Math.abs(samples[j]);
      if (absVal > max) max = absVal;
    }

    // Normalize to 0-1 range
    waveform.push(max / 32768);
  }

  return waveform;
}

/**
 * Analyze audio quality in 1-second chunks
 */
function analyzeQuality(wavBuffer, sampleRate) {
  const headerSize = 44;
  const samples = new Int16Array(
    wavBuffer.buffer,
    wavBuffer.byteOffset + headerSize,
    (wavBuffer.length - headerSize) / 2
  );

  const chunkSize = sampleRate; // 1 second chunks
  const chunks = [];
  let totalRms = 0;
  let totalClipping = 0;
  let totalSilence = 0;

  for (let i = 0; i < samples.length; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, samples.length);
    const chunkSamples = samples.slice(i, chunkEnd);

    // Calculate RMS
    let sumSquares = 0;
    let clipping = 0;
    let silentSamples = 0;

    for (let j = 0; j < chunkSamples.length; j++) {
      const sample = chunkSamples[j];
      sumSquares += sample * sample;

      if (Math.abs(sample) >= 32700) clipping++;
      if (Math.abs(sample) < 500) silentSamples++;
    }

    const rms = Math.sqrt(sumSquares / chunkSamples.length) / 32768;
    const silenceRatio = silentSamples / chunkSamples.length;

    chunks.push({
      start: i / sampleRate,
      rms,
      clipping,
      silenceRatio
    });

    totalRms += rms;
    totalClipping += clipping;
    totalSilence += silenceRatio;
  }

  return {
    chunks,
    avgRms: totalRms / chunks.length,
    clippingCount: totalClipping,
    silenceRatio: totalSilence / chunks.length
  };
}

/**
 * Find the best segment of target duration
 */
function findBestSegment(chunks, totalDuration, targetDuration) {
  if (totalDuration <= targetDuration) {
    return {
      suggestedStart: 0,
      suggestedEnd: totalDuration,
      segmentScore: 1
    };
  }

  let bestScore = -Infinity;
  let bestStart = 0;

  // Slide window to find best segment
  for (let start = 0; start <= totalDuration - targetDuration; start += 0.5) {
    const end = start + targetDuration;

    // Score chunks in this window
    let score = 0;
    let count = 0;

    for (const chunk of chunks) {
      if (chunk.start >= start && chunk.start < end) {
        // Higher RMS is better, less clipping and silence is better
        const chunkScore = chunk.rms * 100 - chunk.clipping * 10 - chunk.silenceRatio * 50;
        score += chunkScore;
        count++;
      }
    }

    if (count > 0) {
      score /= count;
      if (score > bestScore) {
        bestScore = score;
        bestStart = start;
      }
    }
  }

  return {
    suggestedStart: bestStart,
    suggestedEnd: bestStart + targetDuration,
    segmentScore: bestScore
  };
}

/**
 * Run ffmpeg with given arguments
 */
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to run ffmpeg: ${err.message}`));
    });
  });
}

/**
 * Run ffprobe to get audio file info
 */
function runFfprobe(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      filePath
    ];

    const proc = spawn('ffprobe', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    proc.stdout.on('data', (data) => { stdout += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(stdout);
          const audioStream = info.streams?.find(s => s.codec_type === 'audio');
          resolve({
            duration: audioStream?.duration || '0',
            sample_rate: audioStream?.sample_rate || '24000'
          });
        } catch (e) {
          resolve({ duration: '0', sample_rate: '24000' });
        }
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to run ffprobe: ${err.message}`));
    });
  });
}

/**
 * Run pocket-tts export-voice to create safetensors
 */
function runPocketTtsExport(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      'export-voice',
      inputPath,
      outputPath,
      '--truncate'
    ];

    const proc = spawn('pocket-tts', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pocket-tts export-voice exited with code ${code}: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to run pocket-tts: ${err.message}`));
    });
  });
}

export default router;
