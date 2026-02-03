import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import { ensureDataDirs } from './services/storage.js';
import { setupWebSocket } from './services/websocket.js';
import spritesRouter from './routes/sprites.js';
import skitsRouter from './routes/skits.js';
import publishRouter from './routes/publish.js';
import ttsRouter from './routes/tts.js';
import backgroundsRouter from './routes/backgrounds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '../src');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');

const app = express();
const server = createServer(app);

// Trust proxy for correct protocol/host behind reverse proxy
app.set('trust proxy', true);

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' })); // Large SVGs can be big

// API routes
app.use('/api/sprites', spritesRouter);
app.use('/api/skits', skitsRouter);
app.use('/api/publish', publishRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/backgrounds', backgroundsRouter);

// Static route aliases
app.get('/player', (req, res) => {
  res.sendFile(path.join(SRC_DIR, 'skit-player-v3.html'));
});

app.get('/editor', (req, res) => {
  res.sendFile(path.join(SRC_DIR, 'sprite-editor.html'));
});

// Static file serving
app.use('/published', express.static(path.join(DATA_DIR, 'published')));
app.use('/sprites', express.static(path.join(SRC_DIR, 'sprites')));
app.use('/backgrounds', express.static(path.join(SRC_DIR, 'backgrounds')));
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

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`SkitKit server running on :${PORT}`);
    console.log(`  Player: http://localhost:${PORT}/player`);
    console.log(`  Editor: http://localhost:${PORT}/editor`);
    console.log(`  API:    http://localhost:${PORT}/api`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app, server };
