import { Router } from 'express';
import {
  listBackgrounds,
  getBackground,
  saveBackground,
  deleteBackground
} from '../services/storage.js';

const router = Router();

/**
 * GET /api/backgrounds
 * List available backgrounds
 */
router.get('/', async (req, res, next) => {
  try {
    const backgrounds = await listBackgrounds();
    res.json(backgrounds);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/backgrounds/:name
 * Get background SVG content
 */
router.get('/:name', async (req, res, next) => {
  try {
    const svg = await getBackground(req.params.name);
    res.type('image/svg+xml').send(svg);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/backgrounds
 * Create new background
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, svg } = req.body;

    if (!name) {
      return res.status(400).json({ error: true, message: 'Background name is required' });
    }

    if (!svg) {
      return res.status(400).json({ error: true, message: 'SVG content is required' });
    }

    // Check if name is valid (lowercase, hyphens, no special chars)
    if (!/^[a-z0-9-]+$/.test(name)) {
      return res.status(400).json({
        error: true,
        message: 'Background name must be lowercase alphanumeric with hyphens only'
      });
    }

    const result = await saveBackground(name, svg);

    // Broadcast update via WebSocket
    const wss = req.app.get('wss');
    if (wss?.broadcast) {
      wss.broadcast({ type: 'background:created', name });
    }

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/backgrounds/:name
 * Update background SVG
 */
router.put('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const { svg } = req.body;

    if (!svg) {
      return res.status(400).json({ error: true, message: 'SVG content is required' });
    }

    const result = await saveBackground(name, svg);

    // Broadcast update via WebSocket
    const wss = req.app.get('wss');
    if (wss?.broadcast) {
      wss.broadcast({ type: 'background:updated', name });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/backgrounds/:name
 * Delete a background
 */
router.delete('/:name', async (req, res, next) => {
  try {
    await deleteBackground(req.params.name);

    // Broadcast deletion via WebSocket
    const wss = req.app.get('wss');
    if (wss?.broadcast) {
      wss.broadcast({ type: 'background:deleted', name: req.params.name });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
