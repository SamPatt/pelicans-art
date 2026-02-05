import { PORT, DATA_DIR } from './config.js';

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';

import templatesRouter from './routes/templates.js';
import experimentsRouter from './routes/experiments.js';
import ratingsRouter from './routes/ratings.js';
import modelsRouter from './routes/models.js';
import referencesRouter from './routes/references.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/templates', templatesRouter);
app.use('/api/experiments', experimentsRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/models', modelsRouter);
app.use('/api/references', referencesRouter);

// Static frontend
app.use('/', express.static(path.join(__dirname, 'public')));

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal server error'
  });
});

async function start() {
  // Ensure data directories
  await fs.mkdir(path.join(DATA_DIR, 'templates'), { recursive: true });
  await fs.mkdir(path.join(DATA_DIR, 'experiments'), { recursive: true });

  app.listen(PORT, () => {
    console.log(`SVG Prompt Lab running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
