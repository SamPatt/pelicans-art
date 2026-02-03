import { Router } from 'express';
import { listBackgrounds, getBackground } from '../services/storage.js';

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

export default router;
