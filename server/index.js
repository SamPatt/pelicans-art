// Must be first import to ensure env vars are loaded
import { TTS_URL, PORT, DATA_DIR, CORS_ORIGIN, OPENCLAW_URL, OPENCLAW_TOKEN } from './config.js';

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import fetch from 'node-fetch';

import { ensureDataDirs } from './services/storage.js';
import { setupWebSocket } from './services/websocket.js';
import spritesRouter from './routes/sprites.js';
import skitsRouter from './routes/skits.js';
import publishRouter from './routes/publish.js';
import ttsRouter from './routes/tts.js';
import backgroundsRouter from './routes/backgrounds.js';
import propsRouter from './routes/props.js';
import agentRouter from './routes/agent.js';
import voiceRouter from './routes/voice.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '../src');

const app = express();
const server = createServer(app);

// Trust proxy for correct protocol/host behind reverse proxy
app.set('trust proxy', true);

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '10mb' })); // Large SVGs can be big

// API routes
app.use('/api/sprites', spritesRouter);
app.use('/api/skits', skitsRouter);
app.use('/api/publish', publishRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/backgrounds', backgroundsRouter);
app.use('/api/props', propsRouter);
app.use('/api/agent', agentRouter);
app.use('/api/voice', voiceRouter);

// TTS proxy for legacy player compatibility (forwards /tts/* to TTS server)
app.post('/tts/tts', async (req, res) => {
  try {
    // Forward the raw body to TTS server
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      const response = await fetch(`${TTS_URL}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': req.get('Content-Type')
        },
        body
      });

      if (!response.ok) {
        return res.status(response.status).send(await response.text());
      }

      res.set('Content-Type', 'audio/wav');
      const buffer = await response.buffer();
      res.send(buffer);
    });
  } catch (err) {
    console.error('TTS proxy error:', err);
    res.status(502).json({ error: true, message: 'TTS service unavailable' });
  }
});

// Static route aliases
app.get('/player', (req, res) => {
  res.sendFile(path.join(SRC_DIR, 'skit-player.html'));
});

app.get('/editor', (req, res) => {
  res.sendFile(path.join(SRC_DIR, 'sprite-editor.html'));
});

// Static file serving
app.use('/published', express.static(path.join(DATA_DIR, 'published')));
app.use('/voices', express.static(path.join(DATA_DIR, 'voices')));
app.use('/sprites', express.static(path.join(SRC_DIR, 'sprites')));
app.use('/backgrounds', express.static(path.join(SRC_DIR, 'backgrounds')));
app.use('/props', express.static(path.join(SRC_DIR, 'props')));
app.use('/', express.static(SRC_DIR));

// WebSocket setup
const wss = setupWebSocket(server);

// Make wss available to routes for broadcasting
app.set('wss', wss);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal server error'
  });
});

// Start server
async function start() {
  // Ensure data directories exist
  await ensureDataDirs(DATA_DIR);

  server.listen(PORT, () => {
    console.log(`SkitKit server running on :${PORT}`);
    console.log(`  Player: http://localhost:${PORT}/player`);
    console.log(`  Editor: http://localhost:${PORT}/editor`);
    console.log(`  API:    http://localhost:${PORT}/api`);
    console.log('');
    console.log('Services:');
    console.log(`  TTS:      ${TTS_URL}`);
    console.log(`  OpenClaw: ${OPENCLAW_URL}`);
    if (!OPENCLAW_TOKEN) {
      console.log('  ⚠️  OPENCLAW_TOKEN not set - AI generation will be unavailable');
    }
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app, server };
