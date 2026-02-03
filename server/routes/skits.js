import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  listSkits,
  getSkit,
  saveSkit,
  deleteSkit
} from '../services/storage.js';
import { normalizeSkit } from '../middleware/normalize.js';
import { validateSkit, validateSkitMiddleware } from '../middleware/validate.js';

const router = Router();

/**
 * GET /api/skits
 * List all skits
 */
router.get('/', async (req, res, next) => {
  try {
    const skits = await listSkits();
    res.json(skits);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/skits/:id
 * Get skit details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const skit = await getSkit(req.params.id);
    res.json(skit);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/skits
 * Create new skit
 */
router.post('/',
  normalizeSkit,
  validateSkitMiddleware,
  async (req, res, next) => {
    try {
      const id = uuidv4();
      const skit = req.body;

      const result = await saveSkit(id, skit);

      // Broadcast creation via WebSocket
      const wss = req.app.get('wss');
      if (wss?.broadcast) {
        wss.broadcast({ type: 'skit:created', skitId: id, skit: result });
      }

      res.status(201).json({
        ...result,
        validation: req.skitValidation
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/skits/:id
 * Update skit
 */
router.put('/:id',
  normalizeSkit,
  validateSkitMiddleware,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Check if skit exists
      await getSkit(id);

      const result = await saveSkit(id, req.body);

      // Broadcast update via WebSocket
      const wss = req.app.get('wss');
      if (wss?.broadcast) {
        wss.broadcast({ type: 'skit:updated', skitId: id, skit: result });
      }

      res.json({
        ...result,
        validation: req.skitValidation
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/skits/:id
 * Delete skit
 */
router.delete('/:id', async (req, res, next) => {
  try {
    await deleteSkit(req.params.id);

    // Broadcast deletion via WebSocket
    const wss = req.app.get('wss');
    if (wss?.broadcast) {
      wss.broadcast({ type: 'skit:deleted', skitId: req.params.id });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/skits/:id/validate
 * Validate skit structure
 */
router.post('/:id/validate', async (req, res, next) => {
  try {
    const skit = await getSkit(req.params.id);
    const validation = validateSkit(skit);
    res.json(validation);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/skits/:id/preview
 * Get preview URL for the skit
 */
router.get('/:id/preview', async (req, res, next) => {
  try {
    // Verify skit exists
    await getSkit(req.params.id);

    // Construct preview URL
    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}/player?id=${req.params.id}`;

    res.json({ url });
  } catch (err) {
    next(err);
  }
});

export default router;
