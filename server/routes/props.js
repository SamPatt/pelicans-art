import { Router } from 'express';
import {
  listProps,
  getProp,
  saveProp,
  deleteProp
} from '../services/storage.js';

const router = Router();

/**
 * GET /api/props
 * List all props with metadata
 */
router.get('/', async (req, res, next) => {
  try {
    const props = await listProps();
    res.json(props);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/props/:name
 * Get prop SVG content + metadata
 */
router.get('/:name', async (req, res, next) => {
  try {
    const prop = await getProp(req.params.name);
    res.json(prop);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/props
 * Create new prop
 * Body: { name, svg, meta? }
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, svg, meta = {} } = req.body;

    if (!name) {
      return res.status(400).json({ error: true, message: 'Prop name is required' });
    }

    if (!svg) {
      return res.status(400).json({ error: true, message: 'SVG content is required' });
    }

    // Check if name is valid (lowercase, hyphens, no special chars)
    if (!/^[a-z0-9-]+$/.test(name)) {
      return res.status(400).json({
        error: true,
        message: 'Prop name must be lowercase alphanumeric with hyphens only'
      });
    }

    const result = await saveProp(name, svg, meta);

    // Broadcast update via WebSocket
    const wss = req.app.get('wss');
    if (wss?.broadcast) {
      wss.broadcast({ type: 'prop:created', name, prop: result });
    }

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/props/:name
 * Update prop SVG and/or metadata
 * Body: { svg?, meta? }
 */
router.put('/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const { svg, meta } = req.body;

    // Check if prop exists (will throw 404 if not)
    const existing = await getProp(name);

    // Use existing values if not provided
    const updatedSvg = svg || existing.svg;
    const updatedMeta = meta || existing.meta;
    const result = await saveProp(name, updatedSvg, updatedMeta);

    // Broadcast update via WebSocket
    const wss = req.app.get('wss');
    if (wss?.broadcast) {
      wss.broadcast({ type: 'prop:updated', name, prop: result });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/props/:name
 * Delete a prop
 */
router.delete('/:name', async (req, res, next) => {
  try {
    await deleteProp(req.params.name);

    // Broadcast deletion via WebSocket
    const wss = req.app.get('wss');
    if (wss?.broadcast) {
      wss.broadcast({ type: 'prop:deleted', name: req.params.name });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
