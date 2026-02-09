import { Router } from 'express';
import {
  listSprites,
  listSpriteVariants,
  getSprite,
  saveSprite,
  saveSpriteVariant,
  deleteSprite
} from '../services/storage.js';
import { normalizeSprite } from '../middleware/normalize.js';
import {
  validateSpriteSvg,
  validateSpriteMiddleware,
  validateSpriteUpdateMiddleware
} from '../middleware/validate.js';

const router = Router();

/**
 * GET /api/sprites
 * List all sprites
 */
router.get('/', async (req, res, next) => {
  try {
    const sprites = await listSprites();
    res.json(sprites);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sprites/:name
 * Get sprite details + SVG content
 */
router.get('/:name', async (req, res, next) => {
  try {
    const sprite = await getSprite(req.params.name);
    res.json(sprite);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sprites/:name/variants
 * List all available variants for a sprite
 */
router.get('/:name/variants', async (req, res, next) => {
  try {
    const variants = await listSpriteVariants(req.params.name);
    res.json(variants);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sprites
 * Create new sprite
 */
router.post('/',
  normalizeSprite,
  validateSpriteMiddleware,
  async (req, res, next) => {
    try {
      const { name, svg, meta } = req.body;

      if (!name) {
        return res.status(400).json({ error: true, message: 'Sprite name is required' });
      }

      // Check if name is valid (lowercase, hyphens, no special chars)
      if (!/^[a-z0-9-]+$/.test(name)) {
        return res.status(400).json({
          error: true,
          message: 'Sprite name must be lowercase alphanumeric with hyphens only'
        });
      }

      const result = await saveSprite(name, svg, meta || {});

      // Broadcast update via WebSocket
      const wss = req.app.get('wss');
      if (wss?.broadcast) {
        wss.broadcast({ type: 'sprite:created', name, sprite: result });
      }

      res.status(201).json({
        ...result,
        validation: req.spriteValidation
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/sprites/:name
 * Update sprite SVG and/or metadata
 */
router.put('/:name',
  normalizeSprite,
  validateSpriteUpdateMiddleware,
  async (req, res, next) => {
    try {
      const { name } = req.params;
      const { svg, meta } = req.body;

      // Check if sprite exists (will throw 404 if not)
      const existing = await getSprite(name);

      // Use existing svg if not provided (metadata-only update)
      const updatedSvg = svg || existing.svg;
      const result = await saveSprite(name, updatedSvg, meta || existing.meta);

      // Broadcast update via WebSocket
      const wss = req.app.get('wss');
      if (wss?.broadcast) {
        wss.broadcast({ type: 'sprite:updated', name, sprite: result });
      }

      res.json({
        ...result,
        validation: req.spriteValidation
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/sprites/:name
 * Delete a sprite
 */
router.delete('/:name', async (req, res, next) => {
  try {
    await deleteSprite(req.params.name);

    // Broadcast deletion via WebSocket
    const wss = req.app.get('wss');
    if (wss?.broadcast) {
      wss.broadcast({ type: 'sprite:deleted', name: req.params.name });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/sprites/:name/variant/:variant
 * Save a specific variant of a sprite (e.g., front, back, side)
 */
router.put('/:name/variant/:variant', async (req, res, next) => {
  try {
    const { name, variant } = req.params;
    const { svg } = req.body;

    if (!svg) {
      return res.status(400).json({ error: true, message: 'SVG content is required' });
    }

    const result = await saveSpriteVariant(name, variant, svg);

    // Broadcast update via WebSocket
    const wss = req.app.get('wss');
    if (wss?.broadcast) {
      wss.broadcast({ type: 'sprite:updated', name, variant });
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sprites/validate
 * Validate sprite structure without saving
 */
router.post('/validate', (req, res) => {
  const { svg } = req.body;

  if (!svg) {
    return res.status(400).json({ error: true, message: 'SVG content is required' });
  }

  const validation = validateSpriteSvg(svg);
  res.json(validation);
});

export default router;
